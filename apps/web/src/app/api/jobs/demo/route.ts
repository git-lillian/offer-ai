import { NextResponse } from "next/server";
import { demoEchoJobPayloadSchema } from "@offer-ai/contracts";
import { JobQueue } from "@offer-ai/database";
import { requireUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";

/**
 * POST /api/jobs/demo
 *
 * Enqueues a `demo.echo` background job to prove the enqueue → worker →
 * idempotent completion loop. Requires an authenticated session.
 *
 * Body: { "message": "hello worker" }
 */
export async function POST(request: Request) {
  try {
    await requireUser();

    const body = await request.json().catch(() => null);
    const parsed = demoEchoJobPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const service = getServiceClient();
    const queue = new JobQueue(service);
    const job = await queue.enqueue({
      kind: "demo.echo",
      payload: parsed.data,
      idempotencyKey: `demo.echo:${parsed.data.message}`,
      correlationId: randomUUID(),
    });

    return NextResponse.json({ jobId: job.id, status: job.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to enqueue job." },
      { status: 500 },
    );
  }
}
