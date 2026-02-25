import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { scans, jobs } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
