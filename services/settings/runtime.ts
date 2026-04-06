import "server-only";

import { buildSettingsCatalogDefaultValueMap, SETTINGS_CATALOG } from "@/lib/settings/catalog";
import { SETTINGS_CACHE_TTL_MS } from "@/lib/settings/constants";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { getCachedSettingsRuntimeSnapshot, setCachedSettingsRuntimeSnapshot } from "@/services/settings/cache";
import { getEffectiveSettingValue, isSettingsInfrastructureError } from "@/services/settings/internal-helpers";

function parseEnvNumber(rawValue: string | undefined, fallbackValue: number) {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function parseEnvBoolean(rawValue: string | undefined, fallbackValue: boolean) {
  if (typeof rawValue !== "string") {
    return fallbackValue;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallbackValue;
}

async function getRuntimeValueMap() {
  const cached = getCachedSettingsRuntimeSnapshot();
  if (cached) {
    return cached.valueMap;
  }

  const fallbackMap = new Map(
    Array.from(buildSettingsCatalogDefaultValueMap().entries()).map(([key, value]) => [key, value.value]),
  );

  if (!isDatabaseConfigured) {
    setCachedSettingsRuntimeSnapshot({ categories: SETTINGS_CATALOG, valueMap: fallbackMap }, SETTINGS_CACHE_TTL_MS);
    return fallbackMap;
  }

  try {
    const settings = await prisma.setting.findMany({
      where: {
        isActive: true,
        category: {
          isActive: true,
        },
      },
      include: { category: true },
    });

    for (const setting of settings) {
      fallbackMap.set(setting.key, getEffectiveSettingValue(setting, true));
    }

    setCachedSettingsRuntimeSnapshot({ categories: SETTINGS_CATALOG, valueMap: fallbackMap }, SETTINGS_CACHE_TTL_MS);
    return fallbackMap;
  } catch (error) {
    if (isSettingsInfrastructureError(error)) {
      console.warn("Settings runtime fallback activated", error);
      setCachedSettingsRuntimeSnapshot({ categories: SETTINGS_CATALOG, valueMap: fallbackMap }, SETTINGS_CACHE_TTL_MS);
      return fallbackMap;
    }

    throw error;
  }
}

async function getRuntimeSettingValue<T>(key: string, fallbackValue: T) {
  const valueMap = await getRuntimeValueMap();
  const value = valueMap.get(key);

  return (value ?? fallbackValue) as T;
}

export async function getGeneralRuntimeSettings() {
  const applicationName = await getRuntimeSettingValue("general.application_name", process.env.APP_NAME ?? "GTS Academy App");
  const applicationUrl = await getRuntimeSettingValue("general.application_url", process.env.NEXT_PUBLIC_APP_URL ?? "https://gts-acad.vercel.app");
  const supportEmail = await getRuntimeSettingValue(
    "general.support_email",
    process.env.ADMIN_MAIL ?? process.env.MAIL_FROM_ADDRESS ?? "support@gts-academy.test",
  );

  return {
    applicationName: String(applicationName),
    applicationUrl: String(applicationUrl),
    supportEmail: String(supportEmail),
    supportContactNumber: String(await getRuntimeSettingValue("general.support_contact_number", "+91-9000000000")),
    timeZone: String(await getRuntimeSettingValue("general.time_zone", "Asia/Kolkata")),
    defaultLanguage: String(await getRuntimeSettingValue("general.default_language", "English")),
    dateFormat: String(await getRuntimeSettingValue("general.date_format", "DD/MM/YYYY")),
    timeFormat: String(await getRuntimeSettingValue("general.time_format", "24_HOUR")),
  };
}

export async function getBrandingRuntimeSettings() {
  const generalSettings = await getGeneralRuntimeSettings();

  return {
    applicationLogo: await getRuntimeSettingValue("branding.application_logo", null),
    favicon: await getRuntimeSettingValue("branding.favicon", null),
    primaryThemeColor: String(await getRuntimeSettingValue("branding.primary_theme_color", "#0d3b84")),
    secondaryThemeColor: String(await getRuntimeSettingValue("branding.secondary_theme_color", "#0f766e")),
    loginPageBanner: await getRuntimeSettingValue("branding.login_page_banner", null),
    footerText: String(await getRuntimeSettingValue("branding.footer_text", "Powered by GTS Academy")),
    companyName: String(await getRuntimeSettingValue("branding.company_name", generalSettings.applicationName)),
  };
}

export async function getAuthenticationSecurityRuntimeSettings() {
  return {
    enableTwoFactorAuth: Boolean(await getRuntimeSettingValue("auth.enable_two_factor_auth", true)),
    passwordMinimumLength: Number(await getRuntimeSettingValue("auth.password_minimum_length", parseEnvNumber(process.env.AUTH_PASSWORD_MIN_LENGTH, 12))),
    passwordComplexityRequirement: (await getRuntimeSettingValue("auth.password_complexity_requirement", ["UPPERCASE", "LOWERCASE", "NUMBER", "SPECIAL"])) as string[],
    sessionTimeoutDurationMinutes: Number(
      await getRuntimeSettingValue("auth.session_timeout_duration_minutes", Math.round(parseEnvNumber(process.env.AUTH_SESSION_MAX_AGE_SECONDS, 28_800) / 60)),
    ),
    maximumFailedLoginAttempts: Number(
      await getRuntimeSettingValue("auth.maximum_failed_login_attempts", parseEnvNumber(process.env.AUTH_LOGIN_MAX_FAILED_ATTEMPTS, 5)),
    ),
    accountLockDurationSeconds: Number(
      await getRuntimeSettingValue("auth.account_lock_duration_seconds", parseEnvNumber(process.env.AUTH_LOGIN_LOCKOUT_SECONDS, 900)),
    ),
    allowMultipleActiveSessions: Boolean(await getRuntimeSettingValue("auth.allow_multiple_active_sessions", true)),
    forcePasswordChangeOnFirstLogin: Boolean(await getRuntimeSettingValue("auth.force_password_change_on_first_login", true)),
  };
}

export async function getEmailRuntimeSettings() {
  const generalSettings = await getGeneralRuntimeSettings();

  return {
    smtpHost: String(await getRuntimeSettingValue("email.smtp_host", process.env.MAIL_HOST ?? "")),
    smtpPort: Number(await getRuntimeSettingValue("email.smtp_port", parseEnvNumber(process.env.MAIL_PORT, 587))),
    smtpUsername: String(await getRuntimeSettingValue("email.smtp_username", process.env.MAIL_USERNAME ?? "")),
    smtpPassword: String(await getRuntimeSettingValue("email.smtp_password", process.env.MAIL_PASSWORD ?? "")),
    senderEmailAddress: String(await getRuntimeSettingValue("email.sender_email_address", process.env.MAIL_FROM_ADDRESS ?? generalSettings.supportEmail)),
    senderName: String(await getRuntimeSettingValue("email.sender_name", process.env.MAIL_FROM_NAME ?? generalSettings.applicationName)),
    enableSslTls: Boolean(await getRuntimeSettingValue("email.enable_ssl_tls", parseEnvBoolean(process.env.MAIL_ENCRYPTION, true))),
  };
}

export async function getFileUploadRuntimeSettings() {
  return {
    maximumFileUploadSizeMb: Number(await getRuntimeSettingValue("uploads.maximum_file_upload_size_mb", 20)),
    allowedFileTypes: (await getRuntimeSettingValue("uploads.allowed_file_types", ["pdf", "docx", "jpg", "png", "mp4"])) as string[],
    allowedImageTypes: (await getRuntimeSettingValue("uploads.allowed_image_types", ["jpg", "jpeg", "png", "webp", "svg", "ico"])) as string[],
    storageLocation: String(await getRuntimeSettingValue("uploads.storage_location", "LOCAL_PUBLIC")),
    enableDocumentPreview: Boolean(await getRuntimeSettingValue("uploads.enable_document_preview", true)),
  };
}