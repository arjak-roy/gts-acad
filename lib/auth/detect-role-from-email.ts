export function detectRoleFromEmail(email: string): "superadmin" | "admin" | "trainer" {
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail.includes("superadmin") || normalizedEmail.endsWith("@gts-superadmin.com")) {
    return "superadmin";
  }

  if (normalizedEmail.includes("admin") || normalizedEmail.endsWith("@gts-admin.com")) {
    return "admin";
  }

  return "trainer";
}