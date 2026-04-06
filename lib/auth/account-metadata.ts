import { Prisma } from "@prisma/client";

export type AccountMetadata = Record<string, unknown> & {
  accountType?: string;
  requiresPasswordReset?: boolean;
  passwordResetCompletedAt?: string;
  accountActivationRequired?: boolean;
  accountActivationStatus?: "pending" | "activated";
  activationEmailStatus?: "not_requested" | "pending" | "sent" | "failed";
  activationLastIssuedAt?: string;
  activationLastSentAt?: string;
  activationFailureReason?: string | null;
  activationCompletedAt?: string;
};

export function getAccountMetadataRecord(value: Prisma.JsonValue | null | undefined): AccountMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as AccountMetadata;
}

export function mergeAccountMetadata(
  existingValue: Prisma.JsonValue | null | undefined,
  patch: Partial<AccountMetadata>,
): AccountMetadata {
  return {
    ...getAccountMetadataRecord(existingValue),
    ...patch,
  };
}

export function requiresPasswordResetFromMetadata(value: Prisma.JsonValue | null | undefined) {
  const metadata = getAccountMetadataRecord(value);
  return metadata.requiresPasswordReset === true;
}

export function isInternalAccount(value: Prisma.JsonValue | null | undefined) {
  const metadata = getAccountMetadataRecord(value);
  return typeof metadata.accountType === "string" && metadata.accountType.toUpperCase() === "INTERNAL";
}

export function isAccountActivationRequired(value: Prisma.JsonValue | null | undefined, emailVerifiedAt?: Date | null) {
  const metadata = getAccountMetadataRecord(value);

  if (metadata.accountActivationRequired === true) {
    return true;
  }

  return metadata.accountActivationStatus === "pending" && !emailVerifiedAt;
}

export function buildCompletedPasswordResetMetadata(value: Prisma.JsonValue | null | undefined, completedAt: string) {
  return mergeAccountMetadata(value, {
    requiresPasswordReset: false,
    passwordResetCompletedAt: completedAt,
  });
}

export function buildPendingAccountActivationMetadata(value: Prisma.JsonValue | null | undefined, issuedAt: string) {
  return mergeAccountMetadata(value, {
    accountActivationRequired: true,
    accountActivationStatus: "pending",
    activationEmailStatus: "pending",
    activationLastIssuedAt: issuedAt,
    activationFailureReason: null,
  });
}

export function buildActivationEmailSentMetadata(value: Prisma.JsonValue | null | undefined, sentAt: string) {
  return mergeAccountMetadata(value, {
    activationEmailStatus: "sent",
    activationLastSentAt: sentAt,
    activationFailureReason: null,
  });
}

export function buildActivationEmailFailedMetadata(value: Prisma.JsonValue | null | undefined, reason: string) {
  return mergeAccountMetadata(value, {
    activationEmailStatus: "failed",
    activationFailureReason: reason,
  });
}

export function buildCompletedAccountActivationMetadata(value: Prisma.JsonValue | null | undefined, completedAt: string) {
  return mergeAccountMetadata(value, {
    accountActivationRequired: false,
    accountActivationStatus: "activated",
    activationCompletedAt: completedAt,
    activationFailureReason: null,
  });
}