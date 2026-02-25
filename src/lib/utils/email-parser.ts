import type { ParsedSender } from "@/types/gmail";

export function parseSender(fromHeader: string): ParsedSender {
  // Handle formats:
  // "John Doe <john@example.com>"
  // "<john@example.com>"
  // "john@example.com"
  // "\"John Doe\" <john@example.com>"

  let name = "";
  let address = "";

  const angleMatch = fromHeader.match(/<([^>]+)>/);
  if (angleMatch) {
    address = angleMatch[1].toLowerCase().trim();
    name = fromHeader
      .replace(/<[^>]+>/, "")
      .replace(/"/g, "")
      .trim();
  } else {
    address = fromHeader.toLowerCase().trim();
  }

  const domain = address.includes("@") ? address.split("@")[1] : "";

  return { name, address, domain };
}

export function normalizeDomain(domain: string): string {
  // Remove common subdomains
  return domain
    .replace(/^(mail|email|newsletter|info|noreply|no-reply)\./i, "")
    .toLowerCase();
}
