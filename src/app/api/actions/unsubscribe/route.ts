import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { senderProfiles, actionLog } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getGmailClient } from "@/lib/gmail/client";
import { executeUnsubscribe } from "@/lib/gmail/unsubscribe";
import { createId } from "@paralleldrive/cuid2";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { senderIds } = await request.json();
  if (!Array.isArray(senderIds) || senderIds.length === 0) {
    return NextResponse.json(
      { error: "senderIds required" },
      { status: 400 }
    );
  }

  const gmail = await getGmailClient(session.user.id);
  const results: { senderId: string; success: boolean; method: string }[] = [];

  // Batch-fetch all profiles upfront (eliminates N+1)
  const profiles = await db
    .select()
    .from(senderProfiles)
    .where(
      and(
        inArray(senderProfiles.id, senderIds),
        eq(senderProfiles.userId, session.user.id)
      )
    );
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  for (const senderId of senderIds) {
    const profile = profileMap.get(senderId);

    if (!profile || !profile.listUnsubscribeValue) {
      results.push({ senderId, success: false, method: "no-header" });
      continue;
    }

    const result = await executeUnsubscribe(
      gmail,
      profile.listUnsubscribeValue,
      profile.listUnsubscribePostValue
    );

    // Log the action
    await db.insert(actionLog).values({
      id: createId(),
      userId: session.user.id,
      senderProfileId: senderId,
      actionType: "unsubscribe",
      targetCount: profile.totalCount,
      status: result.success ? "success" : "error",
      metadata: JSON.stringify(result),
      createdAt: new Date(),
    });

    // Update sender profile only on success
    if (result.success) {
      await db
        .update(senderProfiles)
        .set({
          userAction: "unsubscribe",
          actionExecutedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(senderProfiles.id, senderId));
    }

    results.push({ senderId, ...result });
  }

  return NextResponse.json({ results });
}
