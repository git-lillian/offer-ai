/**
 * Repository interfaces — ports implemented by `packages/database`.
 *
 * `packages/domain` declares the contracts; the database package provides
 * Supabase-backed implementations. Domain services depend only on these
 * interfaces, keeping the core framework-free.
 */

import type {
  ApplicationCase,
  ApplicationEvent,
  ApplicationEventType,
} from "./application-case";
import type { ApplicationTask } from "./application-task";
import type { ApplicationCycle, Course, CourseIntake, Institution } from "./catalogue";
import type {
  StudentProfile,
  StudentQualification,
  StudentExperience,
  StudentEducation,
} from "./student";
import type { UserRole, UserPreferences } from "./identity";
import type { AuditLogEntry } from "./audit";
import type { AccessGrant } from "./access";
import type { EvidenceItem } from "./evidence";
import type { StudentDocument } from "./document";
import type { Artifact, ArtifactVersion } from "./artifact";

export interface StudentProfileRepository {
  /** Lookup by the canonical student profile id. */
  findById(id: string): Promise<StudentProfile | null>;
  /** Lookup by the linked auth account id. */
  findByUserId(userId: string): Promise<StudentProfile | null>;
  createOrUpdate(profile: StudentProfile): Promise<StudentProfile>;
  /** Links an unclaimed profile to the current auth account (atomic RPC). */
  claim(profileId: string): Promise<StudentProfile | null>;
  /** Creates an unclaimed prospect (adviser/guardian only; role-checked RPC). */
  createProspect(fullName: string, email: string | null): Promise<StudentProfile | null>;
  addEducation(education: StudentEducation): Promise<StudentEducation>;
  addQualification(qualification: StudentQualification): Promise<StudentQualification>;
  addExperience(experience: StudentExperience): Promise<StudentExperience>;
  listEducation(studentId: string): Promise<StudentEducation[]>;
  listQualifications(studentId: string): Promise<StudentQualification[]>;
  listExperiences(studentId: string): Promise<StudentExperience[]>;
}

export interface InstitutionRepository {
  findById(id: string): Promise<Institution | null>;
  listAll(limit: number): Promise<Institution[]>;
}

export interface CourseRepository {
  findById(id: string): Promise<Course | null>;
  listByInstitution(institutionId: string, limit: number): Promise<Course[]>;
}

export interface CourseIntakeRepository {
  findById(id: string): Promise<CourseIntake | null>;
  listByCourse(courseId: string, limit: number): Promise<CourseIntake[]>;
}

export interface ApplicationCycleRepository {
  findById(id: string): Promise<ApplicationCycle | null>;
  listOpen(): Promise<ApplicationCycle[]>;
}

export interface ApplicationCaseRepository {
  findById(id: string): Promise<ApplicationCase | null>;
  listByStudent(studentId: string): Promise<ApplicationCase[]>;
  /** Atomically creates the case and its `created` event. */
  create(input: {
    studentId: string;
    institutionId: string;
    courseId: string;
    courseIntakeId: string;
    applicationCycleId: string;
    applicationRoute: ApplicationCase["applicationRoute"];
    actorUserId: string;
  }): Promise<{ caseRecord: ApplicationCase; createdEvent: ApplicationEvent }>;
  /** Atomically transitions status and appends the status event. */
  transition(input: {
    caseId: string;
    toStatus: ApplicationCase["currentStatus"];
    actorUserId: string;
    eventType: ApplicationEventType;
    message?: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<{ caseRecord: ApplicationCase; event: ApplicationEvent }>;
  /** Appends a non-status event (notes, documents) through a controlled RPC. */
  appendEvent(input: {
    caseId: string;
    eventType: ApplicationEventType;
    status: ApplicationCase["currentStatus"];
    actorUserId: string;
    message: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<ApplicationEvent>;
  listEvents(caseId: string): Promise<ApplicationEvent[]>;
}

export interface ApplicationTaskRepository {
  create(task: ApplicationTask): Promise<ApplicationTask>;
  listByCase(caseId: string): Promise<ApplicationTask[]>;
  update(task: ApplicationTask): Promise<ApplicationTask>;
}

export interface UserRoleRepository {
  listByUser(userId: string): Promise<UserRole[]>;
}

export interface UserPreferencesRepository {
  findById(userId: string): Promise<UserPreferences | null>;
  upsert(preferences: UserPreferences): Promise<UserPreferences>;
}

export interface AuditLogRepository {
  append(entry: AuditLogEntry): Promise<AuditLogEntry>;
}

export interface AccessGrantRepository {
  create(grant: AccessGrant): Promise<AccessGrant>;
  listByStudent(studentId: string): Promise<AccessGrant[]>;
  revoke(id: string, revokedByUserId: string): Promise<AccessGrant>;
}

export interface EvidenceRepository {
  create(item: EvidenceItem): Promise<EvidenceItem>;
  listByStudent(studentId: string): Promise<EvidenceItem[]>;
}

export interface StudentDocumentRepository {
  create(document: StudentDocument): Promise<StudentDocument>;
  listByStudent(studentId: string): Promise<StudentDocument[]>;
}

export interface ArtifactRepository {
  create(artifact: Artifact): Promise<Artifact>;
  listByStudent(studentId: string): Promise<Artifact[]>;
  addVersion(version: ArtifactVersion): Promise<ArtifactVersion>;
}

export interface ApplicationCaseServiceDependencies {
  studentProfileRepository: StudentProfileRepository;
  institutionRepository: InstitutionRepository;
  courseRepository: CourseRepository;
  courseIntakeRepository: CourseIntakeRepository;
  applicationCycleRepository: ApplicationCycleRepository;
  applicationCaseRepository: ApplicationCaseRepository;
}

export interface ApplicationCaseCreationInput {
  studentId: string;
  institutionId: string;
  courseId: string;
  courseIntakeId: string;
  applicationCycleId: string;
  /** Optional explicit route; defaults to the course's preferred route. */
  applicationRoute?: ApplicationCase["applicationRoute"];
  /** Authenticated actor (derived from the session server-side, never the browser). */
  actorUserId: string;
}

export type { ApplicationEvent, ApplicationEventType };
