# Gmail Declutter - Complete Architecture & Implementation Guide

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS v4 + shadcn/ui | Latest |
| Auth | Auth.js (NextAuth v5 beta) | 5.0.0-beta.30 |
| Database | SQLite via better-sqlite3 | 12.6.2 |
| ORM | Drizzle ORM + Drizzle Kit | 0.45.1 |
| AI Classification | DeepSeek V3 (via OpenAI SDK) | deepseek-chat |
| Gmail Integration | googleapis (official Google SDK) | 171.4.0 |
| Charts | Recharts | 3.7.0 |
| Theming | next-themes | 0.4.6 |
| Toasts | Sonner | 2.0.7 |
| IDs | @paralleldrive/cuid2 | 3.3.0 |

---

## Architecture Overview

```
User -> Landing Page (Google OAuth) -> Dashboard
                                          |
                                   [Scan Inbox]
                                          |
                            Gmail API (metadata only)
                                          |
                            SQLite (cache all headers)
                                          |
                        Local Pre-Processor (group by sender)
                                          |
                          DeepSeek API (classify 50 at a time)
                                          |
                              Dashboard (view + act)
```

**Key architectural principle**: Deduplication-first. We never send raw emails to AI. Instead, emails are grouped locally by sender, aggregated into profiles (count, open rate, sample subjects), and only those profiles are sent for classification. This means an inbox of 10,000 emails from 200 senders only needs ~4 DeepSeek API calls.

---

## Database Schema (7 tables)

**File**: `src/db/schema.ts`

### Auth Tables (required by Auth.js Drizzle Adapter)

1. **`users`** - id, name, email, emailVerified, image
2. **`accounts`** - Links to Google OAuth. Stores `access_token`, `refresh_token`, `expires_at`. Critical for Gmail API access.
3. **`sessions`** - Database-backed sessions (sessionToken, userId, expires)
4. **`verification_tokens`** - Token verification (identifier, token, expires)

### Application Tables

5. **`scans`** - Tracks each inbox scan operation
   - Fields: id, userId, status (pending|scanning|grouping|classifying|complete|error), totalMessages, processedMessages, totalSenders, errorMessage, startedAt, completedAt, createdAt

6. **`email_messages`** - Cached email metadata (one row per email)
   - Fields: id (Gmail message ID), scanId, userId, threadId, senderAddress, senderName, senderDomain, subject, labelIds (JSON), isRead, isStarred, listUnsubscribe, listUnsubscribePost, receivedAt, createdAt
   - Indexes on: senderAddress, senderDomain, userId, scanId

7. **`sender_profiles`** - Aggregated sender stats (the central entity for the UI)
   - Aggregated stats: totalCount, readCount, unreadCount, starredCount, openRate
   - Content: sampleSubjects (JSON array of 3 subjects)
   - Unsubscribe: hasListUnsubscribe, listUnsubscribeValue, listUnsubscribePostValue
   - Time-based: oldestEmailAt, newestEmailAt, avgFrequencyDays
   - AI classification: category, categoryConfidence, classifiedAt
   - Computed: clutterScore (0-100)
   - User actions: userAction (keep|unsubscribe|archive|trash), userLabel, actionExecutedAt
   - Unique index on (userId, scanId, senderAddress)

8. **`user_preferences`** - Per-user settings (autoArchiveThreshold, defaultAction, excludedDomains)

9. **`action_log`** - Audit trail of all actions taken (actionType, targetCount, status, metadata)

---

## Authentication Flow

**File**: `src/lib/auth.ts`

1. User clicks "Sign in with Google" on landing page
2. Auth.js redirects to Google OAuth with scopes:
   - `openid email profile`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.labels`
   - `https://www.googleapis.com/auth/gmail.settings.basic`
3. `access_type: "offline"` + `prompt: "consent"` ensures we get a refresh token
4. Tokens stored in `accounts` table via Drizzle Adapter
5. `getAccessToken(userId)` function handles token refresh:
   - Checks `expires_at` against current time
   - If expired, POSTs to `https://oauth2.googleapis.com/token` with refresh_token
   - Updates stored tokens in DB
   - Returns valid access_token

**Middleware** (`middleware.ts`): Protects all `/dashboard/*` and `/api/*` routes (except `/api/auth/*`).

---

## Gmail API Layer (6 files)

**Directory**: `src/lib/gmail/`

### `client.ts`
- `getGmailClient(userId)` - Creates authenticated `gmail_v1.Gmail` instance using stored access_token

### `rate-limiter.ts`
- Token-bucket rate limiter (250 tokens capacity, 250 tokens/sec refill)
- `acquire(cost)` - Async, blocks until tokens available
- Gmail quotas: messages.list = 5 units, messages.get = 5 units, batchModify = 50 units

### `messages.ts`
- `listAllMessageIds(gmail, query?, maxResults?)` - Paginates through `messages.list`, collects all IDs. Default query: `"after:2024/01/01"`
- `getMessageHeaders(gmail, messageId)` - Fetches single message with `format: "metadata"`, extracts From, Subject, Date, List-Unsubscribe, List-Unsubscribe-Post headers
- `batchGetMessageHeaders(gmail, messageIds, onProgress?)` - Processes in batches of 50, calls onProgress callback for UI updates

### `batch.ts`
- `batchModifyMessages(gmail, ids, addLabelIds?, removeLabelIds?)` - Chunks into 1000-ID batches, calls Gmail batchModify
- `batchArchiveMessages(gmail, ids)` - Removes "INBOX" label
- `batchTrashMessages(gmail, ids)` - Adds "TRASH" label, removes "INBOX"

### `labels.ts`
- `listLabels(gmail)` - Returns all user labels
- `createLabel(gmail, name)` - Creates new Gmail label
- `getOrCreateLabel(gmail, name)` - Finds existing or creates new
- `applyLabelToMessages(gmail, ids, labelId)` - Batch applies label

### `filters.ts`
- `createFilter(gmail, from, action)` - Creates Gmail auto-filter (criteria + action)
- `createAutoArchiveFilter(gmail, from, labelId?)` - Skip inbox + optional label

### `unsubscribe.ts`
- `parseListUnsubscribe(headerValue)` - Parses `<mailto:...>, <https://...>` format into structured object
- `executeUnsubscribe(gmail, listUnsubscribe, listUnsubscribePost)` - 4-strategy cascade:
  1. **RFC 8058 one-click POST** (preferred) - POST to HTTP URL with `List-Unsubscribe=One-Click-Unsubscribe`
  2. **HTTP GET** - Follow the unsubscribe link
  3. **Mailto** - Send email to unsubscribe address via Gmail API
  4. **None** - Return failure if no method available

---

## Scan Pipeline (2 files)

**Directory**: `src/lib/pipeline/`

### `scanner.ts` - Orchestrator

`scanInbox(userId, scanId)` flow:
1. Set scan status -> "scanning"
2. Get Gmail client (refresh token if needed)
3. `listAllMessageIds()` with query "after:2024/01/01"
4. Update `scans.totalMessages`
5. `batchGetMessageHeaders()` in batches of 50, with progress callback updating `scans.processedMessages`
6. For each header: parse sender (name, address, domain), determine isRead (absence of UNREAD label), isStarred
7. Insert all rows into `email_messages` table (batches of 500, onConflictDoNothing)
8. Set status -> "grouping"
9. Call `groupBySender()`
10. Set status -> "classifying" (classification triggered separately)
11. On error: set status -> "error" with message

### `grouper.ts` - Aggregation + Scoring

`groupBySender(userId, scanId)` flow:
1. SQL aggregation: `SELECT sender_address, COUNT(*), SUM(isRead), MIN(receivedAt), MAX(receivedAt), MAX(listUnsubscribe IS NOT NULL) GROUP BY sender_address`
2. For each unique sender:
   - Fetch 3 most recent subjects (sample)
   - Fetch first non-null List-Unsubscribe header
   - Compute openRate = readCount / totalCount
   - Compute avgFrequencyDays = (newest - oldest) / (count - 1)
   - Compute clutterScore via formula
3. Insert into `sender_profiles` table

### Clutter Score Formula

**File**: `src/lib/utils/clutter-score.ts`

```
Score = Volume(30%) + OpenRateInverse(35%) + Frequency(25%) + UnsubHeader(10%)

Volume:     min(log10(count+1) / log10(500), 1) * 30
OpenRate:   (1 - openRate) * 35
Frequency:  min(1 / max(avgFrequencyDays, 0.5), 1) * 25
UnsubBonus: hasListUnsubscribe ? 10 : 0

Result: 0-100 (rounded integer, higher = more clutter)
```

### Health Score Formula

**File**: `src/lib/utils/health-score.ts`

- Weighted average of all sender clutter scores, weighted by email count
- `healthScore = 100 - weightedAverageClutter`
- Range: 0-100 (higher = healthier inbox)

---

## AI Classification (3 files)

**Directory**: `src/lib/ai/`

### `deepseek-client.ts`
- Uses OpenAI SDK pointed at `https://api.deepseek.com`
- Model: `deepseek-chat` (DeepSeek V3)

### `prompts.ts`
- System prompt defines 8 categories: newsletter, job_alert, promo, social, transactional, personal, automated, other
- User prompt: JSON array of sender profiles (address, name, domain, count, openRate, 3 sample subjects)
- Response format: `{ classifications: [{ senderAddress, category, confidence }] }`

### `classifier.ts`

`classifyUnclassifiedSenders(scanId)`:
1. Query all sender_profiles where category IS NULL
2. Batch into groups of 50
3. For each batch:
   - Build prompt from sender profile data
   - Call DeepSeek with `response_format: { type: "json_object" }`, `temperature: 0.1`, `max_tokens: 4096`
   - Parse JSON response, validate structure
   - Update each sender_profile with category + confidence + classifiedAt
   - Retry up to 2 times on failure
   - If all retries fail, mark batch as category "other" with confidence 0

---

## API Routes (13 endpoints)

**Directory**: `src/app/api/`

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/auth/[...nextauth]` | Auth.js catch-all handler |
| POST | `/api/scan` | Start inbox scan, returns `{ scanId }`, runs pipeline in background |
| GET | `/api/scan/[scanId]/status` | Poll scan progress (status, totalMessages, processedMessages, totalSenders) |
| GET | `/api/senders?sort=&order=&category=&search=&page=&limit=` | List sender profiles with filtering, sorting, pagination |
| GET | `/api/senders/[senderId]` | Single sender detail |
| PATCH | `/api/senders/[senderId]` | Update user action/label for sender |
| POST | `/api/classify` | Trigger DeepSeek classification for unclassified senders |
| POST | `/api/actions/unsubscribe` | Unsubscribe from sender(s) via List-Unsubscribe |
| POST | `/api/actions/archive` | Archive all emails from sender(s) |
| POST | `/api/actions/trash` | Trash all emails from sender(s) |
| POST | `/api/actions/label` | Apply/create Gmail label for sender(s) |
| GET | `/api/stats` | Dashboard aggregates (healthScore, categories, topClutter, recentActions) |

All routes (except auth) are protected by middleware requiring authenticated session. All action routes accept `{ senderIds: string[] }` and log to `action_log` table.

---

## UI Pages (6 dashboard pages + landing)

### Landing Page (`/`)
- Hero with gradient headline "Take back your inbox"
- 3 feature cards (Mass Unsubscribe, Smart Cleanup, Auto-Organize)
- "Sign in with Google" button
- Redirects to /dashboard if already authenticated

### Dashboard Layout (`/dashboard/layout.tsx`)
- Left sidebar (240px): Navigation links to all 6 pages
- Top bar: Theme toggle (dark/light), user avatar dropdown with sign out
- Sticky positioning, full-height flex layout

### Dashboard Home (`/dashboard`)
- "Scan Inbox" button (starts scan, polls progress every 2s)
- Scan progress card (animated, shows phases: Fetching -> Grouping -> Classifying -> Done)
- 3 stat cards: Health Score (0-100 with color coding), Total Emails, Unique Senders
- Category donut chart (Recharts PieChart with custom tooltip)
- Top 10 Clutter Senders list with category + clutter score badges
- Empty state with CTA when no scans exist
- "Run AI Classification" button when scan is in classifying state

### Senders List (`/dashboard/senders`)
- Full DataTable with sortable columns (Emails, Open Rate, Clutter Score)
- Search input (filters by sender name/address)
- Category dropdown filter
- Checkbox selection with batch action bar (Unsubscribe, Archive, Trash)
- Pagination (50 per page)
- Each row: sender name/email, email count, category badge, open rate %, clutter score badge, action status

### Mass Unsubscribe (`/dashboard/unsubscribe`)
- Pre-filtered list of senders that have List-Unsubscribe headers
- Sorted by clutter score (worst first)
- Select all / individual selection
- Shows: email count, open rate, category, clutter score per sender
- Bulk "Unsubscribe" button with loading states
- Per-sender status icons: checkmark (success), X (failed), spinner (processing)

### Cleanup (`/dashboard/cleanup`)
- Two tabs: Archive / Delete
- Senders grouped by category (collapsible cards)
- Each category card shows: sender count, total email count
- Expand to see individual senders with checkboxes
- Select entire category at once
- Batch Archive or Trash buttons
- Warning note on Delete tab about 30-day recovery

### Organize (`/dashboard/organize`)
- Auto-generated label suggestions based on AI categories:
  - newsletter -> "Newsletters"
  - promo -> "Promotions"
  - social -> "Social Media"
  - transactional -> "Receipts & Notifications"
  - job_alert -> "Job Alerts"
  - automated -> "Automated / System"
- Each suggestion shows: label name, sender count, email count, preview badges of included senders
- "Apply Label" button creates Gmail label + applies to all matching emails
- Success state after applying

### Settings (`/dashboard/settings`)
- Account info (name, email, sign out)
- Re-scan Inbox button
- Danger zone: Clear Local Cache (disabled placeholder)

---

## Shared Components

**Directory**: `src/components/`

- `providers.tsx` - Wraps app in SessionProvider, ThemeProvider, TooltipProvider, Toaster
- `layout/sidebar.tsx` - 6-item nav with active state highlighting (lucide icons)
- `layout/topbar.tsx` - User avatar dropdown, theme toggle
- `layout/theme-toggle.tsx` - Sun/Moon icon toggle using next-themes
- `dashboard/health-score-card.tsx` - Color-coded score (green 80+, yellow 50-79, red <50)
- `dashboard/category-chart.tsx` - Recharts donut chart with 9 color-coded categories
- `dashboard/top-clutter-list.tsx` - Top 10 worst senders with inline stats
- `shared/clutter-score-badge.tsx` - Color-coded badge (red/orange/yellow/green)
- `shared/category-badge.tsx` - Color-coded badge per category with human-readable labels
- `shared/scan-progress.tsx` - Animated progress bar with phase labels
- `ui/*` (18 files) - shadcn/ui primitives: button, card, table, badge, dialog, sheet, dropdown-menu, checkbox, slider, select, input, tabs, progress, avatar, tooltip, separator, skeleton, sonner

---

## Hooks

- `hooks/use-scan-progress.ts` - Polls `/api/scan/[id]/status` every 2 seconds, stops when complete/error

---

## Type Definitions

**Directory**: `src/types/`

- `gmail.ts` - GmailMessageHeader, ParsedSender, GmailLabel, GmailFilter
- `sender.ts` - SenderProfile, UserAction, SenderCategory
- `scan.ts` - ScanStatus, ScanProgress
- `classification.ts` - ClassificationInput, ClassificationResult, ClassificationResponse

---

## File Structure Summary

```
80 files total:
  src/db/            - 2 files (schema + client)
  src/types/         - 4 files
  src/lib/auth.ts    - 1 file
  src/lib/gmail/     - 6 files
  src/lib/pipeline/  - 2 files
  src/lib/ai/        - 3 files
  src/lib/utils/     - 4 files (including shadcn cn utility)
  src/hooks/         - 1 file
  src/app/api/       - 11 route files
  src/app/           - 8 page/layout files (landing + 6 dashboard + layout)
  src/components/    - 21 files (3 layout + 3 dashboard + 3 shared + 18 ui)
  Config files       - 6 (package.json, tsconfig, drizzle.config, middleware, components.json, .env.example)
```

---

## What It Does NOT Do (Scope Boundaries)

- Does **not** read email bodies - only headers (From, Subject, Date, labels, List-Unsubscribe)
- Does **not** use Claude/Sonnet at runtime - only DeepSeek for classification
- Does **not** permanently delete emails - uses Gmail's Trash (30-day recovery)
- Does **not** require any cloud infrastructure - runs entirely local with SQLite
- Does **not** store any email content beyond subject lines (3 samples per sender)

---

## Getting Started

1. Fill in `.env.local` with your Google OAuth credentials and DeepSeek API key
2. Run `npx drizzle-kit push` to create the SQLite database
3. Run `npm run dev`
4. Open `http://localhost:3000` and sign in with Google
5. Click "Scan Inbox" on the dashboard
6. Once scan completes, click "Run AI Classification"
7. Explore senders, unsubscribe, cleanup, and organize
