import { test, expect } from "@playwright/test";

/**
 * Catalogue browsing flow: universities list → institution → course detail
 * with provenance display and fixture notices.
 *
 * Requires the local Supabase stack and a seeded database.
 */

test.describe("catalogue browsing", () => {
  test("browse universities, filter, open a course and see provenance", async ({
    page,
  }) => {
    // ── Universities list (public) ─────────────────────────────────────────
    await page.goto("/universities");
    await expect(
      page.getByRole("heading", { name: "Universities" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /University of Edinburgh/ })).toBeVisible();

    // ── Search within the list ─────────────────────────────────────────────
    await page.getByRole("textbox", { name: "Search universities" }).fill("Glasgow");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("link", { name: /University of Glasgow/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /University of Edinburgh/ })).toHaveCount(0);

    // ── Institution page with course filters ───────────────────────────────
    await page.getByRole("link", { name: /University of Glasgow/ }).click();
    await expect(
      page.getByRole("heading", { name: "University of Glasgow" }),
    ).toBeVisible();
    await expect(page.getByText(/LLB Law/)).toBeVisible();
    await expect(page.getByText(/MSc Law/)).toBeVisible();

    // Filter to undergraduate only.
    await page.getByLabel("Study level").selectOption("undergraduate");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText(/LLB Law/)).toBeVisible();
    await expect(page.getByText(/MSc Law/)).toHaveCount(0);

    // ── Course detail with provenance ──────────────────────────────────────
    await page.getByRole("link", { name: /LLB Law/ }).click();
    await expect(page.getByRole("heading", { name: "LLB Law" })).toBeVisible();
    await expect(page.getByText("Academic requirements")).toBeVisible();

    // The fixture notice is shown for unverified, sourceless requirements.
    await expect(
      page.getByText(/Development fixture/),
    ).toBeVisible();

    // ── A curated course shows official-source provenance instead ──────────
    await page.goto("/universities/university-of-edinburgh/courses/bsc-computer-science");
    await expect(page.getByRole("heading", { name: "BSc Computer Science" })).toBeVisible();
    await expect(page.getByText(/Source:/).first()).toBeVisible();
    await expect(page.getByText(/Last checked:/).first()).toBeVisible();
    await expect(page.getByText(/Development fixture/)).toHaveCount(0);
  });
});
