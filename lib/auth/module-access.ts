import type { AuthSessionClaims, CandidateSessionClaims } from "@/lib/auth/session";

export const ASSIGNABLE_STAFF_MODULES = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", permissionName: "dashboard:view", description: "KPIs, alerts, and global search.", routePrefixes: ["/dashboard", "/search"] },
  { key: "overview", href: "/overview", label: "Overview", permissionName: "dashboard:view", description: "Cross-module academy hierarchy overview.", routePrefixes: ["/overview"] },
  { key: "learners", href: "/staff/learners", label: "Learners", permissionName: "learners:view", description: "Learner directory, sheets, and enrollment operations.", routePrefixes: ["/staff/learners"] },
  { key: "courses", href: "/courses", label: "Courses", permissionName: "programs:view", description: "Course catalog management.", routePrefixes: ["/courses"] },
  { key: "programs", href: "/programs", label: "Programs", permissionName: "programs:view", description: "Program catalog and mappings.", routePrefixes: ["/programs"] },
  { key: "batches", href: "/batches", label: "Batches", permissionName: "batches:view", description: "Batch planning and scheduling.", routePrefixes: ["/batches"] },
  { key: "trainers", href: "/trainers", label: "Trainers", permissionName: "trainers:view", description: "Trainer registry and profile operations.", routePrefixes: ["/trainers"] },
  { key: "attendance", href: "/attendance", label: "Attendance", permissionName: "attendance:view", description: "Attendance records and marking.", routePrefixes: ["/attendance"] },
  { key: "assessments", href: "/assessments", label: "Assessments", permissionName: "reports:view", description: "Assessment bank and results views.", routePrefixes: ["/assessments"] },
  { key: "certifications", href: "/certifications", label: "Certifications", permissionName: "reports:view", description: "Certificates and credential issuance.", routePrefixes: ["/certifications"] },
  { key: "readiness", href: "/readiness", label: "Readiness", permissionName: "reports:view", description: "Placement readiness workflows.", routePrefixes: ["/readiness"] },
  { key: "language-lab", href: "/language-lab", label: "Language Lab", permissionName: "reports:view", description: "Language lab sessions and scoring.", routePrefixes: ["/language-lab"] },
  { key: "payments", href: "/payments", label: "Payments", permissionName: "reports:view", description: "Fees and payment records.", routePrefixes: ["/payments"] },
  { key: "support", href: "/support", label: "Support", permissionName: "reports:view", description: "Support ticket queues.", routePrefixes: ["/support"] },
  { key: "logs-actions", href: "/logs-actions", label: "Logs & Actions", permissionName: "reports:view", description: "Operational audit logs and retry actions.", routePrefixes: ["/logs-actions"] },
] as const;

export const STAFF_ONLY_MODULES = [
  ...ASSIGNABLE_STAFF_MODULES,
  { key: "roles", href: "/super-admin/roles", label: "Roles", permissionName: "roles:manage", description: "Custom role creation and permission management.", routePrefixes: ["/super-admin/roles"] },
  { key: "settings", href: "/settings", label: "Settings", permissionName: "users:manage", description: "Super-admin access control and system settings.", routePrefixes: ["/settings"] },
] as const;

export type StaffModuleKey = (typeof STAFF_ONLY_MODULES)[number]["key"];
export type AssignableStaffModuleKey = (typeof ASSIGNABLE_STAFF_MODULES)[number]["key"];

export const assignableStaffModuleKeys = ASSIGNABLE_STAFF_MODULES.map((module) => module.key) as [
  AssignableStaffModuleKey,
  ...Array<AssignableStaffModuleKey>,
];

const modulePermissionFallbacks: Record<StaffModuleKey, string[]> = {
  dashboard: ["dashboard:view"],
  overview: ["dashboard:view"],
  learners: ["learners:view", "learners:edit"],
  courses: ["programs:view", "programs:manage"],
  programs: ["programs:view", "programs:manage"],
  batches: ["batches:view", "batches:manage"],
  trainers: ["trainers:view", "trainers:manage"],
  attendance: ["attendance:view", "attendance:mark"],
  assessments: ["reports:view"],
  certifications: ["reports:view"],
  readiness: ["reports:view"],
  "language-lab": ["reports:view"],
  payments: ["reports:view"],
  support: ["reports:view"],
  "logs-actions": ["reports:view"],
  roles: ["roles:manage"],
  settings: ["roles:manage", "users:manage"],
};

type StaffSessionLike = Pick<AuthSessionClaims, "role" | "roles" | "permissions">;
type SessionLike = StaffSessionLike | Pick<CandidateSessionClaims, "learnerId"> | null | undefined;

export function isSuperAdminSession(session: Pick<AuthSessionClaims, "role" | "roles" | "permissions"> | null | undefined) {
  if (!session) {
    return false;
  }

  return session.role.toLowerCase() === "superadmin" || session.roles.includes("superadmin");
}

export function isCandidateSession(session: Pick<AuthSessionClaims, "role"> | Pick<CandidateSessionClaims, "learnerId"> | null | undefined): session is Pick<CandidateSessionClaims, "learnerId"> {
  if (!session) {
    return false;
  }

  return "learnerId" in session || session.role?.toLowerCase() === "candidate";
}

export function isStaffSession(session: Pick<AuthSessionClaims, "role" | "roles" | "permissions"> | null | undefined): session is StaffSessionLike {
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

export function canAccessModule(session: SessionLike, moduleKey: StaffModuleKey) {
  if (!session || isCandidateSession(session)) {
    return false;
  }

  const staffSession = session as StaffSessionLike;

  if (isSuperAdminSession(staffSession)) {
    return true;
  }

  if (!isStaffSession(staffSession)) {
    return false;
  }

  return modulePermissionFallbacks[moduleKey].some((permissionKey) => staffSession.permissions.includes(permissionKey));
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