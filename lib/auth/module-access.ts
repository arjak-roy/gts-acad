import type { AuthSessionClaims } from "@/lib/auth/session";

export const ASSIGNABLE_STAFF_MODULES = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", permissionName: "module:dashboard", description: "KPIs, alerts, and global search.", routePrefixes: ["/dashboard", "/search"] },
  { key: "overview", href: "/overview", label: "Overview", permissionName: "module:overview", description: "Cross-module academy hierarchy overview.", routePrefixes: ["/overview"] },
  { key: "learners", href: "/learners", label: "Learners", permissionName: "module:learners", description: "Learner directory, sheets, and enrollment operations.", routePrefixes: ["/learners"] },
  { key: "courses", href: "/courses", label: "Courses", permissionName: "module:courses", description: "Course catalog management.", routePrefixes: ["/courses"] },
  { key: "programs", href: "/programs", label: "Programs", permissionName: "module:programs", description: "Program catalog and mappings.", routePrefixes: ["/programs"] },
  { key: "batches", href: "/batches", label: "Batches", permissionName: "module:batches", description: "Batch planning and scheduling.", routePrefixes: ["/batches"] },
  { key: "trainers", href: "/trainers", label: "Trainers", permissionName: "module:trainers", description: "Trainer registry and profile operations.", routePrefixes: ["/trainers"] },
  { key: "attendance", href: "/attendance", label: "Attendance", permissionName: "module:attendance", description: "Attendance records and marking.", routePrefixes: ["/attendance"] },
  { key: "assessments", href: "/assessments", label: "Assessments", permissionName: "module:assessments", description: "Assessment bank and results views.", routePrefixes: ["/assessments"] },
  { key: "certifications", href: "/certifications", label: "Certifications", permissionName: "module:certifications", description: "Certificates and credential issuance.", routePrefixes: ["/certifications"] },
  { key: "readiness", href: "/readiness", label: "Readiness", permissionName: "module:readiness", description: "Placement readiness workflows.", routePrefixes: ["/readiness"] },
  { key: "language-lab", href: "/language-lab", label: "Language Lab", permissionName: "module:language_lab", description: "Language lab sessions and scoring.", routePrefixes: ["/language-lab"] },
  { key: "payments", href: "/payments", label: "Payments", permissionName: "module:payments", description: "Fees and payment records.", routePrefixes: ["/payments"] },
  { key: "support", href: "/support", label: "Support", permissionName: "module:support", description: "Support ticket queues.", routePrefixes: ["/support"] },
] as const;

export const STAFF_ONLY_MODULES = [
  ...ASSIGNABLE_STAFF_MODULES,
  { key: "settings", href: "/settings", label: "Settings", permissionName: "module:settings", description: "Super-admin access control and system settings.", routePrefixes: ["/settings"] },
] as const;

export type StaffModuleKey = (typeof STAFF_ONLY_MODULES)[number]["key"];
export type AssignableStaffModuleKey = (typeof ASSIGNABLE_STAFF_MODULES)[number]["key"];

export const assignableStaffModuleKeys = ASSIGNABLE_STAFF_MODULES.map((module) => module.key) as [
  AssignableStaffModuleKey,
  ...Array<AssignableStaffModuleKey>,
];

export function isSuperAdminSession(session: Pick<AuthSessionClaims, "roles" | "permissions"> | null | undefined) {
  if (!session) {
    return false;
  }

  return session.permissions.includes("all:*") || session.roles.includes("Super Admin");
}

export function isCandidateSession(session: Pick<AuthSessionClaims, "role"> | null | undefined) {
  return session?.role?.toLowerCase() === "candidate";
}

export function isStaffSession(session: Pick<AuthSessionClaims, "role" | "roles" | "permissions"> | null | undefined) {
  if (!session) {
    return false;
  }

  if (isSuperAdminSession(session)) {
    return true;
  }

  const normalizedRole = session.role.toLowerCase();
  if (normalizedRole === "admin" || normalizedRole === "trainer") {
    return true;
  }

  return ASSIGNABLE_STAFF_MODULES.some((module) => session.permissions.includes(module.permissionName));
}

export function getModulePermissionName(moduleKey: AssignableStaffModuleKey) {
  return ASSIGNABLE_STAFF_MODULES.find((module) => module.key === moduleKey)?.permissionName ?? "";
}

export function canAccessModule(session: Pick<AuthSessionClaims, "role" | "roles" | "permissions"> | null | undefined, moduleKey: StaffModuleKey) {
  if (!session) {
    return false;
  }

  if (moduleKey === "settings") {
    return isSuperAdminSession(session);
  }

  if (isSuperAdminSession(session)) {
    return true;
  }

  if (!isStaffSession(session)) {
    return false;
  }

  const module = ASSIGNABLE_STAFF_MODULES.find((entry) => entry.key === moduleKey);
  return Boolean(module && session.permissions.includes(module.permissionName));
}

export function resolveModuleForPathname(pathname: string): StaffModuleKey | null {
  const match = STAFF_ONLY_MODULES.find((module) =>
    module.routePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );

  return match?.key ?? null;
}

export function getAccessibleStaffModules(session: Pick<AuthSessionClaims, "role" | "roles" | "permissions"> | null | undefined) {
  return STAFF_ONLY_MODULES.filter((module) => canAccessModule(session, module.key));
}

export function getDefaultPortalPath(session: Pick<AuthSessionClaims, "role" | "roles" | "permissions"> | null | undefined) {
  if (!session) {
    return "/login";
  }

  if (isCandidateSession(session)) {
    return "/learners";
  }

  const firstModule = getAccessibleStaffModules(session)[0];
  return firstModule?.href ?? "/access-denied";
}