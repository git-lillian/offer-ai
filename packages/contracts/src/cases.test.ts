import { describe, expect, it } from "vitest";
import { createApplicationCaseSchema, transitionApplicationCaseSchema } from "./cases";

describe("case contracts", () => {
  const validCase = {
    institutionId: "10000000-0000-0000-0000-000000000001",
    courseId: "12000000-0000-0000-0000-000000000001",
    courseIntakeId: "14000000-0000-0000-0000-000000000001",
    applicationCycleId: "13000000-0000-0000-0000-000000000001",
  };

  it("validates a well-formed create-case payload", () => {
    expect(createApplicationCaseSchema.safeParse(validCase).success).toBe(true);
  });

  it("rejects non-UUID ids", () => {
    expect(
      createApplicationCaseSchema.safeParse({ ...validCase, courseId: "not-a-uuid" }).success,
    ).toBe(false);
  });

  it("validates a status transition", () => {
    expect(
      transitionApplicationCaseSchema.safeParse({ caseId: "c1", toStatus: "submitted" }).success,
    ).toBe(false); // caseId must be a UUID
    expect(
      transitionApplicationCaseSchema.safeParse({
        caseId: "10000000-0000-0000-0000-000000000001",
        toStatus: "submitted",
      }).success,
    ).toBe(true);
    expect(
      transitionApplicationCaseSchema.safeParse({
        caseId: "10000000-0000-0000-0000-000000000001",
        toStatus: "not_a_status",
      }).success,
    ).toBe(false);
  });
});
