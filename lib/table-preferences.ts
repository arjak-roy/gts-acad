export const MAX_TABLE_PAGE_SIZE = 100;

export type StoredTablePreference = {
  pageSize?: number;
  hiddenColumnIds?: string[];
};

export type StoredTablePreferences = Record<string, StoredTablePreference>;

export type ResolvedTablePreference = {
  pageSize: number;
  hiddenColumnIds: string[];
};

type ResolveTablePreferenceOptions = {
  defaultPageSize: number;
  pageSizes?: number[];
  columnIds?: string[];
  lockedColumnIds?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizePageSize(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }

  if (value < 1 || value > MAX_TABLE_PAGE_SIZE) {
    return undefined;
  }

  return value;
}

function sanitizeHiddenColumnIds(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const hiddenColumnIds = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .slice(0, 100),
    ),
  );

  return hiddenColumnIds;
}

export function sanitizeStoredTablePreference(value: unknown): StoredTablePreference {
  if (!isRecord(value)) {
    return {};
  }

  const pageSize = sanitizePageSize(value.pageSize);
  const hiddenColumnIds = sanitizeHiddenColumnIds(value.hiddenColumnIds);

  return {
    ...(pageSize ? { pageSize } : {}),
    ...(hiddenColumnIds ? { hiddenColumnIds } : {}),
  };
}

export function sanitizeStoredTablePreferences(value: unknown): StoredTablePreferences {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.trim().length > 0)
      .map(([key, preference]) => [key, sanitizeStoredTablePreference(preference)]),
  );
}

export function resolveStoredTablePreference(
  value: unknown,
  options: ResolveTablePreferenceOptions,
): ResolvedTablePreference {
  const storedPreference = sanitizeStoredTablePreference(value);
  const allowedPageSizes = options.pageSizes ?? [options.defaultPageSize];
  const pageSize =
    storedPreference.pageSize && allowedPageSizes.includes(storedPreference.pageSize)
      ? storedPreference.pageSize
      : options.defaultPageSize;

  const validColumnIds = new Set(options.columnIds ?? []);
  const lockedColumnIds = new Set(options.lockedColumnIds ?? []);
  let hiddenColumnIds = (storedPreference.hiddenColumnIds ?? []).filter(
    (columnId) => (validColumnIds.size === 0 || validColumnIds.has(columnId)) && !lockedColumnIds.has(columnId),
  );

  if (validColumnIds.size > 0) {
    const hideableColumnIds = [...validColumnIds].filter((columnId) => !lockedColumnIds.has(columnId));
    if (hideableColumnIds.length > 0 && hiddenColumnIds.length >= hideableColumnIds.length) {
      hiddenColumnIds = [];
    }
  }

  return {
    pageSize,
    hiddenColumnIds,
  };
}
