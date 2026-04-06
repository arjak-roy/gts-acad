import "server-only";

import { Prisma } from "@prisma/client";

import type {
  CreateSettingDefinitionInput,
  CreateSettingsCategoryInput,
  UpdateSettingDefinitionInput,
  UpdateSettingsCategoryInput,
} from "@/lib/validation-schemas/settings";
import { encryptSettingsValue } from "@/lib/settings/crypto";
import { hasMeaningfulSettingValue, isStoredSettingsAsset, validateDynamicSettingValue } from "@/lib/settings/validation";
import { invalidateMailTransportCache } from "@/lib/mail-service";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { invalidateSettingsRuntimeCache } from "@/services/settings/cache";
import {
  getEffectiveSettingValue,
  normalizeSettingOptions,
  normalizeSettingValidationRules,
} from "@/services/settings/internal-helpers";
import { getSettingsCategoryService } from "@/services/settings/queries";
import { deleteSettingsAsset } from "@/services/settings/storage";
import type { UpdateSettingsCategoryInput as UpdateSettingsCategoryValueInput } from "@/services/settings/types";

type SettingsActor = {
  actorUserId?: string | null;
};

function requireSettingsDatabase() {
  if (!isDatabaseConfigured) {
    throw new Error("Settings management requires database configuration.");
  }
}

function toJsonInputValue(value: unknown) {
  return value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

function buildAuditValue(isEncrypted: boolean, value: unknown) {
  if (isEncrypted) {
    return {
      masked: true,
      configured: hasMeaningfulSettingValue(value),
    };
  }

  return value ?? null;
}

async function writeSettingsAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    settingId?: string | null;
    settingKey: string;
    categoryCode: string;
    action: string;
    oldValue?: unknown;
    newValue?: unknown;
    metadata?: Record<string, unknown>;
    actorUserId?: string | null;
  },
) {
  await tx.settingsAuditLog.create({
    data: {
      settingId: input.settingId ?? null,
      settingKey: input.settingKey,
      categoryCode: input.categoryCode,
      action: input.action,
      oldValue: toJsonInputValue(input.oldValue ?? null),
      newValue: toJsonInputValue(input.newValue ?? null),
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      actorUserId: input.actorUserId ?? null,
    },
  });
}

function invalidateCaches() {
  invalidateSettingsRuntimeCache();
  invalidateMailTransportCache();
}

export async function createSettingsCategoryService(input: CreateSettingsCategoryInput, actor: SettingsActor = {}) {
  requireSettingsDatabase();

  const existing = await prisma.settingsCategory.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new Error("A settings category already exists with this code.");
  }

  const category = await prisma.settingsCategory.create({
    data: {
      name: input.name,
      code: input.code,
      description: input.description || null,
      icon: input.icon || null,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
      isSystem: false,
    },
  });

  await prisma.settingsAuditLog.create({
    data: {
      settingId: null,
      settingKey: `category:${category.code}`,
      categoryCode: category.code,
      action: "category.created",
      oldValue: Prisma.DbNull,
      newValue: {
        name: category.name,
        code: category.code,
      } as Prisma.InputJsonValue,
      metadata: {} as Prisma.InputJsonValue,
      actorUserId: actor.actorUserId ?? null,
    },
  });

  await createAuditLogEntry({
    entityType: "SYSTEM",
    entityId: category.id,
    action: "CREATED",
    message: `Settings category ${category.code} created.`,
    actorUserId: actor.actorUserId ?? null,
  });

  invalidateCaches();
  return getSettingsCategoryService(category.code);
}

export async function updateSettingsCategoryService(input: UpdateSettingsCategoryInput, actor: SettingsActor = {}) {
  requireSettingsDatabase();

  const category = await prisma.settingsCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) {
    throw new Error("Settings category not found.");
  }

  if (category.isSystem && input.code !== category.code) {
    throw new Error("Forbidden: system category codes cannot be changed.");
  }

  if (input.code !== category.code) {
    const duplicate = await prisma.settingsCategory.findUnique({ where: { code: input.code } });
    if (duplicate && duplicate.id !== category.id) {
      throw new Error("A settings category already exists with this code.");
    }
  }

  const updated = await prisma.settingsCategory.update({
    where: { id: category.id },
    data: {
      name: input.name,
      code: input.code,
      description: input.description || null,
      icon: input.icon || null,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
    },
  });

  await prisma.settingsAuditLog.create({
    data: {
      settingId: null,
      settingKey: `category:${updated.code}`,
      categoryCode: updated.code,
      action: "category.updated",
      oldValue: {
        name: category.name,
        code: category.code,
        isActive: category.isActive,
      } as Prisma.InputJsonValue,
      newValue: {
        name: updated.name,
        code: updated.code,
        isActive: updated.isActive,
      } as Prisma.InputJsonValue,
      metadata: {} as Prisma.InputJsonValue,
      actorUserId: actor.actorUserId ?? null,
    },
  });

  await createAuditLogEntry({
    entityType: "SYSTEM",
    entityId: updated.id,
    action: "UPDATED",
    message: `Settings category ${updated.code} updated.`,
    actorUserId: actor.actorUserId ?? null,
  });

  invalidateCaches();
  return getSettingsCategoryService(updated.code);
}

export async function deleteSettingsCategoryService(categoryId: string, actor: SettingsActor = {}) {
  requireSettingsDatabase();

  const category = await prisma.settingsCategory.findUnique({
    where: { id: categoryId },
    include: { settings: true },
  });

  if (!category) {
    throw new Error("Settings category not found.");
  }

  if (category.isSystem) {
    throw new Error("Forbidden: system categories cannot be deleted.");
  }

  const assetsToDelete = category.settings
    .map((setting) => getEffectiveSettingValue({ value: setting.value, defaultValue: null, isEncrypted: setting.isEncrypted }, true))
    .filter(isStoredSettingsAsset);

  await prisma.settingsCategory.delete({ where: { id: category.id } });

  await Promise.all(assetsToDelete.map((asset) => deleteSettingsAsset(asset)));

  await createAuditLogEntry({
    entityType: "SYSTEM",
    entityId: category.id,
    action: "UPDATED",
    message: `Settings category ${category.code} deleted.`,
    actorUserId: actor.actorUserId ?? null,
  });

  invalidateCaches();
  return { ok: true };
}

export async function createSettingDefinitionService(input: CreateSettingDefinitionInput, actor: SettingsActor = {}) {
  requireSettingsDatabase();

  const category = await prisma.settingsCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) {
    throw new Error("Settings category not found.");
  }

  const existing = await prisma.setting.findUnique({ where: { key: input.key } });
  if (existing) {
    throw new Error("A setting already exists with this key.");
  }

  const setting = await prisma.setting.create({
    data: {
      categoryId: input.categoryId,
      key: input.key,
      label: input.label,
      description: input.description || null,
      type: input.type,
      defaultValue: toJsonInputValue(input.defaultValue ?? null),
      placeholder: input.placeholder || null,
      helpText: input.helpText || null,
      options: toJsonInputValue(input.options ?? []),
      validationRules: toJsonInputValue(input.validationRules ?? {}),
      groupName: input.groupName || null,
      displayOrder: input.displayOrder,
      isRequired: input.isRequired,
      isEncrypted: input.isEncrypted,
      isReadonly: input.isReadonly,
      isActive: input.isActive,
      isSystem: false,
    },
  });

  await prisma.settingsAuditLog.create({
    data: {
      settingId: setting.id,
      settingKey: setting.key,
      categoryCode: category.code,
      action: "setting.created",
      oldValue: Prisma.DbNull,
      newValue: {
        label: setting.label,
        type: setting.type,
      } as Prisma.InputJsonValue,
      metadata: {} as Prisma.InputJsonValue,
      actorUserId: actor.actorUserId ?? null,
    },
  });

  await createAuditLogEntry({
    entityType: "SYSTEM",
    entityId: setting.id,
    action: "CREATED",
    message: `Setting definition ${setting.key} created.`,
    actorUserId: actor.actorUserId ?? null,
  });

  invalidateCaches();
  return prisma.setting.findUnique({ where: { id: setting.id }, include: { category: true } });
}

export async function updateSettingDefinitionService(input: UpdateSettingDefinitionInput, actor: SettingsActor = {}) {
  requireSettingsDatabase();

  const setting = await prisma.setting.findUnique({
    where: { id: input.settingId },
    include: { category: true },
  });

  if (!setting) {
    throw new Error("Setting definition not found.");
  }

  if (setting.isSystem) {
    if (input.key !== setting.key || input.type !== setting.type || input.isEncrypted !== setting.isEncrypted) {
      throw new Error("Forbidden: critical system setting attributes cannot be changed.");
    }
  }

  if (input.key !== setting.key) {
    const duplicate = await prisma.setting.findUnique({ where: { key: input.key } });
    if (duplicate && duplicate.id !== setting.id) {
      throw new Error("A setting already exists with this key.");
    }
  }

  const updated = await prisma.setting.update({
    where: { id: setting.id },
    data: {
      categoryId: input.categoryId,
      key: input.key,
      label: input.label,
      description: input.description || null,
      type: input.type,
      defaultValue: toJsonInputValue(input.defaultValue ?? null),
      placeholder: input.placeholder || null,
      helpText: input.helpText || null,
      options: toJsonInputValue(input.options ?? []),
      validationRules: toJsonInputValue(input.validationRules ?? {}),
      groupName: input.groupName || null,
      displayOrder: input.displayOrder,
      isRequired: input.isRequired,
      isEncrypted: input.isEncrypted,
      isReadonly: input.isReadonly,
      isActive: input.isActive,
    },
    include: { category: true },
  });

  await prisma.settingsAuditLog.create({
    data: {
      settingId: updated.id,
      settingKey: updated.key,
      categoryCode: updated.category.code,
      action: "setting.updated",
      oldValue: {
        key: setting.key,
        label: setting.label,
        type: setting.type,
      } as Prisma.InputJsonValue,
      newValue: {
        key: updated.key,
        label: updated.label,
        type: updated.type,
      } as Prisma.InputJsonValue,
      metadata: {} as Prisma.InputJsonValue,
      actorUserId: actor.actorUserId ?? null,
    },
  });

  await createAuditLogEntry({
    entityType: "SYSTEM",
    entityId: updated.id,
    action: "UPDATED",
    message: `Setting definition ${updated.key} updated.`,
    actorUserId: actor.actorUserId ?? null,
  });

  invalidateCaches();
  return updated;
}

export async function deleteSettingDefinitionService(settingId: string, actor: SettingsActor = {}) {
  requireSettingsDatabase();

  const setting = await prisma.setting.findUnique({
    where: { id: settingId },
    include: { category: true },
  });

  if (!setting) {
    throw new Error("Setting definition not found.");
  }

  if (setting.isSystem) {
    throw new Error("Forbidden: system setting definitions cannot be deleted.");
  }

  const assetToDelete = isStoredSettingsAsset(getEffectiveSettingValue(setting, true)) ? getEffectiveSettingValue(setting, true) : null;

  await prisma.setting.delete({ where: { id: setting.id } });

  if (assetToDelete) {
    await deleteSettingsAsset(assetToDelete);
  }

  await createAuditLogEntry({
    entityType: "SYSTEM",
    entityId: setting.id,
    action: "UPDATED",
    message: `Setting definition ${setting.key} deleted.`,
    actorUserId: actor.actorUserId ?? null,
  });

  invalidateCaches();
  return { ok: true };
}

export async function updateSettingsCategoryValuesService(
  categoryCode: string,
  input: UpdateSettingsCategoryValueInput,
  actor: SettingsActor = {},
) {
  requireSettingsDatabase();

  const category = await prisma.settingsCategory.findUnique({
    where: { code: categoryCode },
    include: {
      settings: {
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
      },
    },
  });

  if (!category) {
    throw new Error("Settings category not found.");
  }

  const providedKeys = Object.keys(input.values ?? {});
  const allowedKeys = new Set(category.settings.map((setting) => setting.key));
  const unknownKeys = providedKeys.filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Invalid setting keys: ${unknownKeys.join(", ")}.`);
  }

  const preserveEncryptedKeys = new Set(input.preserveEncryptedKeys ?? []);
  const assetsToDelete: unknown[] = [];
  const changedKeys: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const setting of category.settings) {
      if (!Object.prototype.hasOwnProperty.call(input.values, setting.key)) {
        continue;
      }

      if (setting.isReadonly) {
        throw new Error(`Forbidden: ${setting.label} is read-only.`);
      }

      const currentValue = getEffectiveSettingValue(setting, true);
      const validationResult = validateDynamicSettingValue(
        {
          key: setting.key,
          label: setting.label,
          type: setting.type,
          isRequired: setting.isRequired,
          isEncrypted: setting.isEncrypted,
          options: normalizeSettingOptions(setting.options),
          validationRules: normalizeSettingValidationRules(setting.validationRules),
        },
        input.values[setting.key],
        {
          preserveEncryptedValue: preserveEncryptedKeys.has(setting.key),
          hasStoredValue: setting.value !== null,
        },
      );

      if (validationResult.preserveExisting) {
        continue;
      }

      const nextValue = setting.isEncrypted ? encryptSettingsValue(validationResult.normalizedValue) : validationResult.normalizedValue;
      const previousAuditValue = buildAuditValue(setting.isEncrypted, currentValue);
      const nextAuditValue = buildAuditValue(setting.isEncrypted, validationResult.normalizedValue);

      if (JSON.stringify(previousAuditValue) === JSON.stringify(nextAuditValue)) {
        continue;
      }

      if (setting.type === "FILE" && isStoredSettingsAsset(currentValue) && JSON.stringify(currentValue) !== JSON.stringify(validationResult.normalizedValue)) {
        assetsToDelete.push(currentValue);
      }

      await tx.setting.update({
        where: { id: setting.id },
        data: {
          value: toJsonInputValue(nextValue),
        },
      });

      await writeSettingsAuditLog(tx, {
        settingId: setting.id,
        settingKey: setting.key,
        categoryCode: category.code,
        action: "value.updated",
        oldValue: previousAuditValue,
        newValue: nextAuditValue,
        actorUserId: actor.actorUserId ?? null,
      });

      changedKeys.push(setting.key);
    }
  });

  await Promise.all(assetsToDelete.map((asset) => deleteSettingsAsset(asset)));

  if (changedKeys.length > 0) {
    await createAuditLogEntry({
      entityType: "SYSTEM",
      entityId: category.id,
      action: "UPDATED",
      message: `Settings updated for category ${category.code}.`,
      metadata: {
        changedKeys,
      },
      actorUserId: actor.actorUserId ?? null,
    });
  }

  invalidateCaches();
  return getSettingsCategoryService(category.code);
}

export async function resetSettingsCategoryService(categoryCode: string, actor: SettingsActor = {}) {
  requireSettingsDatabase();

  const category = await prisma.settingsCategory.findUnique({
    where: { code: categoryCode },
    include: {
      settings: {
        where: { isActive: true },
      },
    },
  });

  if (!category) {
    throw new Error("Settings category not found.");
  }

  const assetsToDelete = category.settings
    .map((setting) => getEffectiveSettingValue(setting, true))
    .filter(isStoredSettingsAsset);

  await prisma.$transaction(async (tx) => {
    for (const setting of category.settings) {
      const previousValue = buildAuditValue(setting.isEncrypted, getEffectiveSettingValue(setting, true));

      await tx.setting.update({
        where: { id: setting.id },
        data: {
          value: Prisma.DbNull,
        },
      });

      await writeSettingsAuditLog(tx, {
        settingId: setting.id,
        settingKey: setting.key,
        categoryCode: category.code,
        action: "value.reset",
        oldValue: previousValue,
        newValue: buildAuditValue(setting.isEncrypted, setting.defaultValue ?? null),
        actorUserId: actor.actorUserId ?? null,
      });
    }
  });

  await Promise.all(assetsToDelete.map((asset) => deleteSettingsAsset(asset)));

  await createAuditLogEntry({
    entityType: "SYSTEM",
    entityId: category.id,
    action: "UPDATED",
    message: `Settings reset to defaults for category ${category.code}.`,
    actorUserId: actor.actorUserId ?? null,
  });

  invalidateCaches();
  return getSettingsCategoryService(category.code);
}