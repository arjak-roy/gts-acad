import { z } from "zod";

import { SETTING_FIELD_TYPES } from "@/lib/settings/catalog";

const settingsOptionSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(120),
});

export const settingsCategoryIdSchema = z.object({
  categoryId: z.string().trim().min(1),
});

export const settingsDefinitionIdSchema = z.object({
  settingId: z.string().trim().min(1),
});

export const settingsCategoryCodeSchema = z.object({
  categoryCode: z.string().trim().min(1),
});

export const createSettingsCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(500).optional().default(""),
  icon: z.string().trim().max(80).optional().default(""),
  displayOrder: z.coerce.number().int().min(0).max(10_000).optional().default(0),
  isActive: z.coerce.boolean().optional().default(true),
});

export const updateSettingsCategorySchema = createSettingsCategorySchema.extend({
  categoryId: z.string().trim().min(1),
});

export const createSettingDefinitionSchema = z.object({
  categoryId: z.string().trim().min(1),
  key: z.string().trim().min(3).max(120).regex(/^[a-z0-9._-]+$/),
  label: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).optional().default(""),
  type: z.enum(SETTING_FIELD_TYPES),
  defaultValue: z.any().optional().default(null),
  placeholder: z.string().trim().max(255).optional().default(""),
  helpText: z.string().trim().max(500).optional().default(""),
  options: z.array(settingsOptionSchema).optional().default([]),
  validationRules: z.record(z.string(), z.any()).optional().default({}),
  groupName: z.string().trim().max(120).optional().default(""),
  displayOrder: z.coerce.number().int().min(0).max(10_000).optional().default(0),
  isRequired: z.coerce.boolean().optional().default(false),
  isEncrypted: z.coerce.boolean().optional().default(false),
  isReadonly: z.coerce.boolean().optional().default(false),
  isActive: z.coerce.boolean().optional().default(true),
});

export const updateSettingDefinitionSchema = createSettingDefinitionSchema.extend({
  settingId: z.string().trim().min(1),
});

export const updateSettingsCategoryValuesSchema = z.object({
  values: z.record(z.string(), z.any()),
  preserveEncryptedKeys: z.array(z.string().trim().min(1)).optional().default([]),
});

export const settingsResetSchema = z.object({
  categoryCode: z.string().trim().min(1),
});

export const sendSettingsTestEmailSchema = z.object({
  recipientEmail: z.string().trim().email().optional(),
  values: z.record(z.string(), z.any()).optional().default({}),
});

export type CreateSettingsCategoryInput = z.infer<typeof createSettingsCategorySchema>;
export type UpdateSettingsCategoryInput = z.infer<typeof updateSettingsCategorySchema>;
export type CreateSettingDefinitionInput = z.infer<typeof createSettingDefinitionSchema>;
export type UpdateSettingDefinitionInput = z.infer<typeof updateSettingDefinitionSchema>;
export type UpdateSettingsCategoryValuesPayload = z.infer<typeof updateSettingsCategoryValuesSchema>;
export type SendSettingsTestEmailInput = z.infer<typeof sendSettingsTestEmailSchema>;