import type { gmail_v1 } from "googleapis";
import { gmailRateLimiter } from "./rate-limiter";

interface UnsubscribeLinks {
  mailto: string | null;
  httpUrl: string | null;
}

export function parseListUnsubscribe(headerValue: string): UnsubscribeLinks {
  const result: UnsubscribeLinks = { mailto: null, httpUrl: null };

  // Header format: <mailto:unsub@example.com>, <https://example.com/unsub>
  const matches = headerValue.match(/<([^>]+)>/g);
  if (!matches) return result;

  for (const match of matches) {
    const uri = match.slice(1, -1); // Remove < >
    if (uri.startsWith("mailto:")) {
      result.mailto = uri;
    } else if (uri.startsWith("http://") || uri.startsWith("https://")) {
      result.httpUrl = uri;
    }
  }

  return result;
}

export async function executeUnsubscribe(
  gmail: gmail_v1.Gmail,
  listUnsubscribe: string,
  listUnsubscribePost: string | null
): Promise<{ success: boolean; method: string }> {
  const links = parseListUnsubscribe(listUnsubscribe);

  // Strategy 1: RFC 8058 one-click unsubscribe (POST)
  if (links.httpUrl && listUnsubscribePost) {
    try {
      const response = await fetch(links.httpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click-Unsubscribe",
      });
      if (response.ok || response.status === 204) {
        return { success: true, method: "one-click-post" };
      }
    } catch {
      // Fall through to next strategy
    }
  }

  // Strategy 2: HTTP GET unsubscribe link
  if (links.httpUrl) {
    try {
      const response = await fetch(links.httpUrl, {
        method: "GET",
        redirect: "follow",
      });
      if (response.ok) {
        return { success: true, method: "http-get" };
      }
    } catch {
      // Fall through to next strategy
    }
  }

  // Strategy 3: Send mailto unsubscribe
  if (links.mailto) {
    try {
      const toAddress = links.mailto.replace("mailto:", "").split("?")[0];
      const subject =
        new URLSearchParams(links.mailto.split("?")[1] || "").get("subject") ||
        "Unsubscribe";

      await gmailRateLimiter.acquire(25);

      const message = [
        `To: ${toAddress}`,
        `Subject: ${subject}`,
        "",
        "Unsubscribe",
      ].join("\r\n");

      const encodedMessage = Buffer.from(message).toString("base64url");

      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encodedMessage },
      });

      return { success: true, method: "mailto" };
    } catch {
      return { success: false, method: "mailto-failed" };
    }
  }

  return { success: false, method: "none" };
}
