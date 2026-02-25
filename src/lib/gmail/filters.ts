import type { gmail_v1 } from "googleapis";
import { gmailRateLimiter } from "./rate-limiter";

export async function createFilter(
  gmail: gmail_v1.Gmail,
  from: string,
  action: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
  }
): Promise<string> {
  await gmailRateLimiter.acquire(5);

  const response = await gmail.users.settings.filters.create({
    userId: "me",
    requestBody: {
      criteria: { from },
      action: {
        addLabelIds: action.addLabelIds || [],
        removeLabelIds: action.removeLabelIds || [],
      },
    },
  });

  return response.data.id || "";
}

export async function createAutoArchiveFilter(
  gmail: gmail_v1.Gmail,
  from: string,
  labelId?: string
): Promise<string> {
  return createFilter(gmail, from, {
    addLabelIds: labelId ? [labelId] : undefined,
    removeLabelIds: ["INBOX"],
  });
}
