export const CLASSIFICATION_SYSTEM_PROMPT = `You are an email classification engine. You will receive a JSON array of sender profiles.
Each profile contains: senderAddress, senderName, senderDomain, totalCount, openRate, sampleSubjects (array of up to 3 subject lines).

For each sender, classify into exactly ONE category:
- "newsletter" - Regular content newsletters, digests, blog updates
- "job_alert" - Job listings, career opportunities, recruiter outreach
- "promo" - Sales, deals, coupons, marketing promotions
- "social" - Social media notifications (likes, comments, follows, friend requests)
- "transactional" - Receipts, shipping notifications, password resets, account alerts
- "personal" - Direct person-to-person communication
- "automated" - Automated system emails (CI/CD, monitoring, cron reports)
- "other" - Anything that doesn't fit above

Return a JSON object with key "classifications" containing an array of objects,
each with: { "senderAddress": string, "category": string, "confidence": number (0.0-1.0) }

Order must match input order. Do not skip any sender. Respond with valid JSON only.`;

export function buildClassificationPrompt(
  senders: {
    senderAddress: string;
    senderName: string | null;
    senderDomain: string;
    totalCount: number;
    openRate: number;
    sampleSubjects: string[];
  }[]
): string {
  return JSON.stringify(
    senders.map((s) => ({
      senderAddress: s.senderAddress,
      senderName: s.senderName || "",
      senderDomain: s.senderDomain,
      totalCount: s.totalCount,
      openRate: Math.round(s.openRate * 100) / 100,
      sampleSubjects: s.sampleSubjects
        .slice(0, 3)
        .map((subj) => (subj.length > 100 ? subj.slice(0, 100) + "..." : subj)),
    }))
  );
}
