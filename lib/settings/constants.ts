export const SETTINGS_PERMISSIONS = {
  view: "settings.view",
  edit: "settings.edit",
  manage: "settings.manage",
} as const;

export const SETTINGS_EMAIL_TEMPLATES_PATH = "/settings/email-templates";
export const SETTINGS_UPLOAD_PUBLIC_PREFIX = "/uploads/settings";
export const SETTINGS_UPLOAD_DIRECTORY_SEGMENTS = ["public", "uploads", "settings"] as const;

export const SETTINGS_CACHE_TTL_MS = 60_000;
export const SETTINGS_SECRET_MASK = "********";