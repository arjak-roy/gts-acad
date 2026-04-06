import { Prisma } from "@prisma/client";

import {
  SETTINGS_CATALOG,
  type SettingsCatalogCategory,
  type SettingsCatalogOption,
} from "@/lib/settings/catalog";
import { SETTINGS_EMAIL_TEMPLATES_PATH, SETTINGS_SECRET_MASK } from "@/lib/settings/constants";
import { decryptSettingsValue } from "@/lib/settings/crypto";
import { hasMeaningfulSettingValue } from "@/lib/settings/validation";
import type {
  SettingDefinitionItem,
  SettingsAuditLogItem,
  SettingsCategoryDetail,
  SettingsCategorySummary,
  SettingsOverviewMetric,
  SettingsToolLink,
} from "@/services/settings/types";

type SettingRecordWithCategory = Prisma.SettingGetPayload<{ include: { category: true } }>;
type CategoryRecordWithSettings = Prisma.SettingsCategoryGetPayload<{ include: { settings: true } }>;
type SettingsAuditLogRecord = Prisma.SettingsAuditLogGetPayload<{ select: {
  id: true;
  settingKey: true;
  categoryCode: true;
  action: true;
  oldValue: true;
  newValue: true;
  metadata: true;
  actorUserId: true;
  createdAt: true;
} }>;

function isJsonObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toRecord(value: Prisma.JsonValue | null | undefined) {
  if (!isJsonObject(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

export function normalizeSettingOptions(value: Prisma.JsonValue | null | undefined): SettingsCatalogOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Prisma.JsonObject => isJsonObject(entry))
    .map((entry) => ({
      label: typeof entry.label === "string" ? entry.label : String(entry.value ?? ""),
      value: typeof entry.value === "string" ? entry.value : String(entry.value ?? ""),
    }))
    .filter((entry) => entry.value.length > 0);
}

export function normalizeSettingValidationRules(value: Prisma.JsonValue | null | undefined) {
  return toRecord(value);
}

export function getEffectiveSettingValue(
  setting: Pick<SettingRecordWithCategory, "value" | "defaultValue" | "isEncrypted">,
  includeSecrets = false,
) {
  const sourceValue = setting.value ?? setting.defaultValue ?? null;
  if (setting.isEncrypted) {
    return includeSecrets ? decryptSettingsValue(sourceValue) : null;
  }

  return sourceValue;
}

export function isSettingsInfrastructureError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022";
  }

  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();
    return normalizedMessage.includes("settings_categories") || normalizedMessage.includes("settings_audit_logs") || normalizedMessage.includes("setting_type");
  }

  return false;
}

export function mapSettingRecord(setting: SettingRecordWithCategory, includeSecrets = false): SettingDefinitionItem {
  return {
    id: setting.id,
    key: setting.key,
    label: setting.label,
    description: setting.description ?? null,
    type: setting.type,
    value: setting.isEncrypted ? null : getEffectiveSettingValue(setting, includeSecrets),
    defaultValue: setting.isEncrypted ? null : setting.defaultValue ?? null,
    placeholder: setting.placeholder ?? null,
    helpText: setting.helpText ?? null,
    options: normalizeSettingOptions(setting.options),
    validationRules: normalizeSettingValidationRules(setting.validationRules),
    groupName: setting.groupName ?? null,
    displayOrder: setting.displayOrder,
    isRequired: setting.isRequired,
    isEncrypted: setting.isEncrypted,
    isReadonly: setting.isReadonly,
    isSystem: setting.isSystem,
    isActive: setting.isActive,
    hasStoredValue: setting.value !== null,
    maskedValue: setting.isEncrypted && setting.value !== null ? SETTINGS_SECRET_MASK : null,
  };
}

export function mapSettingsCategorySummary(category: CategoryRecordWithSettings | SettingsCatalogCategory): SettingsCategorySummary {
  const settings = category.settings;

  return {
    id: "id" in category ? category.id : category.code,
    name: category.name,
    code: category.code,
    description: category.description ?? null,
    icon: category.icon ?? null,
    displayOrder: category.displayOrder,
    isSystem: category.isSystem !== false,
    isActive: category.isActive !== false,
    settingCount: settings.length,
    configuredCount: settings.filter((setting) => {
      const value = "value" in setting ? getEffectiveSettingValue(setting, true) : setting.defaultValue ?? null;
      return hasMeaningfulSettingValue(value);
    }).length,
    updatedAt: "updatedAt" in category ? category.updatedAt.toISOString() : null,
  };
}

export function mapSettingsAuditLog(record: SettingsAuditLogRecord): SettingsAuditLogItem {
  return {
    id: record.id,
    settingKey: record.settingKey,
    categoryCode: record.categoryCode,
    action: record.action,
    oldValue: record.oldValue ?? null,
    newValue: record.newValue ?? null,
    metadata: toRecord(record.metadata),
    actorUserId: record.actorUserId ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export function buildSettingsTools(): SettingsToolLink[] {
  return [
    {
      label: "Email Templates",
      href: SETTINGS_EMAIL_TEMPLATES_PATH,
      description: "Manage HTML mail templates used by authentication and operational workflows.",
    },
  ];
}

export function buildSettingsOverviewMetrics(categories: SettingsCategorySummary[]): SettingsOverviewMetric[] {
  const totalSettings = categories.reduce((sum, category) => sum + category.settingCount, 0);
  const configuredSettings = categories.reduce((sum, category) => sum + category.configuredCount, 0);
  const activeCategories = categories.filter((category) => category.isActive).length;

  return [
    {
      label: "Categories",
      value: String(activeCategories),
      helper: "Active configuration groups available to administrators.",
    },
    {
      label: "Fields",
      value: String(totalSettings),
      helper: "Seeded and custom settings fields currently available.",
    },
    {
      label: "Configured",
      value: String(configuredSettings),
      helper: "Settings with a default or saved effective value.",
    },
  ];
}

export function buildCatalogFallbackCategories() {
  return SETTINGS_CATALOG
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((category) => mapSettingsCategorySummary(category));
}

export function buildCatalogFallbackCategoryDetail(categoryCode: string): SettingsCategoryDetail | null {
  const category = SETTINGS_CATALOG.find((entry) => entry.code === categoryCode);
  if (!category) {
    return null;
  }

  return {
    category: mapSettingsCategorySummary(category),
    settings: category.settings
      .slice()
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((setting) => ({
        id: setting.key,
        key: setting.key,
        label: setting.label,
        description: setting.description ?? null,
        type: setting.type,
        value: setting.isEncrypted ? null : setting.defaultValue ?? null,
        defaultValue: setting.isEncrypted ? null : setting.defaultValue ?? null,
        placeholder: setting.placeholder ?? null,
        helpText: setting.helpText ?? null,
        options: setting.options ?? [],
        validationRules: setting.validationRules ?? {},
        groupName: setting.groupName ?? null,
        displayOrder: setting.displayOrder,
        isRequired: setting.isRequired,
        isEncrypted: setting.isEncrypted === true,
        isReadonly: setting.isReadonly === true,
        isSystem: setting.isSystem !== false,
        isActive: setting.isActive !== false,
        hasStoredValue: false,
        maskedValue: null,
      })),
    recentAuditLogs: [],
  };
}