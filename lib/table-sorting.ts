export type ActiveSortDirection = "asc" | "desc";

export type SortableValue = boolean | number | string | Date | null | undefined;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

function isIsoDateString(value: string) {
  return ISO_DATE_PATTERN.test(value);
}

export function compareSortableValues(left: SortableValue, right: SortableValue) {
  if (left == null && right == null) {
    return 0;
  }

  if (left == null) {
    return 1;
  }

  if (right == null) {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }

  if (typeof left === "string" && typeof right === "string" && isIsoDateString(left) && isIsoDateString(right)) {
    return Date.parse(left) - Date.parse(right);
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortByAccessor<T>(
  items: readonly T[],
  direction: ActiveSortDirection,
  accessor: (item: T) => SortableValue,
) {
  return [...items].sort((left, right) => {
    const comparison = compareSortableValues(accessor(left), accessor(right));
    return direction === "desc" ? -comparison : comparison;
  });
}