import type { gmail_v1 } from "googleapis";
import type { GmailMessageHeader } from "@/types/gmail";
import { gmailRateLimiter } from "./rate-limiter";

const METADATA_HEADERS = [
  "From",
  "Subject",
  "Date",
  "List-Unsubscribe",
  "List-Unsubscribe-Post",
];

/**
 * Async generator that yields pages of message IDs.
 * Each page contains up to `pageSize` IDs (default 500).
 * Never holds more than one page in memory at a time.
 */
export async function* listMessageIdPages(
  gmail: gmail_v1.Gmail,
  query?: string,
  pageSize: number = 500
): AsyncGenerator<string[], void, unknown> {
  let pageToken: string | undefined;

  do {
    await gmailRateLimiter.acquire(5);

    const response = await gmail.users.messages.list({
      userId: "me",
      q: query || "after:2024/01/01",
      maxResults: pageSize,
      pageToken,
    });

    const messages = response.data.messages || [];
    const ids = messages
      .map((msg) => msg.id)
      .filter((id): id is string => !!id);

    if (ids.length > 0) {
      yield ids;
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);
}

/**
 * Backward-compatible wrapper: loads all IDs into memory.
 * Prefer listMessageIdPages for streaming.
 */
export async function listAllMessageIds(
  gmail: gmail_v1.Gmail,
  query?: string,
  maxResults?: number
): Promise<string[]> {
  const all: string[] = [];
  for await (const page of listMessageIdPages(gmail, query)) {
    all.push(...page);
    if (maxResults && all.length >= maxResults) {
      return all.slice(0, maxResults);
    }
  }
  return all;
}

function extractHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string | null {
  if (!headers) return null;
  const header = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return header?.value || null;
}

export async function getMessageHeaders(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<GmailMessageHeader | null> {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await gmailRateLimiter.acquire(5);

    try {
      const response = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "metadata",
        metadataHeaders: METADATA_HEADERS,
      });

      const msg = response.data;
      const headers = msg.payload?.headers;

      return {
        messageId: msg.id || messageId,
        threadId: msg.threadId || "",
        from: extractHeader(headers, "From") || "",
        subject: extractHeader(headers, "Subject") || "(no subject)",
        date: extractHeader(headers, "Date") || "",
        labelIds: msg.labelIds || [],
        listUnsubscribe: extractHeader(headers, "List-Unsubscribe"),
        listUnsubscribePost: extractHeader(headers, "List-Unsubscribe-Post"),
      };
    } catch (error: unknown) {
      const status =
        error instanceof Object && "code" in error
          ? (error as { code: number }).code
          : 0;

      if (status === 429 && attempt < MAX_RETRIES) {
        // Exponential backoff: 2s, 4s, 8s
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

export async function batchGetMessageHeaders(
  gmail: gmail_v1.Gmail,
  messageIds: string[],
  onProgress?: (processed: number) => void
): Promise<GmailMessageHeader[]> {
  const results: GmailMessageHeader[] = [];
  const BATCH_SIZE = 50;

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((id) => getMessageHeaders(gmail, id))
    );

    for (const result of batchResults) {
      if (result) results.push(result);
    }

    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, messageIds.length));
    }
  }

  return results;
}