export type PermissionRequirement = string | string[];

export const routePermissionMap: Record<string, PermissionRequirement> = {
  "/dashboard": "dashboard.view",
  "/overview": "dashboard.view",
  "/sessions": "sessions.view",
  "/learners": "users.view",
  "/users": "staff_users.view",
  "/courses": "courses.view",
  "/programs": "programs.view",
  "/batches": "batches.view",
  "/centers": "centers.view",
  "/trainers": "trainers.view",
  "/schedule": "schedule.view",
  "/attendance": "attendance.view",
  "/assessments/reviews": "assessment_reviews.view",
  "/assessments": "assessment_pool.view",
  "/certifications": "certifications.view",
  "/readiness": "readiness.view",
  "/language-lab": "lms.view",
  "/course-builder": ["course_content.view", "learning_resources.view"],
  "/course-builder/repository": ["course_content.view", "learning_resources.view"],
  "/course-builder/content": ["course_content.view", "learning_resources.view"],
  "/course-builder/resources": ["course_content.view", "learning_resources.view"],
  "/course-builder/assessments": "assessment_pool.view",
  "/course-builder/batch-mapping": ["course_content.view", "learning_resources.view"],
  "/curriculum-builder": "curriculum.view",
  "/payments": "payments.view",
  "/support": "support.view",
  "/logs-actions": "logs.view",
  "/settings/email-templates": "email_templates.view",
  "/settings": "settings.view",
  "/roles": "roles.view",
};

export function getRequiredPermission(pathname: string): PermissionRequirement | null {
  const matchingRoute = Object.keys(routePermissionMap)
    .sort((left, right) => right.length - left.length)
    .find((route) => pathname === route || pathname.startsWith(`${route}/`));

  return matchingRoute ? routePermissionMap[matchingRoute] : null;
}
