import type { ApplicationNote } from "@/types";

export type NoteSortOrder = "newest" | "oldest";

export const NOTE_SORT_STORAGE_KEY = "applied-dev-note-sort";

export const DEFAULT_NOTE_SORT_ORDER: NoteSortOrder = "newest";

const NOTE_SORT_LABELS: Record<NoteSortOrder, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
};

export function noteSortLabel(order: NoteSortOrder): string {
  return NOTE_SORT_LABELS[order];
}

export function readStoredNoteSortOrder(): NoteSortOrder {
  if (typeof window === "undefined") return DEFAULT_NOTE_SORT_ORDER;

  try {
    const stored = localStorage.getItem(NOTE_SORT_STORAGE_KEY);
    return stored === "oldest" ? "oldest" : DEFAULT_NOTE_SORT_ORDER;
  } catch {
    return DEFAULT_NOTE_SORT_ORDER;
  }
}

export function persistNoteSortOrder(order: NoteSortOrder): void {
  try {
    localStorage.setItem(NOTE_SORT_STORAGE_KEY, order);
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}

export function sortNotes(notes: ApplicationNote[], order: NoteSortOrder): ApplicationNote[] {
  return [...notes].sort((a, b) => {
    const createdAtCmp = a.createdAt.localeCompare(b.createdAt);
    if (createdAtCmp !== 0) {
      return order === "newest" ? -createdAtCmp : createdAtCmp;
    }

    const idCmp = a.id.localeCompare(b.id);
    return order === "newest" ? -idCmp : idCmp;
  });
}
