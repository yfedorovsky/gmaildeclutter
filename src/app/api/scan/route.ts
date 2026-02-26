import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { scans, jobs } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const ACTIVE_STATUSES = ["pending", "scanning", "grouping", "classifying"];

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for an already-active scan
  const activeScan = await db
    .select({ id: scans.id, status: scans.status })
    .from(scans)
    .where(
      and(
        eq(scans.userId, session.user.id),
        inArray(scans.status, ACTIVE_STATUSES)
      )
    )
    .limit(1)
    .then((rows) => rows[0] || null);

  if (activeScan) {
    return NextResponse.json(
      {
        error: "A scan is already in progress",
        scanId: activeScan.id,
        status: activeScan.status,
      },
      { status: 400 }
    );
  }

  const scanId = createId();
  const jobId = createId();
  const now = new Date();

  await db.insert(scans).values({
    id: scanId,
    userId: session.user.id,
    status: "pending",
    createdAt: now,
  });

  await db.insert(jobs).values({
    id: jobId,
    type: "scan",
    payload: JSON.stringify({ userId: session.user.id, scanId }),
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    createdAt: now,
  });

  return NextResponse.json({ scanId });
}
