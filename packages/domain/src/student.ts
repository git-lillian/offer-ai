/**
 * Student 360 domain — the canonical student data model.
 *
 * A student profile is independent from any individual application. The
 * profile aggregates personal details, goals, academic history,
 * qualifications, experiences and evidence.
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

export interface StudentProfile {
  userId: string;
  fullName: string;
  email: string;
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
  countryCode: string;
  startedYear: number;
  endedYear: number | null;
  degreeTitle: string | null;
}

export const QUALIFICATION_SYSTEMS = [
  "a_level",
  "ib",
  "ap",
  "gcse",
  "chinese_gaokao",
  "chinese_undergraduate",
  "uk_undergraduate",
  "other",
] as const;

export type QualificationSystem = (typeof QUALIFICATION_SYSTEMS)[number];

export interface StudentQualification {
  id: string;
  studentId: string;
  qualificationSystem: QualificationSystem;
  title: string;
  institutionName: string | null;
  countryCode: string | null;
  grade: string | null;
  predictedGrade: string | null;
  overallGpa: number | null;
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

export function isQualificationSystem(value: string): value is QualificationSystem {
  return (QUALIFICATION_SYSTEMS as readonly string[]).includes(value);
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
