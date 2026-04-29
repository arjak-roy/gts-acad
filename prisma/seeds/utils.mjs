// Pure helpers and DB utility functions.
// All DB helpers accept `prisma` as their first argument so callers control
// the client instance (no module-level singleton here).

import { PlacementStatus, SyncStatus } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

// ── Pure helpers ──────────────────────────────────────────────────────────────

export const makeUuid = (seed) =>
  `00000000-0000-0000-0000-${seed.toString(16).padStart(12, "0")}`;

export const hashPassword = (password) => {
  const normalizedPassword = password.trim();
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(normalizedPassword, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
};

export const deriveCodePrefix = (value) => {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) {
    return "GEN";
  }
  return normalized.slice(0, 3).padEnd(3, "X");
};

export const formatEntityCode = (kind, value, sequence) =>
  `${kind}-${deriveCodePrefix(value)}-${String(sequence).padStart(3, "0")}`;

export const formatTrainerEmployeeCode = (sequence) =>
  `TRN-${String(sequence).padStart(4, "0")}`;

export function placementForIndex(index) {
  if (index < 5) {
    return {
      placementStatus: PlacementStatus.PLACEMENT_READY,
      syncStatus: index < 3 ? SyncStatus.SYNCED : SyncStatus.NOT_SYNCED,
      isReadyForDeployment: true,
      readiness: 86 + (index % 5),
    };
  }

  if (index % 3 === 0) {
    return {
      placementStatus: PlacementStatus.IN_REVIEW,
      syncStatus: SyncStatus.NOT_SYNCED,
      isReadyForDeployment: false,
      readiness: 72 + (index % 8),
    };
  }

  return {
    placementStatus: PlacementStatus.NOT_READY,
    syncStatus: SyncStatus.NOT_SYNCED,
    isReadyForDeployment: false,
    readiness: 58 + (index % 10),
  };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

export async function resolveTrainerEmployeeCode(prisma, { userId, sequence }) {
  const existingTrainer = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: { employeeCode: true },
  });

  if (existingTrainer?.employeeCode) {
    return existingTrainer.employeeCode;
  }

  let candidateSequence = sequence;

  while (true) {
    const candidateCode = formatTrainerEmployeeCode(candidateSequence);
    const conflictingTrainer = await prisma.trainerProfile.findFirst({
      where: { employeeCode: candidateCode },
      select: { userId: true },
    });

    if (!conflictingTrainer || conflictingTrainer.userId === userId) {
      return candidateCode;
    }

    candidateSequence += 1;
  }
}

export async function upsertUser(prisma, { email, name, phone, password }) {
  const hashedPassword = hashPassword(password);
  return prisma.user.upsert({
    where: { email },
    update: { name, phone, password: hashedPassword, isActive: true },
    create: { email, name, phone, password: hashedPassword, isActive: true, metadata: {} },
  });
}

export async function assignUserRole(prisma, userId, roleId) {
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });
}
