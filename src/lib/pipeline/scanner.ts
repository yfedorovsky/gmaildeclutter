import { db } from "@/db";
import { scans, emailMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getGmailClient } from "@/lib/gmail/client";
import { listAllMessageIds, batchGetMessageHeaders } from "@/lib/gmail/messages";
import { parseSender } from "@/lib/utils/email-parser";
import { groupBySender } from "./grouper";
import { createId } from "@paralleldrive/cuid2";

export async function scanInbox(userId: string, scanId: string) {
  try {
    // Update status -> scanning
    await db
      .update(scans)
      .set({ status: "scanning", startedAt: new Date() })
      .where(eq(scans.id, scanId));

    const gmail = await getGmailClient(userId);

    // Fetch all message IDs
    const messageIds = await listAllMessageIds(gmail, "after:2024/01/01");

    await db
      .update(scans)
      .set({ totalMessages: messageIds.length })
      .where(eq(scans.id, scanId));

    // Fetch headers in batches
    const headers = await batchGetMessageHeaders(
      gmail,
      messageIds,
      async (processed) => {
        await db
          .update(scans)
          .set({ processedMessages: processed })
          .where(eq(scans.id, scanId));
      }
    );

    // Store email metadata
    const now = new Date();
    const emailRows = headers.map((h) => {
      const sender = parseSender(h.from);
      return {
        id: h.messageId,
        scanId,
        userId,
        threadId: h.threadId,
        senderAddress: sender.address,
        senderName: sender.name,
        senderDomain: sender.domain,
        subject: h.subject,
        labelIds: JSON.stringify(h.labelIds),
        isRead: !h.labelIds.includes("UNREAD"),
        isStarred: h.labelIds.includes("STARRED"),
        listUnsubscribe: h.listUnsubscribe,
        listUnsubscribePost: h.listUnsubscribePost,
        receivedAt: h.date ? new Date(h.date) : null,
        createdAt: now,
      };
    });

    // Insert in batches of 500
    for (let i = 0; i < emailRows.length; i += 500) {
      const batch = emailRows.slice(i, i + 500);
      await db.insert(emailMessages).values(batch).onConflictDoNothing();
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

    // Classification is triggered separately via /api/classify

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(scans)
      .set({ status: "error", errorMessage: message })
      .where(eq(scans.id, scanId));
  }
}
