import type { SettingsCatalogCategory } from "@/lib/settings/catalog";

type SettingsRuntimeSnapshot = {
  categories: SettingsCatalogCategory[];
  valueMap: Map<string, unknown>;
};

let runtimeCache:
  | {
      expiresAt: number;
      snapshot: SettingsRuntimeSnapshot;
    }
  | null = null;

export function getCachedSettingsRuntimeSnapshot() {
  if (!runtimeCache || runtimeCache.expiresAt <= Date.now()) {
    return null;
  }

  return runtimeCache.snapshot;
}

export function setCachedSettingsRuntimeSnapshot(snapshot: SettingsRuntimeSnapshot, ttlMs: number) {
  runtimeCache = {
    expiresAt: Date.now() + ttlMs,
    snapshot,
  };
}

export function invalidateSettingsRuntimeCache() {
  runtimeCache = null;
}