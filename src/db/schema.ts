import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

// ============================================================
// AUTH TABLES (required by Auth.js Drizzle Adapter)
// ============================================================

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: integer("email_verified", { mode: "timestamp" }),
  image: text("image"),
});

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    uniqueIndex("provider_account_idx").on(
      table.provider,
      table.providerAccountId
    ),
  ]
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("verification_token_idx").on(table.identifier, table.token),
  ]
);

// ============================================================
// APPLICATION TABLES
// ============================================================

export const scans = sqliteTable("scans", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  totalMessages: integer("total_messages").default(0),
  processedMessages: integer("processed_messages").default(0),
  totalSenders: integer("total_senders").default(0),
  errorMessage: text("error_message"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const emailMessages = sqliteTable(
  "email_messages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastSeenScanId: text("last_seen_scan_id"),
    threadId: text("thread_id"),
    senderAddress: text("sender_address").notNull(),
    senderName: text("sender_name"),
    senderDomain: text("sender_domain").notNull(),
    subject: text("subject"),
    labelIds: text("label_ids"),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    isStarred: integer("is_starred", { mode: "boolean" })
      .notNull()
      .default(false),
    listUnsubscribe: text("list_unsubscribe"),
    listUnsubscribePost: text("list_unsubscribe_post"),
    receivedAt: integer("received_at", { mode: "timestamp" }),
    lastUpdated: integer("last_updated", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("email_sender_idx").on(table.senderAddress),
    index("email_domain_idx").on(table.senderDomain),
    index("email_user_idx").on(table.userId),
    index("email_scan_idx").on(table.lastSeenScanId),
    index("email_user_scan_sender_idx").on(
      table.userId,
      table.lastSeenScanId,
      table.senderAddress
    ),
  ]
);

export const senderProfiles = sqliteTable(
  "sender_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    senderAddress: text("sender_address").notNull(),
    senderName: text("sender_name"),
    senderDomain: text("sender_domain").notNull(),
    totalCount: integer("total_count").notNull().default(0),
    readCount: integer("read_count").notNull().default(0),
    unreadCount: integer("unread_count").notNull().default(0),
    starredCount: integer("starred_count").notNull().default(0),
    openRate: real("open_rate").notNull().default(0),
    sampleSubjects: text("sample_subjects"),
    hasListUnsubscribe: integer("has_list_unsubscribe", {
      mode: "boolean",
    }).default(false),
    listUnsubscribeValue: text("list_unsubscribe_value"),
    listUnsubscribePostValue: text("list_unsubscribe_post_value"),
    oldestEmailAt: integer("oldest_email_at", { mode: "timestamp" }),
    newestEmailAt: integer("newest_email_at", { mode: "timestamp" }),
    avgFrequencyDays: real("avg_frequency_days"),
    category: text("category"),
    categoryConfidence: real("category_confidence"),
    classifiedAt: integer("classified_at", { mode: "timestamp" }),
    clutterScore: real("clutter_score").notNull().default(0),
    userAction: text("user_action"),
    userLabel: text("user_label"),
    actionExecutedAt: integer("action_executed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("sender_user_scan_idx").on(
      table.userId,
      table.scanId,
      table.senderAddress
    ),
    index("sender_clutter_idx").on(table.clutterScore),
    index("sender_category_idx").on(table.category),
  ]
);

export const userPreferences = sqliteTable("user_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  autoArchiveThreshold: integer("auto_archive_threshold").default(80),
  defaultAction: text("default_action").default("archive"),
  excludedDomains: text("excluded_domains"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const actionLog = sqliteTable("action_log", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  senderProfileId: text("sender_profile_id").references(
    () => senderProfiles.id
  ),
  actionType: text("action_type").notNull(),
  targetCount: integer("target_count").notNull(),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================
// JOB QUEUE
// ============================================================

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => [
    index("jobs_status_idx").on(table.status),
    index("jobs_type_idx").on(table.type),
  ]
);
