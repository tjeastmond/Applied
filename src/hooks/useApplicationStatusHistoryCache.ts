"use client";

import { useCallback, useRef, useState } from "react";
import { listApplicationStatusHistory } from "@/api";
import { errorMessage } from "@/lib/errorMessage";
import { toastMessages } from "@/lib/toastMessages";
import type { ApplicationStatusHistoryEntry } from "@/types";
import { toast } from "sonner";

type LoadStatusHistoryOptions = {
  notifyOnError?: boolean;
  emptyCacheOnError?: boolean;
};

export function useApplicationStatusHistoryCache() {
  const [entries, setEntries] = useState<Record<string, ApplicationStatusHistoryEntry[]>>({});
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

  const loadStatusHistory = useCallback(
    (applicationId: string, options?: LoadStatusHistoryOptions): Promise<void> => {
      const inflight = inflightRef.current.get(applicationId);
      if (inflight) return inflight;

      setLoading(applicationId, true);

      const request = listApplicationStatusHistory(applicationId)
        .then((history) => {
          setEntries((prev) => ({ ...prev, [applicationId]: history }));
        })
        .catch((error) => {
          if (options?.emptyCacheOnError) {
            setEntries((prev) => ({ ...prev, [applicationId]: [] }));
          }
          if (options?.notifyOnError) {
            toast.error(errorMessage(error, toastMessages.statusHistoryLoadFailed));
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
      return loadStatusHistory(applicationId, { ...options, emptyCacheOnError: true });
    },
    [loadStatusHistory],
  );

  const isLoading = useCallback(
    (applicationId: string | null): boolean => {
      if (!applicationId) return false;
      return loadingIds.has(applicationId);
    },
    [loadingIds],
  );

  const refetch = useCallback(
    (applicationId: string, options?: { notifyOnError?: boolean }): Promise<void> => {
      return loadStatusHistory(applicationId, options);
    },
    [loadStatusHistory],
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

  const clearAll = useCallback(() => {
    setEntries({});
    inflightRef.current.clear();
    setLoadingIds(new Set());
  }, []);

  return {
    prefetch,
    statusHistoryByApplicationId: entries,
    isLoading,
    refetch,
    removeApplication,
    clearAll,
  };
}
