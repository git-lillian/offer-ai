/**
 * RLS policy tests — exercise the security boundary with real Supabase
 * users through the REST API (the same path the browser client uses).
 *
 * Run with: pnpm db:test
 * Requires the local Supabase stack (see docs/runbooks/local-development.md).
 */

import { beforeAll, describe, expect, it } from "vitest";
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

let studentA: SupabaseClient;
let studentB: SupabaseClient;
let studentAId: string;
let studentBId: string;
let caseAId: string;
let caseBId: string;

async function createStudent(prefix: string): Promise<{ client: SupabaseClient; id: string }> {
  const email = `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.local`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
    user_metadata: { full_name: prefix },
  });
  if (error) throw error;
  if (!data.user) throw new Error("No user created");

  const session = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  void session;
  // Sign in as the user via the auth endpoint to obtain a session.
  const { data: signIn, error: signInError } = await signInClient.auth.signInWithPassword({
    email,
    password: "password123",
  });
  if (signInError) throw signInError;
  if (!signIn.session) throw new Error("No session");

  const userClient = clientWith(anonKey);
  await userClient.auth.setSession(signIn.session);
  return { client: userClient, id: data.user.id };
}

beforeAll(async () => {
  // Clean any leftover test data (service role).
  const { error: cleanupError } = await service
    .from("application_cases")
    .delete()
    .eq("student_id", "00000000-0000-0000-0000-000000000000");
  void cleanupError;

  const a = await createStudent("rls_a");
  const b = await createStudent("rls_b");
  studentA = a.client;
  studentB = b.client;
  studentAId = a.id;
  studentBId = b.id;

  // Create a case for each student via their own (RLS-enforced) client.
  const seed = {
    institution_id: "10000000-0000-0000-0000-000000000001",
    course_id: "12000000-0000-0000-0000-000000000001",
    course_intake_id: "14000000-0000-0000-0000-000000000001",
    application_cycle_id: "13000000-0000-0000-0000-000000000001",
  };

  const { data: caseA, error: caseAError } = await studentA
    .from("application_cases")
    .insert({ ...seed, student_id: studentAId, current_status: "draft" })
    .select("id")
    .single();
  if (caseAError) throw caseAError;
  caseAId = caseA.id;

  const { data: caseB, error: caseBError } = await studentB
    .from("application_cases")
    .insert({ ...seed, student_id: studentBId, current_status: "draft" })
    .select("id")
    .single();
  if (caseBError) throw caseBError;
  caseBId = caseB.id;
});

describe("RLS: application_cases", () => {
  it("lets a student read their own case", async () => {
    const { data } = await studentA
      .from("application_cases")
      .select("id")
      .eq("id", caseAId);
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(caseAId);
  });

  it("blocks a student from reading another student's case", async () => {
    const { data } = await studentA
      .from("application_cases")
      .select("id")
      .eq("id", caseBId);
    expect(data).toHaveLength(0);
  });

  it("blocks anon from reading any case", async () => {
    const { data } = await anon.from("application_cases").select("id").limit(5);
    expect(data).toHaveLength(0);
  });

  it("blocks a student from inserting a case for another student", async () => {
    const { error } = await studentA.from("application_cases").insert({
      student_id: studentBId,
      institution_id: "10000000-0000-0000-0000-000000000001",
      course_id: "12000000-0000-0000-0000-000000000001",
      course_intake_id: "14000000-0000-0000-0000-000000000001",
      application_cycle_id: "13000000-0000-0000-0000-000000000001",
      current_status: "draft",
    });
    expect(error).not.toBeNull();
  });
});

describe("RLS: student_profiles", () => {
  it("lets a student read their own profile", async () => {
    const { data } = await studentA
      .from("student_profiles")
      .select("user_id")
      .eq("user_id", studentAId);
    expect(data).toHaveLength(1);
  });

  it("blocks a student from reading another profile", async () => {
    const { data } = await studentA
      .from("student_profiles")
      .select("user_id")
      .eq("user_id", studentBId);
    expect(data).toHaveLength(0);
  });
});

describe("RLS: application_events", () => {
  it("lets a student append an event to their own case", async () => {
    const { data, error } = await studentA
      .from("application_events")
      .insert({
        case_id: caseAId,
        event_type: "note_added",
        status: "draft",
        actor_user_id: studentAId,
        message: "test event",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it("blocks appending events to another student's case", async () => {
    const { error } = await studentA.from("application_events").insert({
      case_id: caseBId,
      event_type: "note_added",
      status: "draft",
      actor_user_id: studentAId,
      message: "should not persist",
    });
    expect(error).not.toBeNull();
  });
});

describe("RLS: internal tables (service-role only)", () => {
  it("blocks anon and authenticated from reading audit_logs", async () => {
    // RLS-filtered reads return empty result sets (no error).
    const { data: anonData } = await anon.from("audit_logs").select("id").limit(1);
    expect(anonData).toHaveLength(0);

    const { data: userData } = await studentA.from("audit_logs").select("id").limit(1);
    expect(userData).toHaveLength(0);
  });

  it("blocks anon from reading ai_runs and background_jobs", async () => {
    const ai = await anon.from("ai_runs").select("id").limit(1);
    expect(ai.data).toHaveLength(0);
    const jobs = await anon.from("background_jobs").select("id").limit(1);
    expect(jobs.data).toHaveLength(0);
  });

  it("allows the service role to read internal tables", async () => {
    const { data, error } = await service.from("background_jobs").select("id").limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("RLS: access grants", () => {
  it("lets a student grant an adviser access to their case", async () => {
    const { data, error } = await studentA
      .from("access_grants")
      .insert({
        student_id: studentAId,
        grantee_user_id: studentBId,
        scope: "case",
        scope_id: caseAId,
        granted_by_user_id: studentAId,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it("lets a grantee read the granted student's case", async () => {
    const { data } = await studentB
      .from("application_cases")
      .select("id")
      .eq("id", caseAId);
    expect(data).toHaveLength(1);
  });

  it("revoking the grant immediately blocks access", async () => {
    const { data: grants } = await studentA
      .from("access_grants")
      .select("id")
      .eq("student_id", studentAId)
      .eq("scope_id", caseAId)
      .eq("status", "active");
    const grantId = grants?.[0]?.id;
    expect(grantId).toBeTruthy();

    const { error: revokeError } = await service
      .from("access_grants")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", grantId);
    expect(revokeError).toBeNull();

    const { data } = await studentB
      .from("application_cases")
      .select("id")
      .eq("id", caseAId);
    expect(data).toHaveLength(0);
  });
});
