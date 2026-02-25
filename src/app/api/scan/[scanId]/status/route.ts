import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { scans } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scanId } = await params;

  const scan = await db
    .select()
    .from(scans)
    .where(and(eq(scans.id, scanId), eq(scans.userId, session.user.id)))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: scan.id,
    status: scan.status,
    totalMessages: scan.totalMessages,
    processedMessages: scan.processedMessages,
    totalSenders: scan.totalSenders,
    errorMessage: scan.errorMessage,
    startedAt: scan.startedAt,
    completedAt: scan.completedAt,
  });
}
