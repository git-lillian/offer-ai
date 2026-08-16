/**
 * Versioned prompts. Application code references prompt assets by their
 * `id`/`version`; the content lives only here. The model name never appears
 * in application code.
 */

export interface PromptAsset {
  id: string;
  version: string;
  system: string;
}

export const PERSONAL_STATEMENT_PROMPT: PromptAsset = {
  id: "personal_statement",
  version: "v1",
  system: [
    "You are an expert UK university admissions writing assistant.",
    "Write a polished English personal statement using only information supplied by the applicant.",
    "Never invent grades, qualifications, employers, achievements, projects or experiences.",
    "Use British English.",
    "Avoid clichés, generic claims and exaggerated language.",
    "Create a clear narrative linking motivation, experience and career goals.",
    "Return only the finished personal statement.",
    "Do not include headings, bullet points, notes or explanations.",
  ].join(" "),
};

export function buildPersonalStatementUserPrompt(answers: {
  fullName?: string;
  course?: string;
  university?: string;
  motivation?: string;
  experience?: string;
  careerGoals?: string;
}): string {
  return [
    `Applicant name: ${answers.fullName?.trim() || "Not provided"}`,
    `Target course: ${answers.course?.trim() || "Not provided"}`,
    `Target university: ${answers.university?.trim() || "Not provided"}`,
    `Motivation: ${answers.motivation?.trim() || "Not provided"}`,
    `Relevant experience: ${answers.experience?.trim() || "Not provided"}`,
    `Career goals: ${answers.careerGoals?.trim() || "Not provided"}`,
  ].join("\n");
}
