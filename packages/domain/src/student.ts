/**
 * Student 360 domain — the canonical student data model.
 *
 * A student is an independent domain entity with its own id, decoupled from
 * any auth account. The profile aggregates personal details, goals, academic
 * history, qualifications, experiences and evidence.
 *
 * Lifecycle: a guardian/adviser may create an unclaimed prospect; a student
 * registers and claims (links) it to their auth account; the profile is
 * closed when no longer active.
 */

import { ValidationError } from "./errors";

export const STUDY_LEVELS = [
  "foundation",
  "undergraduate",
  "postgraduate_taught",
  "postgraduate_research",
  "phd",
] as const;

export type StudyLevel = (typeof STUDY_LEVELS)[number];

export const ENGLISH_PROFICIENCY_STATUSES = [
  "not_taken",
  "planned",
  "taken",
  "exempt",
] as const;

export type EnglishProficiencyStatus = (typeof ENGLISH_PROFICIENCY_STATUSES)[number];

export const STUDENT_ACCOUNT_STATUSES = ["unclaimed", "claimed", "closed"] as const;

export type StudentAccountStatus = (typeof STUDENT_ACCOUNT_STATUSES)[number];

export interface StudentProfile {
  /** Canonical student id (independent of any auth account). */
  id: string;
  /** Linked auth account, if claimed. Null for guardian/adviser-created prospects. */
  userId: string | null;
  fullName: string;
  email: string | null;
  accountStatus: StudentAccountStatus;
  createdByUserId: string | null;
  claimedAt: Date | null;
  currentCountryCode: string | null;
  nationalityCountryCode: string | null;
  currentEducationLevel: string | null;
  intendedStudyLevel: StudyLevel | null;
  targetSubjectAreas: string[];
  targetEntryYear: number | null;
  targetCountryCodes: string[];
  budgetRange: {
    currencyCode: string;
    min: number | null;
    max: number | null;
  } | null;
  englishProficiencyStatus: EnglishProficiencyStatus | null;
  onboardingCompletedAt: Date | null;
  updatedAt: Date;
}

export interface StudentEducation {
  id: string;
  studentId: string;
  institutionName: string;
  countryCode: string | null;
  startedYear: number;
  endedYear: number | null;
  degreeTitle: string | null;
}

/**
 * Known qualification systems for UI/input validation. The database keeps a
 * lookup table (qualification_systems) so national systems can be added
 * without a migration; domain code treats the value as free-form text.
 */
export const KNOWN_QUALIFICATION_SYSTEMS = [
  "a_level",
  "as_level",
  "gcse",
  "ib",
  "ib_certificate",
  "ap",
  "us_high_school",
  "gaokao",
  "chinese_gaokao",
  "chinese_undergraduate",
  "hong_kong_dse",
  "australian_atar",
  "canadian_high_school",
  "french_baccalaureat",
  "german_abitur",
  "indian_standard_xii",
  "malaysian_stpm",
  "singapore_a_level",
  "international_foundation",
  "uk_undergraduate",
  "uk_postgraduate",
  "other",
] as const;

export interface StudentQualification {
  id: string;
  studentId: string;
  /** Qualification system code (see the qualification_systems lookup table). */
  qualificationSystem: string;
  title: string;
  institutionName: string | null;
  countryCode: string | null;
  grade: string | null;
  predictedGrade: string | null;
  /** Numeric grade on an explicit scale (see gpaScaleMax), e.g. 3.6 / 4.0. */
  overallGpa: number | null;
  /** The scale max for overallGpa (e.g. 4.0, 5.0, 10). Null when unknown. */
  gpaScaleMax: number | null;
  completedYear: number | null;
}

export const EXPERIENCE_TYPES = [
  "employment",
  "internship",
  "volunteering",
  "project",
  "leadership",
  "award",
  "competition",
  "research",
  "extracurricular",
  "certification",
  "other",
] as const;

export type ExperienceType = (typeof EXPERIENCE_TYPES)[number];

export interface StudentExperience {
  id: string;
  studentId: string;
  experienceType: ExperienceType;
  title: string;
  organisationName: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  description: string;
}

export interface StudentGoals {
  studentId: string;
  studyGoals: string;
  careerGoals: string;
  updatedAt: Date;
}

export function isStudyLevel(value: string): value is StudyLevel {
  return (STUDY_LEVELS as readonly string[]).includes(value);
}

export function isEnglishProficiencyStatus(
  value: string,
): value is EnglishProficiencyStatus {
  return (ENGLISH_PROFICIENCY_STATUSES as readonly string[]).includes(value);
}

export function isStudentAccountStatus(value: string): value is StudentAccountStatus {
  return (STUDENT_ACCOUNT_STATUSES as readonly string[]).includes(value);
}

export function isKnownQualificationSystem(value: string): boolean {
  return (KNOWN_QUALIFICATION_SYSTEMS as readonly string[]).includes(value);
}

export function isExperienceType(value: string): value is ExperienceType {
  return (EXPERIENCE_TYPES as readonly string[]).includes(value);
}

export function isIsoCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

export function validateCountryCode(value: string | null, field: string): void {
  if (value !== null && !isIsoCountryCode(value)) {
    throw new ValidationError(`${field} must be an ISO 3166-1 alpha-2 country code.`);
  }
}