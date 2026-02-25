# Gmail Declutter

A local-first web app that scans your Gmail inbox, groups emails by sender, classifies them with AI, and helps you bulk archive, trash, label, or unsubscribe.

## Prerequisites

- **Node.js** 20+
- **npm** 10+
- A **Google Cloud** project with the Gmail API enabled
- A **DeepSeek** API key (for AI classification)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your keys:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Google OAuth — create at https://console.cloud.google.com/apis/credentials
# OAuth 2.0 Client ID (type: Web application)
# Authorized redirect URI: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Auth.js session secret — generate with: openssl rand -base64 32
AUTH_SECRET=your-random-secret

# DeepSeek API key — get at https://platform.deepseek.com
DEEPSEEK_API_KEY=your-deepseek-key
```

### 3. Google Cloud setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Enable the **Gmail API** under APIs & Services
4. Create **OAuth 2.0 credentials** (Web application type)
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy the Client ID and Client Secret into `.env.local`

### 4. Initialize the database

```bash
npx drizzle-kit push
```

This creates `local.db` (SQLite) in the project root with all required tables.

## Running

You need **two terminals** — the web app and the background worker:

**Terminal 1 — Next.js dev server:**
```bash
npm run dev
```

**Terminal 2 — Job worker** (processes scan and classification jobs):
```bash
npm run worker
```

Then open [http://localhost:3000](http://localhost:3000).

## How it works

1. **Sign in** with your Google account (grants Gmail read/modify access)
2. **Scan** your inbox — the worker fetches message metadata in streaming batches
3. **Review** sender groups sorted by clutter score (volume, open rate, frequency)
4. **Act** — bulk archive, trash, label, or unsubscribe from senders

## Project structure

```
src/
  app/              # Next.js pages and API routes
    api/
      scan/         # Triggers a scan job
      classify/     # Triggers AI classification
      actions/      # Archive, trash, label, unsubscribe endpoints
      senders/      # Sender profile queries
    dashboard/      # UI pages (senders, cleanup, organize, etc.)
  db/
    schema.ts       # Drizzle ORM schema (SQLite)
    index.ts        # Database connection + pragmas
  lib/
    ai/             # DeepSeek classification (prompts, client)
    gmail/          # Gmail API helpers (messages, batch, labels, rate limiter)
    pipeline/       # Scanner (streaming) and grouper (set-based)
    utils/          # Email parser (MIME decoding), clutter score
  worker/
    index.ts        # Standalone job worker (poll loop, retry, crash recovery)
drizzle/            # Generated SQL migrations
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run worker` | Start background job worker |
| `npm run lint` | Run ESLint |
