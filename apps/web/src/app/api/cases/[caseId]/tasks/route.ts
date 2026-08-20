import { NextResponse } from "next/server";
import { createOsTaskSchema } from "@offer-ai/contracts";
import { isDomainError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import { ApplicationOsService } from "@/lib/services/application-os";
import type { ApplicationTask } from "@offer-ai/domain";

function toTaskDto(task: ApplicationTask) {
  return {
    id: task.id,
    caseId: task.caseId,
    title: task.title,
    description: task.description,
    source: task.source,
    assigneeUserId: task.assigneeUserId,
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
    priority: task.priority,
    status: task.status,
    completionEvidence: task.completionEvidence,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params;
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const service = new ApplicationOsService(supabase);
    const tasks = await service.listTasks(caseId, user.id);
    return NextResponse.json({ tasks: tasks.map(toTaskDto), total: tasks.length });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list tasks." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params;
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    // Derive caseId from route — never trust body caseId for ownership.
    const candidate = {
      ...(body ?? {}),
      caseId,
    };

    const parsed = createOsTaskSchema.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    if (parsed.data.caseId !== caseId) {
      return NextResponse.json({ error: "caseId mismatch." }, { status: 400 });
    }

    const service = new ApplicationOsService(supabase);
    const task = await service.createTask(caseId, user.id, {
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      source: parsed.data.source,
      priority: parsed.data.priority,
      dueAt: parsed.data.dueAt ?? null,
      assigneeUserId: parsed.data.assigneeUserId ?? null,
    });

    return NextResponse.json({ task: toTaskDto(task) }, { status: 201 });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create task." },
      { status: 500 },
    );
  }
}
