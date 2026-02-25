import "dotenv/config";
import { resolve } from "path";

// Load .env.local (Next.js does this automatically, worker does not)
import { config } from "dotenv";
config({ path: resolve(process.cwd(), ".env.local") });

import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { scanInbox } from "@/lib/pipeline/scanner";

const POLL_INTERVAL_MS = 2000;

async function claimJob(): Promise<{
  id: string;
  type: string;
  payload: string;
  attempts: number;
  maxAttempts: number;
} | null> {
  // Atomic claim: UPDATE ... WHERE status='pending' ... RETURNING
  // SQLite single-writer guarantee ensures no double-claiming.
  const row = db.$client
    .prepare(
      `UPDATE jobs
       SET status = 'running', started_at = unixepoch(), attempts = attempts + 1
       WHERE id = (
         SELECT id FROM jobs
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT 1
       )
       RETURNING id, type, payload, attempts, max_attempts`
    )
    .get() as
    | {
        id: string;
        type: string;
        payload: string;
        attempts: number;
        max_attempts: number;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
  };
}

async function completeJob(jobId: string): Promise<void> {
  await db
    .update(jobs)
    .set({
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

async function failJob(
  jobId: string,
  error: string,
  attempts: number,
  maxAttempts: number
): Promise<void> {
  const status = attempts >= maxAttempts ? "failed" : "pending";
  await db
    .update(jobs)
    .set({
      status,
      errorMessage: error,
      ...(status === "pending" ? { startedAt: null } : {}),
    })
    .where(eq(jobs.id, jobId));
}

async function processJob(job: {
  id: string;
  type: string;
  payload: string;
  attempts: number;
  maxAttempts: number;
}): Promise<void> {
  console.log(
    `[worker] Processing job ${job.id} (type: ${job.type}, attempt: ${job.attempts}/${job.maxAttempts})`
  );

  try {
    switch (job.type) {
      case "scan": {
        const { userId, scanId } = JSON.parse(job.payload);
        await scanInbox(userId, scanId);
        await completeJob(job.id);
        console.log(`[worker] Job ${job.id} completed successfully`);
        break;
      }
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[worker] Job ${job.id} failed: ${message}`);
    await failJob(job.id, message, job.attempts, job.maxAttempts);
  }
}

async function pollLoop(): Promise<void> {
  console.log("[worker] Starting job worker...");
  console.log(`[worker] Polling every ${POLL_INTERVAL_MS}ms`);

  // Recover any jobs stuck in 'running' state from a previous crash (>5 min)
  const stuck = db.$client
    .prepare(
      `UPDATE jobs
       SET status = 'pending', started_at = NULL
       WHERE status = 'running'
         AND started_at < unixepoch() - 300`
    )
    .run();

  if (stuck.changes > 0) {
    console.log(`[worker] Recovered ${stuck.changes} stuck job(s)`);
  }

  while (true) {
    try {
      const job = await claimJob();
      if (job) {
        await processJob(job);
      } else {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (error) {
      console.error("[worker] Poll loop error:", error);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

process.on("SIGINT", () => {
  console.log("\n[worker] Shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[worker] Shutting down...");
  process.exit(0);
});

pollLoop();
