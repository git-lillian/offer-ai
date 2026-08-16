import Link from "next/link";
import {
  ApplicationCycleRepository,
  CourseIntakeRepository,
  CourseRepository,
  InstitutionRepository,
} from "@offer-ai/database";
import type { SelectOption } from "@offer-ai/ui";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { NewCaseForm } from "./new-case-form";

export const metadata = {
  title: "New application case | Offer.ai",
};

export default async function NewCasePage() {
  await requireUser();
  const supabase = await getServerClient();

  const [institutions, cycles] = await Promise.all([
    new InstitutionRepository(supabase).listAll(50),
    new ApplicationCycleRepository(supabase).listOpen(),
  ]);

  const firstInstitutionId = institutions[0]?.id;
  const courses = firstInstitutionId
    ? await new CourseRepository(supabase).listByInstitution(firstInstitutionId, 50)
    : [];

  const intakeRepo = new CourseIntakeRepository(supabase);
  const intakesByCourse = new Map<string, SelectOption[]>();
  for (const course of courses) {
    const intakes = await intakeRepo.listByCourse(course.id, 10);
    intakesByCourse.set(
      course.id,
      intakes.map((intake) => ({
        value: intake.id,
        label: `Intake ${intake.intakeMonth}/${intake.intakeYear}`,
      })),
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-2xl">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            ← Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl font-bold text-slate-900">Create an application case</h1>
          <p className="mt-2 text-slate-600">
            Choose the university, course, intake and cycle. Cases start in
            draft status and you can add documents and tasks later.
          </p>

          <NewCaseForm
            institutions={institutions}
            courses={courses}
            intakesByCourse={intakesByCourse}
            cycles={cycles}
          />
        </section>
      </main>
    </>
  );
}
