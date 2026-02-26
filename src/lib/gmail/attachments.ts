import type { gmail_v1 } from "googleapis";
import { listAllMessageIds } from "./messages";
import { gmailRateLimiter } from "./rate-limiter";

export interface LargeAttachmentMessage {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  sizeEstimate: number;
  labelIds: string[];
}

const ATTACHMENT_HEADERS = ["From", "Subject", "Date"];
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;

async function getMessageWithSize(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<LargeAttachmentMessage | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await gmailRateLimiter.acquire(5);

    try {
      const response = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "metadata",
        metadataHeaders: ATTACHMENT_HEADERS,
        fields: "id,threadId,sizeEstimate,labelIds,payload/headers",
      });

      const msg = response.data;
      const headers = msg.payload?.headers;

      const extractHeader = (name: string): string | null => {
        if (!headers) return null;
        const header = headers.find(
          (h) => h.name?.toLowerCase() === name.toLowerCase()
        );
        return header?.value || null;
      };

      return {
        messageId: msg.id || messageId,
        threadId: msg.threadId || "",
        from: extractHeader("From") || "",
        subject: extractHeader("Subject") || "(no subject)",
        date: extractHeader("Date") || "",
        sizeEstimate: msg.sizeEstimate || 0,
        labelIds: msg.labelIds || [],
      };
    } catch (error: unknown) {
      const status =
        error instanceof Object && "code" in error
          ? (error as { code: number }).code
          : 0;

      if (status === 429 && attempt < MAX_RETRIES) {
        await new Promise((r) =>
          setTimeout(r, 2000 * Math.pow(2, attempt))
        );
        continue;
      }
      return null;
    }
  }

  return null;
}

export interface AttachmentSearchResult {
  messages: LargeAttachmentMessage[];
  totalCount: number;
  hasMore: boolean;
}

const PAGE_SIZE = 200;
const MAX_IDS = 1000;

/**
 * Search Gmail for messages with attachments larger than a given threshold.
 * Supports pagination via offset. Returns results sorted by size (largest first)
 * within each page.
 */
export async function searchLargeAttachmentMessages(
  gmail: gmail_v1.Gmail,
  minSizeMB: number,
  offset: number = 0
): Promise<AttachmentSearchResult> {
  const query = `has:attachment larger:${minSizeMB}m`;
  const allIds = await listAllMessageIds(gmail, query, MAX_IDS);
  const totalCount = allIds.length;

  const pageIds = allIds.slice(offset, offset + PAGE_SIZE);
  if (pageIds.length === 0) {
    return { messages: [], totalCount, hasMore: false };
  }

  const results: LargeAttachmentMessage[] = [];

  for (let i = 0; i < pageIds.length; i += BATCH_SIZE) {
    const batch = pageIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((id) => getMessageWithSize(gmail, id))
    );

    for (const result of batchResults) {
      if (result) results.push(result);
    }
  }

  // Sort by size descending (largest first)
  results.sort((a, b) => b.sizeEstimate - a.sizeEstimate);

  return {
    messages: results,
    totalCount,
    hasMore: offset + PAGE_SIZE < totalCount,
  };
}
