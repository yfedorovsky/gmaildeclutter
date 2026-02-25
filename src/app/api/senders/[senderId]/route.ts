import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { senderProfiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ senderId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { senderId } = await params;

  const sender = await db
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

  if (!sender) {
    return NextResponse.json({ error: "Sender not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...sender,
    sampleSubjects: JSON.parse(sender.sampleSubjects || "[]"),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ senderId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { senderId } = await params;
  const body = await request.json();
  const { userAction, userLabel } = body;

  await db
    .update(senderProfiles)
    .set({
      userAction,
      userLabel,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(senderProfiles.id, senderId),
        eq(senderProfiles.userId, session.user.id)
      )
    );

  return NextResponse.json({ success: true });
}
