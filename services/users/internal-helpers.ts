import { Prisma } from "@prisma/client";

import type { GetUsersInput } from "@/lib/validation-schemas/users";
import {
  EXTERNAL_USER_ROLE_CODES,
  SUPER_ADMIN_ROLE_CODE,
  isInternalUserRoleCode,
} from "@/lib/users/constants";
import { INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY } from "@/lib/mail-templates/email-template-defaults";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type {
  InternalUserDetail,
  InternalUserListItem,
  InternalUserRoleInfo,
  WelcomeEmailStatus,
} from "@/types";
import { renderEmailTemplateByKeyService } from "@/services/email-templates";
import { deliverLoggedEmail } from "@/services/logs-actions-service";
import { getGeneralRuntimeSettings } from "@/services/settings/runtime";

const INTERNAL_USER_ROLE_EXCLUSIONS = [...EXTERNAL_USER_ROLE_CODES];

type InternalUserMetadata = Record<string, unknown> & {
  accountType?: string;
  createdFrom?: string;
  requiresPasswordReset?: boolean;
  welcomeCredentialsEmailStatus?: WelcomeEmailStatus;
  welcomeCredentialsLastIssuedAt?: string;
  welcomeCredentialsLastSentAt?: string;
  welcomeCredentialsFailureReason?: string | null;
};

type UserRoleRecord = {
  id: string;
  name: string;
  code: string;
  isSystemRole: boolean;
};

export type InternalRoleRecord = UserRoleRecord & {
  isActive: boolean;
};

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Prisma.JsonValue;
  roleAssignments: Array<{
    role: UserRoleRecord;
  }>;
};

export function requireDatabase() {
  if (!isDatabaseConfigured) {
    throw new Error("User management requires database configuration.");
  }
}

export function getMetadataRecord(value: Prisma.JsonValue): InternalUserMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as InternalUserMetadata;
}

export function mergeMetadata(existingValue: Prisma.JsonValue, patch: Partial<InternalUserMetadata>) {
  return {
    ...getMetadataRecord(existingValue),
    ...patch,
  } satisfies InternalUserMetadata;
}

export function getWelcomeEmailStatus(metadataValue: Prisma.JsonValue): WelcomeEmailStatus {
  const metadata = getMetadataRecord(metadataValue);
  const status = metadata.welcomeCredentialsEmailStatus;

  if (status === "pending" || status === "sent" || status === "failed") {
    return status;
  }

  return "not_requested";
}

export function getRequiresPasswordReset(metadataValue: Prisma.JsonValue) {
  const metadata = getMetadataRecord(metadataValue);
  return metadata.requiresPasswordReset === true;
}

export function sortRoles(roles: InternalUserRoleInfo[]) {
  return [...roles].sort((left, right) => {
    if (left.isSystemRole !== right.isSystemRole) {
      return left.isSystemRole ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function mapRoleRecord(role: UserRecord["roleAssignments"][number]["role"]): InternalUserRoleInfo {
  return {
    id: role.id,
    name: role.name,
    code: role.code,
    isSystemRole: role.isSystemRole,
  };
}

export function mapInternalUser(record: UserRecord): InternalUserListItem {
  const roles = sortRoles(record.roleAssignments.map((assignment) => mapRoleRecord(assignment.role)));

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    isActive: record.isActive,
    lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    roles,
    primaryRoleCode: roles[0]?.code ?? null,
    onboardingStatus: getWelcomeEmailStatus(record.metadata),
    requiresPasswordReset: getRequiresPasswordReset(record.metadata),
  };
}

export function mapInternalUserDetail(record: UserRecord): InternalUserDetail {
  return {
    ...mapInternalUser(record),
    metadata: getMetadataRecord(record.metadata),
  };
}

export function buildInternalUserSelect() {
  return {
    id: true,
    email: true,
    name: true,
    phone: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    metadata: true,
    roleAssignments: {
      where: {
        role: {
          code: {
            notIn: INTERNAL_USER_ROLE_EXCLUSIONS,
          },
        },
      },
      select: {
        role: {
          select: {
            id: true,
            name: true,
            code: true,
            isSystemRole: true,
          },
        },
      },
    },
  } as const;
}

export function buildInternalUserWhere(input?: {
  search?: string;
  status?: GetUsersInput["status"];
}): Prisma.UserWhereInput {
  return {
    roleAssignments: {
      some: {
        role: {
          code: {
            notIn: INTERNAL_USER_ROLE_EXCLUSIONS,
          },
        },
      },
    },
    ...(input?.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { email: { contains: input.search, mode: "insensitive" } },
            { phone: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(input?.status === "ACTIVE" ? { isActive: true } : {}),
    ...(input?.status === "INACTIVE" ? { isActive: false } : {}),
  };
}

function buildInternalLoginUrl(fallbackApplicationUrl?: string | null) {
  const normalizeOrigin = (value: string | undefined) => {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    if (/^https?:\/\//i.test(normalized)) {
      return normalized.replace(/\/$/, "");
    }

    return `https://${normalized}`.replace(/\/$/, "");
  };

  const isLoopbackOrigin = (origin: string) => {
    try {
      const url = new URL(origin);
      return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
    } catch {
      return false;
    }
  };

  const candidates = [
    process.env.INTERNAL_APP_ORIGIN,
    process.env.NEXT_PUBLIC_INTERNAL_APP_ORIGIN,
    fallbackApplicationUrl ?? undefined,
    process.env.APP_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ]
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));

  const resolvedOrigin = candidates.find((origin) => !isLoopbackOrigin(origin)) ?? "https://gts-acad.vercel.app";
  return `${resolvedOrigin}/login`;
}

function buildRoleSummary(roles: Array<Pick<InternalRoleRecord, "name">>) {
  if (roles.length === 0) {
    return "Team Member";
  }

  return roles.map((role) => role.name).join(", ");
}

export async function validateAssignableInternalRoles(roleIds: string[], actorRoleCode: string) {
  const roles = await prisma.role.findMany({
    where: {
      id: { in: roleIds },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
      isSystemRole: true,
      isActive: true,
    },
  });

  if (roles.length !== roleIds.length) {
    throw new Error("Invalid role selection.");
  }

  if (roles.some((role) => !isInternalUserRoleCode(role.code))) {
    throw new Error("Invalid role selection for internal user management.");
  }

  if (actorRoleCode !== SUPER_ADMIN_ROLE_CODE && roles.some((role) => role.code === SUPER_ADMIN_ROLE_CODE)) {
    throw new Error("Forbidden: only super admins can assign the SUPER_ADMIN role.");
  }

  return roles;
}

export async function getInternalUserRecord(userId: string) {
  return prisma.user.findFirst({
    where: {
      id: userId,
      ...buildInternalUserWhere(),
    },
    select: buildInternalUserSelect(),
  });
}

export async function sendInternalUserWelcomeEmail(input: {
  userId: string;
  recipientEmail: string;
  recipientName: string;
  temporaryPassword: string;
  roles: Array<Pick<InternalRoleRecord, "name">>;
  actorUserId?: string;
}) {
  const generalSettings = await getGeneralRuntimeSettings();

  const template = await renderEmailTemplateByKeyService(INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY, {
    appName: generalSettings.applicationName,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    temporaryPassword: input.temporaryPassword,
    loginUrl: buildInternalLoginUrl(generalSettings.applicationUrl),
    supportEmail: generalSettings.supportEmail,
    roleSummary: buildRoleSummary(input.roles),
  });

  return deliverLoggedEmail({
    to: input.recipientEmail,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: "SYSTEM",
    templateKey: INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY,
    audit: {
      entityType: "AUTH",
      entityId: input.userId,
      actorUserId: input.actorUserId ?? null,
    },
  });
}

export async function updateInternalUserMetadata(
  userId: string,
  currentValue: Prisma.JsonValue,
  patch: Partial<InternalUserMetadata>,
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      metadata: mergeMetadata(currentValue, patch) as Prisma.InputJsonValue,
    },
  });
}