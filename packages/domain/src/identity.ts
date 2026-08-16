/**
 * Identity domain: user roles, preferences and account state.
 *
 * A user can hold multiple roles (student, guardian, adviser, ...). The
 * product is never modelled around a single `role` field.
 */

export const ROLE_CODES = [
  "student",
  "guardian",
  "adviser",
  "reviewer",
  "mentor",
  "agency_staff",
  "opportunity_provider",
  "platform_staff",
  "administrator",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export interface UserRole {
  userId: string;
  roleCode: RoleCode;
  assignedAt: Date;
}

export interface UserPreferences {
  userId: string;
  locale: string;
  timezone: string;
  currencyCode: string;
  updatedAt: Date;
}

export interface AccountProfile {
  userId: string;
  email: string;
  fullName: string;
  createdAt: Date;
}

export function hasRole(roles: UserRole[], roleCode: RoleCode): boolean {
  return roles.some((role) => role.roleCode === roleCode);
}
