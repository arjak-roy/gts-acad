import rawSettingsCatalog from "@/lib/settings/settings-catalog.json";

export const SETTING_FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "SELECT",
  "TOGGLE",
  "FILE",
  "PASSWORD",
  "MULTI_SELECT",
  "EMAIL",
  "PHONE",
  "URL",
  "COLOR",
] as const;

export type SettingFieldType = (typeof SETTING_FIELD_TYPES)[number];

export type SettingsCatalogOption = {
  label: string;
  value: string;
};

export type SettingsCatalogField = {
  key: string;
  label: string;
  description?: string;
  type: SettingFieldType;
  defaultValue: unknown;
  isRequired: boolean;
  isEncrypted?: boolean;
  isReadonly?: boolean;
  isActive?: boolean;
  isSystem?: boolean;
  displayOrder: number;
  groupName?: string;
  placeholder?: string;
  helpText?: string;
  options?: SettingsCatalogOption[];
  validationRules?: Record<string, unknown>;
};

export type SettingsCatalogCategory = {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  displayOrder: number;
  isSystem?: boolean;
  isActive?: boolean;
  settings: SettingsCatalogField[];
};

export const SETTINGS_CATALOG = rawSettingsCatalog as SettingsCatalogCategory[];

export function getSettingsCatalogCategory(categoryCode: string) {
  return SETTINGS_CATALOG.find((category) => category.code === categoryCode) ?? null;
}

export function getSettingsCatalogField(settingKey: string) {
  for (const category of SETTINGS_CATALOG) {
    const field = category.settings.find((setting) => setting.key === settingKey);
    if (field) {
      return {
        category,
        field,
      };
    }
  }

  return null;
}

export function listSettingsCatalogFields() {
  return SETTINGS_CATALOG.flatMap((category) =>
    category.settings.map((field) => ({
      categoryCode: category.code,
      categoryName: category.name,
      field,
    })),
  );
}

export function buildSettingsCatalogDefaultValueMap() {
  return new Map(
    listSettingsCatalogFields().map(({ categoryCode, field }) => [
      field.key,
      {
        categoryCode,
        value: field.defaultValue,
        isEncrypted: field.isEncrypted === true,
      },
    ]),
  );
}