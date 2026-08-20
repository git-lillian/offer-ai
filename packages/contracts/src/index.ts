export * from "./onboarding";
export * from "./auth";
export * from "./jobs";
export * from "./catalogue";
export * from "./ingestion";
export * from "./recommendation";
export * from "./artifacts";
export * from "./adviser";
export * from "./opportunities";
export * from "./marketplace";
export * from "./billing";
export * from "./notifications";

// cases — explicit to avoid duplicate `createTaskSchema` with application-os
export {
  createApplicationCaseSchema,
  applicationCaseStatusSchema,
  transitionApplicationCaseSchema,
  createTaskSchema,
  completeTaskSchema,
} from "./cases";
export type {
  CreateApplicationCaseInput,
  TransitionApplicationCaseInput,
  CreateTaskInput,
  CompleteTaskInput,
} from "./cases";

// application-os — OS v1 task + milestone contracts
export {
  createTaskSchema as createOsTaskSchema,
  updateTaskSchema,
  completeOsTaskSchema,
  rescheduleTaskSchema,
  listTasksSchema,
  listTasksResponseSchema,
  applicationOsTaskSourceSchema,
  applicationOsTaskPrioritySchema,
  applicationOsTaskStatusSchema,
  applicationOsMilestoneStatusSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  listMilestonesSchema,
  milestoneDtoSchema,
  listMilestonesResponseSchema,
} from "./application-os";
export type {
  CreateOsTaskInput,
  UpdateTaskInput,
  CompleteOsTaskInput,
  RescheduleTaskInput,
  ListTasksInput,
  ListTasksResponse,
  CreateMilestoneInput,
  UpdateMilestoneInput,
  ListMilestonesInput,
  MilestoneDto,
  ListMilestonesResponse,
} from "./application-os";
