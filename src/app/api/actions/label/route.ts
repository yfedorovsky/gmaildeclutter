import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { senderProfiles, emailMessages, actionLog } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getGmailClient } from "@/lib/gmail/client";
import { getOrCreateLabel, applyLabelToMessages } from "@/lib/gmail/labels";
import { createId } from "@paralleldrive/cuid2";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { senderIds, labelName } = await request.json();
  if (!Array.isArray(senderIds) || !labelName) {
    return NextResponse.json(
      { error: "senderIds and labelName required" },
      { status: 400 }
    );
  }

  const gmail = await getGmailClient(session.user.id);
  const labelId = await getOrCreateLabel(gmail, labelName);
  let totalLabeled = 0;

  for (const senderId of senderIds) {
    const profile = await db
      .select()
      .from(senderProfiles)
      .where(
        and(
          eq(senderProfiles.id, senderId),
          eq(senderProfiles.userId, session.user.id)
        )
      )
      .limit(1)
      .then((rows) => rows[0] || null);

    if (!profile) continue;

    const messages = await db
      .select({ id: emailMessages.id })
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.senderAddress, profile.senderAddress),
          eq(emailMessages.scanId, profile.scanId),
          eq(emailMessages.userId, session.user.id)
        )
      );

    const messageIds = messages.map((m) => m.id);
    if (messageIds.length === 0) continue;

    await applyLabelToMessages(gmail, messageIds, labelId);
    totalLabeled += messageIds.length;

    await db.insert(actionLog).values({
      id: createId(),
      userId: session.user.id,
      senderProfileId: senderId,
      actionType: "label",
      targetCount: messageIds.length,
      status: "success",
      metadata: JSON.stringify({ labelName, labelId }),
      createdAt: new Date(),
    });

    await db
      .update(senderProfiles)
      .set({
        userLabel: labelName,
        updatedAt: new Date(),
      })
      .where(eq(senderProfiles.id, senderId));
  }

  return NextResponse.json({ labeled: totalLabeled, labelId });
}
