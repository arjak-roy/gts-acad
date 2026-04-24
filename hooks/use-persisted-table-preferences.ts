"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  resolveStoredTablePreference,
  type ResolvedTablePreference,
  type StoredTablePreference,
} from "@/lib/table-preferences";

type UsePersistedTablePreferencesOptions = {
  tableKey?: string;
  defaultPageSize: number;
  pageSizes?: number[];
  columnIds?: string[];
  lockedColumnIds?: string[];
};

type PersistedTablePreferencePatch = {
  pageSize?: number | null;
  hiddenColumnIds?: string[] | null;
};

const EMPTY_COLUMN_IDS: string[] = [];

export function usePersistedTablePreferences({
  tableKey,
  defaultPageSize,
  pageSizes,
  columnIds = EMPTY_COLUMN_IDS,
  lockedColumnIds = EMPTY_COLUMN_IDS,
}: UsePersistedTablePreferencesOptions) {
  const resolvePreference = useCallback(
    (value: StoredTablePreference | undefined) =>
      resolveStoredTablePreference(value, {
        defaultPageSize,
        pageSizes,
        columnIds,
        lockedColumnIds,
      }),
    [columnIds, defaultPageSize, lockedColumnIds, pageSizes],
  );

  const [preferences, setPreferences] = useState<ResolvedTablePreference>(() =>
    resolvePreference(undefined),
  );
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);

  const persistPreferencePatch = useCallback(
    async (patch: PersistedTablePreferencePatch) => {
      if (!tableKey) {
        return;
      }

      try {
        await fetch(`/api/table-preferences/${encodeURIComponent(tableKey)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      } catch {
        // Preference persistence should not block table interaction.
      }
    },
    [tableKey],
  );

  useEffect(() => {
    let cancelled = false;

    setPreferences(resolvePreference(undefined));

    if (!tableKey) {
      setHasLoadedPreferences(true);
      return () => {
        cancelled = true;
      };
    }

    setHasLoadedPreferences(false);

    void (async () => {
      try {
        const response = await fetch(`/api/table-preferences/${encodeURIComponent(tableKey)}`, {
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as {
          data?: { preferences?: StoredTablePreference };
        } | null;

        if (!response.ok) {
          throw new Error("Failed to load table preferences.");
        }

        if (!cancelled) {
          setPreferences(resolvePreference(payload?.data?.preferences));
        }
      } catch {
        if (!cancelled) {
          setPreferences(resolvePreference(undefined));
        }
      } finally {
        if (!cancelled) {
          setHasLoadedPreferences(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvePreference, tableKey]);

  const setPageSize = useCallback(
    (pageSize: number) => {
      setPreferences((current) => ({
        ...current,
        pageSize,
      }));
      void persistPreferencePatch({ pageSize });
    },
    [persistPreferencePatch],
  );

  const setHiddenColumnIds = useCallback(
    (hiddenColumnIds: string[]) => {
      const nextPreference = resolvePreference({
        pageSize: preferences.pageSize,
        hiddenColumnIds,
      });

      setPreferences(nextPreference);
      void persistPreferencePatch({ hiddenColumnIds: nextPreference.hiddenColumnIds });
    },
    [persistPreferencePatch, preferences.pageSize, resolvePreference],
  );

  const toggleColumnVisibility = useCallback(
    (columnId: string) => {
      if (lockedColumnIds.includes(columnId)) {
        return;
      }

      setPreferences((current) => {
        const isHidden = current.hiddenColumnIds.includes(columnId);
        const nextHiddenColumnIds = isHidden
          ? current.hiddenColumnIds.filter((candidate) => candidate !== columnId)
          : [...current.hiddenColumnIds, columnId];
        const nextPreference = resolvePreference({
          pageSize: current.pageSize,
          hiddenColumnIds: nextHiddenColumnIds,
        });

        void persistPreferencePatch({ hiddenColumnIds: nextPreference.hiddenColumnIds });
        return nextPreference;
      });
    },
    [lockedColumnIds, persistPreferencePatch, resolvePreference],
  );

  const resetPreferences = useCallback(() => {
    const nextPreference = resolvePreference(undefined);
    setPreferences(nextPreference);
    void persistPreferencePatch({ pageSize: null, hiddenColumnIds: null });
  }, [persistPreferencePatch, resolvePreference]);

  const visibleColumnIds = useMemo(
    () => columnIds.filter((columnId) => !preferences.hiddenColumnIds.includes(columnId)),
    [columnIds, preferences.hiddenColumnIds],
  );

  return {
    preferences,
    hasLoadedPreferences,
    visibleColumnIds,
    setPageSize,
    setHiddenColumnIds,
    toggleColumnVisibility,
    resetPreferences,
  };
}
