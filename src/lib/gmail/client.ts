import { google } from "googleapis";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getGmailClient(userId: string) {
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.userId, userId),
  });

  if (!account?.access_token) {
    throw new Error("No valid access token available. Please re-authenticate.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token || undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  // Auto-persist refreshed tokens back to the database
  oauth2Client.on("tokens", async (tokens) => {
    await db
      .update(accounts)
      .set({
        access_token: tokens.access_token || account.access_token,
        ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
        ...(tokens.expiry_date && {
          expires_at: Math.floor(tokens.expiry_date / 1000),
        }),
      })
      .where(eq(accounts.userId, userId));
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}
