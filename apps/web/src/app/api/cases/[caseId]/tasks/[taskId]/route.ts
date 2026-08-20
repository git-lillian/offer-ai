import { NextResponse } from "next/server";
import { updateTaskSchema, completeOsTaskSchema } from "@offer-ai/contracts";
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string; taskId: string }> },
) {
  try {
    const { caseId, taskId } = await params;
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    // Support two shapes: generic update (title, status, etc) and complete (completionEvidence)
    // Try complete schema first if status is completed and evidence present, else update schema.
    const rawStatus = (body as { status?: unknown } | null)?.status;

    if (rawStatus === "completed") {
      // Expect completionEvidence — validate with complete schema but also allow other patches?
      // For completed transition we require evidence; merge and validate with updateTaskSchema which
      // allows evidence + status, so use updateTaskSchema for unified path.
    }

    // Use updateTaskSchema for all PATCH — it covers title, description, status, etc.
    // Ensure taskId from route is used.
    const candidate = {
      taskId,
      ...(body ?? {}),
    };

    // If body contains no status/priority etc but contains completionEvidence alone, still validate.
    const parsedUpdate = updateTaskSchema.safeParse(candidate);
    const parsedComplete = completeOsTaskSchema.safeParse(candidate);

    // Prefer updateTaskSchema if it succeeds; if it fails but complete succeeds (evidence only), allow complete.
    // However complete also needs status handling — we delegate to service.updateTask which handles status=completed + evidence.
    let patchForService: {
      title?: string;
      description?: string;
      priority?: ApplicationTask["priority"];
      status?: ApplicationTask["status"];
      dueAt?: string | null;
      assigneeUserId?: string | null;
      completionEvidence?: string;
    } = {};

    if (parsedUpdate.success) {
      patchForService = {
        title: parsedUpdate.data.title,
        description: parsedUpdate.data.description,
        priority: parsedUpdate.data.priority,
        status: parsedUpdate.data.status,
        dueAt: parsedUpdate.data.dueAt ?? undefined,
        assigneeUserId: parsedUpdate.data.assigneeUserId,
        completionEvidence: parsedUpdate.data.completionEvidence,
      };
    } else if (parsedComplete.success) {
      // Standalone complete with evidence (client may send only evidence + taskId)
      patchForService = {
        status: "completed",
        completionEvidence: parsedComplete.data.completionEvidence,
      };
    } else {
      // Prefer update error message
      const err = parsedUpdate.error.issues[0]?.message ?? parsedComplete.error.issues[0]?.message ?? "Invalid input.";
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const service = new ApplicationOsService(supabase);
    const updated = await service.updateTask(caseId, taskId, user.id, patchForService);

    return NextResponse.json({ task: toTaskDto(updated) });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update task." },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; taskId: string }> },
) {
  try {
    const { caseId, taskId } = await params;
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const service = new ApplicationOsService(supabase);
    const tasks = await service.listTasks(caseId, user.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }
    return NextResponse.json({ task: toTaskDto(task) });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch task." },
      { status: 500 },
    );
  }
}
