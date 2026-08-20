import "server-only";
import {
  StudentProfileRepository,
  RecommendationRunRepository,
  CatalogueQueryRepository,
} from "@offer-ai/database";
import { RecommendationService } from "@offer-ai/admissions-engine";
import { UK_RULES_VERSION } from "@offer-ai/admissions-engine";
import { NotFoundError, ValidationError } from "@offer-ai/domain";
import type { Course, CourseRequirement } from "@offer-ai/domain";
import type { CourseRecommendation } from "@offer-ai/admissions-engine";
import { getServerClient, getServiceClient } from "@/lib/supabase/server";

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

/**
 * Application service for deterministic recommendations.
 * Framework-aware orchestration (Supabase + domain engine) — keeps
 * React components and route handlers free of business logic.
 */
export class RecommendationApplicationService {
  private readonly engine = new RecommendationService();

  async generateForUser(
    userId: string,
    courseIds: string[],
  ): Promise<CourseRecommendation[]> {
    if (courseIds.length === 0 || courseIds.length > 20) {
      throw new ValidationError("Provide 1 to 20 course ids.");
    }

    const supabase = await getServerClient();
    const profileRepo = new StudentProfileRepository(supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError("Student profile not found. Complete onboarding first.");
    }

    const qualifications = await profileRepo.listQualifications(profile.id);

    const { data: courseRows, error: courseError } = await supabase
      .from("catalog_courses")
      .select("*")
      .in("id", courseIds);

    if (courseError) {
      throw new ValidationError(courseError.message);
    }

    const rows = (courseRows ?? []) as unknown as CourseRow[];
    if (rows.length !== courseIds.length) {
      const foundIds = new Set(rows.map((r) => r.id));
      const missing = courseIds.filter((id) => !foundIds.has(id));
      throw new NotFoundError(`Courses not found: ${missing.join(", ")}`);
    }

    const courses = rows.map(toCourse);

    const { data: reqRows, error: reqError } = await supabase
      .from("catalog_course_requirements")
      .select("*")
      .in("course_id", courseIds)
      .is("effective_to", null);

    if (reqError) {
      throw new ValidationError(reqError.message);
    }

    const requirementsByCourse = new Map<string, CourseRequirement[]>();
    for (const row of (reqRows ?? []) as unknown as RequirementRow[]) {
      const req = toRequirement(row);
      const list = requirementsByCourse.get(req.courseId) ?? [];
      list.push(req);
      requirementsByCourse.set(req.courseId, list);
    }

    const profileVersion = profile.updatedAt.toISOString();
    const catalogueVersion =
      courses
        .map((c) => c.updatedAt.toISOString())
        .sort()
        .pop() ?? new Date().toISOString();
    const rulesVersion = UK_RULES_VERSION;

    const context = { profileVersion, catalogueVersion, rulesVersion };

    const results = this.engine.evaluateBatch({
      student: profile,
      qualifications,
      courses: courses.map((course) => ({
        course,
        requirements: requirementsByCourse.get(course.id) ?? [],
      })),
      context,
    });

    // Persist reproducibility ledger best-effort via service role (RLS blocks client writes).
    try {
      const service = getServiceClient();
      const runRepo = new RecommendationRunRepository(service);
      for (const rec of results) {
        await runRepo.create({
          studentId: profile.id,
          courseId: rec.courseId,
          eligibility: rec.eligibility,
          strategyBand: rec.strategyBand,
          score: rec.score,
          confidence: rec.confidence,
          reasons: rec.reasons as unknown[],
          blockers: rec.blockers as unknown[],
          missingInformation: rec.missingInformation as unknown[],
          profileVersion: rec.profileVersion,
          catalogueVersion: rec.catalogueVersion,
          ruleVersion: rec.rulesVersion,
        });
      }
    } catch {
      // Non-fatal in local/dev without service key; recommendations still returned.
    }

    return results;
  }

  /**
   * Generate for a sample of the catalogue when the caller does not provide
   * explicit course ids (used by the recommendations page).
   * Uses CatalogueQueryRepository for catalogue reads (RLS-enforced).
   */
  async generateSampleForUser(userId: string, limit = 12): Promise<CourseRecommendation[]> {
    const supabase = await getServerClient();
    const catalogueRepo = new CatalogueQueryRepository(supabase);
    const result = await catalogueRepo.searchCourses({ page: 1, pageSize: limit });
    const ids = result.items.map((c) => c.id);
    if (ids.length === 0) return [];
    return this.generateForUser(userId, ids);
  }
}

export async function createRecommendationService(): Promise<RecommendationApplicationService> {
  return new RecommendationApplicationService();
}
