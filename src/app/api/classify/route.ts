import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { scans } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { classifyUnclassifiedSenders } from "@/lib/ai/classifier";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the latest scan
  const latestScan = await db
    .select()
    .from(scans)
    .where(eq(scans.userId, session.user.id))
    .orderBy(desc(scans.createdAt))
    .limit(1)
    .then((rows) => rows[0] || null);

  if (!latestScan) {
    return NextResponse.json({ error: "No scan found" }, { status: 404 });
  }

  // Run classification in background
  classifyUnclassifiedSenders(latestScan.id)
    .then(async () => {
      if (latestScan.status === "classifying") {
        await db
          .update(scans)
          .set({ status: "complete", completedAt: new Date() })
          .where(eq(scans.id, latestScan.id));
      }
    })
    .catch(async (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown classification error";
      await db
        .update(scans)
        .set({ status: "error", errorMessage })
        .where(eq(scans.id, latestScan.id));
    });

  return NextResponse.json({ message: "Classification started" });
}
