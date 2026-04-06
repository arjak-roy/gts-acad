import type { SettingsCatalogOption, SettingFieldType } from "@/lib/settings/catalog";

export type SettingsAssetValue = {
  kind: "settings-asset";
  url: string;
  storagePath: string;
  storageProvider?: "LOCAL_PUBLIC" | "S3";
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export type SettingsCategorySummary = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
  isSystem: boolean;
  isActive: boolean;
  settingCount: number;
  configuredCount: number;
  updatedAt: string | null;
};

export type SettingDefinitionItem = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  type: SettingFieldType;
  value: unknown;
  defaultValue: unknown;
  placeholder: string | null;
  helpText: string | null;
  options: SettingsCatalogOption[];
  validationRules: Record<string, unknown>;
  groupName: string | null;
  displayOrder: number;
  isRequired: boolean;
  isEncrypted: boolean;
  isReadonly: boolean;
  isSystem: boolean;
  isActive: boolean;
  hasStoredValue: boolean;
  maskedValue: string | null;
};

export type SettingsAuditLogItem = {
  id: string;
  settingKey: string;
  categoryCode: string;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  metadata: Record<string, unknown>;
  actorUserId: string | null;
  createdAt: string;
};

export type SettingsCategoryDetail = {
  category: SettingsCategorySummary;
  settings: SettingDefinitionItem[];
  recentAuditLogs: SettingsAuditLogItem[];
};

export type SettingsOverviewMetric = {
  label: string;
  value: string;
  helper: string;
};

export type SettingsToolLink = {
  label: string;
  href: string;
  description: string;
};

export type SettingsOverview = {
  metrics: SettingsOverviewMetric[];
  categories: SettingsCategorySummary[];
  tools: SettingsToolLink[];
};

export type UpdateSettingsCategoryInput = {
  values: Record<string, unknown>;
  preserveEncryptedKeys?: string[];
};

export type SendSettingsTestEmailResult = {
  recipientEmail: string;
  providerMessageId: string | null;
};