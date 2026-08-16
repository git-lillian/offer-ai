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
  findById(userId: string): Promise<StudentProfile | null>;
  createOrUpdate(profile: StudentProfile): Promise<StudentProfile>;
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
  create(caseRecord: ApplicationCase): Promise<ApplicationCase>;
  updateStatus(
    id: string,
    status: ApplicationCase["currentStatus"],
  ): Promise<ApplicationCase>;
  appendEvent(event: ApplicationEvent): Promise<ApplicationEvent>;
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
}

export type { ApplicationEvent, ApplicationEventType };
