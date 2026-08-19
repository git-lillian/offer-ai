import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

type Db = SupabaseClient<Database>;

export interface SavedCourseRow {
  id: string;
  studentId: string;
  courseId: string;
  createdAt: Date;
}

export interface RecommendationRunRow {
  id: string;
  studentId: string;
  courseId: string;
  eligibility: string;
  strategyBand: string;
  score: number;
  confidence: number;
  reasons: unknown[];
  blockers: unknown[];
  missingInformation: unknown[];
  profileVersion: string;
  catalogueVersion: string;
  ruleVersion: string;
  createdAt: Date;
}

function toSavedCourse(row: Database["public"]["Tables"]["student_saved_courses"]["Row"]): SavedCourseRow {
  return {
    id: row.id,
    studentId: row.student_id,
    courseId: row.course_id,
    createdAt: new Date(row.created_at),
  };
}

function toRecommendationRun(
  row: Database["public"]["Tables"]["recommendation_runs"]["Row"],
): RecommendationRunRow {
  return {
    id: row.id,
    studentId: row.student_id,
    courseId: row.course_id,
    eligibility: row.eligibility,
    strategyBand: row.strategy_band,
    score: row.score,
    confidence: Number(row.confidence),
    reasons: (row.reasons as unknown as unknown[]) ?? [],
    blockers: (row.blockers as unknown as unknown[]) ?? [],
    missingInformation: (row.missing_information as unknown as unknown[]) ?? [],
    profileVersion: row.profile_version,
    catalogueVersion: row.catalogue_version,
    ruleVersion: row.rule_version,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Student saved courses — RLS-owner writes.
 *
 * Policies in 0020 restrict access to the linked student owner
 * (`public.is_student_owner(student_id)`). The service role bypasses RLS.
 */
export class SavedCourseRepository {
  constructor(private readonly db: Db) {}

  async list(studentId: string): Promise<SavedCourseRow[]> {
    const { data, error } = await this.db
      .from("student_saved_courses")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toSavedCourse);
  }

  async isSaved(studentId: string, courseId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from("student_saved_courses")
      .select("id")
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }

  async save(studentId: string, courseId: string): Promise<SavedCourseRow> {
    const { data, error } = await this.db
      .from("student_saved_courses")
      .insert({ student_id: studentId, course_id: courseId })
      .select("*")
      .single();
    if (error) throw error;
    return toSavedCourse(data as Database["public"]["Tables"]["student_saved_courses"]["Row"]);
  }

  async unsave(studentId: string, courseId: string): Promise<void> {
    const { error } = await this.db
      .from("student_saved_courses")
      .delete()
      .eq("student_id", studentId)
      .eq("course_id", courseId);
    if (error) throw error;
  }

  async listCourseIds(studentId: string): Promise<string[]> {
    const rows = await this.list(studentId);
    return rows.map((r) => r.courseId);
  }
}

/**
 * Recommendation runs — reproducibility ledger.
 *
 * Written by the service role (application service / worker). Students may
 * read their own runs via RLS; the browser never writes directly.
 */
export class RecommendationRunRepository {
  constructor(private readonly db: Db) {}

  async listByStudent(studentId: string, limit = 50): Promise<RecommendationRunRow[]> {
    const { data, error } = await this.db
      .from("recommendation_runs")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toRecommendationRun);
  }

  async listByStudentAndCourse(studentId: string, courseId: string): Promise<RecommendationRunRow[]> {
    const { data, error } = await this.db
      .from("recommendation_runs")
      .select("*")
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toRecommendationRun);
  }

  async create(input: {
    studentId: string;
    courseId: string;
    eligibility: string;
    strategyBand: string;
    score: number;
    confidence: number;
    reasons: unknown[];
    blockers: unknown[];
    missingInformation: unknown[];
    profileVersion: string;
    catalogueVersion: string;
    ruleVersion: string;
  }): Promise<RecommendationRunRow> {
    const { data, error } = await this.db
      .from("recommendation_runs")
      .insert({
        student_id: input.studentId,
        course_id: input.courseId,
        eligibility: input.eligibility,
        strategy_band: input.strategyBand,
        score: input.score,
        confidence: input.confidence,
        reasons: input.reasons as never,
        blockers: input.blockers as never,
        missing_information: input.missingInformation as never,
        profile_version: input.profileVersion,
        catalogue_version: input.catalogueVersion,
        rule_version: input.ruleVersion,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toRecommendationRun(data as Database["public"]["Tables"]["recommendation_runs"]["Row"]);
  }
}
