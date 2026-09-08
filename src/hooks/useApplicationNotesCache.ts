"use client";

import { listApplicationNotes } from "@/api";
import { useApplicationResourceCache } from "@/hooks/useApplicationResourceCache";
import { toastMessages } from "@/lib/toastMessages";
import type { ApplicationNote } from "@/types";

export function useApplicationNotesCache(options?: {
  initialNotesByApplicationId?: Record<string, ApplicationNote[]>;
}) {
  const { entries, getEntries, setResourceEntries, ...cache } = useApplicationResourceCache({
    initialEntries: options?.initialNotesByApplicationId,
    load: listApplicationNotes,
    errorMessage: toastMessages.notesLoadFailed,
  });
  return { ...cache, notesByApplicationId: entries, getNotes: getEntries, setNotes: setResourceEntries };
}
