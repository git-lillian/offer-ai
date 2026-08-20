import "server-only";
import { StudentProfileRepository } from "@offer-ai/database";
import { NotFoundError } from "@offer-ai/domain";
import { analyzeExperienceGaps } from "@offer-ai/domain";
import type { GapAnalysisResult, StudentExperience } from "@offer-ai/domain";
import type { StudentGoals } from "@offer-ai/domain";
import type { Course, CourseRequirement } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";

type CourseRow = {
  id: string;
  institution_id: string;
  subject_id: string | null;
  title: string;
  slug: string;
  level: string;
  duration_months: number | null;
  tuition_fee: number | null;
  currency_code: string | null;
  application_routes: string[];
  international_applicants_supported: boolean | null;
  created_at: string;
  updated_at: string;
};

type RequirementRow = {
  id: string;
  course_id: string;
  kind: string;
  structured: Record<string, unknown> | null;
  source_text: string;
  source_id: string | null;
  effective_from: string;
  effective_to: string | null;
  observed_at: string;
  published_at: string;
  superseded_by_id: string | null;
  verification_status: string;
};

function toCourse(row: CourseRow): Course {
  return {
    id: row.id,
    institutionId: row.institution_id,
    subjectId: row.subject_id,
    title: row.title,
    slug: row.slug,
    level: row.level as Course["level"],
    durationMonths: row.duration_months,
    tuitionFee: row.tuition_fee,
    currencyCode: row.currency_code,
    applicationRoutes: (row.application_routes ?? []) as Course["applicationRoutes"],
    internationalApplicantsSupported: row.international_applicants_supported,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toRequirement(row: RequirementRow): CourseRequirement {
  return {
    id: row.id,
    courseId: row.course_id,
    kind: row.kind as CourseRequirement["kind"],
    structured: row.structured,
    sourceText: row.source_text,
    sourceId: row.source_id,
    effectiveFrom: new Date(row.effective_from),
    effectiveTo: row.effective_to ? new Date(row.effective_to) : null,
    observedAt: new Date(row.observed_at),
    publishedAt: new Date(row.published_at),
    supersededById: row.superseded_by_id,
    verificationStatus: row.verification_status as CourseRequirement["verificationStatus"],
  };
}

export interface ExperienceGapAnalysisWithContext extends GapAnalysisResult {
  experiences: StudentExperience[];
  goals: StudentGoals | null;
  profileId: string;
}

export class ExperienceGapApplicationService {
  async analyzeForUser(
    userId: string,
    courseIds: string[] = [],
  ): Promise<ExperienceGapAnalysisWithContext> {
    const supabase = await getServerClient();
    const profileRepo = new StudentProfileRepository(supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError("Student profile not found. Complete onboarding first.");
    }

    const experiences = await profileRepo.listExperiences(profile.id);

    // Goals — direct table read (no repository yet)
    let goals: StudentGoals | null = null;
    try {
      const { data } = await supabase
        .from("student_goals")
        .select("student_id, study_goals, career_goals, updated_at")
        .eq("student_id", profile.id)
        .maybeSingle();
      if (data) {
        const row = data as unknown as {
          student_id: string;
          study_goals: string;
          career_goals: string;
          updated_at: string;
        };
        goals = {
          studentId: row.student_id,
          studyGoals: row.study_goals,
          careerGoals: row.career_goals,
          updatedAt: new Date(row.updated_at),
        };
      }
    } catch {
      goals = null;
    }

    let recommendedCourses: Array<{ course: Course; requirements: CourseRequirement[] }> | undefined;
    if (courseIds.length > 0) {
      const { data: courseRows, error: courseError } = await supabase
        .from("catalog_courses")
        .select("*")
        .in("id", courseIds);
      if (courseError) {
        throw new NotFoundError(courseError.message);
      }
      const rows = (courseRows ?? []) as unknown as CourseRow[];
      const courses = rows.map(toCourse);

      const { data: reqRows } = await supabase
        .from("catalog_course_requirements")
        .select("*")
        .in("course_id", courseIds)
        .is("effective_to", null);

      const requirementsByCourse = new Map<string, CourseRequirement[]>();
      for (const row of (reqRows ?? []) as unknown as RequirementRow[]) {
        const req = toRequirement(row);
        const list = requirementsByCourse.get(req.courseId) ?? [];
        list.push(req);
        requirementsByCourse.set(req.courseId, list);
      }

      recommendedCourses = courses.map((course) => ({
        course,
        requirements: requirementsByCourse.get(course.id) ?? [],
      }));
    }

    const result = analyzeExperienceGaps({
      profile,
      experiences,
      goals,
      recommendedCourses,
    });

    return {
      ...result,
      experiences,
      goals,
      profileId: profile.id,
    };
  }
}

export async function createExperienceGapService(): Promise<ExperienceGapApplicationService> {
  return new ExperienceGapApplicationService();
}
