import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { senderProfiles, scans } from "@/db/schema";
import { eq, and, desc, asc, like, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const sort = searchParams.get("sort") || "clutterScore";
  const order = searchParams.get("order") || "desc";
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  // Get the latest scan
  const latestScan = await db
    .select()
    .from(scans)
    .where(eq(scans.userId, session.user.id))
    .orderBy(desc(scans.createdAt))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!latestScan) {
    return NextResponse.json({ senders: [], total: 0, page, limit });
  }

  // Build conditions
  const conditions = [
    eq(senderProfiles.userId, session.user.id),
    eq(senderProfiles.scanId, latestScan.id),
  ];

  if (category) {
    conditions.push(eq(senderProfiles.category, category));
  }

  if (search) {
    conditions.push(
      sql`(${senderProfiles.senderAddress} LIKE ${"%" + search + "%"} OR ${senderProfiles.senderName} LIKE ${"%" + search + "%"})`
    );
  }

  // Sort column mapping
  const sortColumnMap = {
    clutterScore: senderProfiles.clutterScore,
    totalCount: senderProfiles.totalCount,
    openRate: senderProfiles.openRate,
    senderName: senderProfiles.senderName,
    senderAddress: senderProfiles.senderAddress,
  } as const;

  const sortCol = sortColumnMap[sort as keyof typeof sortColumnMap] || senderProfiles.clutterScore;
  const orderFn = order === "asc" ? asc : desc;

  const [senders, countResult] = await Promise.all([
    db
      .select()
      .from(senderProfiles)
      .where(and(...conditions))
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(senderProfiles)
      .where(and(...conditions))
      .then((rows) => rows[0]?.count || 0),
  ]);

  // Parse sampleSubjects JSON
  const parsed = senders.map((s) => ({
    ...s,
    sampleSubjects: JSON.parse(s.sampleSubjects || "[]"),
  }));

  return NextResponse.json({
    senders: parsed,
    total: countResult,
    page,
    limit,
  });
}
