import { db } from "@/db";
import { emailMessages, senderProfiles } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { computeClutterScore } from "@/lib/utils/clutter-score";
import { createId } from "@paralleldrive/cuid2";

export async function groupBySender(
  userId: string,
  scanId: string
): Promise<number> {
  // ---- Query 1: Aggregate stats per sender ----
  const groups = await db
    .select({
      senderAddress: emailMessages.senderAddress,
      senderDomain: emailMessages.senderDomain,
      senderName: sql<string>`MAX(${emailMessages.senderName})`,
      totalCount: sql<number>`COUNT(*)`,
      readCount: sql<number>`SUM(CASE WHEN ${emailMessages.isRead} THEN 1 ELSE 0 END)`,
      starredCount: sql<number>`SUM(CASE WHEN ${emailMessages.isStarred} THEN 1 ELSE 0 END)`,
      oldestEmailAt: sql<number | null>`MIN(${emailMessages.receivedAt})`,
      newestEmailAt: sql<number | null>`MAX(${emailMessages.receivedAt})`,
      hasListUnsubscribe: sql<number>`MAX(CASE WHEN ${emailMessages.listUnsubscribe} IS NOT NULL THEN 1 ELSE 0 END)`,
    })
    .from(emailMessages)
    .where(
      and(
        eq(emailMessages.userId, userId),
        eq(emailMessages.lastSeenScanId, scanId)
      )
    )
    .groupBy(emailMessages.senderAddress, emailMessages.senderDomain);

  if (groups.length === 0) return 0;

  // ---- Query 2: Top 3 subjects per sender using window function ----
  const subjectRows = db.$client
    .prepare(
      `SELECT sender_address, subject FROM (
        SELECT sender_address, subject,
          ROW_NUMBER() OVER (PARTITION BY sender_address ORDER BY received_at DESC) AS rn
        FROM email_messages
        WHERE user_id = ? AND last_seen_scan_id = ? AND subject IS NOT NULL
      ) WHERE rn <= 3`
    )
    .all(userId, scanId) as { sender_address: string; subject: string }[];

  const subjectMap = new Map<string, string[]>();
  for (const row of subjectRows) {
    const existing = subjectMap.get(row.sender_address) || [];
    const truncated =
      row.subject.length > 100
        ? row.subject.slice(0, 100) + "..."
        : row.subject;
    existing.push(truncated);
    subjectMap.set(row.sender_address, existing);
  }

  // ---- Query 3: Bulk unsubscribe headers (one per sender) ----
  const unsubRows = db.$client
    .prepare(
      `SELECT sender_address, list_unsubscribe, list_unsubscribe_post FROM (
        SELECT sender_address, list_unsubscribe, list_unsubscribe_post,
          ROW_NUMBER() OVER (PARTITION BY sender_address ORDER BY received_at DESC) AS rn
        FROM email_messages
        WHERE user_id = ? AND last_seen_scan_id = ? AND list_unsubscribe IS NOT NULL
      ) WHERE rn = 1`
    )
    .all(userId, scanId) as {
    sender_address: string;
    list_unsubscribe: string;
    list_unsubscribe_post: string | null;
  }[];

  const unsubMap = new Map<
    string,
    { listUnsubscribe: string; listUnsubscribePost: string | null }
  >();
  for (const row of unsubRows) {
    unsubMap.set(row.sender_address, {
      listUnsubscribe: row.list_unsubscribe,
      listUnsubscribePost: row.list_unsubscribe_post,
    });
  }

  // ---- Build all sender profile rows in memory ----
  const now = new Date();
  const profileRows = groups.map((group) => {
    const unreadCount = group.totalCount - group.readCount;
    const openRate =
      group.totalCount > 0 ? group.readCount / group.totalCount : 0;

    let avgFrequencyDays: number | null = null;
    if (
      group.totalCount > 1 &&
      group.oldestEmailAt != null &&
      group.newestEmailAt != null
    ) {
      // receivedAt is stored as seconds-since-epoch by Drizzle mode: "timestamp"
      const spanDays =
        (group.newestEmailAt - group.oldestEmailAt) / (60 * 60 * 24);
      avgFrequencyDays = spanDays / (group.totalCount - 1);
    }

    const clutterScore = computeClutterScore({
      totalCount: group.totalCount,
      openRate,
      avgFrequencyDays,
      hasListUnsubscribe: !!group.hasListUnsubscribe,
    });

    const unsub = unsubMap.get(group.senderAddress);
    const sampleSubjects = subjectMap.get(group.senderAddress) || [];

    return {
      id: createId(),
      userId,
      scanId,
      senderAddress: group.senderAddress,
      senderName: group.senderName,
      senderDomain: group.senderDomain,
      totalCount: group.totalCount,
      readCount: group.readCount,
      unreadCount,
      starredCount: group.starredCount,
      openRate,
      sampleSubjects: JSON.stringify(sampleSubjects),
      hasListUnsubscribe: !!group.hasListUnsubscribe,
      listUnsubscribeValue: unsub?.listUnsubscribe || null,
      listUnsubscribePostValue: unsub?.listUnsubscribePost || null,
      oldestEmailAt:
        group.oldestEmailAt != null
          ? new Date(group.oldestEmailAt * 1000)
          : null,
      newestEmailAt:
        group.newestEmailAt != null
          ? new Date(group.newestEmailAt * 1000)
          : null,
      avgFrequencyDays,
      clutterScore,
      createdAt: now,
      updatedAt: now,
    };
  });

  // ---- Bulk insert in batches of 500 (better-sqlite3 is synchronous) ----
  for (let i = 0; i < profileRows.length; i += 500) {
    const batch = profileRows.slice(i, i + 500);
    await db.insert(senderProfiles).values(batch);
  }

  return groups.length;
}
