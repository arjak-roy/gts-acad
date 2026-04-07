export const routePermissionMap: Record<string, string> = {
  "/dashboard": "dashboard.view",
  "/overview": "dashboard.view",
  "/sessions": "sessions.view",
  "/learners": "users.view",
  "/users": "staff_users.view",
  "/courses": "courses.view",
  "/programs": "programs.view",
  "/batches": "batches.view",
  "/trainers": "trainers.view",
  "/schedule": "schedule.view",
  "/attendance": "attendance.view",
  "/assessments": "assessment_pool.view",
  "/certifications": "certifications.view",
  "/readiness": "readiness.view",
  "/language-lab": "lms.view",
  "/course-builder": "courses.view",
  "/course-builder/content": "course_content.view",
  "/course-builder/assessments": "assessment_pool.view",
  "/course-builder/batch-mapping": "batch_content.view",
  "/curriculum-builder": "curriculum.view",
  "/payments": "payments.view",
  "/support": "support.view",
  "/logs-actions": "logs.view",
  "/settings/email-templates": "email_templates.view",
  "/settings": "settings.view",
  "/roles": "roles.view",
};

export function getRequiredPermission(pathname: string): string | null {
  const matchingRoute = Object.keys(routePermissionMap)
    .sort((left, right) => right.length - left.length)
    .find((route) => pathname === route || pathname.startsWith(`${route}/`));

  return matchingRoute ? routePermissionMap[matchingRoute] : null;
}
