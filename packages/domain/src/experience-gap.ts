/**
 * ExperienceGapService — deterministic gap analysis for the Experience builder.
 *
 * The service is pure and framework-free. It compares a student's existing
 * experiences/goals against inferred expectations for their intended study
 * level and target courses, then suggests opportunity types that would
 * strengthen future applications.
 *
 * Important: rules decide, the LLM explains. This module never calls an LLM
 * and never fabricates catalogue facts. All inputs are caller-supplied
 * (profile version, catalogue version) so the result is reproducible.
 */

import { ValidationError } from "./errors";
import type { StudentProfile, StudentExperience, StudentGoals } from "./student";
import type { Course, CourseRequirement } from "./catalogue";
import type { OpportunityType } from "./opportunity";
import { isOpportunityType } from "./opportunity";

// ── Types ───────────────────────────────────────────────────────────────────

export type GapSeverity = "gap" | "suggestion" | "info";

export interface ExperienceGap {
  /** Stable code for UI/analytics filtering, e.g. "missing_research_experience". */
  code: string;
  /** Human-readable explanation of the gap. */
  message: string;
  /** Severity — "gap" is actionable, "suggestion" is optional polish, "info" is context. */
  severity: GapSeverity;
  /** Opportunity types that would mitigate this gap. Sorted, de-duplicated. */
  suggestedOpportunityTypes: OpportunityType[];
}

export interface GapAnalysisInput {
  profile: StudentProfile;
  experiences: StudentExperience[];
  goals: StudentGoals | null;
  /** Optional recommended/target courses to contextualise expectations. */
  recommendedCourses?: Array<{
    course: Course;
    requirements: CourseRequirement[];
  }>;
}

export interface GapAnalysisResult {
  gaps: ExperienceGap[];
  /** Union of all suggestedOpportunityTypes across gaps, deduped and sorted. */
  suggestedOpportunityTypes: OpportunityType[];
  summary: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// Mapping from student experienceType → opportunityType that would strengthen it.
// Used to detect which opportunity categories are already covered.
const EXPERIENCE_TO_OPPORTUNITY: Record<string, OpportunityType> = {
  internship: "internship",
  employment: "internship",
  volunteering: "volunteering",
  research: "research",
  competition: "competition",
  award: "competition",
  certification: "course",
  project: "course",
  extracurricular: "course",
  leadership: "course",
};

// ── Validation ──────────────────────────────────────────────────────────────

function assertProfile(profile: StudentProfile): void {
  if (!isUuid(profile.id)) {
    throw new ValidationError("profile.id must be a valid UUID.", {
      field: "profile.id",
    });
  }
}

function assertExperiences(experiences: StudentExperience[]): void {
  if (!Array.isArray(experiences)) {
    throw new ValidationError("experiences must be an array.", {
      field: "experiences",
    });
  }
  for (const exp of experiences) {
    if (typeof exp.experienceType !== "string" || exp.experienceType.length === 0) {
      throw new ValidationError("experienceType is required.", {
        field: "experiences.experienceType",
      });
    }
  }
}

// ── Core helpers ────────────────────────────────────────────────────────────

function hasExperienceType(
  experiences: StudentExperience[],
  types: string[],
): boolean {
  const set = new Set(types);
  return experiences.some((e) => set.has(e.experienceType));
}

function countDistinctExperienceTypes(
  experiences: StudentExperience[],
): number {
  return new Set(experiences.map((e) => e.experienceType)).size;
}

function dedupeAndSort(types: OpportunityType[]): OpportunityType[] {
  const uniq = Array.from(new Set(types));
  // Deterministic alphabetical sort for reproducibility.
  uniq.sort();
  return uniq;
}

function isResearchIntensiveLevel(
  level: StudentProfile["intendedStudyLevel"],
): boolean {
  return level === "postgraduate_research" || level === "phd";
}

function requiresResearchContext(courses: GapAnalysisInput["recommendedCourses"]): boolean {
  if (!courses || courses.length === 0) return false;
  return courses.some(
    (c) =>
      c.course.level === "postgraduate_research" ||
      c.course.level === "phd" ||
      c.requirements.some((r) => r.kind === "academic" && /research/i.test(r.sourceText)),
  );
}

function isGoalsMeaningful(goals: StudentGoals | null): boolean {
  if (!goals) return false;
  const study = goals.studyGoals.trim();
  const career = goals.careerGoals.trim();
  // Consider goals meaningful if either field is > 20 chars (not just placeholder).
  return study.length >= 20 || career.length >= 20;
}

// ── Main analysis ───────────────────────────────────────────────────────────

/**
 * Deterministic experience gap analysis.
 *
 * Rules (transparent, versioned implicitly by code):
 *  1. Limited breadth — fewer than 2 experiences or <2 distinct types → suggests course + volunteering
 *  2. Missing internship/employment when targeting competitive UG/PG → gap
 *  3. Missing volunteering/community → suggestion
 *  4. Missing research for research-intensive pathways → gap
 *  5. Missing competition/award → suggestion for competitive courses
 *  6. Undefined or empty goals → gap suggesting course (exploration)
 *  7. No leadership/project when targeting postgraduate → suggestion
 *
 * All branches are pure and order-independent; output is sorted for determinism.
 */
export function analyzeExperienceGaps(
  input: GapAnalysisInput,
): GapAnalysisResult {
  assertProfile(input.profile);
  assertExperiences(input.experiences);

  const gaps: ExperienceGap[] = [];
  const experiences = input.experiences;
  const profile = input.profile;
  const goals = input.goals;
  const courses = input.recommendedCourses ?? [];

  // 1) Breadth
  if (experiences.length === 0) {
    gaps.push({
      code: "no_experiences",
      message:
        "No experiences recorded yet. Add internships, volunteering or projects to strengthen your application.",
      severity: "gap",
      suggestedOpportunityTypes: ["course", "internship", "volunteering"],
    });
  } else if (experiences.length === 1 || countDistinctExperienceTypes(experiences) < 2) {
    gaps.push({
      code: "limited_breadth",
      message:
        "Your profile shows limited breadth — one experience or a single category. Diversify with a complementary opportunity.",
      severity: "suggestion",
      suggestedOpportunityTypes: ["course", "volunteering"],
    });
  }

  // 2) Internship / employment
  if (!hasExperienceType(experiences, ["internship", "employment"])) {
    // For undergraduate/postgraduate_taught employability is valued.
    const needsInternship =
      profile.intendedStudyLevel === "undergraduate" ||
      profile.intendedStudyLevel === "postgraduate_taught" ||
      profile.intendedStudyLevel === null ||
      courses.some((c) => c.course.level === "undergraduate");
    if (needsInternship) {
      gaps.push({
        code: "missing_internship_experience",
        message:
          "No internship or employment experience found. Internships demonstrate career readiness for taught programmes.",
        severity: "gap",
        suggestedOpportunityTypes: ["internship"],
      });
    } else if (experiences.length > 0) {
      // For other levels, still suggest but as lower severity.
      gaps.push({
        code: "missing_internship_experience_optional",
        message: "Consider an internship to add practical experience.",
        severity: "suggestion",
        suggestedOpportunityTypes: ["internship"],
      });
    }
  }

  // 3) Volunteering
  if (!hasExperienceType(experiences, ["volunteering"])) {
    // Always valuable; gap if breadth is low, suggestion otherwise.
    const severity: GapSeverity =
      experiences.length < 3 ? "gap" : "suggestion";
    gaps.push({
      code: "missing_volunteering_experience",
      message:
        "No volunteering experience recorded. Volunteering signals community engagement valued by UK universities.",
      severity,
      suggestedOpportunityTypes: ["volunteering"],
    });
  }

  // 4) Research
  const needsResearch =
    isResearchIntensiveLevel(profile.intendedStudyLevel) ||
    requiresResearchContext(courses);
  if (needsResearch && !hasExperienceType(experiences, ["research"])) {
    gaps.push({
      code: "missing_research_experience",
      message:
        "Your target pathway is research-intensive but no research experience is recorded. A research placement would strengthen the application.",
      severity: "gap",
      suggestedOpportunityTypes: ["research"],
    });
  } else if (
    !needsResearch &&
    !hasExperienceType(experiences, ["research"]) &&
    experiences.length >= 2 &&
    (profile.intendedStudyLevel === "postgraduate_taught" ||
      courses.some((c) => c.course.level === "postgraduate_taught"))
  ) {
    // Light suggestion for taught postgrad to differentiate.
    gaps.push({
      code: "missing_research_suggestion",
      message:
        "Adding a short research project or assistant experience would differentiate a taught postgraduate application.",
      severity: "suggestion",
      suggestedOpportunityTypes: ["research"],
    });
  }

  // 5) Competition / award
  if (!hasExperienceType(experiences, ["competition", "award"])) {
    const competitiveCourses = courses.filter((c) =>
      /competition|olympiad|award/i.test(c.requirements.map((r) => r.sourceText).join(" ")),
    );
    // If any recommended course is aspirational/competitive or student targets competitive subject, suggest.
    const shouldFlag =
      competitiveCourses.length > 0 ||
      experiences.length < 4;
    if (shouldFlag) {
      gaps.push({
        code: "missing_competition_experience",
        message:
          "No competition or award experience found. Competitions demonstrate subject passion and achievement.",
        severity: experiences.length === 0 ? "gap" : "suggestion",
        suggestedOpportunityTypes: ["competition"],
      });
    }
  }

  // 6) Goals clarity
  if (!isGoalsMeaningful(goals)) {
    gaps.push({
      code: "undefined_goals",
      message:
        "Study or career goals are empty or too brief. Define goals to receive tailored course and skill recommendations.",
      severity: experiences.length === 0 ? "gap" : "suggestion",
      suggestedOpportunityTypes: ["course"],
    });
  }

  // 7) Leadership / project for postgraduate
  if (
    (profile.intendedStudyLevel === "postgraduate_taught" ||
      profile.intendedStudyLevel === "postgraduate_research" ||
      profile.intendedStudyLevel === "phd") &&
    !hasExperienceType(experiences, ["leadership", "project", "research"])
  ) {
    // Only add if not already covered by research gap to avoid redundancy.
    const alreadyHasLeadershipGap = gaps.some((g) => g.code === "missing_research_experience");
    if (!alreadyHasLeadershipGap) {
      gaps.push({
        code: "missing_leadership_project",
        message:
          "No leadership or project experience found for a postgraduate pathway. Lead a project or initiative to demonstrate independence.",
        severity: "suggestion",
        suggestedOpportunityTypes: ["course", "internship"],
      });
    }
  }

  // 8) Extracurricular / certification for enrichment
  const hasEnrichment = hasExperienceType(experiences, [
    "certification",
    "extracurricular",
    "project",
  ]);
  if (!hasEnrichment && experiences.length < 3) {
    gaps.push({
      code: "limited_enrichment",
      message:
        "Add a short course or certification to show continuous learning alongside formal study.",
      severity: "info",
      suggestedOpportunityTypes: ["course"],
    });
  }

  // Ensure every gap's opportunity types are validated and sorted.
  for (const gap of gaps) {
    const filtered = gap.suggestedOpportunityTypes.filter((t) => isOpportunityType(t));
    gap.suggestedOpportunityTypes = dedupeAndSort(filtered);
  }

  // Deterministic sort of gaps by code for reproducibility.
  gaps.sort((a, b) => a.code.localeCompare(b.code));

  const allSuggested = dedupeAndSort(
    gaps.flatMap((g) => g.suggestedOpportunityTypes),
  );

  const summary =
    gaps.length === 0
      ? "Your experience profile looks well-rounded for your target pathway."
      : `Found ${gaps.length} area${gaps.length === 1 ? "" : "s"} to strengthen. Prioritise: ${allSuggested.join(", ") || "no specific opportunity type"}.`;

  return {
    gaps,
    suggestedOpportunityTypes: allSuggested,
    summary,
  };
}

/**
 * Convenience helper: map existing experiences to already-covered opportunity types.
 * Useful for filtering catalogue queries to exclude redundant categories.
 */
export function coveredOpportunityTypes(
  experiences: StudentExperience[],
): OpportunityType[] {
  assertExperiences(experiences);
  const covered: OpportunityType[] = [];
  for (const exp of experiences) {
    const mapped = EXPERIENCE_TO_OPPORTUNITY[exp.experienceType];
    if (mapped) covered.push(mapped);
  }
  return dedupeAndSort(covered);
}

/**
 * Returns a deterministic relevance score for an opportunity against gaps.
 * Higher means the opportunity addresses more gaps. Pure utility for ranking.
 */
export function scoreOpportunityForGaps(
  opportunityType: OpportunityType,
  gaps: ExperienceGap[],
): number {
  if (!isOpportunityType(opportunityType)) {
    throw new ValidationError(`Invalid opportunity type "${opportunityType}".`, {
      field: "opportunityType",
    });
  }
  let score = 0;
  for (const gap of gaps) {
    if (gap.suggestedOpportunityTypes.includes(opportunityType)) {
      // Weight by severity.
      if (gap.severity === "gap") score += 3;
      else if (gap.severity === "suggestion") score += 2;
      else score += 1;
    }
  }
  return score;
}
