export const SUPER_ADMIN_ROLE_CODE = "SUPER_ADMIN";

export const EXTERNAL_USER_ROLE_CODES = ["CANDIDATE", "TRAINER"] as const;

export const STAFF_USERS_PERMISSIONS = {
  view: "staff_users.view",
  create: "staff_users.create",
  edit: "staff_users.edit",
  delete: "staff_users.delete",
} as const;

export const CANDIDATE_USERS_PERMISSIONS = {
  view: "candidate_users.view",
  create: "candidate_users.create",
  edit: "candidate_users.edit",
  delete: "candidate_users.delete",
} as const;

export function isInternalUserRoleCode(code: string) {
  return !EXTERNAL_USER_ROLE_CODES.includes(code as (typeof EXTERNAL_USER_ROLE_CODES)[number]);
}
