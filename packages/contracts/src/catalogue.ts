import { z } from "zod";

/** Coerces empty-string query params (from HTML forms) to `undefined`. */
function emptyToUndefined(value: unknown): unknown {
  return value === "" || value === null ? undefined : value;
}

function optionalString() {
  return z.preprocess(emptyToUndefined, z.string().trim().max(120).optional());
}

/** Study levels offered in the catalogue. */
export const catalogueStudyLevelSchema = z.enum([
  "foundation",
  "undergraduate",
  "postgraduate_taught",
  "postgraduate_research",
  "phd",
]);

/** Tuition range filter (in a currency). */
export const tuitionRangeSchema = z
  .object({
    currencyCode: z
      .string()
      .regex(/^[A-Z]{3}$/, "Must be an ISO 4217 currency code.")
      .optional(),
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().nonnegative().optional(),
  })
  .refine((value) => {
    if (value.min === undefined || value.max === undefined) return true;
    return value.min <= value.max;
  }, "Minimum tuition cannot exceed maximum.");

/**
 * Query parameters for catalogue course search.
 *
 * All filters are optional; combining them narrows the result set. Filtering
 * happens in PostgreSQL (no external search service); pagination is
 * mandatory and page-based.
 */
export const courseSearchParamsSchema = z.object({
  /** Free-text search against institution name, course title and subject. */
  query: optionalString(),
  institutionSlug: optionalString(),
  subjectSlug: optionalString(),
  level: z.preprocess(emptyToUndefined, catalogueStudyLevelSchema.optional()),
  city: optionalString(),
  /** Open intakes in this entry year. */
  intakeYear: z.preprocess(emptyToUndefined, z.coerce.number().int().min(2000).max(2100).optional()),
  tuitionRange: tuitionRangeSchema.optional(),
  internationalApplicantsSupported: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export type CourseSearchParams = z.infer<typeof courseSearchParamsSchema>;

/** Facet values shown alongside search results. */
export const catalogueFacetsSchema = z.object({
  levels: z.array(z.object({ level: catalogueStudyLevelSchema, count: z.number() })),
  subjects: z.array(z.object({ id: z.string(), slug: z.string(), name: z.string(), count: z.number() })),
  cities: z.array(z.object({ city: z.string(), count: z.number() })),
  intakeYears: z.array(z.object({ intakeYear: z.number(), count: z.number() })),
  internationalSupported: z.object({ known: z.number(), yes: z.number() }),
  tuitionMin: z.number().nullable(),
  tuitionMax: z.number().nullable(),
});

export type CatalogueFacets = z.infer<typeof catalogueFacetsSchema>;

export const institutionSearchParamsSchema = z.object({
  query: optionalString(),
  countryCode: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^[A-Z]{2}$/).optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(24),
});

export type InstitutionSearchParams = z.infer<typeof institutionSearchParamsSchema>;
