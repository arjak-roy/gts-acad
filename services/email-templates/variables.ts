import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";

export type EmailTemplateVariableItem = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  category: string;
  sampleValue: string | null;
  isSystem: boolean;
};

export type EmailTemplateVariableGroup = {
  category: string;
  variables: EmailTemplateVariableItem[];
};

const SYSTEM_VARIABLES: EmailTemplateVariableItem[] = [
  { id: "sys-appName", name: "appName", label: "Application Name", description: "Name of the application, injected from branding settings.", category: "Branding", sampleValue: "GTS Academy", isSystem: true },
  { id: "sys-companyName", name: "companyName", label: "Company Name", description: "Company or organization name from branding settings.", category: "Branding", sampleValue: "GTS Academy", isSystem: true },
  { id: "sys-applicationUrl", name: "applicationUrl", label: "Application URL", description: "Base URL of the application from general settings.", category: "Branding", sampleValue: "https://gts-academy.app", isSystem: true },
  { id: "sys-footerText", name: "footerText", label: "Footer Text", description: "Footer text injected into email layouts from branding settings.", category: "Branding", sampleValue: "© 2026 GTS Academy. All rights reserved.", isSystem: true },
  { id: "sys-brandPrimaryColor", name: "brandPrimaryColor", label: "Primary Color", description: "Primary brand theme color hex code.", category: "Branding", sampleValue: "#0d3b84", isSystem: true },
  { id: "sys-brandSecondaryColor", name: "brandSecondaryColor", label: "Secondary Color", description: "Secondary brand theme color hex code.", category: "Branding", sampleValue: "#1e40af", isSystem: true },
  { id: "sys-brandLogoUrl", name: "brandLogoUrl", label: "Logo URL", description: "Absolute URL to the application logo image.", category: "Branding", sampleValue: "https://gts-academy.app/api/branding/application-logo", isSystem: true },
  { id: "sys-recipientName", name: "recipientName", label: "Recipient Name", description: "Full name of the email recipient.", category: "Recipient", sampleValue: "John Doe", isSystem: true },
  { id: "sys-recipientEmail", name: "recipientEmail", label: "Recipient Email", description: "Email address of the recipient.", category: "Recipient", sampleValue: "john@example.com", isSystem: true },
  { id: "sys-supportEmail", name: "supportEmail", label: "Support Email", description: "Support contact email address.", category: "General", sampleValue: "support@gts-academy.app", isSystem: true },
  { id: "sys-loginUrl", name: "loginUrl", label: "Login URL", description: "URL to the application login page.", category: "General", sampleValue: "https://gts-academy.app/login", isSystem: true },
  { id: "sys-currentYear", name: "currentYear", label: "Current Year", description: "The current calendar year for copyright notices.", category: "General", sampleValue: "2026", isSystem: true },
  { id: "sys-templateName", name: "templateName", label: "Template Name", description: "Name of the email template being rendered.", category: "General", sampleValue: "Two-Factor Verification Code", isSystem: true },
  { id: "sys-code", name: "code", label: "Verification Code", description: "6-digit OTP verification code for 2FA flows.", category: "Authentication", sampleValue: "123456", isSystem: true },
  { id: "sys-expiresInMinutes", name: "expiresInMinutes", label: "Expiry (Minutes)", description: "Number of minutes until a code or token expires.", category: "Authentication", sampleValue: "10", isSystem: true },
  { id: "sys-expiresInHours", name: "expiresInHours", label: "Expiry (Hours)", description: "Number of hours until a code or token expires.", category: "Authentication", sampleValue: "24", isSystem: true },
  { id: "sys-purposeLabel", name: "purposeLabel", label: "Purpose Label", description: "Human-readable description of the verification purpose.", category: "Authentication", sampleValue: "verify your account", isSystem: true },
  { id: "sys-resetUrl", name: "resetUrl", label: "Reset URL", description: "Full URL for the password reset page with token.", category: "Authentication", sampleValue: "https://gts-academy.app/reset-password?token=...", isSystem: true },
  { id: "sys-resetToken", name: "resetToken", label: "Reset Token", description: "The raw password reset token value.", category: "Authentication", sampleValue: "SAMPLE_RESET_TOKEN", isSystem: true },
  { id: "sys-invitationUrl", name: "invitationUrl", label: "Invitation URL", description: "Full URL for account activation or invitation link.", category: "Authentication", sampleValue: "https://gts-academy.app/activate-account?token=...", isSystem: true },
  { id: "sys-temporaryPassword", name: "temporaryPassword", label: "Temporary Password", description: "Auto-generated temporary password for new accounts.", category: "User Management", sampleValue: "TempPass#123", isSystem: true },
  { id: "sys-learnerCode", name: "learnerCode", label: "Learner Code", description: "Unique learner identification code for candidates.", category: "User Management", sampleValue: "L-TEST-001", isSystem: true },
  { id: "sys-primaryRole", name: "primaryRole", label: "Primary Role", description: "The primary assigned role of the user.", category: "User Management", sampleValue: "Academy Admin", isSystem: true },
  { id: "sys-roleSummary", name: "roleSummary", label: "Role Summary", description: "Comma-separated list of all assigned roles.", category: "User Management", sampleValue: "Academy Admin, Content Manager", isSystem: true },
  { id: "sys-programName", name: "programName", label: "Program Name", description: "Name of the training program.", category: "Course & Program", sampleValue: "Demo Medical German Program", isSystem: true },
  { id: "sys-courseName", name: "courseName", label: "Course Name", description: "Name of the course.", category: "Course & Program", sampleValue: "React Fundamentals", isSystem: true },
  { id: "sys-batchName", name: "batchName", label: "Batch Name", description: "Name or code of the batch.", category: "Course & Program", sampleValue: "Batch A - 2026", isSystem: true },
  { id: "sys-startDate", name: "startDate", label: "Start Date", description: "Start date of a course, batch, or event.", category: "Course & Program", sampleValue: "09/04/2026", isSystem: true },
  { id: "sys-completionDate", name: "completionDate", label: "Completion Date", description: "Completion date of a course or program.", category: "Course & Program", sampleValue: "09/04/2026", isSystem: true },
  { id: "sys-quizName", name: "quizName", label: "Quiz Name", description: "Name of the assigned quiz or assessment.", category: "Assessment", sampleValue: "Module 1 Assessment", isSystem: true },
  { id: "sys-dueDate", name: "dueDate", label: "Due Date", description: "Due date for an assessment or assignment.", category: "Assessment", sampleValue: "16/04/2026", isSystem: true },
  { id: "sys-score", name: "score", label: "Score", description: "Assessment score or grade.", category: "Assessment", sampleValue: "85%", isSystem: true },
  { id: "sys-resultStatus", name: "resultStatus", label: "Result Status", description: "Pass/fail status of an assessment.", category: "Assessment", sampleValue: "Passed", isSystem: true },
  { id: "sys-notificationSubject", name: "notificationSubject", label: "Notification Subject", description: "Subject line for general notification emails.", category: "Notification", sampleValue: "Important Update", isSystem: true },
  { id: "sys-notificationTitle", name: "notificationTitle", label: "Notification Title", description: "Title heading for general notification emails.", category: "Notification", sampleValue: "Platform Update", isSystem: true },
  { id: "sys-notificationBody", name: "notificationBody", label: "Notification Body", description: "Main body content for general notification emails.", category: "Notification", sampleValue: "This is a sample notification message.", isSystem: true },
];

const CATEGORY_ORDER = ["Branding", "Recipient", "General", "Authentication", "User Management", "Course & Program", "Assessment", "Notification"];

function groupByCategory(variables: EmailTemplateVariableItem[]): EmailTemplateVariableGroup[] {
  const map = new Map<string, EmailTemplateVariableItem[]>();

  for (const variable of variables) {
    const existing = map.get(variable.category);
    if (existing) {
      existing.push(variable);
    } else {
      map.set(variable.category, [variable]);
    }
  }

  const sorted = Array.from(map.entries()).sort(([a], [b]) => {
    const indexA = CATEGORY_ORDER.indexOf(a);
    const indexB = CATEGORY_ORDER.indexOf(b);
    const resolvedA = indexA === -1 ? CATEGORY_ORDER.length : indexA;
    const resolvedB = indexB === -1 ? CATEGORY_ORDER.length : indexB;
    return resolvedA - resolvedB || a.localeCompare(b);
  });

  return sorted.map(([category, variables]) => ({ category, variables }));
}

function mapRecord(record: {
  id: string;
  name: string;
  label: string;
  description: string | null;
  category: string;
  sampleValue: string | null;
  isSystem: boolean;
}): EmailTemplateVariableItem {
  return {
    id: record.id,
    name: record.name,
    label: record.label,
    description: record.description,
    category: record.category,
    sampleValue: record.sampleValue,
    isSystem: record.isSystem,
  };
}

export async function listEmailTemplateVariablesService(): Promise<EmailTemplateVariableItem[]> {
  if (!isDatabaseConfigured) {
    return SYSTEM_VARIABLES;
  }

  try {
    const records = await prisma.emailTemplateVariable.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        label: true,
        description: true,
        category: true,
        sampleValue: true,
        isSystem: true,
      },
    });

    if (records.length === 0) {
      return SYSTEM_VARIABLES;
    }

    return records.map(mapRecord);
  } catch {
    return SYSTEM_VARIABLES;
  }
}

export async function listEmailTemplateVariablesGroupedService(): Promise<EmailTemplateVariableGroup[]> {
  const variables = await listEmailTemplateVariablesService();
  return groupByCategory(variables);
}

const VARIABLE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export async function createEmailTemplateVariableService(input: {
  name: string;
  label: string;
  description?: string | null;
  category: string;
  sampleValue?: string | null;
}): Promise<EmailTemplateVariableItem> {
  if (!isDatabaseConfigured) {
    throw new Error("Database configuration required.");
  }

  const normalizedName = input.name.trim();
  const normalizedLabel = input.label.trim();
  const normalizedCategory = input.category.trim();

  if (!normalizedName || !normalizedLabel || !normalizedCategory) {
    throw new Error("Name, label, and category are required.");
  }

  if (!VARIABLE_NAME_PATTERN.test(normalizedName)) {
    throw new Error("Variable name must start with a letter and contain only letters, numbers, and underscores.");
  }

  if (normalizedName.length > 100) {
    throw new Error("Variable name must be 100 characters or fewer.");
  }

  const existing = await prisma.emailTemplateVariable.findUnique({
    where: { name: normalizedName },
    select: { id: true },
  });

  if (existing) {
    throw new Error(`A variable named "${normalizedName}" already exists.`);
  }

  const record = await prisma.emailTemplateVariable.create({
    data: {
      name: normalizedName,
      label: normalizedLabel,
      description: input.description?.trim() || null,
      category: normalizedCategory,
      sampleValue: input.sampleValue?.trim() || null,
      isSystem: false,
    },
    select: {
      id: true,
      name: true,
      label: true,
      description: true,
      category: true,
      sampleValue: true,
      isSystem: true,
    },
  });

  return mapRecord(record);
}

export async function deleteEmailTemplateVariableService(variableId: string): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database configuration required.");
  }

  const record = await prisma.emailTemplateVariable.findUnique({
    where: { id: variableId },
    select: { id: true, isSystem: true, name: true },
  });

  if (!record) {
    throw new Error("Variable not found.");
  }

  if (record.isSystem) {
    throw new Error("System variables cannot be deleted.");
  }

  await prisma.emailTemplateVariable.delete({ where: { id: variableId } });
}
