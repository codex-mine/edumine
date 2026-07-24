export const ROLES = [
  "principal",
  "admin",
  "teacher",
  "accountant",
  "receptionist",
  "staff",
  "student",
  "guardian",
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Principal holds full system authority (requirements.md 3.1) and may access every role's dashboard. */
export function roleCanAccess(userRole: Role, requiredRole: Role): boolean {
  return userRole === "principal" || userRole === requiredRole;
}
