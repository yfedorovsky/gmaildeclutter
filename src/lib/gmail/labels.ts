import type { gmail_v1 } from "googleapis";
import type { GmailLabel } from "@/types/gmail";
import { gmailRateLimiter } from "./rate-limiter";
import { batchModifyMessages } from "./batch";

export async function listLabels(
  gmail: gmail_v1.Gmail
): Promise<GmailLabel[]> {
  await gmailRateLimiter.acquire(5);

  const response = await gmail.users.labels.list({ userId: "me" });
  const labels = response.data.labels || [];

  return labels.map((label) => ({
    id: label.id || "",
    name: label.name || "",
    type: label.type === "system" ? "system" : "user",
    color: label.color
      ? {
          textColor: label.color.textColor || "",
          backgroundColor: label.color.backgroundColor || "",
        }
      : undefined,
  }));
}

export async function createLabel(
  gmail: gmail_v1.Gmail,
  name: string
): Promise<string> {
  await gmailRateLimiter.acquire(5);

  const response = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });

  return response.data.id || "";
}

export async function getOrCreateLabel(
  gmail: gmail_v1.Gmail,
  name: string
): Promise<string> {
  const labels = await listLabels(gmail);
  const existing = labels.find(
    (l) => l.name.toLowerCase() === name.toLowerCase()
  );

  if (existing) return existing.id;
  return createLabel(gmail, name);
}

export async function applyLabelToMessages(
  gmail: gmail_v1.Gmail,
  messageIds: string[],
  labelId: string
): Promise<void> {
  await batchModifyMessages(gmail, messageIds, [labelId]);
}
