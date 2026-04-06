import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import {
  buildCatalogFallbackCategories,
  buildCatalogFallbackCategoryDetail,
  buildSettingsOverviewMetrics,
  buildSettingsTools,
  isSettingsInfrastructureError,
  mapSettingRecord,
  mapSettingsAuditLog,
  mapSettingsCategorySummary,
} from "@/services/settings/internal-helpers";
import type { SettingsCategoryDetail, SettingsOverview, SettingDefinitionItem } from "@/services/settings/types";

async function getSettingsCategoryRecord(categoryCode: string) {
  return prisma.settingsCategory.findUnique({
    where: { code: categoryCode },
    include: {
      settings: {
        orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
      },
    },
  });
}

export async function listSettingsCategoriesService() {
  if (!isDatabaseConfigured) {
    return buildCatalogFallbackCategories();
  }

  try {
    const categories = await prisma.settingsCategory.findMany({
      where: { isActive: true },
      include: {
        settings: {
          where: { isActive: true },
          orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
        },
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });

    return categories.map((category) => mapSettingsCategorySummary(category));
  } catch (error) {
    if (isSettingsInfrastructureError(error)) {
      console.warn("Settings category fallback activated", error);
      return buildCatalogFallbackCategories();
    }

    throw error;
  }
}

export async function getSettingsOverviewService(): Promise<SettingsOverview> {
  const categories = await listSettingsCategoriesService();

  return {
    metrics: buildSettingsOverviewMetrics(categories),
    categories,
    tools: buildSettingsTools(),
  };
}

export async function getSettingsCategoryService(categoryCode: string): Promise<SettingsCategoryDetail | null> {
  if (!isDatabaseConfigured) {
    return buildCatalogFallbackCategoryDetail(categoryCode);
  }

  try {
    const [category, auditLogs] = await Promise.all([
      getSettingsCategoryRecord(categoryCode),
      prisma.settingsAuditLog.findMany({
        where: { categoryCode },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          settingKey: true,
          categoryCode: true,
          action: true,
          oldValue: true,
          newValue: true,
          metadata: true,
          actorUserId: true,
          createdAt: true,
        },
      }),
    ]);

    if (!category) {
      return buildCatalogFallbackCategoryDetail(categoryCode);
    }

    return {
      category: mapSettingsCategorySummary(category),
      settings: category.settings.map((setting) => mapSettingRecord({ ...setting, category })),
      recentAuditLogs: auditLogs.map(mapSettingsAuditLog),
    };
  } catch (error) {
    if (isSettingsInfrastructureError(error)) {
      console.warn(`Settings category fallback activated for ${categoryCode}`, error);
      return buildCatalogFallbackCategoryDetail(categoryCode);
    }

    throw error;
  }
}

export async function getSettingDefinitionByIdService(settingId: string): Promise<SettingDefinitionItem | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const setting = await prisma.setting.findUnique({
    where: { id: settingId },
    include: { category: true },
  });

  return setting ? mapSettingRecord(setting) : null;
}

export async function getSettingByKeyService(settingKey: string): Promise<SettingDefinitionItem | null> {
  if (!isDatabaseConfigured) {
    const fallbackCategory = buildCatalogFallbackCategoryDetail(settingKey.split(".")[0] ?? "");
    return fallbackCategory?.settings.find((setting) => setting.key === settingKey) ?? null;
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: settingKey },
      include: { category: true },
    });

    return setting ? mapSettingRecord(setting) : null;
  } catch (error) {
    if (isSettingsInfrastructureError(error)) {
      const fallbackCategory = buildCatalogFallbackCategoryDetail(settingKey.split(".")[0] ?? "");
      return fallbackCategory?.settings.find((setting) => setting.key === settingKey) ?? null;
    }

    throw error;
  }
}