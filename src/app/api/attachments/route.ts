import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGmailClient } from "@/lib/gmail/client";
import { searchLargeAttachmentMessages } from "@/lib/gmail/attachments";

const VALID_SIZES = [5, 10, 20, 100];

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const minSize = parseInt(
    request.nextUrl.searchParams.get("minSize") || "5",
    10
  );

  if (!VALID_SIZES.includes(minSize)) {
    return NextResponse.json(
      { error: `minSize must be one of: ${VALID_SIZES.join(", ")}` },
      { status: 400 }
    );
  }

  const offset = parseInt(
    request.nextUrl.searchParams.get("offset") || "0",
    10
  );

  try {
    const gmail = await getGmailClient(session.user.id);
    const result = await searchLargeAttachmentMessages(gmail, minSize, offset);

    return NextResponse.json({
      messages: result.messages,
      count: result.totalCount,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error("Attachment search failed:", error);
    return NextResponse.json(
      { error: "Failed to search attachments" },
      { status: 500 }
    );
  }
}
