import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { scans, senderProfiles, actionLog } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { computeHealthScore } from "@/lib/utils/health-score";

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

  // Get all sender profiles for this scan
  const profiles = await db
    .select()
    .from(senderProfiles)
    .where(
      and(
        eq(senderProfiles.userId, session.user.id),
        eq(senderProfiles.scanId, latestScan.id)
      )
    );

  // Health score
  const healthScore = computeHealthScore(
    profiles.map((p) => ({
      clutterScore: p.clutterScore,
      totalCount: p.totalCount,
    }))
  );

  // Category breakdown
  const categories: Record<string, { count: number; emails: number }> = {};
  for (const p of profiles) {
    const cat = p.category || "unclassified";
    if (!categories[cat]) categories[cat] = { count: 0, emails: 0 };
    categories[cat].count++;
    categories[cat].emails += p.totalCount;
  }

  // Total emails
  const totalEmails = profiles.reduce((sum, p) => sum + p.totalCount, 0);

  // Top 10 clutter senders
  const topClutter = [...profiles]
    .sort((a, b) => b.clutterScore - a.clutterScore)
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      senderAddress: p.senderAddress,
      senderName: p.senderName,
      totalCount: p.totalCount,
      openRate: p.openRate,
      clutterScore: p.clutterScore,
      category: p.category,
      hasListUnsubscribe: p.hasListUnsubscribe,
    }));

  // Recent actions
  const recentActions = await db
    .select()
    .from(actionLog)
    .where(eq(actionLog.userId, session.user.id))
    .orderBy(desc(actionLog.createdAt))
    .limit(5);

  return NextResponse.json({
    healthScore,
    totalSenders: profiles.length,
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
