import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type {
  CourseSearchParams,
  InstitutionSearchParams,
  CatalogueFacets,
} from "@offer-ai/contracts";
import type { CourseRequirement, Institution, Source } from "@offer-ai/domain";

type Db = SupabaseClient<Database>;

export interface CourseSummary {
  id: string;
  title: string;
  slug: string;
  level: string;
  durationMonths: number | null;
  tuitionFee: number | null;
  currencyCode: string | null;
  applicationRoutes: string[];
  internationalApplicantsSupported: boolean | null;
  institutionId: string;
  institutionName: string;
  institutionSlug: string;
  institutionCity: string | null;
  subjectId: string | null;
  subjectName: string | null;
  subjectSlug: string | null;
  openIntakeCount: number;
  earliestDeadline: string | null;
}

export interface InstitutionSummary {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  city: string | null;
  websiteUrl: string | null;
  courseCount: number;
}

export interface CourseSearchResult {
  total: number;
  items: CourseSummary[];
  facets: CatalogueFacets;
}

export interface CourseDetail extends CourseSummary {
  institutionCountryCode: string;
  websiteUrl: string | null;
  requirements: CourseRequirement[];
  intakes: {
    id: string;
    intakeMonth: number;
    intakeYear: number;
    applicationDeadline: string | null;
    applicationDeadlineSource: Source | null;
    tuitionFee: number | null;
    feeCurrencyCode: string | null;
    feeSource: Source | null;
    closed: boolean;
    cycleCode: string;
  }[];
}

/** Public catalogue reads — search, filters, pagination and detail pages. */
export class CatalogueQueryRepository {
  constructor(private readonly db: Db) {}

  async searchCourses(
    params: CourseSearchParams,
  ): Promise<CourseSearchResult> {
    const { data, error } = await this.db.rpc("catalog_search_courses", {
      p_query: params.query ?? null,
      p_institution_slug: params.institutionSlug ?? null,
      p_subject_slug: params.subjectSlug ?? null,
      p_level: params.level ?? null,
      p_city: params.city ?? null,
      p_intake_year: params.intakeYear ?? null,
      p_tuition_min: params.tuitionRange?.min ?? null,
      p_tuition_max: params.tuitionRange?.max ?? null,
      p_tuition_currency: params.tuitionRange?.currencyCode ?? null,
      p_international: params.internationalApplicantsSupported ?? null,
      p_page: params.page,
      p_page_size: params.pageSize,
    });
    if (error) throw error;

    const payload = (data ?? {}) as {
      total?: number;
      items?: CourseSummary[];
      facets?: CourseSearchResult["facets"];
    };
    return {
      total: payload.total ?? 0,
      items: payload.items ?? [],
      facets: payload.facets ?? {
        levels: [],
        subjects: [],
        cities: [],
        intakeYears: [],
        internationalSupported: { known: 0, yes: 0 },
        tuitionMin: null,
        tuitionMax: null,
      },
    };
  }

  async searchInstitutions(
    params: InstitutionSearchParams,
  ): Promise<{ total: number; items: InstitutionSummary[] }> {
    const { data, error } = await this.db.rpc("catalog_search_institutions", {
      p_query: params.query ?? null,
      p_country_code: params.countryCode ?? null,
      p_page: params.page,
      p_page_size: params.pageSize,
    });
    if (error) throw error;

    const payload = (data ?? {}) as { total?: number; items?: InstitutionSummary[] };
    return { total: payload.total ?? 0, items: payload.items ?? [] };
  }

  async getInstitutionBySlug(slug: string): Promise<InstitutionSummary | null> {
    const { data } = await this.db
      .from("catalog_institutions")
      .select(
        "id, name, slug, country_code, city, website_url, courses:catalog_courses(count)",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      countryCode: data.country_code,
      city: data.city,
      websiteUrl: data.website_url,
      courseCount: (data.courses as unknown as { count: number }[] | null)?.length ?? 0,
    };
  }

  /** Courses of one institution, filtered by the same search parameters. */
  async searchCoursesByInstitution(
    institutionSlug: string,
    params: Omit<CourseSearchParams, "institutionSlug">,
  ): Promise<CourseSearchResult> {
    return this.searchCourses({ ...params, institutionSlug });
  }

  async getCourseBySlugs(
    institutionSlug: string,
    courseSlug: string,
  ): Promise<CourseDetail | null> {
    const { data: course } = await this.db
      .from("catalog_courses")
      .select("*, catalog_institutions(*), catalog_subjects(*)")
      .eq("catalog_institutions.slug", institutionSlug)
      .eq("slug", courseSlug)
      .maybeSingle();
    if (!course) return null;

    const institution = course.catalog_institutions as unknown as {
      name: string;
      slug: string;
      city: string | null;
      country_code: string;
      website_url: string | null;
    };

    const [requirements, intakes] = await Promise.all([
      this.db
        .from("catalog_course_requirements")
        .select("*, catalog_sources(*)")
        .eq("course_id", course.id)
        .is("effective_to", null)
        .order("published_at", { ascending: false }),
      this.db
        .from("catalog_course_intakes")
        .select("*, catalog_application_cycles(*), fee_source:catalog_sources!fee_source_id(*), deadline_source:catalog_sources!application_deadline_source_id(*)")
        .eq("course_id", course.id)
        .order("intake_year", { ascending: true }),
    ]);

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      level: course.level,
      durationMonths: course.duration_months,
      tuitionFee: course.tuition_fee,
      currencyCode: course.currency_code,
      applicationRoutes: course.application_routes,
      internationalApplicantsSupported: course.international_applicants_supported,
      institutionId: course.institution_id,
      institutionName: institution.name,
      institutionSlug: institution.slug,
      institutionCity: institution.city,
      institutionCountryCode: institution.country_code,
      websiteUrl: institution.website_url,
      subjectId: course.subject_id,
      subjectName: null,
      subjectSlug: null,
      openIntakeCount: 0,
      earliestDeadline: null,
      requirements: (requirements.data ?? []).map((row) => ({
        id: row.id,
        courseId: row.course_id,
        kind: row.kind as CourseRequirement["kind"],
        structured: row.structured as Record<string, unknown> | null,
        sourceText: row.source_text,
        sourceId: row.source_id,
        effectiveFrom: new Date(row.effective_from),
        effectiveTo: row.effective_to ? new Date(row.effective_to) : null,
        observedAt: new Date(row.observed_at),
        publishedAt: new Date(row.published_at),
        supersededById: row.superseded_by_id,
        verificationStatus: row.verification_status as CourseRequirement["verificationStatus"],
      })),
      intakes: (intakes.data ?? []).map((row) => ({
        id: row.id,
        intakeMonth: row.intake_month,
        intakeYear: row.intake_year,
        applicationDeadline: row.application_deadline,
        tuitionFee: row.tuition_fee,
        feeCurrencyCode: row.fee_currency_code,
        closed: row.closed,
        cycleCode: (row.catalog_application_cycles as unknown as { code: string })?.code ?? "",
        feeSource: toSource(row.fee_source as never),
        applicationDeadlineSource: toSource(row.deadline_source as never),
      })),
    };
  }
}

function toSource(
  row: Database["public"]["Tables"]["catalog_sources"]["Row"] | null | undefined,
): Source | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    sourceOwner: row.source_owner,
    extractorVersion: row.extractor_version,
    fetchPolicy: row.fetch_policy,
    enabled: row.enabled,
    lastVerifiedAt: row.last_verified_at ? new Date(row.last_verified_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export type { Institution as InstitutionDetail };
