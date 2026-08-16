-- 0018_catalogue_search.sql
-- Search-ready catalogue for browsing (Milestone 2).
--
-- 1. pg_trgm indexes for case-insensitive substring search on
--    institution/subject/course names and titles (PostgreSQL-only search;
--    no Elasticsearch).
-- 2. International-applicant support flag on courses (filterable).
-- 3. Filterable-column indexes.
-- 4. Search RPCs with filters, pagination and facets (`catalog_search_*`).

-- ── 1) Trigram search ───────────────────────────────────────────────────────
create extension if not exists pg_trgm;

create index catalog_institutions_name_trgm_idx
  on public.catalog_institutions using gin (name gin_trgm_ops);

create index catalog_subjects_name_trgm_idx
  on public.catalog_subjects using gin (name gin_trgm_ops);

create index catalog_courses_title_trgm_idx
  on public.catalog_courses using gin (title gin_trgm_ops);

-- ── 2) International applicant support ─────────────────────────────────────
-- Whether the course accepts international applicants (visa-holding
-- students). Nullable so ingestion can leave it unknown; filters only match
-- rows where it is known.
alter table public.catalog_courses
  add column international_applicants_supported boolean;

create index catalog_courses_international_idx
  on public.catalog_courses (international_applicants_supported);

-- ── 3) Filterable-column indexes ────────────────────────────────────────────
create index catalog_courses_level_idx
  on public.catalog_courses (level);

create index catalog_courses_subject_idx
  on public.catalog_courses (subject_id);

create index catalog_courses_tuition_idx
  on public.catalog_courses (tuition_fee, currency_code);

create index catalog_institutions_country_idx
  on public.catalog_institutions (country_code, city);

create index catalog_intakes_year_idx
  on public.catalog_course_intakes (intake_year);

-- ── 4) Search RPCs ──────────────────────────────────────────────────────────
-- One round trip per search: rows, total count, and facet aggregates over
-- the matched set. Filters compose with AND; all are optional.

create or replace function public.catalog_search_courses(
  p_query text default null,
  p_institution_slug text default null,
  p_subject_slug text default null,
  p_level text default null,
  p_city text default null,
  p_intake_year integer default null,
  p_tuition_min integer default null,
  p_tuition_max integer default null,
  p_tuition_currency text default null,
  p_international boolean default null,
  p_page integer default 1,
  p_page_size integer default 12
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_query text := coalesce(btrim(p_query), '');
  v_result jsonb;
begin
  with base as (
    select c.id, c.institution_id, c.subject_id, c.title, c.slug, c.level,
           c.duration_months, c.tuition_fee, c.currency_code,
           c.application_routes, c.international_applicants_supported,
           i.name as institution_name, i.slug as institution_slug, i.city as institution_city,
           s.name as subject_name, s.slug as subject_slug,
           (select count(*) filter (where ci.closed = false)
              from public.catalog_course_intakes ci where ci.course_id = c.id) as open_intake_count,
           (select min(ci.application_deadline) filter (where ci.closed = false)
              from public.catalog_course_intakes ci where ci.course_id = c.id) as earliest_deadline
      from public.catalog_courses c
      join public.catalog_institutions i on i.id = c.institution_id
      left join public.catalog_subjects s on s.id = c.subject_id
     where (v_query = '' or c.title ilike '%' || v_query || '%'
                          or i.name ilike '%' || v_query || '%'
                          or coalesce(s.name, '') ilike '%' || v_query || '%')
       and (p_institution_slug is null or i.slug = p_institution_slug)
       and (p_subject_slug is null or s.slug = p_subject_slug)
       and (p_level is null or c.level = p_level)
       and (p_city is null or i.city ilike '%' || p_city || '%')
       and (p_intake_year is null or exists (
             select 1 from public.catalog_course_intakes ci
             where ci.course_id = c.id and ci.intake_year = p_intake_year and ci.closed = false))
       and (p_international is null or c.international_applicants_supported = p_international)
       and (p_tuition_min is null or (c.tuition_fee >= p_tuition_min
           and (p_tuition_currency is null or c.currency_code = p_tuition_currency)))
       and (p_tuition_max is null or (c.tuition_fee <= p_tuition_max
           and (p_tuition_currency is null or c.currency_code = p_tuition_currency)))
  ),
  items as (
    select base.*,
           count(*) over () as total_count,
           row_number() over (order by base.institution_name, base.title) as rn
      from base
  )
  select jsonb_build_object(
    'total', (select max(total_count) from items),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'title', i.title,
        'slug', i.slug,
        'level', i.level,
        'durationMonths', i.duration_months,
        'tuitionFee', i.tuition_fee,
        'currencyCode', i.currency_code,
        'applicationRoutes', i.application_routes,
        'internationalApplicantsSupported', i.international_applicants_supported,
        'institutionId', i.institution_id,
        'institutionName', i.institution_name,
        'institutionSlug', i.institution_slug,
        'institutionCity', i.institution_city,
        'subjectId', i.subject_id,
        'subjectName', i.subject_name,
        'subjectSlug', i.subject_slug,
        'openIntakeCount', i.open_intake_count,
        'earliestDeadline', i.earliest_deadline
      ) order by i.rn)
      from items i
     where i.rn between (greatest(p_page, 1) - 1) * greatest(p_page_size, 1) + 1
                   and greatest(p_page, 1) * greatest(p_page_size, 1)
    ), '[]'::jsonb),
    'facets', jsonb_build_object(
      'levels', coalesce((
        select jsonb_agg(jsonb_build_object('level', level, 'count', n) order by n desc)
          from (select base.level, count(*)::int as n from base group by base.level) f
      ), '[]'::jsonb),
      'subjects', coalesce((
        select jsonb_agg(jsonb_build_object('id', subject_id, 'slug', subject_slug, 'name', subject_name, 'count', n) order by n desc)
          from (select base.subject_id, base.subject_slug, base.subject_name, count(*)::int as n
                  from base where base.subject_id is not null group by base.subject_id, base.subject_slug, base.subject_name) f
      ), '[]'::jsonb),
      'cities', coalesce((
        select jsonb_agg(jsonb_build_object('city', city, 'count', n) order by n desc)
          from (select base.institution_city as city, count(*)::int as n
                  from base where base.institution_city is not null group by base.institution_city) f
      ), '[]'::jsonb),
      'intakeYears', coalesce((
        select jsonb_agg(jsonb_build_object('intakeYear', y, 'count', n) order by y)
          from (
            select ci.intake_year as y, count(distinct c2.id)::int as n
              from base b2
              join public.catalog_courses c2 on c2.id = b2.id
              join public.catalog_course_intakes ci on ci.course_id = c2.id and ci.closed = false
             group by ci.intake_year
          ) f
      ), '[]'::jsonb),
      'internationalSupported', jsonb_build_object(
        'known', (select count(*)::int from base where base.international_applicants_supported is not null),
        'yes', (select count(*)::int from base where base.international_applicants_supported = true)
      ),
      'tuitionMin', (select min(base.tuition_fee) from base),
      'tuitionMax', (select max(base.tuition_fee) from base)
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.catalog_search_institutions(
  p_query text default null,
  p_country_code text default null,
  p_page integer default 1,
  p_page_size integer default 24
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_query text := coalesce(btrim(p_query), '');
  v_result jsonb;
begin
  with base as (
    select i.id, i.name, i.slug, i.country_code, i.city, i.website_url,
           (select count(*) from public.catalog_courses c where c.institution_id = i.id) as course_count
      from public.catalog_institutions i
     where (v_query = '' or i.name ilike '%' || v_query || '%' or coalesce(i.city, '') ilike '%' || v_query || '%')
       and (p_country_code is null or i.country_code = p_country_code)
  ),
  items as (
    select base.*,
           count(*) over () as total_count,
           row_number() over (order by base.name) as rn
      from base
  )
  select jsonb_build_object(
    'total', (select max(total_count) from items),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.name, 'slug', i.slug,
        'countryCode', i.country_code, 'city', i.city,
        'websiteUrl', i.website_url, 'courseCount', i.course_count
      ) order by i.rn)
      from items i
     where i.rn between (greatest(p_page, 1) - 1) * greatest(p_page_size, 1) + 1
                   and greatest(p_page, 1) * greatest(p_page_size, 1)
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
