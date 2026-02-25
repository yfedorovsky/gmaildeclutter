import type { ParsedSender } from "@/types/gmail";

/**
 * Decode RFC 2047 MIME encoded-words in email headers.
 * Handles =?charset?encoding?encoded_text?= patterns.
 * Supports B (Base64) and Q (Quoted-Printable) encodings.
 */
export function decodeMimeHeader(value: string): string {
  return value.replace(
    /=\?([^?]+)\?(B|Q)\?([^?]*)\?=/gi,
    (_match, charset: string, encoding: string, encoded: string) => {
      try {
        if (encoding.toUpperCase() === "B") {
          const bytes = Buffer.from(encoded, "base64");
          return decodeCharset(bytes, charset);
        } else if (encoding.toUpperCase() === "Q") {
          // In Q encoding, underscores represent spaces
          const normalized = encoded.replace(/_/g, " ");
          const bytes = Buffer.from(
            normalized.replace(/=([0-9A-Fa-f]{2})/g, (_m, hex: string) =>
              String.fromCharCode(parseInt(hex, 16))
            ),
            "binary"
          );
          return decodeCharset(bytes, charset);
        }
      } catch {
        // If decoding fails, return original
      }
      return _match;
    }
  );
}

function decodeCharset(bytes: Buffer, charset: string): string {
  const normalized = charset.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (normalized === "utf-8" || normalized === "utf8") {
    return bytes.toString("utf-8");
  }
  try {
    const decoder = new TextDecoder(normalized);
    return decoder.decode(bytes);
  } catch {
    return bytes.toString("utf-8");
  }
}

export function parseSender(fromHeader: string): ParsedSender {
  // Decode any RFC 2047 MIME encoded-words first
  const decoded = decodeMimeHeader(fromHeader);

  let name = "";
  let address = "";

  const angleMatch = decoded.match(/<([^>]+)>/);
  if (angleMatch) {
    address = angleMatch[1].toLowerCase().trim();
    name = decoded
      .replace(/<[^>]+>/, "")
      .replace(/"/g, "")
      .trim();
  } else {
    address = decoded.toLowerCase().trim();
  }

  const domain = address.includes("@") ? address.split("@")[1] : "";

  return { name, address, domain };
}

export function normalizeDomain(domain: string): string {
  return domain
    .replace(/^(mail|email|newsletter|info|noreply|no-reply)\./i, "")
    .toLowerCase();
}
