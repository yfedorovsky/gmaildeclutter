import type { gmail_v1 } from "googleapis";
import { gmailRateLimiter } from "./rate-limiter";

const MAX_BATCH_SIZE = 1000;

export async function batchModifyMessages(
  gmail: gmail_v1.Gmail,
  messageIds: string[],
  addLabelIds?: string[],
  removeLabelIds?: string[]
): Promise<void> {
  for (let i = 0; i < messageIds.length; i += MAX_BATCH_SIZE) {
    const batch = messageIds.slice(i, i + MAX_BATCH_SIZE);
    await gmailRateLimiter.acquire(50);

    await gmail.users.messages.batchModify({
      userId: "me",
      requestBody: {
        ids: batch,
        addLabelIds: addLabelIds || [],
        removeLabelIds: removeLabelIds || [],
      },
    });
  }
}

export async function batchArchiveMessages(
  gmail: gmail_v1.Gmail,
  messageIds: string[]
): Promise<void> {
  await batchModifyMessages(gmail, messageIds, undefined, ["INBOX"]);
}

export async function batchTrashMessages(
  gmail: gmail_v1.Gmail,
  messageIds: string[]
): Promise<void> {
  for (let i = 0; i < messageIds.length; i += MAX_BATCH_SIZE) {
    const batch = messageIds.slice(i, i + MAX_BATCH_SIZE);
    await gmailRateLimiter.acquire(50);

    await gmail.users.messages.batchModify({
      userId: "me",
      requestBody: {
        ids: batch,
        addLabelIds: ["TRASH"],
        removeLabelIds: ["INBOX"],
      },
    });
  }
}
