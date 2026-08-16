import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Critical user flow: register → login → onboarding → dashboard →
 * create case → logout → login → data still exists.
 *
 * Requires the local Supabase stack and a seeded database.
 */

function loadEnv(): Record<string, string> {
  const path = resolve(__dirname, "../../.env.local");
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const UNIQUE = Date.now();
const EMAIL = `e2e.${UNIQUE}@offer-ai.local`;
const PASSWORD = "password123";
const FULL_NAME = "E2E Student";

test.describe("vertical slice", () => {
  test("register, complete onboarding, create a case, log out, log back in", async ({
    page,
  }) => {
    // ── Landing page ──────────────────────────────────────────────────────
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Build stronger applications/ })).toBeVisible();

    // ── Register ───────────────────────────────────────────────────────────
    await page.getByRole("link", { name: "Start your application" }).click();
    await page.getByLabel("Full name").fill(FULL_NAME);
    await page.getByLabel("Email address").fill(EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    // Auto-confirmed locally → lands on onboarding. The wizard resumes at
    // the first incomplete step (register already set the full name via the
    // signup trigger).
    await expect(page.getByRole("heading", { name: "Tell us about yourself" })).toBeVisible({
      timeout: 15_000,
    });

    // ── Onboarding (step by step, resuming where needed) ───────────────────
    const nameInput = page.getByLabel("Full name");
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill(FULL_NAME);
      await page.getByRole("button", { name: "Continue" }).click();
    }

    await page.getByLabel("Current country").selectOption("CN");
    await page.getByLabel("Nationality").selectOption("CN");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Current education level").fill("Bachelor degree");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Intended study level").selectOption("postgraduate_taught");
    await page.getByLabel("Target subject areas (comma separated)").fill("Data Science");
    await page.getByLabel("Target entry year").fill("2027");
    await page.getByLabel("Target countries (comma separated country codes)").fill("GB");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Budget minimum (GBP)").fill("25000");
    await page.getByLabel("Budget maximum (GBP)").fill("40000");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("English proficiency status").selectOption("planned");
    await page.getByRole("button", { name: "Finish onboarding" }).click();

    // ── Dashboard (real data from Postgres) ───────────────────────────────
    await expect(page.getByRole("heading", { name: `Welcome, ${FULL_NAME}` })).toBeVisible({
      timeout: 15_000,
    });

    // ── Create an application case ─────────────────────────────────────────
    await page.getByRole("link", { name: "Create application case" }).first().click();
    await expect(page.getByRole("heading", { name: "Create an application case" })).toBeVisible();

    await page.getByLabel("University").selectOption({ index: 0 });
    await page.getByLabel("Course").selectOption({ index: 0 });
    await page.getByLabel("Intake").selectOption({ index: 0 });
    await page.getByLabel("Application cycle").selectOption({ index: 0 });
    await page.getByRole("button", { name: "Create case" }).click();

    // Case detail page with timeline.
    await expect(page.getByText("Application case", { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Application case created.")).toBeVisible();

    // ── Log out ────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: /Build stronger applications/ })).toBeVisible();

    // ── Log back in; data must still exist ─────────────────────────────────
    await page.getByRole("link", { name: "Log in" }).first().click();
    await page.getByLabel("Email address").fill(EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByRole("heading", { name: `Welcome, ${FULL_NAME}` })).toBeVisible({
      timeout: 15_000,
    });

    // Profile completion should be 6/6 and at least one case listed.
    await expect(page.getByText("6/6")).toBeVisible();
    await expect(page.getByText("Case", { exact: false }).first()).toBeVisible();
  });

  test("another user cannot see the first user's data", async ({ browser }) => {
    const otherPage = await browser.newPage();
    await otherPage.goto("/register");
    const otherEmail = `e2e.other.${UNIQUE}@offer-ai.local`;
    await otherPage.getByLabel("Full name").fill("Other Student");
    await otherPage.getByLabel("Email address").fill(otherEmail);
    await otherPage.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await otherPage.getByRole("button", { name: "Create account" }).click();
    await otherPage.waitForTimeout(800);
    // Resume-aware: register already sets the full name, so the wizard may
    // start at a later step.
    const otherNameInput = otherPage.getByLabel("Full name");
    if (await otherNameInput.isVisible().catch(() => false)) {
      await otherNameInput.fill("Other Student");
      await otherPage.getByRole("button", { name: "Continue" }).click();
      await otherPage.waitForTimeout(600);
    }
    await otherPage.getByLabel("Current country").selectOption("GB");
    await otherPage.getByLabel("Nationality").selectOption("GB");
    await otherPage.getByRole("button", { name: "Continue" }).click();
    await otherPage.waitForTimeout(600);
    await otherPage.getByLabel("Current education level").fill("Bachelor degree");
    await otherPage.getByRole("button", { name: "Continue" }).click();
    await otherPage.waitForTimeout(600);
    await otherPage.getByLabel("Intended study level").selectOption("undergraduate");
    await otherPage.getByRole("button", { name: "Continue" }).click();
    await otherPage.waitForTimeout(600);
    await otherPage.getByLabel("Budget minimum (GBP)").fill("10000");
    await otherPage.getByLabel("Budget maximum (GBP)").fill("20000");
    await otherPage.getByRole("button", { name: "Continue" }).click();
    await otherPage.waitForTimeout(600);
    await otherPage.getByLabel("English proficiency status").selectOption("not_taken");
    await otherPage.getByRole("button", { name: "Finish onboarding" }).click();

    // Dashboard of the second user must not show the first user's case.
    await expect(otherPage.getByRole("heading", { name: "Welcome, Other Student" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(otherPage.getByText("You have no application cases yet.")).toBeVisible();
    await otherPage.close();
  });

  test.afterAll(async () => {
    // Clean up the test users.
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    for (const email of [EMAIL, `e2e.other.${UNIQUE}@offer-ai.local`]) {
      const { data } = await service.auth.admin.listUsers();
      const user = data?.users.find((u) => u.email === email);
      if (user) await service.auth.admin.deleteUser(user.id);
    }
  });
});
