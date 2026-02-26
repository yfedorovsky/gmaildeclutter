import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { senderProfiles, emailMessages, actionLog } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getGmailClient } from "@/lib/gmail/client";
import { batchTrashMessages } from "@/lib/gmail/batch";
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
  let totalTrashed = 0;

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
    if (!profile) continue;

    const messages = await db
      .select({ id: emailMessages.id })
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.senderAddress, profile.senderAddress),
          eq(emailMessages.lastSeenScanId, profile.scanId),
          eq(emailMessages.userId, session.user.id)
        )
      );

    const messageIds = messages.map((m) => m.id);
    if (messageIds.length === 0) continue;

    try {
      await batchTrashMessages(gmail, messageIds);
      totalTrashed += messageIds.length;

      await db.insert(actionLog).values({
        id: createId(),
        userId: session.user.id,
        senderProfileId: senderId,
        actionType: "trash",
        targetCount: messageIds.length,
        status: "success",
        createdAt: new Date(),
      });

      await db
        .update(senderProfiles)
        .set({
          userAction: "trash",
          actionExecutedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(senderProfiles.id, senderId));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await db.insert(actionLog).values({
        id: createId(),
        userId: session.user.id,
        senderProfileId: senderId,
        actionType: "trash",
        targetCount: messageIds.length,
        status: "error",
        errorMessage,
        createdAt: new Date(),
      });
    }
  }

  return NextResponse.json({ trashed: totalTrashed });
}
