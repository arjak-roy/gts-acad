import "server-only";

import { Prisma } from "@prisma/client";

import {
  sanitizeStoredTablePreference,
  sanitizeStoredTablePreferences,
  type StoredTablePreference,
  type StoredTablePreferences,
} from "@/lib/table-preferences";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { UpdateTablePreferenceInput } from "@/lib/validation-schemas/table-preferences";

type UserMetadataRecord = Record<string, unknown> & {
  tablePreferences?: StoredTablePreferences;
};

function requireDatabase() {
  if (!isDatabaseConfigured) {
    throw new Error("Table preferences require database configuration.");
  }
}

function getUserMetadataRecord(value: Prisma.JsonValue): UserMetadataRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as UserMetadataRecord;
}

function getStoredTablePreferences(value: Prisma.JsonValue) {
  return sanitizeStoredTablePreferences(getUserMetadataRecord(value).tablePreferences);
}

function toInputJsonValue(value: Record<string, unknown>) {
  return value as Prisma.InputJsonValue;
}

export async function getUserTablePreferenceService(userId: string, tableKey: string): Promise<StoredTablePreference> {
  requireDatabase();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { metadata: true },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const storedTablePreferences = getStoredTablePreferences(user.metadata);
  return sanitizeStoredTablePreference(storedTablePreferences[tableKey]);
}

export async function updateUserTablePreferenceService(
  userId: string,
  tableKey: string,
  input: UpdateTablePreferenceInput,
): Promise<StoredTablePreference> {
  requireDatabase();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { metadata: true },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const metadata = getUserMetadataRecord(user.metadata);
  const storedTablePreferences = getStoredTablePreferences(user.metadata);
  const currentPreference = sanitizeStoredTablePreference(storedTablePreferences[tableKey]);

  const nextPreference = sanitizeStoredTablePreference({
    ...currentPreference,
    ...(input.pageSize === null ? { pageSize: undefined } : {}),
    ...(input.hiddenColumnIds === null ? { hiddenColumnIds: undefined } : {}),
    ...(input.pageSize !== undefined && input.pageSize !== null ? { pageSize: input.pageSize } : {}),
    ...(input.hiddenColumnIds !== undefined && input.hiddenColumnIds !== null
      ? { hiddenColumnIds: input.hiddenColumnIds }
      : {}),
  });

  const nextTablePreferences = { ...storedTablePreferences };

  if (Object.keys(nextPreference).length === 0) {
    delete nextTablePreferences[tableKey];
  } else {
    nextTablePreferences[tableKey] = nextPreference;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      metadata: toInputJsonValue({
        ...metadata,
        tablePreferences: nextTablePreferences,
      }),
    },
  });

  return sanitizeStoredTablePreference(nextTablePreferences[tableKey]);
}
