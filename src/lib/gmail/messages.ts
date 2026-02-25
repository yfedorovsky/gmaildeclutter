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

export async function listAllMessageIds(
  gmail: gmail_v1.Gmail,
  query?: string,
  maxResults?: number
): Promise<string[]> {
  const messageIds: string[] = [];
  let pageToken: string | undefined;

  do {
    await gmailRateLimiter.acquire(5);

    const response = await gmail.users.messages.list({
      userId: "me",
      q: query || "after:2024/01/01",
      maxResults: 500,
      pageToken,
    });

    const messages = response.data.messages || [];
    for (const msg of messages) {
      if (msg.id) messageIds.push(msg.id);
    }

    pageToken = response.data.nextPageToken || undefined;

    if (maxResults && messageIds.length >= maxResults) {
      return messageIds.slice(0, maxResults);
    }
  } while (pageToken);

  return messageIds;
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
  } catch {
    return null;
  }
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
