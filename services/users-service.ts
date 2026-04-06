import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import type { CreateUserInput, GetUsersInput, UpdateUserInput } from "@/lib/validation-schemas/users";
import {
  EXTERNAL_USER_ROLE_CODES,
  SUPER_ADMIN_ROLE_CODE,
  isInternalUserRoleCode,
} from "@/lib/users/constants";
import { hashPassword } from "@/lib/auth/password";
import {
  INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY,
} from "@/lib/mail-templates/email-template-defaults";
import { buildPendingAccountActivationMetadata } from "@/lib/auth/account-metadata";
import { sendAccountActivationEmail } from "@/services/auth/account-activation";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { InternalUserDetail, InternalUserListItem, InternalUserRoleInfo, InternalUsersResponse, WelcomeEmailStatus } from "@/types";
import { renderEmailTemplateByKeyService } from "@/services/email-templates-service";
import { createAuditLogEntry, deliverLoggedEmail } from "@/services/logs-actions-service";
import { assignRolesToUser, invalidateUserPermissionCache } from "@/services/rbac-service";
import { requestPasswordReset } from "@/services/auth-service";

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

type InternalRoleRecord = {
  id: string;
  name: string;
  code: string;
  isSystemRole: boolean;
  isActive: boolean;
};

type UserRecord = {
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
    role: {
      id: string;
      name: string;
      code: string;
      isSystemRole: boolean;
    };
  }>;
};

function requireDatabase() {
  if (!isDatabaseConfigured) {
    throw new Error("User management requires database configuration.");
  }
}

function getMetadataRecord(value: Prisma.JsonValue): InternalUserMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as InternalUserMetadata;
}

function mergeMetadata(existingValue: Prisma.JsonValue, patch: Partial<InternalUserMetadata>) {
  return {
    ...getMetadataRecord(existingValue),
    ...patch,
  } satisfies InternalUserMetadata;
}

function getWelcomeEmailStatus(metadataValue: Prisma.JsonValue): WelcomeEmailStatus {
  const metadata = getMetadataRecord(metadataValue);
  const status = metadata.welcomeCredentialsEmailStatus;

  if (status === "pending" || status === "sent" || status === "failed") {
    return status;
  }

  return "not_requested";
}

function getRequiresPasswordReset(metadataValue: Prisma.JsonValue) {
  const metadata = getMetadataRecord(metadataValue);
  return metadata.requiresPasswordReset === true;
}

function sortRoles(roles: InternalUserRoleInfo[]) {
  return [...roles].sort((left, right) => {
    if (left.isSystemRole !== right.isSystemRole) {
      return left.isSystemRole ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function mapRoleRecord(role: UserRecord["roleAssignments"][number]["role"]): InternalUserRoleInfo {
  return {
    id: role.id,
    name: role.name,
    code: role.code,
    isSystemRole: role.isSystemRole,
  };
}

function mapInternalUser(record: UserRecord): InternalUserListItem {
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

function mapInternalUserDetail(record: UserRecord): InternalUserDetail {
  return {
    ...mapInternalUser(record),
    metadata: getMetadataRecord(record.metadata),
  };
}

function buildInternalUserSelect() {
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

function buildInternalUserWhere(input?: { search?: string; status?: GetUsersInput["status"] }): Prisma.UserWhereInput {
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

function buildInternalLoginUrl() {
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

async function validateAssignableInternalRoles(roleIds: string[], actorRoleCode: string) {
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

async function getInternalUserRecord(userId: string) {
  return prisma.user.findFirst({
    where: {
      id: userId,
      ...buildInternalUserWhere(),
    },
    select: buildInternalUserSelect(),
  });
}

async function sendInternalUserWelcomeEmail(input: {
  userId: string;
  recipientEmail: string;
  recipientName: string;
  temporaryPassword: string;
  roles: Array<Pick<InternalRoleRecord, "name">>;
  actorUserId?: string;
}) {
  const template = await renderEmailTemplateByKeyService(INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY, {
    appName: process.env.APP_NAME ?? "GTS Academy App",
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    temporaryPassword: input.temporaryPassword,
    loginUrl: buildInternalLoginUrl(),
    supportEmail: process.env.ADMIN_MAIL ?? process.env.MAIL_FROM_ADDRESS ?? "support@gts-academy.test",
    roleSummary: buildRoleSummary(input.roles),
  });

  await deliverLoggedEmail({
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

async function updateInternalUserMetadata(userId: string, currentValue: Prisma.JsonValue, patch: Partial<InternalUserMetadata>) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      metadata: mergeMetadata(currentValue, patch) as Prisma.InputJsonValue,
    },
  });
}

export async function getUsersService(input: GetUsersInput): Promise<InternalUsersResponse> {
  if (!isDatabaseConfigured) {
    return {
      items: [],
      totalCount: 0,
      page: input.page,
      pageSize: input.pageSize,
      pageCount: 1,
    };
  }

  const sortMap: Record<GetUsersInput["sortBy"], Prisma.UserOrderByWithRelationInput> = {
    name: { name: input.sortDirection },
    email: { email: input.sortDirection },
    createdAt: { createdAt: input.sortDirection },
    lastLoginAt: { lastLoginAt: input.sortDirection },
  };

  const where = buildInternalUserWhere({ search: input.search, status: input.status });

  const [totalCount, records] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: sortMap[input.sortBy],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: buildInternalUserSelect(),
    }),
  ]);

  return {
    items: records.map((record) => mapInternalUser(record as UserRecord)),
    totalCount,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / input.pageSize)),
  };
}

export async function getUserByIdService(userId: string): Promise<InternalUserDetail | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const record = await getInternalUserRecord(userId);
  return record ? mapInternalUserDetail(record as UserRecord) : null;
}

export async function getInternalUserRolesService(userId: string): Promise<InternalUserRoleInfo[]> {
  const user = await getUserByIdService(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  return user.roles;
}

export async function createInternalUserService(
  input: CreateUserInput,
  actor: { actorUserId?: string; actorRoleCode: string },
): Promise<InternalUserDetail> {
  requireDatabase();

  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedName = input.name.trim();
  const normalizedPhone = input.phone.trim() || null;

  const [existingUser, roles] = await Promise.all([
    prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    validateAssignableInternalRoles(input.roleIds, actor.actorRoleCode),
  ]);

  if (existingUser) {
    throw new Error("A user account already exists with this email.");
  }

  const temporaryPassword = randomUUID();
  const hashedTemporaryPassword = await hashPassword(temporaryPassword);
  const issuedAt = new Date().toISOString();

  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedName,
        phone: normalizedPhone,
        password: hashedTemporaryPassword,
        isActive: true,
        metadata: buildPendingAccountActivationMetadata({
          accountType: "INTERNAL",
          createdFrom: "internal-user-management",
          requiresPasswordReset: true,
          welcomeCredentialsEmailStatus: "pending",
          welcomeCredentialsLastIssuedAt: issuedAt,
        }, issuedAt) as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        email: true,
        name: true,
        metadata: true,
      },
    });

    await tx.userSecurity.create({
      data: {
        userId: user.id,
        twoFactorEnabled: true,
        recoveryCodes: [],
      },
    });

    await tx.userRoleAssignment.createMany({
      data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
      skipDuplicates: true,
    });

    return user;
  });

  try {
    await sendInternalUserWelcomeEmail({
      userId: createdUser.id,
      recipientEmail: createdUser.email,
      recipientName: createdUser.name,
      temporaryPassword,
      roles,
      actorUserId: actor.actorUserId,
    });

    await updateInternalUserMetadata(createdUser.id, createdUser.metadata, {
      welcomeCredentialsEmailStatus: "sent",
      welcomeCredentialsLastSentAt: new Date().toISOString(),
      welcomeCredentialsFailureReason: null,
    });
  } catch (error) {
    await updateInternalUserMetadata(createdUser.id, createdUser.metadata, {
      welcomeCredentialsEmailStatus: "failed",
      welcomeCredentialsFailureReason: error instanceof Error ? error.message : "Unknown delivery failure.",
    });
  }

  try {
    await sendAccountActivationEmail(createdUser.id, {
      actorUserId: actor.actorUserId ?? null,
    });
  } catch (error) {
    console.warn("Internal user activation email dispatch failed.", error);
  }

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: createdUser.id,
    action: "CREATED",
    message: `Internal user ${normalizedEmail} created from user management.`,
    metadata: {
      email: normalizedEmail,
      roles: roles.map((role) => role.code),
    },
    actorUserId: actor.actorUserId ?? null,
  });

  const detail = await getUserByIdService(createdUser.id);
  if (!detail) {
    throw new Error("User not found after creation.");
  }

  return detail;
}

export async function updateInternalUserService(
  userId: string,
  input: UpdateUserInput,
  actorUserId?: string,
): Promise<InternalUserDetail> {
  requireDatabase();

  const user = await getInternalUserRecord(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const normalizedEmail = input.email?.trim().toLowerCase();

  if (normalizedEmail && normalizedEmail !== user.email.toLowerCase()) {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new Error("A user account already exists with this email.");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name?.trim(),
      email: normalizedEmail,
      phone: input.phone !== undefined ? input.phone.trim() || null : undefined,
      isActive: input.isActive,
    },
  });

  if (input.isActive !== undefined) {
    invalidateUserPermissionCache(userId);
  }

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: userId,
    action: "UPDATED",
    message: `Internal user ${user.email} updated from user management.`,
    metadata: {
      name: input.name?.trim(),
      email: normalizedEmail,
      phone: input.phone?.trim() || null,
      isActive: input.isActive,
    },
    actorUserId: actorUserId ?? null,
  });

  const detail = await getUserByIdService(userId);
  if (!detail) {
    throw new Error("User not found.");
  }

  return detail;
}

export async function assignInternalUserRolesService(
  userId: string,
  roleIds: string[],
  actor: { actorUserId?: string; actorRoleCode: string },
) {
  requireDatabase();

  const user = await getInternalUserRecord(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const roles = await validateAssignableInternalRoles(roleIds, actor.actorRoleCode);
  await assignRolesToUser(userId, roles.map((role) => role.id));

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: userId,
    action: "UPDATED",
    message: `Internal user ${user.email} roles updated.`,
    metadata: {
      roles: roles.map((role) => role.code),
    },
    actorUserId: actor.actorUserId ?? null,
  });

  const detail = await getUserByIdService(userId);
  if (!detail) {
    throw new Error("User not found.");
  }

  return detail;
}

export async function resendInternalUserWelcomeService(userId: string, actorUserId?: string) {
  requireDatabase();

  const user = await getInternalUserRecord(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const roles = sortRoles(user.roleAssignments.map((assignment) => mapRoleRecord(assignment.role)));
  const temporaryPassword = randomUUID();
  const hashedTemporaryPassword = await hashPassword(temporaryPassword);
  const nextMetadata = mergeMetadata(user.metadata, {
    accountType: "INTERNAL",
    requiresPasswordReset: true,
    welcomeCredentialsEmailStatus: "pending",
    welcomeCredentialsLastIssuedAt: new Date().toISOString(),
    welcomeCredentialsFailureReason: null,
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedTemporaryPassword,
      metadata: nextMetadata as Prisma.InputJsonValue,
    },
  });

  try {
    await sendInternalUserWelcomeEmail({
      userId,
      recipientEmail: user.email,
      recipientName: user.name,
      temporaryPassword,
      roles,
      actorUserId,
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        metadata: {
          ...nextMetadata,
          welcomeCredentialsEmailStatus: "sent",
          welcomeCredentialsLastSentAt: new Date().toISOString(),
          welcomeCredentialsFailureReason: null,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        metadata: {
          ...nextMetadata,
          welcomeCredentialsEmailStatus: "failed",
          welcomeCredentialsFailureReason: error instanceof Error ? error.message : "Unknown delivery failure.",
        } as Prisma.InputJsonValue,
      },
    });
  }

  try {
    await sendAccountActivationEmail(userId, {
      actorUserId: actorUserId ?? null,
    });
  } catch (error) {
    console.warn("Internal user activation email re-issue failed.", error);
  }

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: userId,
    action: "UPDATED",
    message: `Welcome credentials re-issued for ${user.email}.`,
    actorUserId: actorUserId ?? null,
  });

  const detail = await getUserByIdService(userId);
  if (!detail) {
    throw new Error("User not found.");
  }

  return detail;
}

export async function sendInternalUserPasswordResetService(userId: string, actorUserId?: string) {
  requireDatabase();

  const user = await getInternalUserRecord(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  await requestPasswordReset(user.email, {});

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: userId,
    action: "UPDATED",
    message: `Admin password reset requested for ${user.email}.`,
    actorUserId: actorUserId ?? null,
  });

  return {
    ok: true,
  };
}
