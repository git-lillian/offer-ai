/**
 * Organisations domain: agencies, solo consultants, schools, opportunity
 * providers. Membership links users to organisations instead of attaching
 * staff directly to business records.
 */

export const ORGANISATION_TYPES = [
  "agency",
  "solo_provider",
  "school",
  "university_partner",
  "opportunity_provider",
] as const;

export type OrganisationType = (typeof ORGANISATION_TYPES)[number];

export interface Organisation {
  id: string;
  name: string;
  type: OrganisationType;
  countryCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganisationMembership {
  id: string;
  organisationId: string;
  userId: string;
  roleInOrganisation: string;
  joinedAt: Date;
}

export function isOrganisationType(value: string): value is OrganisationType {
  return (ORGANISATION_TYPES as readonly string[]).includes(value);
}
