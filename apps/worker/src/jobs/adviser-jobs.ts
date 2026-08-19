/**
 * ai.explain_eligibility — background explanation of deterministic eligibility.
 *
 * The job validates its payload with zod, builds minimal adviser contexts
 * (never passing full DB records to the model), calls AdviserService through
 * the `packages/ai` abstraction (never constructing a provider inline), and
 * records the run in `ai_runs` via the ledger. The LLM explains; rules decide.
 */

import { createServiceSupabaseClient } from "@offer-ai/database";
import {
  CourseRepository,
  InstitutionRepository,
  StudentProfileRepository,
  SupabaseAiRunLedger,
} from "@offer-ai/database";
import { createAIProvider } from "@offer-ai/ai";
import { AdviserService } from "@offer-ai/ai";
import { buildCourseContext, buildStudentContext } from "@offer-ai/ai";
import { explainEligibilityJobPayloadSchema } from "@offer-ai/contracts";
import { getServerEnv } from "@offer-ai/config";
import type { JobContext, JobHandler } from "./registry";

export const explainEligibilityHandler: JobHandler = {
  kind: "ai.explain_eligibility",
  async handle(payload, context: JobContext): Promise<void> {
    const parsed = explainEligibilityJobPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Invalid ai.explain_eligibility payload: ${parsed.error.message}`);
    }
    const data = parsed.data;

    context.logger.info("ai.explain_eligibility started", {
      studentId: data.studentId,
      courseId: data.courseId,
      correlationId: data.correlationId ?? context.correlationId ?? undefined,
    });

    const env = getServerEnv();
    const provider = createAIProvider(env);
    const service = createServiceSupabaseClient();
    const ledger = new SupabaseAiRunLedger(service);
    const studentRepo = new StudentProfileRepository(service as unknown as never);
    const courseRepo = new CourseRepository(service as unknown as never);
    const institutionRepo = new InstitutionRepository(service as unknown as never);

    const student = await studentRepo.findById(data.studentId);
    if (!student) {
      throw new Error(`Student not found: ${data.studentId}`);
    }
    const qualifications = await studentRepo.listQualifications(data.studentId);
    // Evidence is optional for explanation; pass empty if repository not queried.
    // Never pass full profile — build minimal context.
    const studentContext = buildStudentContext(student, qualifications, []);

    const course = await courseRepo.findById(data.courseId);
    if (!course) {
      throw new Error(`Course not found: ${data.courseId}`);
    }
    const institution = course.institutionId
      ? await institutionRepo.findById(course.institutionId)
      : null;

    // Requirements are optional; worker does not invent them.
    // A future catalogue repository could supply effective-dated requirements here.
    const courseContext = buildCourseContext(course, { institution, requirements: [] });

    // The deterministic recommendation is carried in the payload — worker never
    // recomputes eligibility with an LLM. Map contract DTO to domain shape for
    // the adviser (they are structurally compatible).
    const recommendation = {
      courseId: data.recommendation.courseId,
      eligibility: data.recommendation.eligibility,
      strategyBand: data.recommendation.strategyBand,
      score: data.recommendation.score,
      confidence: data.recommendation.confidence,
      reasons: data.recommendation.reasons,
      blockers: data.recommendation.blockers,
      missingInformation: data.recommendation.missingInformation,
      profileVersion: data.recommendation.profileVersion,
      catalogueVersion: data.recommendation.catalogueVersion,
      rulesVersion: data.recommendation.rulesVersion,
    };

    const adviser = new AdviserService({ provider, ledger });

    const result = await adviser.explainEligibility({
      studentId: data.studentId,
      courseId: data.courseId,
      studentContext,
      courseContext,
      recommendation,
      correlationId: data.correlationId ?? context.correlationId ?? null,
    });

    // Background generation is observable via ledger + logs; no extra table.
    context.logger.info("ai.explain_eligibility completed", {
      studentId: data.studentId,
      courseId: data.courseId,
      model: result.provenance.model,
      promptVersion: result.provenance.promptVersion,
      latencyMs: result.provenance.latencyMs,
      explanationPreview: result.explanation.slice(0, 120),
    });
  },
};
