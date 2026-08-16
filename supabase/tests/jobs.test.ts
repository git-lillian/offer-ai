/**
 * Background job integration test — proves the enqueue → consume →
 * idempotent-completion loop against the real database.
 *
 * Run with: pnpm db:test
 */

import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { JobQueue } from "@offer-ai/database";
import { createLogger } from "@offer-ai/config";
import { demoEchoHandler } from "../../apps/worker/src/jobs/registry";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(): Record<string, string> {
  const path = resolve(process.cwd(), ".env.local");
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!serviceKey) {
  throw new Error("Job tests require SUPABASE_SERVICE_ROLE_KEY in .env.local.");
}

const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const queue = new JobQueue(service);
const logger = createLogger("silent");

describe("background jobs: demo.echo", () => {
  let jobId: string;

  it("enqueues a demo.echo job", async () => {
    const job = await queue.enqueue({
      kind: "demo.echo",
      payload: { message: `integration-test-${Date.now()}` },
      idempotencyKey: `integration-test-${Date.now()}`,
      correlationId: crypto.randomUUID(),
    });
    expect(job.id).toBeTruthy();
    expect(job.status).toBe("queued");
    jobId = job.id;
  });

  it("worker claims and executes the job to completion", async () => {
    const jobs = await queue.claimBatch(10);
    const claimed = jobs.find((job) => job.id === jobId);
    expect(claimed).toBeTruthy();

    if (!claimed) return;

    await queue.markRunning(claimed.id, claimed.attempts + 1);
    const result = await demoEchoHandler.handle(claimed.payload, { logger });
    expect(result).toBeUndefined();

    await queue.markCompleted(claimed.id);

    const { data } = await service
      .from("background_jobs")
      .select("*")
      .eq("id", claimed.id)
      .single();
    expect(data.status).toBe("completed");
    expect(data.completed_at).not.toBeNull();
  });

  it("does not create duplicates for the same idempotency key", async () => {
    const key = `dup-${Date.now()}`;
    const first = await queue.enqueue({ kind: "demo.echo", payload: { message: "a" }, idempotencyKey: key });
    const second = await queue.enqueue({ kind: "demo.echo", payload: { message: "b" }, idempotencyKey: key });
    expect(second.id).toBeTruthy();
    // Idempotent enqueue: same logical operation must not create a second queued row.
    const { data } = await service
      .from("background_jobs")
      .select("id")
      .eq("idempotency_key", key);
    expect(data).toHaveLength(1);
    void first;
  });
});
