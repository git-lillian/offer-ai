/**
 * Opportunity domain — internships, volunteering, courses, competitions,
 * research placements that strengthen a student's application.
 *
 * Opportunities are catalogue data (public read) akin to catalog_courses.
 * StudentOpportunity is the private join tracking saved/applied/completed
 * for a student. Both are framework-free: no Supabase/Next/React imports.
 */

import { ValidationError } from "./errors";

// ── Opportunity type ──────────────────────────────────────────────────────

export const OPPORTUNITY_TYPES = [
  "internship",
  "volunteering",
  "course",
  "competition",
  "research",
] as const;

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export function isOpportunityType(value: string): value is OpportunityType {
  return (OPPORTUNITY_TYPES as readonly string[]).includes(value);
}

// ── Student opportunity status ────────────────────────────────────────────

export const STUDENT_OPPORTUNITY_STATUSES = [
  "saved",
  "applied",
  "completed",
] as const;

export type StudentOpportunityStatus = (typeof STUDENT_OPPORTUNITY_STATUSES)[number];

export function isStudentOpportunityStatus(
  value: string,
): value is StudentOpportunityStatus {
  return (STUDENT_OPPORTUNITY_STATUSES as readonly string[]).includes(value);
}

// ── Entities ──────────────────────────────────────────────────────────────

export interface Opportunity {
  id: string;
  title: string;
  providerName: string;
  opportunityType: OpportunityType;
  locationCountryCode: string | null;
  isRemote: boolean;
  durationMonths: number | null;
  description: string;
  url: string | null;
  createdAt: Date;
}

export interface StudentOpportunity {
  id: string;
  studentId: string;
  opportunityId: string;
  status: StudentOpportunityStatus;
  appliedAt: Date | null;
  createdAt: Date;
}

// ── Validation helpers ────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function assertUuid(value: string, field: string): void {
  if (!isUuid(value)) {
    throw new ValidationError(`${field} must be a valid UUID.`, { field });
  }
}

function isIsoCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

function assertCountryCode(value: string | null, field: string): void {
  if (value !== null && !isIsoCountryCode(value)) {
    throw new ValidationError(`${field} must be an ISO 3166-1 alpha-2 code.`, {
      field,
    });
  }
}

function assertTrimmedLength(
  value: string,
  field: string,
  min: number,
  max: number,
): string {
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new ValidationError(`${field} is required.`, { field });
  }
  if (trimmed.length > max) {
    throw new ValidationError(`${field} must be ${max} characters or fewer.`, {
      field,
    });
  }
  return trimmed;
}

// ── Opportunity validation ────────────────────────────────────────────────

export interface CreateOpportunityInput {
  title: string;
  providerName: string;
  opportunityType: OpportunityType;
  locationCountryCode?: string | null;
  isRemote?: boolean;
  durationMonths?: number | null;
  description?: string;
  url?: string | null;
}

export function validateCreateOpportunityInput(
  input: CreateOpportunityInput,
): void {
  assertTrimmedLength(input.title, "title", 1, 200);
  assertTrimmedLength(input.providerName, "providerName", 1, 200);
  if (!isOpportunityType(input.opportunityType)) {
    throw new ValidationError(
      `Invalid opportunity type "${input.opportunityType}".`,
      { field: "opportunityType" },
    );
  }
  assertCountryCode(input.locationCountryCode ?? null, "locationCountryCode");
  if (
    input.durationMonths !== undefined &&
    input.durationMonths !== null &&
    (!Number.isInteger(input.durationMonths) ||
      input.durationMonths < 0 ||
      input.durationMonths > 120)
  ) {
    throw new ValidationError(
      "durationMonths must be an integer between 0 and 120.",
      { field: "durationMonths" },
    );
  }
  if (input.description !== undefined) {
    if (typeof input.description !== "string") {
      throw new ValidationError("description must be a string.", {
        field: "description",
      });
    }
    if (input.description.length > 5000) {
      throw new ValidationError(
        "description must be 5000 characters or fewer.",
        { field: "description" },
      );
    }
  }
  if (
    input.url !== undefined &&
    input.url !== null &&
    typeof input.url === "string" &&
    input.url.trim().length > 0
  ) {
    const trimmed = input.url.trim();
    if (trimmed.length > 2048) {
      throw new ValidationError("url must be 2048 characters or fewer.", {
        field: "url",
      });
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new ValidationError("url must be http or https.", {
          field: "url",
        });
      }
    } catch {
      throw new ValidationError("url must be a valid http(s) URL.", {
        field: "url",
      });
    }
  }
  if (input.isRemote !== undefined && typeof input.isRemote !== "boolean") {
    throw new ValidationError("isRemote must be a boolean.", {
      field: "isRemote",
    });
  }
}

export function createOpportunity(
  input: CreateOpportunityInput,
): Opportunity {
  validateCreateOpportunityInput(input);
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    providerName: input.providerName.trim(),
    opportunityType: input.opportunityType,
    locationCountryCode: input.locationCountryCode ?? null,
    isRemote: input.isRemote ?? false,
    durationMonths: input.durationMonths ?? null,
    description: (input.description ?? "").trim(),
    url: input.url?.trim() ?? null,
    createdAt: now,
  };
}

export function validateOpportunity(value: Opportunity): void {
  assertUuid(value.id, "id");
  assertTrimmedLength(value.title, "title", 1, 200);
  assertTrimmedLength(value.providerName, "providerName", 1, 200);
  if (!isOpportunityType(value.opportunityType)) {
    throw new ValidationError(
      `Invalid opportunity type "${value.opportunityType}".`,
      { field: "opportunityType" },
    );
  }
  assertCountryCode(value.locationCountryCode, "locationCountryCode");
  if (
    value.durationMonths !== null &&
    (!Number.isInteger(value.durationMonths) ||
      value.durationMonths < 0 ||
      value.durationMonths > 120)
  ) {
    throw new ValidationError(
      "durationMonths must be an integer between 0 and 120.",
      { field: "durationMonths" },
    );
  }
  if (value.description.length > 5000) {
    throw new ValidationError(
      "description must be 5000 characters or fewer.",
      { field: "description" },
    );
  }
  if (value.url !== null && value.url.length > 2048) {
    throw new ValidationError("url must be 2048 characters or fewer.", {
      field: "url",
    });
  }
  if (!(value.createdAt instanceof Date) || Number.isNaN(value.createdAt.getTime())) {
    throw new ValidationError("createdAt must be a valid Date.", {
      field: "createdAt",
    });
  }
}

// ── StudentOpportunity validation ─────────────────────────────────────────

export interface CreateStudentOpportunityInput {
  studentId: string;
  opportunityId: string;
  status?: StudentOpportunityStatus;
  appliedAt?: Date | null;
}

const STUDENT_OPPORTUNITY_TRANSITIONS: Record<
  StudentOpportunityStatus,
  readonly StudentOpportunityStatus[]
> = {
  saved: ["applied", "completed"],
  applied: ["completed", "saved"],
  completed: ["saved"],
};

export function canTransitionStudentOpportunity(
  from: StudentOpportunityStatus,
  to: StudentOpportunityStatus,
): boolean {
  if (from === to) return true;
  return STUDENT_OPPORTUNITY_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateCreateStudentOpportunityInput(
  input: CreateStudentOpportunityInput,
): void {
  assertUuid(input.studentId, "studentId");
  assertUuid(input.opportunityId, "opportunityId");
  if (
    input.status !== undefined &&
    !isStudentOpportunityStatus(input.status)
  ) {
    throw new ValidationError(`Invalid status "${input.status}".`, {
      field: "status",
    });
  }
  if (
    input.appliedAt !== undefined &&
    input.appliedAt !== null &&
    !(input.appliedAt instanceof Date)
  ) {
    throw new ValidationError("appliedAt must be a Date or null.", {
      field: "appliedAt",
    });
  }
  if (
    input.appliedAt instanceof Date &&
    Number.isNaN(input.appliedAt.getTime())
  ) {
    throw new ValidationError("appliedAt must be a valid date.", {
      field: "appliedAt",
    });
  }
  if (
    input.status === "saved" &&
    input.appliedAt !== undefined &&
    input.appliedAt !== null
  ) {
    throw new ValidationError(
      "appliedAt must be null when status is saved.",
      { field: "appliedAt" },
    );
  }
}

export function createStudentOpportunity(
  input: CreateStudentOpportunityInput,
): StudentOpportunity {
  validateCreateStudentOpportunityInput(input);
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    studentId: input.studentId,
    opportunityId: input.opportunityId,
    status: input.status ?? "saved",
    appliedAt:
      input.status === "applied" || input.status === "completed"
        ? (input.appliedAt ?? now)
        : null,
    createdAt: now,
  };
}

export function transitionStudentOpportunity(
  record: StudentOpportunity,
  toStatus: StudentOpportunityStatus,
): StudentOpportunity {
  if (!isStudentOpportunityStatus(toStatus)) {
    throw new ValidationError(`Invalid status "${toStatus}".`, {
      field: "status",
    });
  }
  if (!canTransitionStudentOpportunity(record.status, toStatus)) {
    throw new ValidationError(
      `Cannot transition student opportunity from "${record.status}" to "${toStatus}".`,
      { field: "status" },
    );
  }
  const now = new Date();
  return {
    ...record,
    status: toStatus,
    appliedAt:
      toStatus === "saved"
        ? null
        : (record.appliedAt ?? now),
  };
}

export function validateStudentOpportunity(
  value: StudentOpportunity,
): void {
  assertUuid(value.id, "id");
  assertUuid(value.studentId, "studentId");
  assertUuid(value.opportunityId, "opportunityId");
  if (!isStudentOpportunityStatus(value.status)) {
    throw new ValidationError(`Invalid status "${value.status}".`, {
      field: "status",
    });
  }
  if (value.appliedAt !== null && !(value.appliedAt instanceof Date)) {
    throw new ValidationError("appliedAt must be a Date or null.", {
      field: "appliedAt",
    });
  }
  if (
    value.appliedAt instanceof Date &&
    Number.isNaN(value.appliedAt.getTime())
  ) {
    throw new ValidationError("appliedAt must be a valid date.", {
      field: "appliedAt",
    });
  }
  if (!(value.createdAt instanceof Date) || Number.isNaN(value.createdAt.getTime())) {
    throw new ValidationError("createdAt must be a valid Date.", {
      field: "createdAt",
    });
  }
}
