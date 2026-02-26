import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { actionLog } from "@/db/schema";
import { getGmailClient } from "@/lib/gmail/client";
import { batchTrashMessages } from "@/lib/gmail/batch";
import { createId } from "@paralleldrive/cuid2";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messageIds } = await request.json();
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return NextResponse.json(
      { error: "messageIds required" },
      { status: 400 }
    );
  }

  if (messageIds.length > 500) {
    return NextResponse.json(
      { error: "Maximum 500 messages per request" },
      { status: 400 }
    );
  }

  try {
    const gmail = await getGmailClient(session.user.id);
    await batchTrashMessages(gmail, messageIds);

    await db.insert(actionLog).values({
      id: createId(),
      userId: session.user.id,
      senderProfileId: null,
      actionType: "trash-attachments",
      targetCount: messageIds.length,
      status: "success",
      metadata: JSON.stringify({ source: "large-attachments" }),
      createdAt: new Date(),
    });

    return NextResponse.json({ trashed: messageIds.length });
  } catch (error) {
    console.error("Trash messages failed:", error);
    return NextResponse.json(
      { error: "Failed to trash messages" },
      { status: 500 }
    );
  }
}
