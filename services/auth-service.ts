import "server-only";

import { Prisma } from "@prisma/client";

import { prisma, isDatabaseConfigured } from "@/lib/prisma-client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  generateEmailOtpCode,
  generateRecoveryCodes,
  getTwoFactorCodeTtlMinutes,
  getTwoFactorResendCooldownSeconds,
  hashSensitiveToken,
  maskEmail,
} from "@/lib/auth/two-factor";
import { renderTwoFactorDemoTemplate } from "@/lib/mail-templates/two-factor-demo";
import { sendMail } from "@/lib/mail-service";

const LOGIN_CHALLENGE_PURPOSE = "LOGIN";
const ENABLE_2FA_CHALLENGE_PURPOSE = "ENABLE_2FA";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  roles: string[];
  permissions: string[];
  security: {
    id: string;
    twoFactorEnabled: boolean;
    recoveryCodes: string[];
  } | null;
};

type LoginResult =
  | {
      status: "authenticated";
      user: AuthUser;
    }
  | {
      status: "two-factor-required";
      user: AuthUser;
      challengeId: string;
      maskedEmail: string;
    };

type ChallengeRecord = {
  id: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  sentAt: Date;
  consumedAt: Date | null;
  user: AuthUser;
};

function requireDatabase() {
  if (!isDatabaseConfigured) {
    throw new Error("Authentication requires database configuration.");
  }
}

function shouldBypassTwoFactorForLocal(email: string) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  if ((process.env.AUTH_DISABLE_2FA_IN_DEV ?? "false").toLowerCase() !== "true") {
    return false;
  }

  const allowList = (process.env.AUTH_DISABLE_2FA_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowList.length === 0 || allowList.includes(email.trim().toLowerCase());
}

function getRbacSelect() {
  return {
    rbacAssignments: {
      select: {
        role: {
          select: {
            name: true,
            rolePermissions: {
              select: {
                permission: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    },
    directPermissions: {
      select: {
        permission: {
          select: {
            name: true,
          },
        },
      },
    },
  };
}

function deriveAccessFromAssignments(
  assignments: Array<{
    role: {
      name: string;
      rolePermissions: Array<{
        permission: {
          name: string;
        };
      }>;
    };
  }>,
  directPermissions: Array<{
    permission: {
      name: string;
    };
  }>,
) {
  const roleNames = new Set<string>();
  const permissionNames = new Set<string>();

  for (const assignment of assignments) {
    roleNames.add(assignment.role.name);

    for (const rolePermission of assignment.role.rolePermissions) {
      permissionNames.add(rolePermission.permission.name);
    }
  }

  for (const directPermission of directPermissions) {
    permissionNames.add(directPermission.permission.name);
  }

  return {
    roles: Array.from(roleNames).sort(),
    permissions: Array.from(permissionNames).sort(),
  };
}

function mapAuthUser(record: {
  id: string;
  email: string;
  name: string;
  role: { toString(): string } | string;
  security?: {
    id: string;
    twoFactorEnabled: boolean;
    recoveryCodes: string[];
  } | null;
  rbacAssignments: Array<{
    role: {
      name: string;
      rolePermissions: Array<{
        permission: {
          name: string;
        };
      }>;
    };
  }>;
  directPermissions: Array<{
    permission: {
      name: string;
    };
  }>;
}) {
  const access = deriveAccessFromAssignments(record.rbacAssignments, record.directPermissions);

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: String(record.role),
    roles: access.roles,
    permissions: access.permissions,
    security: record.security ?? null,
  } satisfies AuthUser;
}

async function getUserByEmail(email: string) {
  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      password: true,
      security: {
        select: {
          id: true,
          twoFactorEnabled: true,
          recoveryCodes: true,
        },
      },
      ...getRbacSelect(),
    },
  });

  return user
    ? {
        ...mapAuthUser(user),
        password: user.password,
      }
    : null;
}

async function deliverTwoFactorEmail(user: Pick<AuthUser, "email" | "name">, code: string, purposeLabel: string) {
  const template = renderTwoFactorDemoTemplate({
    appName: process.env.APP_NAME ?? "GTS Academy App",
    recipientName: user.name,
    code,
    expiresInMinutes: getTwoFactorCodeTtlMinutes(),
    purposeLabel,
  });

  await sendMail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

function mapChallengeRows(rows: Array<{
  id: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  sentAt: Date;
  consumedAt: Date | null;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  securityId: string | null;
  twoFactorEnabled: boolean | null;
  recoveryCodes: string[] | null;
}>): ChallengeRecord[] {
  return rows.map((row) => ({
    id: row.id,
    codeHash: row.codeHash,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    expiresAt: row.expiresAt,
    sentAt: row.sentAt,
    consumedAt: row.consumedAt,
    user: {
      id: row.userId,
      email: row.userEmail,
      name: row.userName,
      role: row.userRole,
      roles: [],
      permissions: [],
      security: row.securityId
        ? {
            id: row.securityId,
            twoFactorEnabled: row.twoFactorEnabled ?? false,
            recoveryCodes: row.recoveryCodes ?? [],
          }
        : null,
    },
  }));
}

async function createChallenge(userId: string, purpose: string) {
  const code = generateEmailOtpCode();
  const expiresAt = new Date(Date.now() + getTwoFactorCodeTtlMinutes() * 60_000);

  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "two_factor_challenges"
      SET "consumed_at" = NOW()
      WHERE "user_id" = ${userId}::uuid
        AND "purpose" = ${purpose}
        AND "consumed_at" IS NULL
    `,
  );

  const challengeRows = await prisma.$queryRaw<Array<{ id: string; expiresAt: Date }>>(
    Prisma.sql`
      INSERT INTO "two_factor_challenges" (
        "user_id",
        "purpose",
        "code_hash",
        "expires_at"
      )
      VALUES (
        ${userId}::uuid,
        ${purpose},
        ${hashSensitiveToken(code)},
        ${expiresAt}
      )
      RETURNING
        "challenge_id" AS "id",
        "expires_at" AS "expiresAt"
    `,
  );

  const [challenge] = challengeRows;

  return { id: challenge.id, expiresAt: challenge.expiresAt, code };
}

async function consumeChallenge(challengeId: string) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "two_factor_challenges"
      SET "consumed_at" = NOW()
      WHERE "challenge_id" = ${challengeId}::uuid
    `,
  );
}

async function validateChallenge(userId: string, challengeId: string, purpose: string) {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    codeHash: string;
    attempts: number;
    maxAttempts: number;
    expiresAt: Date;
    sentAt: Date;
    consumedAt: Date | null;
    userId: string;
    userEmail: string;
    userName: string;
    userRole: string;
    securityId: string | null;
    twoFactorEnabled: boolean | null;
    recoveryCodes: string[] | null;
  }>>(
    Prisma.sql`
      SELECT
        c."challenge_id" AS "id",
        c."code_hash" AS "codeHash",
        c."attempts" AS "attempts",
        c."max_attempts" AS "maxAttempts",
        c."expires_at" AS "expiresAt",
        c."sent_at" AS "sentAt",
        c."consumed_at" AS "consumedAt",
        u."user_id" AS "userId",
        u."email" AS "userEmail",
        u."full_name" AS "userName",
        u."role"::text AS "userRole",
        s."id" AS "securityId",
        s."two_factor_enabled" AS "twoFactorEnabled",
        s."recovery_codes" AS "recoveryCodes"
      FROM "two_factor_challenges" c
      INNER JOIN "users" u ON u."user_id" = c."user_id"
      LEFT JOIN "user_security" s ON s."user_id" = u."user_id"
      WHERE c."challenge_id" = ${challengeId}::uuid
        AND c."user_id" = ${userId}::uuid
        AND c."purpose" = ${purpose}
      LIMIT 1
    `,
  );

  const [challenge] = mapChallengeRows(rows);

  if (!challenge || challenge.consumedAt) {
    throw new Error("Two-factor challenge is no longer valid.");
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new Error("Two-factor code expired.");
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new Error("Too many invalid verification attempts.");
  }

  return challenge;
}

async function markInvalidAttempt(challengeId: string, attempts: number) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "two_factor_challenges"
      SET "attempts" = ${attempts + 1}
      WHERE "challenge_id" = ${challengeId}::uuid
    `,
  );
}

async function finalizeLogin(userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      security: {
        select: {
          id: true,
          twoFactorEnabled: true,
          recoveryCodes: true,
        },
      },
      ...getRbacSelect(),
    },
  });

  return mapAuthUser(user);
}

export async function persistAuthenticatedSession(user: Pick<AuthUser, "id" | "roles" | "permissions">, sessionToken: string, maxAgeSeconds: number) {
  requireDatabase();

  await prisma.userSession.create({
    data: {
      userId: user.id,
      sessionToken,
      roles: user.roles,
      permissions: user.permissions,
      expiresAt: new Date(Date.now() + maxAgeSeconds * 1000),
    },
  });
}

export async function revokeAuthenticatedSession(sessionToken: string) {
  requireDatabase();

  await prisma.userSession.updateMany({
    where: {
      sessionToken,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  requireDatabase();

  const normalizedEmail = email.trim();
  const normalizedPassword = password.trim();

  if (!normalizedEmail || !normalizedPassword) {
    throw new Error("Email and password are required.");
  }

  const user = await getUserByEmail(normalizedEmail);
  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const passwordCheck = await verifyPassword(normalizedPassword, user.password);
  if (!passwordCheck.isValid) {
    throw new Error("Invalid email or password.");
  }

  if (passwordCheck.needsUpgrade) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(normalizedPassword) },
    });
  }

  const requiresTwoFactor = shouldBypassTwoFactorForLocal(user.email) ? false : (user.security?.twoFactorEnabled ?? true);

  if (!requiresTwoFactor) {
    return {
      status: "authenticated",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roles: user.roles,
        permissions: user.permissions,
        security: user.security,
      },
    };
  }

  const challenge = await createChallenge(user.id, LOGIN_CHALLENGE_PURPOSE);
  await deliverTwoFactorEmail(user, challenge.code, "complete your sign in");

  return {
    status: "two-factor-required",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      roles: user.roles,
      permissions: user.permissions,
      security: user.security,
    },
    challengeId: challenge.id,
    maskedEmail: maskEmail(user.email),
  };
}

export async function verifyLoginTwoFactor(userId: string, challengeId: string, code: string) {
  requireDatabase();

  const challenge = await validateChallenge(userId, challengeId, LOGIN_CHALLENGE_PURPOSE);
  if (challenge.codeHash !== hashSensitiveToken(code)) {
    await markInvalidAttempt(challenge.id, challenge.attempts);
    throw new Error("Invalid verification code.");
  }

  await consumeChallenge(challenge.id);
  return finalizeLogin(userId);
}

export async function verifyRecoveryCode(userId: string, challengeId: string, recoveryCode: string) {
  requireDatabase();

  const challenge = await validateChallenge(userId, challengeId, LOGIN_CHALLENGE_PURPOSE);
  const userSecurity = challenge.user.security;

  if (!userSecurity || userSecurity.recoveryCodes.length === 0) {
    throw new Error("Recovery codes are not configured for this account.");
  }

  const normalizedRecoveryCode = recoveryCode.trim().toUpperCase();
  const hashedRecoveryCode = hashSensitiveToken(normalizedRecoveryCode);
  const recoveryCodeIndex = userSecurity.recoveryCodes.findIndex((storedCode: string) => storedCode === hashedRecoveryCode);

  if (recoveryCodeIndex === -1) {
    await markInvalidAttempt(challenge.id, challenge.attempts);
    throw new Error("Invalid recovery code.");
  }

  const remainingRecoveryCodes = userSecurity.recoveryCodes.filter((_: string, index: number) => index !== recoveryCodeIndex);

  await prisma.$transaction(async (tx) => {
    await tx.userSecurity.update({
      where: { id: userSecurity.id },
      data: { recoveryCodes: remainingRecoveryCodes },
    });

    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "two_factor_challenges"
        SET "consumed_at" = NOW()
        WHERE "challenge_id" = ${challenge.id}::uuid
      `,
    );
  });

  return finalizeLogin(userId);
}

export async function resendLoginTwoFactor(userId: string, challengeId: string) {
  requireDatabase();

  const challenge = await validateChallenge(userId, challengeId, LOGIN_CHALLENGE_PURPOSE);
  const waitUntil = challenge.sentAt.getTime() + getTwoFactorResendCooldownSeconds() * 1_000;

  if (waitUntil > Date.now()) {
    throw new Error("Please wait before requesting a new verification code.");
  }

  const nextChallenge = await createChallenge(userId, LOGIN_CHALLENGE_PURPOSE);
  await deliverTwoFactorEmail(challenge.user, nextChallenge.code, "complete your sign in");

  return {
    challengeId: nextChallenge.id,
    maskedEmail: maskEmail(challenge.user.email),
  };
}

export async function startTwoFactorSetup(userId: string) {
  requireDatabase();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const challenge = await createChallenge(user.id, ENABLE_2FA_CHALLENGE_PURPOSE);
  await deliverTwoFactorEmail(user, challenge.code, "enable two-factor authentication");

  return {
    maskedEmail: maskEmail(user.email),
    expiresAt: challenge.expiresAt.toISOString(),
  };
}

export async function verifyTwoFactorSetup(userId: string, code: string) {
  requireDatabase();

  const challengeRows = await prisma.$queryRaw<Array<{
    id: string;
    codeHash: string;
    attempts: number;
    maxAttempts: number;
    expiresAt: Date;
  }>>(
    Prisma.sql`
      SELECT
        "challenge_id" AS "id",
        "code_hash" AS "codeHash",
        "attempts" AS "attempts",
        "max_attempts" AS "maxAttempts",
        "expires_at" AS "expiresAt"
      FROM "two_factor_challenges"
      WHERE "user_id" = ${userId}::uuid
        AND "purpose" = ${ENABLE_2FA_CHALLENGE_PURPOSE}
        AND "consumed_at" IS NULL
      ORDER BY "created_at" DESC
      LIMIT 1
    `,
  );

  const [challenge] = challengeRows;

  if (!challenge) {
    throw new Error("Two-factor setup challenge not found.");
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new Error("Two-factor setup code expired.");
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new Error("Too many invalid verification attempts.");
  }

  if (challenge.codeHash !== hashSensitiveToken(code)) {
    await markInvalidAttempt(challenge.id, challenge.attempts);
    throw new Error("Invalid verification code.");
  }

  const recoveryCodes = generateRecoveryCodes();
  const hashedRecoveryCodes = recoveryCodes.map((recoveryCode) => hashSensitiveToken(recoveryCode));

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "two_factor_challenges"
        SET "consumed_at" = NOW()
        WHERE "challenge_id" = ${challenge.id}::uuid
      `,
    );

    await tx.userSecurity.upsert({
      where: { userId },
      update: {
        twoFactorEnabled: true,
        recoveryCodes: hashedRecoveryCodes,
      },
      create: {
        userId,
        twoFactorEnabled: true,
        recoveryCodes: hashedRecoveryCodes,
      },
    });
  });

  return { recoveryCodes };
}

export async function sendDemoTwoFactorMail(recipient: string) {
  const to = recipient.trim() || process.env.ADMIN_MAIL;
  if (!to) {
    throw new Error("Demo recipient email is not configured.");
  }

  const template = renderTwoFactorDemoTemplate({
    appName: process.env.APP_NAME ?? "GTS Academy App",
    recipientName: "Demo Recipient",
    code: generateEmailOtpCode(),
    expiresInMinutes: getTwoFactorCodeTtlMinutes(),
    purposeLabel: "preview the email template",
  });

  await sendMail({
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}
