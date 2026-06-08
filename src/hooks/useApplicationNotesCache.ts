"use client";

import { useCallback, useRef, useState } from "react";
import { listApplicationNotes } from "@/api";
import { errorMessage } from "@/lib/errorMessage";
import { toastMessages } from "@/lib/toastMessages";
import type { ApplicationNote } from "@/types";
import { toast } from "sonner";

type LoadNotesOptions = {
  notifyOnError?: boolean;
  emptyCacheOnError?: boolean;
};

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

  const loadNotes = useCallback(
    (applicationId: string, options?: LoadNotesOptions): Promise<void> => {
      const inflight = inflightRef.current.get(applicationId);
      if (inflight) return inflight;

      setLoading(applicationId, true);

      const request = listApplicationNotes(applicationId)
        .then((notes) => {
          setEntries((prev) => ({ ...prev, [applicationId]: notes }));
        })
        .catch((error) => {
          if (options?.emptyCacheOnError) {
            setEntries((prev) => ({ ...prev, [applicationId]: [] }));
          }
          if (options?.notifyOnError) {
            toast.error(errorMessage(error, toastMessages.notesLoadFailed));
          }
        })
        .finally(() => {
          setLoading(applicationId, false);
          inflightRef.current.delete(applicationId);
        });

      inflightRef.current.set(applicationId, request);
      return request;
    },
    [setLoading],
  );

  const prefetch = useCallback(
    (applicationId: string, options?: { notifyOnError?: boolean }): Promise<void> => {
      if (entriesRef.current[applicationId] !== undefined) return Promise.resolve();
      return loadNotes(applicationId, { ...options, emptyCacheOnError: true });
    },
    [loadNotes],
  );

  const getNotes = useCallback((applicationId: string | null): ApplicationNote[] | undefined => {
    if (!applicationId) return undefined;
    return entriesRef.current[applicationId];
  }, []);

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

  const refetch = useCallback(
    (applicationId: string, options?: { notifyOnError?: boolean }): Promise<void> => {
      return loadNotes(applicationId, options);
    },
    [loadNotes],
  );

  const removeApplication = useCallback(
    (applicationId: string) => {
      setEntries((prev) => {
        const next = { ...prev };
        delete next[applicationId];
        return next;
      });
      inflightRef.current.delete(applicationId);
      setLoading(applicationId, false);
    },
    [setLoading],
  );

  const prefetchMany = useCallback(
    (applicationIds: string[]) => {
      const queue = applicationIds.filter((id) => entriesRef.current[id] === undefined);
      if (queue.length === 0) return;

      const concurrency = 6;
      void (async () => {
        for (let index = 0; index < queue.length; index += concurrency) {
          const batch = queue.slice(index, index + concurrency);
          await Promise.all(batch.map((id) => prefetch(id)));
        }
      })();
    },
    [prefetch],
  );

  const clearAll = useCallback(() => {
    setEntries({});
    inflightRef.current.clear();
    setLoadingIds(new Set());
  }, []);

  return {
    prefetch,
    prefetchMany,
    getNotes,
    notesByApplicationId: entries,
    isLoading,
    setNotes,
    refetch,
    removeApplication,
    clearAll,
  };
}
