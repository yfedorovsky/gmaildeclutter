import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { scans } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { scanInbox } from "@/lib/pipeline/scanner";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scanId = createId();
  const now = new Date();

  await db.insert(scans).values({
    id: scanId,
    userId: session.user.id,
    status: "pending",
    createdAt: now,
  });

  // Start scan in background (fire and forget)
  scanInbox(session.user.id, scanId).catch(console.error);

  return NextResponse.json({ scanId });
}
