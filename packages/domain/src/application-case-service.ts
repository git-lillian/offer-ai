/**
 * Application services for the ApplicationCase aggregate.
 *
 * These services orchestrate repositories and apply domain rules. They are
 * framework-free and therefore usable from the web app and the worker.
 */

import { NotFoundError, ValidationError, ConflictError } from "./errors";
import type {
  ApplicationCase,
  ApplicationEvent,
  ApplicationCaseStatus,
} from "./application-case";
import { transitionCaseStatus } from "./application-case";
import type {
  ApplicationCaseCreationInput,
  ApplicationCaseServiceDependencies,
} from "./repositories";

export class ApplicationCaseService {
  constructor(private readonly deps: ApplicationCaseServiceDependencies) {}

  async create(input: ApplicationCaseCreationInput): Promise<{
    caseRecord: ApplicationCase;
    createdEvent: ApplicationEvent;
  }> {
    const { studentId, institutionId, courseId, courseIntakeId, applicationCycleId } =
      input;

    const student = await this.deps.studentProfileRepository.findById(studentId);
    if (!student) {
      throw new NotFoundError("Student profile not found.");
    }

    const [institution, course, intake, cycle] = await Promise.all([
      this.deps.institutionRepository.findById(institutionId),
      this.deps.courseRepository.findById(courseId),
      this.deps.courseIntakeRepository.findById(courseIntakeId),
      this.deps.applicationCycleRepository.findById(applicationCycleId),
    ]);

    if (!institution) throw new NotFoundError("Institution not found.");
    if (!course) throw new NotFoundError("Course not found.");
    if (!intake) throw new NotFoundError("Course intake not found.");
    if (!cycle) throw new NotFoundError("Application cycle not found.");

    if (intake.courseId !== course.id) {
      throw new ConflictError("The intake does not belong to the chosen course.");
    }
    if (intake.applicationCycleId !== cycle.id) {
      throw new ConflictError("The intake does not belong to the chosen cycle.");
    }
    if (cycle.status === "closed") {
      throw new ConflictError("The application cycle is closed.");
    }

    const now = new Date();
    const caseRecord: ApplicationCase = {
      id: crypto.randomUUID(),
      studentId,
      institutionId,
      courseId,
      courseIntakeId,
      applicationCycleId,
      applicationRoute: "institution_direct",
      currentStatus: "draft",
      submittedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const createdEvent: ApplicationEvent = {
      id: crypto.randomUUID(),
      caseId: caseRecord.id,
      eventType: "created",
      status: "draft",
      actorUserId: studentId,
      message: "Application case created.",
      metadata: null,
      occurredAt: now,
    };

    const saved = await this.deps.applicationCaseRepository.create(caseRecord);
    const savedEvent = await this.deps.applicationCaseRepository.appendEvent(
      createdEvent,
    );
    return { caseRecord: saved, createdEvent: savedEvent };
  }

  async listEvents(caseId: string): Promise<ApplicationEvent[]> {
    return this.deps.applicationCaseRepository.listEvents(caseId);
  }
}

/**
 * Status transitions only need the case repository — separate from full
 * case creation so delivery layers don't carry unused dependencies.
 */
export class ApplicationCaseTransitionService {
  constructor(
    private readonly applicationCaseRepository: ApplicationCaseServiceDependencies["applicationCaseRepository"],
  ) {}

  async transitionStatus(
    caseId: string,
    to: ApplicationCaseStatus,
    actorUserId: string,
    message?: string,
  ): Promise<ApplicationEvent> {
    const existing = await this.applicationCaseRepository.findById(caseId);
    if (!existing) {
      throw new NotFoundError("Application case not found.");
    }

    const event = transitionCaseStatus(existing.currentStatus, to, actorUserId, message);
    event.caseId = caseId;

    await this.applicationCaseRepository.updateStatus(caseId, to);
    return this.applicationCaseRepository.appendEvent(event);
  }
}

export function validateCaseCreationInput(input: ApplicationCaseCreationInput): void {
  if (!input.studentId) throw new ValidationError("Student is required.");
  if (!input.institutionId) throw new ValidationError("Institution is required.");
  if (!input.courseId) throw new ValidationError("Course is required.");
  if (!input.courseIntakeId) throw new ValidationError("Intake is required.");
  if (!input.applicationCycleId) throw new ValidationError("Application cycle is required.");
}
