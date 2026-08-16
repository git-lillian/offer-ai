import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type {
  ApplicationCase,
  ApplicationEvent,
} from "@offer-ai/domain";

type Db = SupabaseClient<Database>;

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

  async create(caseRecord: ApplicationCase): Promise<ApplicationCase> {
    const { data, error } = await this.db
      .from("application_cases")
      .insert({
        id: caseRecord.id,
        student_id: caseRecord.studentId,
        institution_id: caseRecord.institutionId,
        course_id: caseRecord.courseId,
        course_intake_id: caseRecord.courseIntakeId,
        application_cycle_id: caseRecord.applicationCycleId,
        application_route: caseRecord.applicationRoute,
        current_status: caseRecord.currentStatus,
      })
      .select("*")
      .single();
    if (error) throw error;
    return this.toCase(data);
  }

  async updateStatus(id: string, status: ApplicationCase["currentStatus"]) {
    const { data, error } = await this.db
      .from("application_cases")
      .update({ current_status: status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return this.toCase(data);
  }

  async appendEvent(event: ApplicationEvent): Promise<ApplicationEvent> {
    const { data, error } = await this.db
      .from("application_events")
      .insert({
        id: event.id,
        case_id: event.caseId,
        event_type: event.eventType,
        status: event.status,
        actor_user_id: event.actorUserId,
        message: event.message,
        metadata: event.metadata,
        occurred_at: event.occurredAt.toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return this.toEvent(data);
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
