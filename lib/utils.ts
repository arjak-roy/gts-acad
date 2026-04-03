import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatRoleLabel(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return "";
  }

  const compact = normalized.replace(/[_\s-]+/g, "").toLowerCase();

  if (compact === "superadmin") {
    return "Super Admin";
  }

  if (compact === "admin") {
    return "Admin";
  }

  if (compact === "trainer") {
    return "Trainer";
  }

  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createSearchParams(entries: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();

  Object.entries(entries).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  return params.toString();
}

export function deriveGeneratedCodePrefix(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!normalized) {
    return "GEN";
  }

  return normalized.slice(0, 3).padEnd(3, "X");
}

export function formatGeneratedCode(kind: "B" | "C" | "P", source: string, sequence: number) {
  const prefix = deriveGeneratedCodePrefix(source);
  return `${kind}-${prefix}-${String(sequence).padStart(3, "0")}`;
}