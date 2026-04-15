/**
 * Prompt Framework — Version management service
 *
 * Handles creating version snapshots, listing versions, and rolling back.
 */

import type { PromptType } from "@/lib/language-lab/prompt-types";
import type { PromptScope } from "@/lib/language-lab/prompt-types";
import { prisma } from "@/lib/prisma-client";

export type CreateVersionParams = {
  personaId?: string | null;
  settingKey?: string | null;
  promptType: PromptType;
  scope: PromptScope;
  content: string;
  createdById?: string | null;
};

/**
 * Create a version snapshot of a prompt.
 * Auto-increments the version number for this persona+type+scope combination.
 */
export async function createPromptVersion(params: CreateVersionParams) {
  const { personaId, settingKey, promptType, scope, content, createdById } = params;

  // Find the current highest version
  const latest = await prisma.buddyPromptVersion.findFirst({
    where: {
      ...(personaId ? { personaId } : { personaId: null }),
      ...(settingKey ? { settingKey } : {}),
      promptType,
      scope,
    },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  const created = await prisma.buddyPromptVersion.create({
    data: {
      personaId: personaId ?? null,
      settingKey: settingKey ?? null,
      promptType,
      scope,
      version: nextVersion,
      content,
      createdById: createdById ?? null,
    },
  });

  return {
    id: created.id,
    version: nextVersion,
  };
}

/**
 * List all version snapshots for a persona prompt or base setting prompt.
 */
export async function listPromptVersions(params: {
  personaId?: string | null;
  settingKey?: string | null;
  promptType: PromptType;
  scope?: PromptScope;
}) {
  const { personaId, settingKey, promptType, scope } = params;

  const versions = await prisma.buddyPromptVersion.findMany({
    where: {
      ...(personaId ? { personaId } : { personaId: null }),
      ...(settingKey ? { settingKey } : {}),
      promptType,
      ...(scope ? { scope } : {}),
    },
    orderBy: { version: "desc" },
    select: {
      id: true,
      personaId: true,
      settingKey: true,
      promptType: true,
      scope: true,
      version: true,
      content: true,
      createdAt: true,
      createdBy: {
        select: { name: true },
      },
    },
  });

  return versions.map((v) => ({
    id: v.id,
    personaId: v.personaId,
    settingKey: v.settingKey,
    promptType: v.promptType,
    scope: v.scope,
    version: v.version,
    content: v.content,
    createdAt: v.createdAt.toISOString(),
    createdByName: v.createdBy?.name ?? null,
  }));
}

/**
 * Get a specific version by ID.
 */
export async function getPromptVersion(versionId: string) {
  const v = await prisma.buddyPromptVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      personaId: true,
      settingKey: true,
      promptType: true,
      scope: true,
      version: true,
      content: true,
      createdAt: true,
      createdBy: {
        select: { name: true },
      },
    },
  });

  if (!v) return null;

  return {
    id: v.id,
    personaId: v.personaId,
    settingKey: v.settingKey,
    promptType: v.promptType,
    scope: v.scope,
    version: v.version,
    content: v.content,
    createdAt: v.createdAt.toISOString(),
    createdByName: v.createdBy?.name ?? null,
  };
}

/**
 * Get the count of versions for a persona or base prompt.
 */
export async function countPromptVersions(params: {
  personaId?: string | null;
  settingKey?: string | null;
  promptType: PromptType;
}) {
  return prisma.buddyPromptVersion.count({
    where: {
      ...(params.personaId ? { personaId: params.personaId } : { personaId: null }),
      ...(params.settingKey ? { settingKey: params.settingKey } : {}),
      promptType: params.promptType,
    },
  });
}
