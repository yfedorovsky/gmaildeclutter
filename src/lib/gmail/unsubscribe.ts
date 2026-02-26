import type { gmail_v1 } from "googleapis";
import { gmailRateLimiter } from "./rate-limiter";

interface UnsubscribeLinks {
  mailto: string | null;
  httpUrl: string | null;
}

// Private/reserved IP ranges that must be blocked (SSRF protection)
const BLOCKED_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^fd/i,
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "0.0.0.0",
  "[::]",
  "[::1]",
  "metadata.google.internal",
];

/**
 * Validates a URL is safe to fetch (not internal/private).
 * String-based checks only — no DNS resolution needed.
 */
function isUrlSafe(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Block known dangerous hostnames
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return false;
    }

    // Block private/reserved IP ranges
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return false;
      }
    }

    // Block AWS/GCP metadata endpoints
    if (hostname === "169.254.169.254") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

const MAX_REDIRECTS = 3;

/**
 * Fetch with manual redirect following + SSRF re-validation at each hop.
 */
async function safeFetch(
  url: string,
  options: RequestInit & { maxRedirects?: number } = {}
): Promise<Response> {
  const { maxRedirects = MAX_REDIRECTS, ...fetchOptions } = options;
  let currentUrl = url;

  for (let i = 0; i <= maxRedirects; i++) {
    if (!isUrlSafe(currentUrl)) {
      throw new Error(`Blocked unsafe URL: ${currentUrl}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(currentUrl, {
      ...fetchOptions,
      redirect: "manual",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Not a redirect — return the response
    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    // Handle redirect
    const location = response.headers.get("location");
    if (!location) {
      return response; // No location header — return as-is
    }

    // Resolve relative redirects
    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error(`Too many redirects (>${maxRedirects})`);
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
      const response = await safeFetch(links.httpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click-Unsubscribe",
      });
      if (response.ok || response.status === 204) {
        return { success: true, method: "one-click-post" };
      }
    } catch {
      // Timeout, SSRF block, or network error — fall through
    }
  }

  // Strategy 2: HTTP GET unsubscribe link
  if (links.httpUrl) {
    try {
      const response = await safeFetch(links.httpUrl, {
        method: "GET",
      });
      if (response.ok) {
        return { success: true, method: "http-get" };
      }
    } catch {
      // Timeout, SSRF block, or network error — fall through
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
