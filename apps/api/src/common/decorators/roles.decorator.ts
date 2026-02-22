import { SetMetadata } from '@nestjs/common';

export type AgencyRole = 'OWNER' | 'STAFF' | 'STAFF_PRICING' | 'VIEWER';

// Role hierarchy (higher index = more permissions)
const ROLE_LEVEL: Record<AgencyRole, number> = {
  VIEWER: 0,
  STAFF: 1,
  STAFF_PRICING: 2,
  OWNER: 3,
};

export function hasMinRole(userRole: string, minRole: AgencyRole): boolean {
  const user = ROLE_LEVEL[userRole as AgencyRole];
  const required = ROLE_LEVEL[minRole];
  if (user === undefined || required === undefined) return false;
  return user >= required;
}

export const ROLES_KEY = 'roles';

/**
 * @Roles('STAFF') means the user must have STAFF level or higher (STAFF_PRICING, OWNER).
 * Use @Roles('OWNER') for owner-only routes.
 */
export const Roles = (minRole: AgencyRole) => SetMetadata(ROLES_KEY, minRole);
