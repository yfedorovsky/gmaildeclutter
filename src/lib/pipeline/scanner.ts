import { db } from "@/db";
import { scans, emailMessages } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getGmailClient } from "@/lib/gmail/client";
import { listMessageIdPages, batchGetMessageHeaders } from "@/lib/gmail/messages";
import { parseSender, decodeMimeHeader } from "@/lib/utils/email-parser";
import { groupBySender } from "./grouper";

const CHUNK_SIZE = 500;

export async function scanInbox(userId: string, scanId: string) {
  try {
    await db
      .update(scans)
      .set({ status: "scanning", startedAt: new Date() })
      .where(eq(scans.id, scanId));

    const gmail = await getGmailClient(userId);

    let totalMessagesSeen = 0;
    let processedMessages = 0;

    for await (const idPage of listMessageIdPages(gmail, "after:2024/01/01", CHUNK_SIZE)) {
      totalMessagesSeen += idPage.length;

      await db
        .update(scans)
        .set({ totalMessages: totalMessagesSeen })
        .where(eq(scans.id, scanId));

      const headers = await batchGetMessageHeaders(gmail, idPage);

      const now = new Date();
      const chunkRows = headers.map((h) => {
        const sender = parseSender(h.from);
        return {
          id: h.messageId,
          userId,
          lastSeenScanId: scanId,
          threadId: h.threadId,
          senderAddress: sender.address,
          senderName: sender.name,
          senderDomain: sender.domain,
          subject: decodeMimeHeader(h.subject),
          labelIds: JSON.stringify(h.labelIds),
          isRead: !h.labelIds.includes("UNREAD"),
          isStarred: h.labelIds.includes("STARRED"),
          listUnsubscribe: h.listUnsubscribe,
          listUnsubscribePost: h.listUnsubscribePost,
          receivedAt: h.date ? new Date(h.date) : null,
          lastUpdated: now,
          createdAt: now,
        };
      });

      if (chunkRows.length > 0) {
        await db
          .insert(emailMessages)
          .values(chunkRows)
          .onConflictDoUpdate({
            target: emailMessages.id,
            set: {
              lastSeenScanId: sql`excluded.last_seen_scan_id`,
              lastUpdated: sql`excluded.last_updated`,
              labelIds: sql`excluded.label_ids`,
              isRead: sql`excluded.is_read`,
              isStarred: sql`excluded.is_starred`,
              listUnsubscribe: sql`excluded.list_unsubscribe`,
              listUnsubscribePost: sql`excluded.list_unsubscribe_post`,
            },
          });
      }

      processedMessages += headers.length;
      await db
        .update(scans)
        .set({ processedMessages })
        .where(eq(scans.id, scanId));
    }

    // Group by sender
    await db
      .update(scans)
      .set({ status: "grouping" })
      .where(eq(scans.id, scanId));

    const totalSenders = await groupBySender(userId, scanId);

    await db
      .update(scans)
      .set({
        status: "classifying",
        totalSenders,
      })
      .where(eq(scans.id, scanId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(scans)
      .set({ status: "error", errorMessage: message })
      .where(eq(scans.id, scanId));
  }
}
