"use client";

import { listApplicationStatusHistory } from "@/api";
import { useApplicationResourceCache } from "@/hooks/useApplicationResourceCache";
import { toastMessages } from "@/lib/toastMessages";

export function useApplicationStatusHistoryCache() {
  const { entries, prefetch, isLoading, refetch, removeApplication, clearAll } = useApplicationResourceCache({
    load: listApplicationStatusHistory,
    errorMessage: toastMessages.statusHistoryLoadFailed,
  });
  return { statusHistoryByApplicationId: entries, prefetch, isLoading, refetch, removeApplication, clearAll };
}
