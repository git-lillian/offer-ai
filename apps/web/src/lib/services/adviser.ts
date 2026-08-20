import "server-only";

import { randomUUID } from "node:crypto";
import {
  InstitutionRepository,
  StudentProfileRepository,
  SupabaseAiRunLedger,
} from "@offer-ai/database";
import {
  RecommendationService,
  UK_RULES_VERSION,
} from "@offer-ai/admissions-engine";
import {
  AdviserService,
  buildCourseContext,
  buildRecommendationContext,
  buildStudentContext,
  createAIProvider,
} from "@offer-ai/ai";
import type { ExplainEligibilityResult } from "@offer-ai/ai";
import {
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from "@offer-ai/domain";
import type { Course, CourseRequirement } from "@offer-ai/domain";
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

type EvidenceRow = {
  id: string;
  student_id: string;
  evidence_type: string;
  source_type: string;
  source_document_id: string | null;
  description: string;
  verification_status: string;
  verified_by_user_id: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
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
 * Application service for the AI adviser — deterministic rules decide,
 * LLM explains. Keeps React components and route handlers free of business logic.
 */
export class AdviserApplicationService {
  private readonly recommendationEngine = new RecommendationService();

  async explainEligibilityForUser(
    userId: string,
    courseId: string,
    correlationId: string | null = null,
    structured = false,
  ): Promise<ExplainEligibilityResult> {
    if (!courseId || typeof courseId !== "string") {
      throw new ValidationError("courseId is required.");
    }
    // Basic uuid shape check — zod will re-validate at the API boundary.
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(courseId)) {
      throw new ValidationError("courseId must be a valid UUID.");
    }
    if (correlationId && !uuidPattern.test(correlationId)) {
      throw new ValidationError("correlationId must be a valid UUID.");
    }

    const supabase = await getServerClient();
    const profileRepo = new StudentProfileRepository(supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError("Student profile not found. Complete onboarding first.");
    }

    const qualifications = await profileRepo.listQualifications(profile.id);

    // Evidence refs — best-effort; missing table or RLS just yields empty refs.
    let evidenceItems: {
      id: string;
      verificationStatus: string;
      evidenceType: string;
      studentId: string;
      sourceType: string;
      sourceDocumentId: string | null;
      description: string;
      verifiedByUserId: string | null;
      verifiedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }[] = [];
    try {
      const { data: evidenceRows } = (await supabase
        .from("evidence_items")
        .select("*")
        .eq("student_id", profile.id)) as { data: EvidenceRow[] | null };
      evidenceItems = (evidenceRows ?? []).map((row) => ({
        id: row.id,
        studentId: row.student_id,
        evidenceType: row.evidence_type,
        sourceType: row.source_type as never,
        sourceDocumentId: row.source_document_id,
        description: row.description,
        verificationStatus: row.verification_status as never,
        verifiedByUserId: row.verified_by_user_id,
        verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));
    } catch {
      evidenceItems = [];
    }

    // Course
    const { data: courseRow, error: courseError } = (await supabase
      .from("catalog_courses")
      .select("*")
      .eq("id", courseId)
      .maybeSingle()) as { data: CourseRow | null; error: unknown };
    if (courseError) {
      throw new ValidationError(
        courseError instanceof Error ? courseError.message : "Unable to load course.",
      );
    }
    if (!courseRow) {
      throw new NotFoundError("Course not found.");
    }
    const course = toCourse(courseRow);

    // Institution (optional)
    let institution: Awaited<ReturnType<InstitutionRepository["findById"]>> = null;
    try {
      const institutionRepo = new InstitutionRepository(supabase);
      institution = await institutionRepo.findById(course.institutionId);
    } catch {
      institution = null;
    }

    // Requirements
    const { data: reqRows, error: reqError } = (await supabase
      .from("catalog_course_requirements")
      .select("*")
      .eq("course_id", courseId)
      .is("effective_to", null)) as { data: RequirementRow[] | null; error: unknown };
    if (reqError) {
      throw new ValidationError(
        reqError instanceof Error ? reqError.message : "Unable to load requirements.",
      );
    }
    const requirements = (reqRows ?? []).map(toRequirement);

    // Deterministic recommendation — rules decide, LLM only explains.
    const profileVersion = profile.updatedAt.toISOString();
    const catalogueVersion = course.updatedAt.toISOString();
    const rulesVersion = UK_RULES_VERSION;

    const recommendation = this.recommendationEngine.evaluate({
      student: profile,
      qualifications,
      course,
      requirements,
      context: { profileVersion, catalogueVersion, rulesVersion },
    });

    // Build minimal contexts for the LLM — never hand over full DB records.
    const studentContext = buildStudentContext(profile, qualifications, evidenceItems as never);
    const courseContext = buildCourseContext(course, {
      institution,
      requirements,
    });
    const recommendationContext = buildRecommendationContext(recommendation);

    const effectiveCorrelationId = correlationId ?? randomUUID();

    // Provider + ledger — provider selection is centralised, model names never appear in app code.
    // Read env directly; getServerEnv pulls node:fs via load-root-env and is edge-incompatible.
    // No model name literals here — the provider factory resolves defaults.
    const env = {
      AI_PROVIDER: (process.env.AI_PROVIDER as "fake" | "deepseek" | "opencode") ?? "fake",
      AI_MODEL: process.env.AI_MODEL,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
      OPENCODE_API_KEY: process.env.OPENCODE_API_KEY,
      OPENCODE_BASE_URL: process.env.OPENCODE_BASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      LOG_LEVEL: "info",
    } as unknown as Parameters<typeof createAIProvider>[0];

    let provider: ReturnType<typeof createAIProvider>;
    try {
      provider = createAIProvider(env);
    } catch (e) {
      throw new ExternalServiceError(
        e instanceof Error ? e.message : "AI configuration missing.",
      );
    }
    const serviceClient = getServiceClient();
    const ledger = new SupabaseAiRunLedger(serviceClient);

    const adviserService = new AdviserService({ provider, ledger });

    try {
      if (structured) {
        return await adviserService.explainEligibilityStructured({
          studentId: profile.id,
          courseId: course.id,
          studentContext,
          courseContext,
          recommendation: recommendationContext,
          correlationId: effectiveCorrelationId,
        });
      }
      return await adviserService.explainEligibility({
        studentId: profile.id,
        courseId: course.id,
        studentContext,
        courseContext,
        recommendation: recommendationContext,
        correlationId: effectiveCorrelationId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Map transient provider failures to a typed error for the API boundary.
      if (
        message.toLowerCase().includes("rate limit") ||
        message.includes("429")
      ) {
        throw new ExternalServiceError(message);
      }
      // Preserve DomainError subclasses, otherwise wrap as ExternalServiceError
      // so callers get a typed 502 instead of a generic 500.
      if (error instanceof ExternalServiceError) throw error;
      // Re-throw with context — caller maps DomainErrors to HTTP status.
      // For AI generation failures, surface as ExternalServiceError.
      if (message.includes("AdviserService")) {
        throw new ExternalServiceError(message);
      }
      throw error;
    }
  }
}

export async function createAdviserService(): Promise<AdviserApplicationService> {
  return new AdviserApplicationService();
}
