/**
 * Application services for the ApplicationCase aggregate.
 *
 * These services orchestrate repositories and apply domain rules. They are
 * framework-free and therefore usable from the web app and the worker.
 *
 * Persistence is atomic: the database repository creates the case and its
 * `created` event in one transaction (and transitions status + event in one
 * transaction) through security-definer RPCs. The domain layer validates
 * inputs and the state machine up front so callers receive typed errors;
 * the database re-enforces the same invariants inside the transaction.
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

    if (course.institutionId !== institution.id) {
      throw new ConflictError("The course does not belong to the chosen institution.");
    }
    if (intake.courseId !== course.id) {
      throw new ConflictError("The intake does not belong to the chosen course.");
    }
    if (intake.applicationCycleId !== cycle.id) {
      throw new ConflictError("The intake does not belong to the chosen cycle.");
    }
    if (cycle.status === "closed") {
      throw new ConflictError("The application cycle is closed.");
    }

    const applicationRoute =
      input.applicationRoute ?? (course.applicationRoutes?.includes("ucas") ? "ucas" : "institution_direct");

    return this.deps.applicationCaseRepository.create({
      studentId,
      institutionId,
      courseId,
      courseIntakeId,
      applicationCycleId,
      applicationRoute,
      actorUserId: input.actorUserId,
    });
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
  ): Promise<{ caseRecord: ApplicationCase; event: ApplicationEvent }> {
    const existing = await this.applicationCaseRepository.findById(caseId);
    if (!existing) {
      throw new NotFoundError("Application case not found.");
    }

    const event = transitionCaseStatus(existing.currentStatus, to, actorUserId, message);

    return this.applicationCaseRepository.transition({
      caseId,
      toStatus: to,
      actorUserId,
      eventType: event.eventType,
      message: event.message,
      metadata: event.metadata,
    });
  }
}

export function validateCaseCreationInput(input: ApplicationCaseCreationInput): void {
  if (!input.studentId) throw new ValidationError("Student is required.");
  if (!input.institutionId) throw new ValidationError("Institution is required.");
  if (!input.courseId) throw new ValidationError("Course is required.");
  if (!input.courseIntakeId) throw new ValidationError("Intake is required.");
  if (!input.applicationCycleId) throw new ValidationError("Application cycle is required.");
  if (!input.actorUserId) throw new ValidationError("Actor is required.");
}
