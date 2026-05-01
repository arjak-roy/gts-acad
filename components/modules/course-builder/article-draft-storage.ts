"use client";

export type StoredArticleDraft<T> = {
  value: T;
  updatedAt: string;
};

export function readStoredArticleDraft<T>(storageKey: string | null | undefined): StoredArticleDraft<T> | null {
  if (!storageKey || typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredArticleDraft<T> | null;
    if (!parsed || typeof parsed !== "object" || !("value" in parsed) || typeof parsed.updatedAt !== "string") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredArticleDraft<T>(storageKey: string | null | undefined, value: T): string | null {
  if (!storageKey || typeof window === "undefined") {
    return null;
  }

  const payload: StoredArticleDraft<T> = {
    value,
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    return payload.updatedAt;
  } catch {
    return null;
  }
}

export function clearStoredArticleDraft(storageKey: string | null | undefined) {
  if (!storageKey || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore localStorage errors
  }
}

export function formatStoredArticleDraftTime(value: string | null | undefined) {
  if (!value) {
    return "a recent session";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "a recent session";
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}