"use client";

import { useCallback, useRef, useState } from "react";
import { listApplicationNotes } from "@/api";
import { errorMessage } from "@/lib/errorMessage";
import { toastMessages } from "@/lib/toastMessages";
import type { ApplicationNote } from "@/types";
import { toast } from "sonner";

export function useApplicationNotesCache() {
  const [entries, setEntries] = useState<Record<string, ApplicationNote[]>>({});
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(() => new Set());
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map());

  const setLoading = useCallback((applicationId: string, loading: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      if (loading) {
        next.add(applicationId);
      } else {
        next.delete(applicationId);
      }
      return next;
    });
  }, []);

  const prefetch = useCallback((applicationId: string, options?: { notifyOnError?: boolean }) => {
    if (entriesRef.current[applicationId] !== undefined) return;
    const inflight = inflightRef.current.get(applicationId);
    if (inflight) return;

    setLoading(applicationId, true);

    const request = listApplicationNotes(applicationId)
      .then((notes) => {
        setEntries((prev) => ({ ...prev, [applicationId]: notes }));
      })
      .catch((error) => {
        setEntries((prev) => ({ ...prev, [applicationId]: [] }));
        if (options?.notifyOnError) {
          toast.error(errorMessage(error, toastMessages.notesLoadFailed));
        }
      })
      .finally(() => {
        setLoading(applicationId, false);
        inflightRef.current.delete(applicationId);
      });

    inflightRef.current.set(applicationId, request);
  }, [setLoading]);

  const getNotes = useCallback(
    (applicationId: string | null): ApplicationNote[] | undefined => {
      if (!applicationId) return undefined;
      return entries[applicationId];
    },
    [entries],
  );

  const isLoading = useCallback(
    (applicationId: string | null): boolean => {
      if (!applicationId) return false;
      return loadingIds.has(applicationId);
    },
    [loadingIds],
  );

  const setNotes = useCallback((applicationId: string, notes: ApplicationNote[]) => {
    setEntries((prev) => ({ ...prev, [applicationId]: notes }));
  }, []);

  const removeApplication = useCallback((applicationId: string) => {
    setEntries((prev) => {
      const next = { ...prev };
      delete next[applicationId];
      return next;
    });
    inflightRef.current.delete(applicationId);
    setLoading(applicationId, false);
  }, [setLoading]);

  const prefetchMany = useCallback(
    (applicationIds: string[]) => {
      for (const id of applicationIds) {
        prefetch(id);
      }
    },
    [prefetch],
  );

  return {
    prefetch,
    prefetchMany,
    getNotes,
    isLoading,
    setNotes,
    removeApplication,
  };
}
