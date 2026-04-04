export const routePermissionMap: Record<string, string> = {
  "/dashboard": "dashboard.view",
  "/overview": "dashboard.view",
  "/learners": "users.view",
  "/users": "staff_users.view",
  "/courses": "courses.view",
  "/programs": "programs.view",
  "/batches": "batches.view",
  "/trainers": "trainers.view",
  "/schedule": "schedule.view",
  "/attendance": "attendance.view",
  "/assessments": "assessments.view",
  "/certifications": "certifications.view",
  "/readiness": "readiness.view",
  "/language-lab": "lms.view",
  "/payments": "payments.view",
  "/support": "support.view",
  "/logs-actions": "logs.view",
  "/settings": "settings.view",
  "/roles": "roles.view",
};

export function getRequiredPermission(pathname: string): string | null {
  if (routePermissionMap[pathname]) {
    return routePermissionMap[pathname];
  }

  for (const [route, permission] of Object.entries(routePermissionMap)) {
    if (pathname.startsWith(`${route}/`)) {
      return permission;
    }
  }

  return null;
}
