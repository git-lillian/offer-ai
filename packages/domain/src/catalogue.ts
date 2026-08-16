/**
 * Admissions catalogue domain: institutions, courses, intakes, cycles and
 * structured requirements with effective dating and source provenance.
 */

import type { ApplicationRoute } from "./application-case";

export const COURSE_LEVELS = [
  "foundation",
  "undergraduate",
  "postgraduate_taught",
  "postgraduate_research",
  "phd",
] as const;

export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const COURSE_STUDY_MODES = [
  "full_time",
  "part_time",
  "distance_learning",
] as const;

export type CourseStudyMode = (typeof COURSE_STUDY_MODES)[number];

export interface Institution {
  id: string;
  name: string;
  countryCode: string;
  city: string | null;
  websiteUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  parentSubjectId: string | null;
}

export interface Course {
  id: string;
  institutionId: string;
  subjectId: string | null;
  title: string;
  level: CourseLevel;
  durationMonths: number | null;
  tuitionFee: number | null;
  currencyCode: string | null;
  /** Official application routes for this course (e.g. ["ucas", "institution_direct"]). */
  applicationRoutes: ApplicationRoute[];
  createdAt: Date;
  updatedAt: Date;
}

export const INTAKE_MONTHS = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type IntakeMonth = (typeof INTAKE_MONTHS)[number];

export interface CourseIntake {
  id: string;
  courseId: string;
  applicationCycleId: string;
  intakeMonth: IntakeMonth;
  intakeYear: number;
  applicationDeadline: Date | null;
  tuitionFee: number | null;
  feeCurrencyCode: string | null;
  closed: boolean;
}

export interface ApplicationCycle {
  id: string;
  code: string; // e.g. "2026/27"
  startsYear: number;
  endsYear: number;
  status: "open" | "closed" | "upcoming";
}

export const REQUIREMENT_KINDS = [
  "academic",
  "language",
  "application",
] as const;

export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

/**
 * Effective-dated structured course requirement. Structured values coexist
 * with the original source text; nothing is blindly overwritten.
 */
export interface CourseRequirement {
  id: string;
  courseId: string;
  kind: RequirementKind;
  structured: Record<string, unknown> | null;
  sourceText: string;
  sourceId: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  observedAt: Date;
  publishedAt: Date;
  supersededById: string | null;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  sourceOwner: string | null;
  extractorVersion: string | null;
  fetchPolicy: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SourceSnapshot {
  id: string;
  sourceId: string;
  fetchedAt: Date;
  contentHash: string;
  rawContent: string;
  status: string;
}

export function isCourseLevel(value: string): value is CourseLevel {
  return (COURSE_LEVELS as readonly string[]).includes(value);
}

export function isIntakeMonth(value: number): value is IntakeMonth {
  return (INTAKE_MONTHS as readonly number[]).includes(value);
}
