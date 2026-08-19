import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@offer-ai/database";
import type { NormalizedRecord, CataloguePublisher } from "./pipeline";
import { ValidationError } from "@offer-ai/domain";

type Db = SupabaseClient<Database>;

/**
 * Catalogue publisher with diff + effective dating.
 *
 * For each normalized record:
 * - Resolve candidate course(s) via `catalog_source_courses` mapping or
 *   fallback: any course currently linked to this source (requirement source_id
 *   or intake fee/deadline source). v1 is deliberately limited to sources that
 *   are already associated with courses; a source with no associated courses is
 *   skipped (no silent creation of courses from scraped content).
 * - For `kind: language|academic`: diff against the active (effective_to is null)
 *   requirement of same kind for the course. If sourceText + structured are
 *   identical → skip. Otherwise create a new `catalog_course_requirements` row
 *   with `machine_extracted` and supersede the old one (effective_to = now,
 *   superseded_by_id = new id). Never overwrites history.
 * - For `kind: application` with `tuition_fee` or `application_deadline` in
 *   structured: diff against intakes for the course(s). If fee/deadline differs,
 *   update the intakes with new value + provenance (fee_source_id /
 *   deadline_source_id + observed_at). Keep intake update minimal: only the
 *   provenance-tracked columns, not blind course-level fee.
 *
 * All writes go through the service client (RLS bypass) and are performed
 * one course at a time (RLS not a factor for service role; durability over
 * batching at this scale).
 */
export class CataloguePublisherService implements CataloguePublisher {
  constructor(private readonly db: Db) {}

  async publish(records: NormalizedRecord[]): Promise<void> {
    for (const record of records) {
      const fact = record.fact;
      const canonical = record.canonical;

      if (!canonical.kind || !canonical.verificationStatus) {
        throw new ValidationError("Publisher received incomplete canonical record", { fact });
      }

      const structured = canonical.structured as Record<string, unknown> | null;
      const structuredKind = structured?.kind as string | undefined;

      const associatedCourseIds = await this.resolveCoursesForSource(fact.sourceId);
      if (associatedCourseIds.length === 0) {
        // No known courses for this source — skip silently. v1 never creates
        // courses from ingestion; a human must link the source first.
        continue;
      }

      if (structuredKind === "tuition_fee") {
        await this.publishFee(associatedCourseIds, record);
      } else if (structuredKind === "application_deadline") {
        await this.publishDeadline(associatedCourseIds, record);
      } else {
        // Requirement: language / academic
        for (const courseId of associatedCourseIds) {
          await this.publishRequirement(courseId, record);
        }
      }
    }
  }

  private async resolveCoursesForSource(sourceId: string): Promise<string[]> {
    // Prefer explicit mapping table if present.
    const { data: mapping, error: mappingError } = await this.db
      .from("catalog_source_courses")
      .select("course_id")
      .eq("source_id", sourceId);
    if (!mappingError && mapping && mapping.length > 0) {
      return mapping.map((r) => r.course_id);
    }

    // Fallback: any course that already references this source in requirements or intakes.
    const courseIds = new Set<string>();

    const { data: reqRows } = await this.db
      .from("catalog_course_requirements")
      .select("course_id")
      .eq("source_id", sourceId)
      .limit(20);
    for (const row of reqRows ?? []) courseIds.add((row as { course_id: string }).course_id);

    const { data: intakeRows } = await this.db
      .from("catalog_course_intakes")
      .select("course_id")
      .eq("fee_source_id", sourceId)
      .limit(20);
    for (const row of intakeRows ?? []) courseIds.add((row as { course_id: string }).course_id);

    const { data: deadlineRows } = await this.db
      .from("catalog_course_intakes")
      .select("course_id")
      .eq("application_deadline_source_id", sourceId)
      .limit(20);
    for (const row of deadlineRows ?? []) courseIds.add((row as { course_id: string }).course_id);

    return [...courseIds];
  }

  private async publishRequirement(courseId: string, record: NormalizedRecord): Promise<void> {
    const canonical = record.canonical;
    const structured = canonical.structured;

    const { data: active } = await this.db
      .from("catalog_course_requirements")
      .select("*")
      .eq("course_id", courseId)
      .eq("kind", canonical.kind as string)
      .is("effective_to", null)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (active) {
      const sameText = active.source_text === canonical.sourceText;
      const sameStructured = JSON.stringify(active.structured) === JSON.stringify(structured);
      if (sameText && sameStructured) return; // No change → skip
    }

    const { data: inserted, error: insertError } = await this.db
      .from("catalog_course_requirements")
      .insert({
        course_id: courseId,
        kind: canonical.kind as string,
        structured: structured as never,
        source_text: canonical.sourceText ?? "",
        source_id: record.fact.sourceId,
        verification_status: "machine_extracted",
        effective_from: new Date().toISOString(),
        observed_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
      } as never)
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw new Error(`Failed to publish requirement for course ${courseId}: ${insertError?.message ?? "no id"}`);
    }

    if (active) {
      const newId = (inserted as { id: string }).id;
      await this.db
        .from("catalog_course_requirements")
        .update({
          effective_to: new Date().toISOString(),
          superseded_by_id: newId,
          verification_status: "superseded",
        } as never)
        .eq("id", active.id);
    }
  }

  private async publishFee(courseIds: string[], record: NormalizedRecord): Promise<void> {
    const structured = record.canonical.structured as { tuitionFee: number; currencyCode: string };
    for (const courseId of courseIds) {
      const { data: intakes } = await this.db
        .from("catalog_course_intakes")
        .select("id, tuition_fee, fee_currency_code")
        .eq("course_id", courseId)
        .eq("closed", false)
        .limit(10);

      for (const intake of intakes ?? []) {
        const row = intake as { id: string; tuition_fee: number | null; fee_currency_code: string | null };
        if (row.tuition_fee === structured.tuitionFee && row.fee_currency_code === structured.currencyCode) {
          continue;
        }
        await this.db
          .from("catalog_course_intakes")
          .update({
            tuition_fee: structured.tuitionFee,
            fee_currency_code: structured.currencyCode,
            fee_source_id: record.fact.sourceId,
            fee_observed_at: new Date().toISOString(),
          } as never)
          .eq("id", row.id);
      }
    }
  }

  private async publishDeadline(courseIds: string[], record: NormalizedRecord): Promise<void> {
    const structured = record.canonical.structured as { applicationDeadline: string };
    const deadlineIso = structured.applicationDeadline;
    for (const courseId of courseIds) {
      const { data: intakes } = await this.db
        .from("catalog_course_intakes")
        .select("id, application_deadline")
        .eq("course_id", courseId)
        .eq("closed", false)
        .limit(10);

      for (const intake of intakes ?? []) {
        const row = intake as { id: string; application_deadline: string | null };
        const existing = row.application_deadline ? new Date(row.application_deadline).toISOString() : null;
        const incoming = new Date(deadlineIso).toISOString();
        if (existing === incoming) continue;
        await this.db
          .from("catalog_course_intakes")
          .update({
            application_deadline: incoming,
            application_deadline_source_id: record.fact.sourceId,
            application_deadline_observed_at: new Date().toISOString(),
          } as never)
          .eq("id", row.id);
      }
    }
  }
}
