/**
 * Catalogue search integration tests — exercise the search RPCs against the
 * real database with the public (anon) client, which is the same access path
 * the browse pages use.
 *
 * Requires the seeded local Supabase stack. Run with: pnpm db:test
 */

import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(): Record<string, string> {
  const path = resolve(process.cwd(), ".env.local");
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!anonKey) {
  throw new Error("Catalogue tests require NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
}

const anon: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: false },
});

async function searchCourses(payload: Record<string, unknown>) {
  const { data, error } = await anon.rpc("catalog_search_courses", payload);
  if (error) throw error;
  return (data ?? {}) as {
    total: number;
    items: Record<string, unknown>[];
    facets: Record<string, unknown>;
  };
}

async function searchInstitutions(payload: Record<string, unknown>) {
  const { data, error } = await anon.rpc("catalog_search_institutions", payload);
  if (error) throw error;
  return (data ?? {}) as { total: number; items: Record<string, unknown>[] };
}

describe("catalogue: course search", () => {
  it("returns seeded courses with institution, subject and intake data", async () => {
    const result = await searchCourses({});
    expect(result.total).toBeGreaterThanOrEqual(10);
    expect(result.items.length).toBe(result.total >= 12 ? 12 : result.total);

    const sample = result.items[0] as Record<string, unknown>;
    expect(sample.title).toBeTruthy();
    expect(sample.institutionName).toBeTruthy();
    expect(sample.institutionSlug).toBeTruthy();
    expect(typeof sample.openIntakeCount).toBe("number");
  });

  it("filters by study level and intake year", async () => {
    const result = await searchCourses({ p_level: "undergraduate", p_intake_year: 2026 });
    expect(result.total).toBe(4);
    const titles = result.items.map((i) => (i as Record<string, unknown>).title);
    expect(titles).toContain("BSc Computer Science");
    expect(titles).toContain("LLB Law");
  });

  it("filters by city and subject slug", async () => {
    const byCity = await searchCourses({ p_city: "Glasgow" });
    expect(byCity.total).toBe(2);

    const bySubject = await searchCourses({ p_subject_slug: "law" });
    expect(bySubject.total).toBe(2);
  });

  it("filters by tuition range with currency", async () => {
    const result = await searchCourses({
      p_tuition_min: 30000,
      p_tuition_max: 34000,
      p_tuition_currency: "GBP",
    });
    expect(result.total).toBeGreaterThan(0);
    for (const item of result.items) {
      const fee = (item as Record<string, unknown>).tuitionFee as number;
      expect(fee).toBeGreaterThanOrEqual(30000);
      expect(fee).toBeLessThanOrEqual(34000);
    }
  });

  it("paginates deterministically", async () => {
    const page1 = await searchCourses({ p_page: 1, p_page_size: 4 });
    const page2 = await searchCourses({ p_page: 2, p_page_size: 4 });
    expect(page1.items).toHaveLength(4);
    expect(page2.items).toHaveLength(4);
    const ids1 = page1.items.map((i) => (i as Record<string, unknown>).id);
    const ids2 = page2.items.map((i) => (i as Record<string, unknown>).id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it("returns useful facets over the matched set", async () => {
    const result = await searchCourses({});
    const facets = result.facets as Record<string, unknown>;
    expect(Array.isArray(facets.levels)).toBe(true);
    expect(Array.isArray(facets.subjects)).toBe(true);
    expect(Array.isArray(facets.cities)).toBe(true);
    const tuitionMin = facets.tuitionMin as number | null;
    const tuitionMax = facets.tuitionMax as number | null;
    expect(tuitionMin).toBeLessThanOrEqual(tuitionMax as number);
  });
});

describe("catalogue: institution search", () => {
  it("returns institutions with course counts", async () => {
    const result = await searchInstitutions({});
    expect(result.total).toBeGreaterThanOrEqual(5);
    const glasgow = result.items.find(
      (i) => (i as Record<string, unknown>).slug === "university-of-glasgow",
    );
    expect((glasgow as Record<string, unknown>)?.courseCount).toBe(2);
  });

  it("searches institutions by name", async () => {
    const result = await searchInstitutions({ p_query: "Edinburgh" });
    expect(result.total).toBe(1);
    expect((result.items[0] as Record<string, unknown>).name).toBe(
      "University of Edinburgh",
    );
  });
});

describe("catalogue: course detail (provenance integrity)", () => {
  it("exposes requirements with source provenance for curated courses", async () => {
    const { data: course } = await anon
      .from("catalog_courses")
      .select(
        "id, requirements:catalog_course_requirements(verification_status, source_id), intakes:catalog_course_intakes(fee_source_id)",
      )
      .eq("slug", "bsc-computer-science")
      .single();
    const requirements = (course as { requirements?: { verification_status: string; source_id: string | null }[] })
      ?.requirements ?? [];
    expect(requirements.length).toBeGreaterThan(0);
    expect(requirements.every((r) => r.verification_status === "human_verified")).toBe(true);
    expect(requirements.every((r) => r.source_id !== null)).toBe(true);
  });

  it("keeps fixture requirements visibly unverified and sourceless", async () => {
    const { data: course } = await anon
      .from("catalog_courses")
      .select("id, requirements:catalog_course_requirements(verification_status, source_id)")
      .eq("slug", "llb-law")
      .single();
    const requirements = (course as { requirements?: { verification_status: string; source_id: string | null }[] })
      ?.requirements ?? [];
    expect(requirements.length).toBeGreaterThan(0);
    expect(requirements.every((r) => r.verification_status === "unverified")).toBe(true);
    expect(requirements.every((r) => r.source_id === null)).toBe(true);
  });
});
