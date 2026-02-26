import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { scans, senderProfiles, actionLog } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get latest scan
  const latestScan = await db
    .select()
    .from(scans)
    .where(eq(scans.userId, session.user.id))
    .orderBy(desc(scans.createdAt))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!latestScan) {
    return NextResponse.json({
      healthScore: null,
      totalSenders: 0,
      totalEmails: 0,
      categories: {},
      topClutter: [],
      recentActions: [],
      scan: null,
    });
  }

  // Q1: Category aggregates + health data (single query instead of full table load)
  const categoryRows = await db
    .select({
      category: sql<string>`COALESCE(${senderProfiles.category}, 'unclassified')`,
      count: sql<number>`COUNT(*)`,
      emails: sql<number>`SUM(${senderProfiles.totalCount})`,
      weightedClutter: sql<number>`SUM(${senderProfiles.clutterScore} * ${senderProfiles.totalCount})`,
    })
    .from(senderProfiles)
    .where(
      and(
        eq(senderProfiles.userId, session.user.id),
        eq(senderProfiles.scanId, latestScan.id)
      )
    )
    .groupBy(sql`COALESCE(${senderProfiles.category}, 'unclassified')`);

  // Derive totals from aggregated rows
  let totalSenders = 0;
  let totalEmails = 0;
  let totalWeightedClutter = 0;
  const categories: Record<string, { count: number; emails: number }> = {};

  for (const row of categoryRows) {
    totalSenders += Number(row.count);
    totalEmails += Number(row.emails);
    totalWeightedClutter += Number(row.weightedClutter);
    categories[row.category] = {
      count: Number(row.count),
      emails: Number(row.emails),
    };
  }

  // Health score = 100 - weighted average clutter
  const healthScore =
    totalEmails > 0
      ? Math.round(100 - totalWeightedClutter / totalEmails)
      : null;

  // Q2: Top 10 clutter senders (only needed columns)
  const topClutter = await db
    .select({
      id: senderProfiles.id,
      senderAddress: senderProfiles.senderAddress,
      senderName: senderProfiles.senderName,
      totalCount: senderProfiles.totalCount,
      openRate: senderProfiles.openRate,
      clutterScore: senderProfiles.clutterScore,
      category: senderProfiles.category,
      hasListUnsubscribe: senderProfiles.hasListUnsubscribe,
    })
    .from(senderProfiles)
    .where(
      and(
        eq(senderProfiles.userId, session.user.id),
        eq(senderProfiles.scanId, latestScan.id)
      )
    )
    .orderBy(desc(senderProfiles.clutterScore))
    .limit(10);

  // Q3: Recent actions (already SQL, keep as-is)
  const recentActions = await db
    .select()
    .from(actionLog)
    .where(eq(actionLog.userId, session.user.id))
    .orderBy(desc(actionLog.createdAt))
    .limit(5);

  return NextResponse.json({
    healthScore,
    totalSenders,
    totalEmails,
    categories,
    topClutter,
    recentActions,
    scan: {
      id: latestScan.id,
      status: latestScan.status,
      completedAt: latestScan.completedAt,
    },
  });
}
