import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type {
  ApplicationCase,
  ApplicationEvent,
  ApplicationEventType,
  ApplicationCaseStatus,
  ApplicationRoute,
} from "@offer-ai/domain";

type Db = SupabaseClient<Database>;

export interface ApplicationCaseCreationInput {
  studentId: string;
  institutionId: string;
  courseId: string;
  courseIntakeId: string;
  applicationCycleId: string;
  applicationRoute: ApplicationRoute;
  actorUserId: string;
}

export interface ApplicationCaseTransitionInput {
  caseId: string;
  toStatus: ApplicationCaseStatus;
  actorUserId: string;
  eventType: ApplicationEventType;
  message?: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Application case persistence against the atomic, security-definer RPCs.
 *
 * Client-side insert/update policies on `application_cases` /
 * `application_events` do not exist by design: the database enforces the
 * status machine and the institution/course/intake/cycle invariants inside
 * one transaction, and RLS is checked inside the functions. Repositories
 * therefore never write those tables directly from the browser path.
 */
export class ApplicationCaseRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<ApplicationCase | null> {
    const { data } = await this.db
      .from("application_cases")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    return this.toCase(data);
  }

  async listByStudent(studentId: string): Promise<ApplicationCase[]> {
    const { data } = await this.db
      .from("application_cases")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    return (data ?? []).map((row) => this.toCase(row));
  }

  /** Atomically creates the case and its `created` event. */
  async create(
    input: ApplicationCaseCreationInput,
  ): Promise<{ caseRecord: ApplicationCase; createdEvent: ApplicationEvent }> {
    const { data, error } = await this.db.rpc("create_application_case", {
      p_student_id: input.studentId,
      p_institution_id: input.institutionId,
      p_course_id: input.courseId,
      p_course_intake_id: input.courseIntakeId,
      p_application_cycle_id: input.applicationCycleId,
      p_application_route: input.applicationRoute,
      p_actor_user_id: input.actorUserId,
    });
    if (error) throw error;

    const payload = (data ?? {}) as {
      case?: Database["public"]["Tables"]["application_cases"]["Row"];
      event?: Database["public"]["Tables"]["application_events"]["Row"];
    };
    if (!payload.case || !payload.event) {
      throw new Error("create_application_case returned an unexpected payload.");
    }
    return { caseRecord: this.toCase(payload.case), createdEvent: this.toEvent(payload.event) };
  }

  /** Atomically transitions status and appends the status event. */
  async transition(
    input: ApplicationCaseTransitionInput,
  ): Promise<{ caseRecord: ApplicationCase; event: ApplicationEvent }> {
    const { data, error } = await this.db.rpc("transition_application_case", {
      p_case_id: input.caseId,
      p_to_status: input.toStatus,
      p_actor_user_id: input.actorUserId,
      p_event_type: input.eventType,
      p_message: input.message ?? "",
      p_metadata: input.metadata ?? null,
    });
    if (error) throw error;

    const event = this.toEvent(
      data as Database["public"]["Tables"]["application_events"]["Row"],
    );
    const caseRecord = await this.findById(input.caseId);
    if (!caseRecord) throw new Error("Application case not found after transition.");
    return { caseRecord, event };
  }

  /** Appends a non-status event (notes, documents) through the controlled RPC. */
  async appendEvent(input: {
    caseId: string;
    eventType: ApplicationEventType;
    status: ApplicationCaseStatus;
    actorUserId: string;
    message: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<ApplicationEvent> {
    const { data, error } = await this.db.rpc("append_application_event", {
      p_case_id: input.caseId,
      p_event_type: input.eventType,
      p_status: input.status,
      p_actor_user_id: input.actorUserId,
      p_message: input.message,
      p_metadata: input.metadata ?? null,
    });
    if (error) throw error;
    return this.toEvent(data as Database["public"]["Tables"]["application_events"]["Row"]);
  }

  async listEvents(caseId: string): Promise<ApplicationEvent[]> {
    const { data } = await this.db
      .from("application_events")
      .select("*")
      .eq("case_id", caseId)
      .order("occurred_at", { ascending: true });
    return (data ?? []).map((row) => this.toEvent(row));
  }

  private toCase(row: Database["public"]["Tables"]["application_cases"]["Row"]): ApplicationCase {
    return {
      id: row.id,
      studentId: row.student_id,
      institutionId: row.institution_id,
      courseId: row.course_id,
      courseIntakeId: row.course_intake_id,
      applicationCycleId: row.application_cycle_id,
      applicationRoute: row.application_route as ApplicationCase["applicationRoute"],
      currentStatus: row.current_status as ApplicationCase["currentStatus"],
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private toEvent(
    row: Database["public"]["Tables"]["application_events"]["Row"],
  ): ApplicationEvent {
    return {
      id: row.id,
      caseId: row.case_id,
      eventType: row.event_type as ApplicationEvent["eventType"],
      status: row.status as ApplicationEvent["status"],
      actorUserId: row.actor_user_id ?? "",
      message: row.message,
      metadata: row.metadata as Record<string, unknown> | null,
      occurredAt: new Date(row.occurred_at),
    };
  }
}
