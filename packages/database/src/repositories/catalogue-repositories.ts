import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type {
  Institution,
  Course,
  CourseIntake,
  ApplicationCycle,
} from "@offer-ai/domain";

type Db = SupabaseClient<Database>;

export class InstitutionRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Institution | null> {
    const { data } = await this.db
      .from("catalog_institutions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      countryCode: data.country_code,
      city: data.city,
      websiteUrl: data.website_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async listAll(limit: number): Promise<Institution[]> {
    const { data } = await this.db
      .from("catalog_institutions")
      .select("*")
      .order("name")
      .limit(limit);
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      countryCode: row.country_code,
      city: row.city,
      websiteUrl: row.website_url,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }
}

export class CourseRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Course | null> {
    const { data } = await this.db
      .from("catalog_courses")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      institutionId: data.institution_id,
      subjectId: data.subject_id,
      title: data.title,
      level: data.level as Course["level"],
      durationMonths: data.duration_months,
      tuitionFee: data.tuition_fee,
      currencyCode: data.currency_code,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async listByInstitution(institutionId: string, limit: number): Promise<Course[]> {
    const { data } = await this.db
      .from("catalog_courses")
      .select("*")
      .eq("institution_id", institutionId)
      .order("title")
      .limit(limit);
    return (data ?? []).map((row) => ({
      id: row.id,
      institutionId: row.institution_id,
      subjectId: row.subject_id,
      title: row.title,
      level: row.level as Course["level"],
      durationMonths: row.duration_months,
      tuitionFee: row.tuition_fee,
      currencyCode: row.currency_code,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }
}

export class CourseIntakeRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<CourseIntake | null> {
    const { data } = await this.db
      .from("catalog_course_intakes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      courseId: data.course_id,
      applicationCycleId: data.application_cycle_id,
      intakeMonth: data.intake_month as CourseIntake["intakeMonth"],
      intakeYear: data.intake_year,
      applicationDeadline: data.application_deadline
        ? new Date(data.application_deadline)
        : null,
      closed: data.closed,
    };
  }

  async listByCourse(courseId: string, limit: number): Promise<CourseIntake[]> {
    const { data } = await this.db
      .from("catalog_course_intakes")
      .select("*")
      .eq("course_id", courseId)
      .order("intake_year")
      .limit(limit);
    return (data ?? []).map((row) => ({
      id: row.id,
      courseId: row.course_id,
      applicationCycleId: row.application_cycle_id,
      intakeMonth: row.intake_month as CourseIntake["intakeMonth"],
      intakeYear: row.intake_year,
      applicationDeadline: row.application_deadline
        ? new Date(row.application_deadline)
        : null,
      closed: row.closed,
    }));
  }
}

export class ApplicationCycleRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<ApplicationCycle | null> {
    const { data } = await this.db
      .from("catalog_application_cycles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      code: data.code,
      startsYear: data.starts_year,
      endsYear: data.ends_year,
      status: data.status as ApplicationCycle["status"],
    };
  }

  async listOpen(): Promise<ApplicationCycle[]> {
    const { data } = await this.db
      .from("catalog_application_cycles")
      .select("*")
      .eq("status", "open")
      .order("starts_year");
    return (data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      startsYear: row.starts_year,
      endsYear: row.ends_year,
      status: row.status as ApplicationCycle["status"],
    }));
  }
}
