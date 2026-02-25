import { db } from "@/db";
import { emailMessages, senderProfiles } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { computeClutterScore } from "@/lib/utils/clutter-score";
import { createId } from "@paralleldrive/cuid2";

export async function groupBySender(
  userId: string,
  scanId: string
): Promise<number> {
  // Aggregate emails by sender address
  const groups = await db
    .select({
      senderAddress: emailMessages.senderAddress,
      senderDomain: emailMessages.senderDomain,
      senderName: sql<string>`MAX(${emailMessages.senderName})`,
      totalCount: sql<number>`COUNT(*)`,
      readCount: sql<number>`SUM(CASE WHEN ${emailMessages.isRead} THEN 1 ELSE 0 END)`,
      starredCount: sql<number>`SUM(CASE WHEN ${emailMessages.isStarred} THEN 1 ELSE 0 END)`,
      oldestEmailAt: sql<Date>`MIN(${emailMessages.receivedAt})`,
      newestEmailAt: sql<Date>`MAX(${emailMessages.receivedAt})`,
      hasListUnsubscribe: sql<boolean>`MAX(CASE WHEN ${emailMessages.listUnsubscribe} IS NOT NULL THEN 1 ELSE 0 END)`,
    })
    .from(emailMessages)
    .where(
      and(eq(emailMessages.userId, userId), eq(emailMessages.scanId, scanId))
    )
    .groupBy(emailMessages.senderAddress, emailMessages.senderDomain);

  const now = new Date();

  for (const group of groups) {
    // Get 3 sample subjects
    const samples = await db
      .select({ subject: emailMessages.subject })
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.senderAddress, group.senderAddress),
          eq(emailMessages.scanId, scanId)
        )
      )
      .orderBy(desc(emailMessages.receivedAt))
      .limit(3);

    const sampleSubjects = samples
      .map((s) => s.subject)
      .filter(Boolean) as string[];

    // Get first List-Unsubscribe value
    const unsubRow = group.hasListUnsubscribe
      ? await db
          .select({
            listUnsubscribe: emailMessages.listUnsubscribe,
            listUnsubscribePost: emailMessages.listUnsubscribePost,
          })
          .from(emailMessages)
          .where(
            and(
              eq(emailMessages.senderAddress, group.senderAddress),
              eq(emailMessages.scanId, scanId),
              sql`${emailMessages.listUnsubscribe} IS NOT NULL`
            )
          )
          .limit(1)
          .then((rows) => rows[0] || null)
      : null;

    const unreadCount = group.totalCount - group.readCount;
    const openRate =
      group.totalCount > 0 ? group.readCount / group.totalCount : 0;

    // Calculate average frequency
    let avgFrequencyDays: number | null = null;
    if (
      group.totalCount > 1 &&
      group.oldestEmailAt &&
      group.newestEmailAt
    ) {
      const oldest = new Date(group.oldestEmailAt).getTime();
      const newest = new Date(group.newestEmailAt).getTime();
      const spanDays = (newest - oldest) / (1000 * 60 * 60 * 24);
      avgFrequencyDays = spanDays / (group.totalCount - 1);
    }

    const clutterScore = computeClutterScore({
      totalCount: group.totalCount,
      openRate,
      avgFrequencyDays,
      hasListUnsubscribe: !!group.hasListUnsubscribe,
    });

    await db.insert(senderProfiles).values({
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
      listUnsubscribeValue: unsubRow?.listUnsubscribe || null,
      listUnsubscribePostValue: unsubRow?.listUnsubscribePost || null,
      oldestEmailAt: group.oldestEmailAt
        ? new Date(group.oldestEmailAt)
        : null,
      newestEmailAt: group.newestEmailAt
        ? new Date(group.newestEmailAt)
        : null,
      avgFrequencyDays,
      clutterScore,
      createdAt: now,
      updatedAt: now,
    });
  }

  return groups.length;
}
