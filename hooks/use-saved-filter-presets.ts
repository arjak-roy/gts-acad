"use client";

import { useCallback, useMemo, useState } from "react";

export type SavedFilterPreset = {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
};

type SavedFilterPresetsMap = Record<string, SavedFilterPreset[]>;

const STORAGE_KEY = "gts-saved-filter-presets";
const MAX_PRESETS_PER_TABLE = 10;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readAllPresets(): SavedFilterPresetsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as SavedFilterPresetsMap;
  } catch {
    return {};
  }
}

function writeAllPresets(presets: SavedFilterPresetsMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage may be full — silently ignore
  }
}

export function useSavedFilterPresets(tableKey: string | undefined) {
  const [revision, setRevision] = useState(0);

  const presets = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    revision; // depend on revision so we re-read after mutations
    if (!tableKey) return [];
    return readAllPresets()[tableKey] ?? [];
  }, [tableKey, revision]);

  const savePreset = useCallback(
    (name: string, filters: Record<string, string>) => {
      if (!tableKey) return;
      const all = readAllPresets();
      const existing = all[tableKey] ?? [];

      const preset: SavedFilterPreset = {
        id: generateId(),
        name: name.trim(),
        filters,
        createdAt: new Date().toISOString(),
      };

      all[tableKey] = [preset, ...existing].slice(0, MAX_PRESETS_PER_TABLE);
      writeAllPresets(all);
      setRevision((r) => r + 1);
    },
    [tableKey],
  );

  const deletePreset = useCallback(
    (presetId: string) => {
      if (!tableKey) return;
      const all = readAllPresets();
      const existing = all[tableKey] ?? [];
      all[tableKey] = existing.filter((p) => p.id !== presetId);
      writeAllPresets(all);
      setRevision((r) => r + 1);
    },
    [tableKey],
  );

  return { presets, savePreset, deletePreset };
}
