import { db } from "@/db";
import { senderProfiles, scans } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { getDeepSeekClient } from "./deepseek-client";
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationPrompt,
} from "./prompts";
import type { ClassificationResponse } from "@/types/classification";

const BATCH_SIZE = 50;

export async function classifyUnclassifiedSenders(
  scanId: string
): Promise<number> {
  const unclassified = await db
    .select()
    .from(senderProfiles)
    .where(
      and(eq(senderProfiles.scanId, scanId), isNull(senderProfiles.category))
    );

  if (unclassified.length === 0) return 0;

  // Reset processedMessages to track classification progress
  await db
    .update(scans)
    .set({ processedMessages: 0 })
    .where(eq(scans.id, scanId));

  let classified = 0;
  const client = getDeepSeekClient();

  for (let i = 0; i < unclassified.length; i += BATCH_SIZE) {
    const batch = unclassified.slice(i, i + BATCH_SIZE);

    const senderInputs = batch.map((p) => ({
      senderAddress: p.senderAddress,
      senderName: p.senderName,
      senderDomain: p.senderDomain,
      totalCount: p.totalCount,
      openRate: p.openRate,
      sampleSubjects: JSON.parse(p.sampleSubjects || "[]") as string[],
    }));

    let retries = 2;
    while (retries > 0) {
      try {
        const completion = await client.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: CLASSIFICATION_SYSTEM_PROMPT },
            { role: "user", content: buildClassificationPrompt(senderInputs) },
          ],
          response_format: { type: "json_object" },
          max_tokens: 4096,
          temperature: 0.1,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          retries--;
          continue;
        }

        const result: ClassificationResponse = JSON.parse(content);

        if (!result.classifications || !Array.isArray(result.classifications)) {
          retries--;
          continue;
        }

        const now = new Date();
        for (const classification of result.classifications) {
          const profile = batch.find(
            (p) => p.senderAddress === classification.senderAddress
          );
          if (!profile) continue;

          await db
            .update(senderProfiles)
            .set({
              category: classification.category,
              categoryConfidence: classification.confidence,
              classifiedAt: now,
              updatedAt: now,
            })
            .where(eq(senderProfiles.id, profile.id));

          classified++;
        }

        break; // Success, exit retry loop
      } catch {
        retries--;
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    // If all retries failed, mark batch as "other"
    if (retries === 0) {
      const now = new Date();
      for (const profile of batch) {
        if (!profile.category) {
          await db
            .update(senderProfiles)
            .set({
              category: "other",
              categoryConfidence: 0,
              classifiedAt: now,
              updatedAt: now,
            })
            .where(eq(senderProfiles.id, profile.id));
          classified++;
        }
      }
    }

    // Update classification progress
    await db
      .update(scans)
      .set({ processedMessages: classified })
      .where(eq(scans.id, scanId));
  }

  return classified;
}
