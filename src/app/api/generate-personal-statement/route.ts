import OpenAI from "openai";
import { NextResponse } from "next/server";

type PersonalStatementAnswers = {
  fullName?: string;
  course?: string;
  university?: string;
  motivation?: string;
  experience?: string;
  careerGoals?: string;
};

type GenerateRequest = {
  answers?: PersonalStatementAnswers;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const model =
      process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "DeepSeek API key is not configured.",
        },
        {
          status: 500,
        },
      );
    }

    const body = (await request.json()) as GenerateRequest;
    const answers = body.answers;

    if (!answers) {
      return NextResponse.json(
        {
          error: "Questionnaire answers are required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !answers.course?.trim() ||
      !answers.university?.trim() ||
      !answers.motivation?.trim() ||
      !answers.experience?.trim() ||
      !answers.careerGoals?.trim()
    ) {
      return NextResponse.json(
        {
          error: "Please complete all questionnaire sections.",
        },
        {
          status: 400,
        },
      );
    }

    const deepseek = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
    });

    const completion = await deepseek.chat.completions.create({
      model,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: [
            "You are an expert UK university admissions writing assistant.",
            "Write a polished English personal statement using only information supplied by the applicant.",
            "Never invent grades, qualifications, employers, achievements, projects or experiences.",
            "Use British English.",
            "Avoid clichés, generic claims and exaggerated language.",
            "Create a clear narrative linking motivation, experience and career goals.",
            "Return only the finished personal statement.",
            "Do not include headings, bullet points, notes or explanations.",
          ].join(" "),
        },
        {
          role: "user",
          content: `
Applicant name:
${answers.fullName?.trim() || "Not provided"}

Target course:
${answers.course.trim()}

Target university:
${answers.university.trim()}

Motivation:
${answers.motivation.trim()}

Relevant experience:
${answers.experience.trim()}

Career goals:
${answers.careerGoals.trim()}
          `.trim(),
        },
      ],
    });

    const statement =
      completion.choices[0]?.message?.content?.trim();

    if (!statement) {
      return NextResponse.json(
        {
          error: "DeepSeek returned an empty response.",
        },
        {
          status: 502,
        },
      );
    }

    return NextResponse.json({
      statement,
    });
  } catch (error) {
    console.error(
      "DeepSeek personal statement generation failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate the personal statement.",
      },
      {
        status: 500,
      },
    );
  }
}