"use client";

import { useCallback, useRef, useState } from "react";
import { errorMessage } from "@/lib/errorMessage";
import { toast } from "sonner";

type LoadResourceOptions = {
  notifyOnError?: boolean;
  emptyCacheOnError?: boolean;
};

type ApplicationResourceCacheOptions<T> = {
  initialEntries?: Record<string, T[]>;
  load: (applicationId: string) => Promise<T[]>;
  errorMessage: string;
};

export function useApplicationResourceCache<T>(options: ApplicationResourceCacheOptions<T>) {
  const { load, errorMessage: failureMessage } = options;
  const [entries, setEntries] = useState<Record<string, T[]>>(() => options.initialEntries ?? {});
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

  const loadResource = useCallback(
    (applicationId: string, options?: LoadResourceOptions): Promise<void> => {
      const inflight = inflightRef.current.get(applicationId);
      if (inflight) return inflight;

      setLoading(applicationId, true);

      const request = load(applicationId)
        .then((items) => {
          setEntries((prev) => ({ ...prev, [applicationId]: items }));
        })
        .catch((error) => {
          if (options?.emptyCacheOnError) {
            setEntries((prev) => ({ ...prev, [applicationId]: [] }));
          }
          if (options?.notifyOnError) {
            toast.error(errorMessage(error, failureMessage));
          }
        })
        .finally(() => {
          setLoading(applicationId, false);
          inflightRef.current.delete(applicationId);
        });

      inflightRef.current.set(applicationId, request);
      return request;
    },
    [setLoading, load, failureMessage],
  );

  const prefetch = useCallback(
    (applicationId: string, options?: { notifyOnError?: boolean }): Promise<void> => {
      if (entriesRef.current[applicationId] !== undefined) return Promise.resolve();
      return loadResource(applicationId, { ...options, emptyCacheOnError: true });
    },
    [loadResource],
  );

  const getEntries = useCallback((applicationId: string | null): T[] | undefined => {
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

  const setResourceEntries = useCallback((applicationId: string, items: T[]) => {
    setEntries((prev) => ({ ...prev, [applicationId]: items }));
  }, []);

  const refetch = useCallback(
    (applicationId: string, options?: { notifyOnError?: boolean }): Promise<void> => {
      return loadResource(applicationId, options);
    },
    [loadResource],
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
    (applicationIds: readonly string[]) => {
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
    getEntries,
    entries,
    isLoading,
    setResourceEntries,
    refetch,
    removeApplication,
    clearAll,
  };
}
