import type { CourseRequirement } from "@offer-ai/domain";
import type { ExtractedFact, NormalizedRecord, Normalizer } from "./pipeline";
import { ValidationError } from "@offer-ai/domain";
import { z } from "zod";

const structuredFeeSchema = z.object({
  kind: z.literal("tuition_fee"),
  tuitionFee: z.number().int().positive(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  observedAt: z.string(),
});

const structuredDeadlineSchema = z.object({
  kind: z.literal("application_deadline"),
  applicationDeadline: z.string(),
  observedAt: z.string(),
});

const structuredLanguageSchema = z.object({
  kind: z.literal("language"),
  test: z.string(),
  overall: z.number(),
  componentMinimum: z.number().nullable().optional(),
  observedAt: z.string(),
});

const structuredAcademicSchema = z.object({
  kind: z.literal("academic"),
  degreeClass: z.string(),
  observedAt: z.string(),
});

/**
 * Normalizer: maps `ExtractedFact.structured` into canonical catalogue records.
 *
 * v1 maps to `CourseRequirement` (and intake fee/deadline via structured
 * discriminant). Facts that fail zod validation are dropped with a warning
 * rather than crashing the pipeline — validation is a boundary, not a crash.
 */
export class IngestionNormalizer implements Normalizer {
  async normalize(facts: ExtractedFact[]): Promise<NormalizedRecord[]> {
    const records: NormalizedRecord[] = [];
    for (const fact of facts) {
      const normalized = normalizeOne(fact);
      if (normalized) records.push(normalized);
    }
    return records;
  }
}

function normalizeOne(fact: ExtractedFact): NormalizedRecord | null {
  const structured = fact.structured as Record<string, unknown>;
  const kindDiscriminant = structured.kind as string | undefined;

  switch (kindDiscriminant) {
    case "tuition_fee": {
      const parsed = structuredFeeSchema.safeParse(structured);
      if (!parsed.success) return null;
      // Tuition fees live on intakes, but we normalize them as a course-level
      // requirement candidate with structured fee so the publisher can decide
      // whether to update intakes. Keeps normalizer course-agnostic.
      const canonical: Partial<CourseRequirement> = {
        kind: "application",
        structured: {
          kind: "tuition_fee",
          tuitionFee: parsed.data.tuitionFee,
          currencyCode: parsed.data.currencyCode,
        },
        sourceText: fact.sourceText,
        sourceId: fact.sourceId,
        verificationStatus: "machine_extracted",
      };
      return { fact, canonical };
    }
    case "application_deadline": {
      const parsed = structuredDeadlineSchema.safeParse(structured);
      if (!parsed.success) return null;
      const canonical: Partial<CourseRequirement> = {
        kind: "application",
        structured: {
          kind: "application_deadline",
          applicationDeadline: parsed.data.applicationDeadline,
        },
        sourceText: fact.sourceText,
        sourceId: fact.sourceId,
        verificationStatus: "machine_extracted",
      };
      return { fact, canonical };
    }
    case "language": {
      const parsed = structuredLanguageSchema.safeParse(structured);
      if (!parsed.success) return null;
      const canonical: Partial<CourseRequirement> = {
        kind: "language",
        structured: {
          test: parsed.data.test,
          overall: parsed.data.overall,
          componentMinimum: parsed.data.componentMinimum ?? null,
        },
        sourceText: fact.sourceText,
        sourceId: fact.sourceId,
        verificationStatus: "machine_extracted",
      };
      return { fact, canonical };
    }
    case "academic": {
      const parsed = structuredAcademicSchema.safeParse(structured);
      if (!parsed.success) return null;
      const canonical: Partial<CourseRequirement> = {
        kind: "academic",
        structured: {
          degreeClass: parsed.data.degreeClass,
        },
        sourceText: fact.sourceText,
        sourceId: fact.sourceId,
        verificationStatus: "machine_extracted",
      };
      return { fact, canonical };
    }
    default:
      return null;
  }
}

/** Validates a normalized record before publishing — throws ValidationError on failure. */
export function validateNormalizedRecord(record: NormalizedRecord): void {
  if (!record.canonical.kind) {
    throw new ValidationError("Normalized record missing kind", { fact: record.fact });
  }
  if (!record.canonical.verificationStatus) {
    throw new ValidationError("Normalized record missing verificationStatus", { fact: record.fact });
  }
}
