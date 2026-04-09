import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";

export type EmailTemplateCategorySummary = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
};

export async function listEmailTemplateCategoriesService(): Promise<EmailTemplateCategorySummary[]> {
  if (!isDatabaseConfigured) {
    return getDefaultCategoriesAsSummaries();
  }

  try {
    const categories = await prisma.emailTemplateCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
      },
    });

    if (categories.length === 0) {
      return getDefaultCategoriesAsSummaries();
    }

    return categories;
  } catch {
    return getDefaultCategoriesAsSummaries();
  }
}

const DEFAULT_CATEGORIES: Omit<EmailTemplateCategorySummary, "id">[] = [
  { name: "Authentication Emails", code: "authentication", description: "Emails related to login, 2FA, password reset, and account activation.", isActive: true },
  { name: "User Management Emails", code: "user-management", description: "Emails for user invitations, welcome credentials, and account lifecycle.", isActive: true },
  { name: "Course Emails", code: "course", description: "Emails for course enrollment, completion, and related notifications.", isActive: true },
  { name: "Quiz Emails", code: "quiz", description: "Emails for quiz assignments and result notifications.", isActive: true },
  { name: "Trainer Emails", code: "trainer", description: "Emails for trainer assignment and training-related notifications.", isActive: true },
  { name: "Notification Emails", code: "notification", description: "General operational and system notification emails.", isActive: true },
  { name: "System Emails", code: "system", description: "Internal system emails for administrative and diagnostic purposes.", isActive: true },
];

function getDefaultCategoriesAsSummaries(): EmailTemplateCategorySummary[] {
  return DEFAULT_CATEGORIES.map((category, index) => ({
    ...category,
    id: `default-${index}`,
  }));
}
