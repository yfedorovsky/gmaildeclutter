import type { gmail_v1 } from "googleapis";
import type { GmailLabel } from "@/types/gmail";
import { gmailRateLimiter } from "./rate-limiter";
import { batchModifyMessages } from "./batch";

// Module-level label cache with 60s TTL
const labelCache = new Map<
  string,
  { labels: GmailLabel[]; ts: number }
>();
const CACHE_TTL_MS = 60_000;

function getCachedLabels(cacheKey: string): GmailLabel[] | null {
  const entry = labelCache.get(cacheKey);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) {
    return entry.labels;
  }
  labelCache.delete(cacheKey);
  return null;
}

export async function listLabels(
  gmail: gmail_v1.Gmail,
  cacheKey?: string
): Promise<GmailLabel[]> {
  // Check cache if cacheKey provided
  if (cacheKey) {
    const cached = getCachedLabels(cacheKey);
    if (cached) return cached;
  }

  await gmailRateLimiter.acquire(5);

  const response = await gmail.users.labels.list({ userId: "me" });
  const labels = response.data.labels || [];

  const mapped = labels.map((label) => ({
    id: label.id || "",
    name: label.name || "",
    type: label.type === "system" ? ("system" as const) : ("user" as const),
    color: label.color
      ? {
          textColor: label.color.textColor || "",
          backgroundColor: label.color.backgroundColor || "",
        }
      : undefined,
  }));

  // Update cache
  if (cacheKey) {
    labelCache.set(cacheKey, { labels: mapped, ts: Date.now() });
  }

  return mapped;
}

export async function createLabel(
  gmail: gmail_v1.Gmail,
  name: string,
  cacheKey?: string
): Promise<string> {
  await gmailRateLimiter.acquire(5);

  const response = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });

  // Invalidate cache after creating a new label
  if (cacheKey) {
    labelCache.delete(cacheKey);
  }

  return response.data.id || "";
}

export async function getOrCreateLabel(
  gmail: gmail_v1.Gmail,
  name: string,
  cacheKey: string = "default"
): Promise<string> {
  const labels = await listLabels(gmail, cacheKey);
  const existing = labels.find(
    (l) => l.name.toLowerCase() === name.toLowerCase()
  );

  if (existing) return existing.id;
  return createLabel(gmail, name, cacheKey);
}

export async function applyLabelToMessages(
  gmail: gmail_v1.Gmail,
  messageIds: string[],
  labelId: string
): Promise<void> {
  await batchModifyMessages(gmail, messageIds, [labelId]);
}
