import type { SettingsCatalogOption, SettingFieldType } from "@/lib/settings/catalog";

type DynamicSettingDefinition = {
  key: string;
  label: string;
  type: SettingFieldType;
  isRequired: boolean;
  isEncrypted?: boolean;
  options?: SettingsCatalogOption[] | null;
  validationRules?: Record<string, unknown> | null;
};

type ValidationOptions = {
  preserveEncryptedValue?: boolean;
  hasStoredValue?: boolean;
};

export type DynamicSettingValidationResult = {
  normalizedValue: unknown;
  preserveExisting: boolean;
};

function normalizeStringValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeBooleanValue(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
      return true;
    }

    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
      return false;
    }
  }

  return Boolean(value);
}

function normalizeNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = Number.parseFloat(normalizeStringValue(value));
  if (!Number.isFinite(normalized)) {
    throw new Error("A numeric value is required.");
  }

  return normalized;
}

function normalizeStringArrayValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeStringValue(entry)).filter(Boolean);
  }

  const normalized = normalizeStringValue(value);
  if (!normalized) {
    return [];
  }

  return normalized.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function getRuleNumber(rules: Record<string, unknown> | null | undefined, key: string) {
  const value = rules?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getRuleStringArray(rules: Record<string, unknown> | null | undefined, key: string) {
  const value = rules?.[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => normalizeStringValue(entry)).filter(Boolean);
}

export function isStoredSettingsAsset(value: unknown): value is {
  kind: "settings-asset";
  url: string;
  storagePath: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.kind === "settings-asset" &&
    typeof candidate.url === "string" &&
    typeof candidate.storagePath === "string" &&
    typeof candidate.fileName === "string" &&
    typeof candidate.originalName === "string" &&
    typeof candidate.mimeType === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.uploadedAt === "string"
  );
}

export function hasMeaningfulSettingValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return true;
}

function validateStringRules(value: string, rules: Record<string, unknown> | null | undefined) {
  const minLength = getRuleNumber(rules, "minLength");
  if (minLength !== null && value.length < minLength) {
    throw new Error(`Value must be at least ${minLength} characters long.`);
  }

  const maxLength = getRuleNumber(rules, "maxLength");
  if (maxLength !== null && value.length > maxLength) {
    throw new Error(`Value must be at most ${maxLength} characters long.`);
  }

  const pattern = normalizeStringValue(rules?.pattern);
  if (pattern) {
    const regex = new RegExp(pattern);
    if (!regex.test(value)) {
      throw new Error("Value does not match the required format.");
    }
  }
}

function validateSelectValue(value: string, options: SettingsCatalogOption[] | null | undefined) {
  if (!value) {
    return;
  }

  if (options && options.length > 0 && !options.some((option) => option.value === value)) {
    throw new Error("Value must match one of the available options.");
  }
}

function validateFileValue(value: unknown, rules: Record<string, unknown> | null | undefined) {
  if (!value) {
    return;
  }

  if (!isStoredSettingsAsset(value)) {
    throw new Error("A valid uploaded file is required.");
  }

  const allowedMimeTypes = getRuleStringArray(rules, "allowedMimeTypes");
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(value.mimeType)) {
    throw new Error("Uploaded file type is not allowed.");
  }

  const maxSizeBytes = getRuleNumber(rules, "maxSizeBytes");
  if (maxSizeBytes !== null && value.size > maxSizeBytes) {
    throw new Error("Uploaded file exceeds the allowed size.");
  }
}

export function validateDynamicSettingValue(
  definition: DynamicSettingDefinition,
  rawValue: unknown,
  options: ValidationOptions = {},
): DynamicSettingValidationResult {
  const rules = definition.validationRules ?? null;
  const preserveEncryptedValue =
    definition.isEncrypted === true &&
    (options.preserveEncryptedValue === true || options.hasStoredValue === true) &&
    normalizeStringValue(rawValue).length === 0;

  if (preserveEncryptedValue) {
    return {
      normalizedValue: null,
      preserveExisting: true,
    };
  }

  let normalizedValue: unknown;

  switch (definition.type) {
    case "TOGGLE": {
      normalizedValue = normalizeBooleanValue(rawValue);
      break;
    }

    case "NUMBER": {
      normalizedValue = normalizeNumberValue(rawValue);
      const min = getRuleNumber(rules, "min");
      const max = getRuleNumber(rules, "max");
      if (min !== null && (normalizedValue as number) < min) {
        throw new Error(`Value must be greater than or equal to ${min}.`);
      }

      if (max !== null && (normalizedValue as number) > max) {
        throw new Error(`Value must be less than or equal to ${max}.`);
      }
      break;
    }

    case "MULTI_SELECT": {
      normalizedValue = normalizeStringArrayValue(rawValue);
      const minItems = getRuleNumber(rules, "minItems");
      const maxItems = getRuleNumber(rules, "maxItems");
      const optionValues = new Set((definition.options ?? []).map((option) => option.value));

      if ((normalizedValue as string[]).some((entry) => optionValues.size > 0 && !optionValues.has(entry))) {
        throw new Error("One or more selected values are invalid.");
      }

      if (minItems !== null && (normalizedValue as string[]).length < minItems) {
        throw new Error(`Select at least ${minItems} value(s).`);
      }

      if (maxItems !== null && (normalizedValue as string[]).length > maxItems) {
        throw new Error(`Select no more than ${maxItems} value(s).`);
      }
      break;
    }

    case "SELECT": {
      normalizedValue = normalizeStringValue(rawValue);
      validateSelectValue(normalizedValue as string, definition.options ?? []);
      break;
    }

    case "FILE": {
      normalizedValue = rawValue ?? null;
      validateFileValue(normalizedValue, rules);
      break;
    }

    case "EMAIL": {
      normalizedValue = normalizeStringValue(rawValue);
      if (normalizedValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue as string)) {
        throw new Error("A valid email address is required.");
      }

      validateStringRules(normalizedValue as string, rules);
      break;
    }

    case "URL": {
      normalizedValue = normalizeStringValue(rawValue);
      if (normalizedValue) {
        try {
          // eslint-disable-next-line no-new
          new URL(normalizedValue as string);
        } catch {
          throw new Error("A valid URL is required.");
        }
      }

      validateStringRules(normalizedValue as string, rules);
      break;
    }

    case "COLOR": {
      normalizedValue = normalizeStringValue(rawValue);
      if (normalizedValue && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalizedValue as string)) {
        throw new Error("A valid HEX color value is required.");
      }

      break;
    }

    case "PHONE": {
      normalizedValue = normalizeStringValue(rawValue);
      if (normalizedValue && !/^[+()\-\s0-9]{6,30}$/.test(normalizedValue as string)) {
        throw new Error("A valid phone number is required.");
      }

      validateStringRules(normalizedValue as string, rules);
      break;
    }

    case "PASSWORD":
    case "TEXTAREA":
    case "TEXT":
    default: {
      normalizedValue = normalizeStringValue(rawValue);
      validateStringRules(normalizedValue as string, rules);
      break;
    }
  }

  if (definition.isRequired && !hasMeaningfulSettingValue(normalizedValue)) {
    throw new Error(`${definition.label} is required.`);
  }

  return {
    normalizedValue,
    preserveExisting: false,
  };
}

export function getDynamicSettingValidationMessage(
  definition: DynamicSettingDefinition,
  rawValue: unknown,
  options: ValidationOptions = {},
) {
  try {
    validateDynamicSettingValue(definition, rawValue, options);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid value.";
  }
}