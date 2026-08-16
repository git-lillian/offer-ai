"use client";

import { useActionState, useState } from "react";
import { Button, Select, type SelectOption } from "@offer-ai/ui";
import { createApplicationCaseAction } from "./actions";

type InstitutionOption = { id: string; name: string };
type CourseOption = { id: string; title: string; level: string };
type CycleOption = { id: string; code: string };

export function NewCaseForm({
  institutions,
  courses,
  intakesByCourse,
  cycles,
}: {
  institutions: InstitutionOption[];
  courses: CourseOption[];
  intakesByCourse: Map<string, SelectOption[]>;
  cycles: CycleOption[];
}) {
  const [state, formAction, pending] = useActionState(createApplicationCaseAction, {});
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.id ?? "");

  const intakes = (selectedCourse && intakesByCourse.get(selectedCourse)) || [];

  return (
    <form
      action={formAction}
      className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
    >
      <Select
        id="institutionId"
        label="University"
        required
        name="institutionId"
        options={institutions.map((institution) => ({
          value: institution.id,
          label: institution.name,
        }))}
      />
      <Select
        id="courseId"
        label="Course"
        required
        name="courseId"
        options={courses.map((course) => ({
          value: course.id,
          label: `${course.title} (${course.level.replace(/_/g, " ")})`,
        }))}
        onChange={(event) => setSelectedCourse(event.target.value)}
      />
      <Select
        id="courseIntakeId"
        label="Intake"
        required
        name="courseIntakeId"
        options={intakes}
      />
      <Select
        id="applicationCycleId"
        label="Application cycle"
        required
        name="applicationCycleId"
        options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.code }))}
      />

      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          {state.error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create case"}
        </Button>
      </div>
    </form>
  );
}
