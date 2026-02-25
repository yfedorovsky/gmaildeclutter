import { google } from "googleapis";
import { getAccessToken } from "@/lib/auth";

export async function getGmailClient(userId: string) {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error("No valid access token available. Please re-authenticate.");
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  return google.gmail({ version: "v1", auth: oauth2Client });
}
