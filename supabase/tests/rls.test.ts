/**
 * RLS policy tests — exercise the security boundary with real Supabase
 * users through the REST API (the same path the browser client uses).
 *
 * Covers the hardened foundation semantics:
 *  - Student identity separation (profile id != auth user id, claiming)
 *  - Scoped access grants (case / document / artifact / profile)
 *  - Atomic application-case operations (RPC-only writes, invariants)
 *
 * Run with: pnpm db:test
 * Requires the local Supabase stack (see docs/runbooks/local-development.md).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!anonKey || !serviceKey) {
  throw new Error(
    "RLS tests require NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (copy .env.example to .env.local).",
  );
}

function clientWith(key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false } });
}

// Dedicated anonymous client that is never signed in.
const anon = clientWith(anonKey);
// Clients used for sign-in flows (a session may be set on these).
const signInClient = clientWith(anonKey);
const service = clientWith(serviceKey);

// Fixed catalogue fixture ids (created in beforeAll via the service role).
const FIXTURE = {
  institutionA: "20000000-0000-0000-0000-000000000001",
  institutionB: "20000000-0000-0000-0000-000000000002",
  subject: "20000000-0000-0000-0000-000000000003",
  courseA: "21000000-0000-0000-0000-000000000001",
  courseB: "21000000-0000-0000-0000-000000000002",
  cycle: "22000000-0000-0000-0000-000000000001",
  cycleClosed: "22000000-0000-0000-0000-000000000002",
  intakeA: "23000000-0000-0000-0000-000000000001",
  intakeB: "23000000-0000-0000-0000-000000000002",
};

interface User {
  client: SupabaseClient;
  userId: string;
}

let studentA: User;
let studentB: User;
let claimant: User;
let adviser: User;
let profileAId: string;
let profileBId: string;
let caseAId: string;
let caseBId: string;
let caseA2Id: string;

/** Grants `scope`/`scopeId` on student A's data to student B (as A). */
async function grantToB(scope: string, scopeId: string | null): Promise<void> {
  const { error } = await studentA.client.from("access_grants").insert({
    student_id: profileAId,
    grantee_user_id: studentB.userId,
    scope,
    scope_id: scopeId,
    granted_by_user_id: studentA.userId,
  });
  if (error) throw error;
}

/** Revokes every active grant on student A's data held by student B. */
async function revokeAllGrantsToB(): Promise<void> {
  const { data: grants } = await studentA.client
    .from("access_grants")
    .select("id")
    .eq("student_id", profileAId)
    .eq("grantee_user_id", studentB.userId)
    .eq("status", "active");
  for (const grant of grants ?? []) {
    await service
      .from("access_grants")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", grant.id);
  }
}

async function createUser(prefix: string, emailOverride?: string): Promise<User> {
  const email = emailOverride ?? `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.local`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
    user_metadata: { full_name: prefix },
  });
  if (error) throw error;
  if (!data.user) throw new Error("No user created");

  const { data: signIn, error: signInError } = await signInClient.auth.signInWithPassword({
    email,
    password: "password123",
  });
  if (signInError) throw signInError;
  if (!signIn.session) throw new Error("No session");

  const client = clientWith(anonKey);
  await client.auth.setSession(signIn.session);
  return { client, userId: data.user.id };
}

async function createCaseRpc(
  client: SupabaseClient,
  studentId: string,
  actorUserId: string,
  overrides: Partial<Record<string, string>> = {},
): Promise<string> {
  const { data, error } = await client.rpc("create_application_case", {
    p_student_id: studentId,
    p_institution_id: FIXTURE.institutionA,
    p_course_id: FIXTURE.courseA,
    p_course_intake_id: FIXTURE.intakeA,
    p_application_cycle_id: FIXTURE.cycle,
    p_application_route: "ucas",
    p_actor_user_id: actorUserId,
    ...overrides,
  });
  if (error) throw error;
  const payload = (data ?? {}) as { case?: { id: string } };
  if (!payload.case?.id) throw new Error("create_application_case returned no case id");
  return payload.case.id;
}

beforeAll(async () => {
  // ── Catalogue fixtures (service role; catalogue writes are never client-accessible) ──
  await service.from("catalog_institutions").upsert([
    { id: FIXTURE.institutionA, name: "RLS Test University", slug: "rls-test-university", country_code: "GB", city: "Testville" },
    { id: FIXTURE.institutionB, name: "RLS Test College", slug: "rls-test-college", country_code: "GB", city: "Othertown" },
  ]);
  await service.from("catalog_subjects").upsert([
    { id: FIXTURE.subject, code: "rls-subj", slug: "rls-subject", name: "RLS Subject" },
  ]);
  await service.from("catalog_courses").upsert([
    { id: FIXTURE.courseA, institution_id: FIXTURE.institutionA, subject_id: FIXTURE.subject, title: "BSc RLS Science", slug: "bsc-rls-science", level: "undergraduate", application_routes: ["ucas", "institution_direct"] },
    { id: FIXTURE.courseB, institution_id: FIXTURE.institutionB, subject_id: FIXTURE.subject, title: "BSc RLS Studies", slug: "bsc-rls-studies", level: "undergraduate", application_routes: ["institution_direct"] },
  ]);
  await service.from("catalog_application_cycles").upsert([
    { id: FIXTURE.cycle, code: "2099/00", starts_year: 2099, ends_year: 2100, status: "open" },
    { id: FIXTURE.cycleClosed, code: "2098/99", starts_year: 2098, ends_year: 2099, status: "closed" },
  ]);
  await service.from("catalog_course_intakes").upsert([
    { id: FIXTURE.intakeA, course_id: FIXTURE.courseA, application_cycle_id: FIXTURE.cycle, intake_month: 9, intake_year: 2099, closed: false },
    { id: FIXTURE.intakeB, course_id: FIXTURE.courseB, application_cycle_id: FIXTURE.cycle, intake_month: 9, intake_year: 2099, closed: false },
  ]);

  // Users: two students, one claimant for the claiming flow, one adviser.
  studentA = await createUser("rls_a");
  studentB = await createUser("rls_b");
  claimant = await createUser("rls_claim");
  adviser = await createUser("rls_adv");

  // Adviser role (service role grants it; used for prospect creation).
  await service.from("identity_user_roles").upsert({
    user_id: adviser.userId,
    role_code: "adviser",
  });

  // Profiles are provisioned by the signup trigger with their own ids.
  const profileA = await service
    .from("student_profiles")
    .select("id")
    .eq("user_id", studentA.userId)
    .single();
  if (profileA.error) throw profileA.error;
  profileAId = profileA.data.id;

  const profileB = await service
    .from("student_profiles")
    .select("id")
    .eq("user_id", studentB.userId)
    .single();
  if (profileB.error) throw profileB.error;
  profileBId = profileB.data.id;

  // ── Cases: created atomically through the RPC (the only client path) ──
  caseAId = await createCaseRpc(studentA.client, profileAId, studentA.userId);
  caseBId = await createCaseRpc(studentB.client, profileBId, studentB.userId);
  caseA2Id = await createCaseRpc(studentA.client, profileAId, studentA.userId);
});

describe("RLS: student identity separation", () => {
  it("gives each student a canonical profile id distinct from their auth id", () => {
    expect(profileAId).not.toBe(studentA.userId);
    expect(profileBId).not.toBe(studentB.userId);
  });

  it("marks signup-provisioned profiles as claimed and linked", async () => {
    const { data } = await studentA.client
      .from("student_profiles")
      .select("id, user_id, account_status, claimed_at, created_by_user_id")
      .eq("id", profileAId)
      .single();
    expect(data).toMatchObject({
      id: profileAId,
      user_id: studentA.userId,
      account_status: "claimed",
      created_by_user_id: null,
    });
    expect(data.claimed_at).toBeTruthy();
  });

  it("lets a student read their own profile and blocks reading another's", async () => {
    const own = await studentA.client
      .from("student_profiles")
      .select("id")
      .eq("id", profileAId);
    expect(own.data).toHaveLength(1);

    const other = await studentA.client
      .from("student_profiles")
      .select("id")
      .eq("id", profileBId);
    expect(other.data).toHaveLength(0);
  });

  it("blocks a plain student from creating an unclaimed prospect", async () => {
    const { error } = await studentB.client.from("student_profiles").insert({
      user_id: null,
      full_name: "Sneaky Prospect",
      email: null,
      created_by_user_id: studentB.userId,
    });
    expect(error).not.toBeNull();
  });

  it("lets an adviser create an unclaimed prospect via the controlled RPC", async () => {
    const { data, error } = await adviser.client.rpc("create_prospect", {
      p_full_name: "Prospect One",
      p_email: null,
    });
    expect(error).toBeNull();
    expect((data as { account_status: string })?.account_status).toBe("unclaimed");
    expect((data as { user_id: string | null })?.user_id).toBeNull();
    expect((data as { created_by_user_id: string })?.created_by_user_id).toBe(adviser.userId);
  });

  it("blocks a plain student from creating a prospect via the RPC", async () => {
    const { error } = await studentB.client.rpc("create_prospect", {
      p_full_name: "Sneaky Prospect",
      p_email: null,
    });
    expect(error).not.toBeNull();
  });

  it("lets a new account claim an unclaimed prospect (atomic RPC)", async () => {
    // Adviser creates a prospect (no auth account yet).
    const prospectEmail = `prospect.${Date.now()}@test.local`;
    const { data: prospect, error: prospectError } = await adviser.client.rpc(
      "create_prospect",
      { p_full_name: "Claimable Prospect", p_email: prospectEmail },
    );
    expect(prospectError).toBeNull();
    const prospectId = (prospect as { id: string })?.id;
    expect(prospectId).toBeTruthy();

    // Simulate an existing account that is not yet linked to any profile
    // (e.g. a legacy/admin-provisioned account): drop its auto profile.
    await service
      .from("student_profiles")
      .delete()
      .eq("user_id", claimant.userId);

    const { data: claimed, error } = await claimant.client.rpc("claim_student_profile", {
      p_student_id: prospectId,
    });
    expect(error).toBeNull();
    expect((claimed as { user_id: string | null })?.user_id).toBe(claimant.userId);

    const { data: after } = await claimant.client
      .from("student_profiles")
      .select("account_status, claimed_at")
      .eq("id", prospectId)
      .single();
    expect(after).toMatchObject({ account_status: "claimed" });
    expect(after.claimed_at).toBeTruthy();
  });

  it("signup auto-claims a prospect whose email matches the new account", async () => {
    const prospectEmail = `match.${Date.now()}@test.local`;
    const { data: prospect } = await adviser.client.rpc("create_prospect", {
      p_full_name: "Matching Prospect",
      p_email: prospectEmail,
    });
    const prospectId = (prospect as { id: string })?.id;
    expect(prospectId).toBeTruthy();

    const { client, userId } = await createUser(`match_user_${Date.now()}`, prospectEmail);
    void userId;

    const { data: claimed } = await client
      .from("student_profiles")
      .select("account_status, user_id")
      .eq("id", prospectId)
      .single();
    expect(claimed).toMatchObject({ account_status: "claimed" });
    expect(claimed.user_id).toBe(userId);
  });

  it("rejects claiming an already-claimed profile", async () => {
    const { error } = await studentB.client.rpc("claim_student_profile", {
      p_student_id: profileAId,
    });
    expect(error).not.toBeNull();
  });

  it("rejects claiming when the account is already linked to another profile", async () => {
    const { data: prospect } = await adviser.client.rpc("create_prospect", {
      p_full_name: "Another Prospect",
      p_email: null,
    });
    const prospectId = (prospect as { id: string })?.id;
    expect(prospectId).toBeTruthy();

    // studentB still has their auto-created profile, so linking another is rejected.
    const { error } = await studentB.client.rpc("claim_student_profile", {
      p_student_id: prospectId,
    });
    expect(error).not.toBeNull();
  });
});

describe("RLS: application cases are RPC-only and atomic", () => {
  it("blocks direct client inserts into application_cases", async () => {
    const { error } = await studentA.client.from("application_cases").insert({
      student_id: profileAId,
      institution_id: FIXTURE.institutionA,
      course_id: FIXTURE.courseA,
      course_intake_id: FIXTURE.intakeA,
      application_cycle_id: FIXTURE.cycle,
      application_route: "ucas",
      current_status: "draft",
    });
    expect(error).not.toBeNull();
  });

  it("creates the case and its created event in one call", async () => {
    const { data: caseRow } = await studentA.client
      .from("application_cases")
      .select("current_status, course_id")
      .eq("id", caseAId)
      .single();
    expect(caseRow).toMatchObject({ current_status: "draft", course_id: FIXTURE.courseA });

    const { data: events } = await studentA.client
      .from("application_events")
      .select("event_type, message")
      .eq("case_id", caseAId);
    expect(events?.map((e) => e.event_type)).toContain("created");
  });

  it("transitions status and appends the event atomically", async () => {
    const { error } = await studentA.client.rpc("transition_application_case", {
      p_case_id: caseAId,
      p_to_status: "in_progress",
      p_actor_user_id: studentA.userId,
      p_event_type: "status_changed",
      p_message: "Moving forward",
      p_metadata: null,
    });
    expect(error).toBeNull();

    const { data: caseRow } = await studentA.client
      .from("application_cases")
      .select("current_status")
      .eq("id", caseAId)
      .single();
    expect(caseRow.current_status).toBe("in_progress");

    const { data: events } = await studentA.client
      .from("application_events")
      .select("event_type, status")
      .eq("case_id", caseAId)
      .eq("event_type", "status_changed");
    expect(events?.length).toBe(1);
    expect(events?.[0]?.status).toBe("in_progress");
  });

  it("rejects invalid transitions", async () => {
    const { error } = await studentA.client.rpc("transition_application_case", {
      p_case_id: caseAId,
      p_to_status: "offer_received",
      p_actor_user_id: studentA.userId,
      p_event_type: "status_changed",
      p_message: "illegal",
      p_metadata: null,
    });
    expect(error).not.toBeNull();

    const { data: caseRow } = await studentA.client
      .from("application_cases")
      .select("current_status")
      .eq("id", caseAId)
      .single();
    expect(caseRow.current_status).toBe("in_progress");
  });

  it("rejects cases for a closed application cycle", async () => {
    const { error } = await studentA.client.rpc("create_application_case", {
      p_student_id: profileAId,
      p_institution_id: FIXTURE.institutionA,
      p_course_id: FIXTURE.courseA,
      p_course_intake_id: FIXTURE.intakeA,
      p_application_cycle_id: FIXTURE.cycleClosed,
      p_application_route: "ucas",
      p_actor_user_id: studentA.userId,
    });
    expect(error).not.toBeNull();
  });

  it("rejects course/institution invariant violations", async () => {
    const { error } = await studentA.client.rpc("create_application_case", {
      p_student_id: profileAId,
      p_institution_id: FIXTURE.institutionB,
      p_course_id: FIXTURE.courseA,
      p_course_intake_id: FIXTURE.intakeA,
      p_application_cycle_id: FIXTURE.cycle,
      p_application_route: "ucas",
      p_actor_user_id: studentA.userId,
    });
    expect(error).not.toBeNull();
  });

  it("blocks a student from creating a case for another student", async () => {
    await expect(
      createCaseRpc(studentA.client, profileBId, studentA.userId),
    ).rejects.toBeTruthy();
  });

  it("lets a student read their own case but not another's", async () => {
    const own = await studentA.client
      .from("application_cases")
      .select("id")
      .eq("id", caseAId);
    expect(own.data).toHaveLength(1);

    const other = await studentA.client
      .from("application_cases")
      .select("id")
      .eq("id", caseBId);
    expect(other.data).toHaveLength(0);
  });

  it("blocks anon from reading any case", async () => {
    const { data } = await anon.from("application_cases").select("id").limit(5);
    expect(data).toHaveLength(0);
  });
});

describe("RLS: scoped access grants", () => {
  let docId: string;
  let artifactId: string;

  beforeAll(async () => {
    // Owner-created document + artifact (service role stands in for the upload path).
    const { data: doc } = await service
      .from("documents")
      .insert({
        student_id: profileAId,
        owner_user_id: studentA.userId,
        file_type: "pdf",
        mime_type: "application/pdf",
        original_filename: "transcript.pdf",
        storage_path: `${studentA.userId}/transcript.pdf`,
        checksum: "abc123",
        size_bytes: 1000,
        upload_source: "test",
        processing_status: "completed",
        version: 1,
      })
      .select("id")
      .single();
    docId = doc?.id ?? "";

    const { data: artifact } = await service
      .from("artifacts")
      .insert({
        student_id: profileAId,
        artifact_type: "personal_statement",
        title: "PS draft",
        approval_state: "draft",
      })
      .select("id")
      .single();
    artifactId = artifact?.id ?? "";
  });

  it("a case-scope grant exposes exactly the granted case", async () => {
    await grantToB("case", caseAId);

    const granted = await studentB.client
      .from("application_cases")
      .select("id")
      .eq("id", caseAId);
    expect(granted.data).toHaveLength(1);

    // ...but not a different case of the same student
    const other = await studentB.client
      .from("application_cases")
      .select("id")
      .eq("id", caseA2Id);
    expect(other.data).toHaveLength(0);

    // Cleanup so later tests observe a fresh grant state.
    await revokeAllGrantsToB();
  });

  it("a case grant does not expose the profile or other resources", async () => {
    await grantToB("case", caseAId);

    const profile = await studentB.client
      .from("student_profiles")
      .select("id")
      .eq("id", profileAId);
    expect(profile.data).toHaveLength(0);

    const docs = await studentB.client.from("documents").select("id").limit(10);
    expect(docs.data).toHaveLength(0);

    const artifacts = await studentB.client.from("artifacts").select("id").limit(10);
    expect(artifacts.data).toHaveLength(0);

    await revokeAllGrantsToB();
  });

  it("a document-scope grant exposes exactly that document", async () => {
    expect(docId).toBeTruthy();
    await grantToB("document", docId);

    const doc = await studentB.client.from("documents").select("id").eq("id", docId);
    expect(doc.data).toHaveLength(1);

    // A document grant must not expose the student's profile or cases.
    const profile = await studentB.client
      .from("student_profiles")
      .select("id")
      .eq("id", profileAId);
    expect(profile.data).toHaveLength(0);

    const cases = await studentB.client
      .from("application_cases")
      .select("id")
      .eq("id", caseAId);
    expect(cases.data).toHaveLength(0);

    await revokeAllGrantsToB();
  });

  it("an artifact-scope grant exposes exactly that artifact and its versions", async () => {
    expect(artifactId).toBeTruthy();
    await grantToB("artifact", artifactId);

    const artifact = await studentB.client.from("artifacts").select("id").eq("id", artifactId);
    expect(artifact.data).toHaveLength(1);

    const cases = await studentB.client
      .from("application_cases")
      .select("id")
      .eq("id", caseAId);
    expect(cases.data).toHaveLength(0);

    await revokeAllGrantsToB();
  });

  it("a profile-scope grant exposes the profile and its child data", async () => {
    await grantToB("profile", null);

    const profile = await studentB.client
      .from("student_profiles")
      .select("id, full_name")
      .eq("id", profileAId)
      .single();
    expect(profile.error).toBeNull();
    expect(profile.data.id).toBe(profileAId);

    // Education rows are readable through the profile grant.
    await service.from("student_education").insert({
      student_id: profileAId,
      institution_name: "Test High School",
      started_year: 2020,
      ended_year: 2024,
    });
    const education = await studentB.client
      .from("student_education")
      .select("id")
      .eq("student_id", profileAId);
    expect(education.data).toHaveLength(1);

    await revokeAllGrantsToB();
  });

  it("revoking the grant immediately blocks access", async () => {
    await grantToB("case", caseAId);

    const { data: grants } = await studentA.client
      .from("access_grants")
      .select("id")
      .eq("student_id", profileAId)
      .eq("scope_id", caseAId)
      .eq("status", "active");
    const grantId = grants?.[0]?.id;
    expect(grantId).toBeTruthy();

    const { error: revokeError } = await service
      .from("access_grants")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", grantId);
    expect(revokeError).toBeNull();

    const { data } = await studentB.client
      .from("application_cases")
      .select("id")
      .eq("id", caseAId);
    expect(data).toHaveLength(0);
  });
});

describe("RLS: internal tables (service-role only)", () => {
  it("blocks anon and authenticated from reading internal tables", async () => {
    const anonAudit = await anon.from("audit_logs").select("id").limit(1);
    expect(anonAudit.data).toHaveLength(0);
    const userAudit = await studentA.client.from("audit_logs").select("id").limit(1);
    expect(userAudit.data).toHaveLength(0);

    const ai = await studentA.client.from("ai_runs").select("id").limit(1);
    expect(ai.data).toHaveLength(0);
    const jobs = await studentA.client.from("background_jobs").select("id").limit(1);
    expect(jobs.data).toHaveLength(0);
    const snapshots = await studentA.client
      .from("catalog_source_snapshots")
      .select("id")
      .limit(1);
    expect(snapshots.data).toHaveLength(0);
  });

  it("allows the service role to read internal tables", async () => {
    const { data, error } = await service.from("background_jobs").select("id").limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("RLS: catalogue is public read", () => {
  it("lets anon and authenticated read catalogue data", async () => {
    const anonInstitutions = await anon
      .from("catalog_institutions")
      .select("id")
      .eq("id", FIXTURE.institutionA);
    expect(anonInstitutions.data).toHaveLength(1);

    const userCourses = await studentA.client
      .from("catalog_courses")
      .select("id")
      .eq("id", FIXTURE.courseA);
    expect(userCourses.data).toHaveLength(1);
  });
});

afterAll(async () => {
  // Remove the catalogue fixtures so the shared dev database stays clean
  // for the other test suites (e2e picks catalogue options by order/name).
  await service.from("catalog_course_intakes").delete().in("id", [FIXTURE.intakeA, FIXTURE.intakeB]);
  await service.from("catalog_courses").delete().in("id", [FIXTURE.courseA, FIXTURE.courseB]);
  await service.from("catalog_application_cycles").delete().in("id", [FIXTURE.cycle, FIXTURE.cycleClosed]);
  await service.from("catalog_subjects").delete().eq("id", FIXTURE.subject);
  await service.from("catalog_institutions").delete().in("id", [FIXTURE.institutionA, FIXTURE.institutionB]);
});
