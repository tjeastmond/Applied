"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteApplication, updateApplication } from "@/api";
import { useApplicationListView } from "@/hooks/useApplicationListView";
import { useApplicationNotesCache } from "@/hooks/useApplicationNotesCache";
import { useApplicationStatusHistoryCache } from "@/hooks/useApplicationStatusHistoryCache";
import { shouldShowIncludeArchived, type AppView } from "@/lib/appView";
import { removeApplication, sortApplications, upsertApplication } from "@/lib/applicationsList";
import { applicationMatchesViewMode } from "@/lib/applicationArchive";
import {
  canHandleApplicationCardNavigation,
  cardNavigationKeyFromEvent,
  resolveNextCardId,
} from "@/lib/applicationCardNavigation";
import { shouldClearKeyboardHighlight } from "@/lib/applicationListView";
import type { ApplicationPageSize } from "@/lib/applicationPagination";
import { errorMessage } from "@/lib/errorMessage";
import {
  consumeDoubleEscape,
  isEditableKeyboardTarget,
  isModKeyChord,
  isSearchFocusSlash,
} from "@/lib/keyboardShortcut";
import { toastMessages } from "@/lib/toastMessages";
import type { ApplicationNote, ApplicationStatus, JobApplication } from "@/types";
import { toast } from "sonner";

export type AuthenticatedAppControllerOptions = {
  initialApplications: JobApplication[];
  initialNotesByApplicationId: Record<string, ApplicationNote[]>;
  initialPageSize: ApplicationPageSize;
  initialPageSizeFromPreference: boolean;
  routeAppView?: AppView;
  /** Shell mode: navigate home when filtering by company from the detail drawer. */
  navigateToApplications?: () => void;
};

export function useAuthenticatedAppController({
  initialApplications,
  initialNotesByApplicationId,
  initialPageSize,
  initialPageSizeFromPreference,
  routeAppView,
  navigateToApplications,
}: AuthenticatedAppControllerOptions) {
  const [formOpen, setFormOpen] = useState(false);
  const [applications, setApplications] = useState<JobApplication[]>(() => initialApplications);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [keyboardHighlightId, setKeyboardHighlightId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const detailClosingIdRef = useRef<string | null>(null);
  const hoveredCardIdRef = useRef<string | null>(null);
  const keyboardHighlightIdRef = useRef(keyboardHighlightId);
  keyboardHighlightIdRef.current = keyboardHighlightId;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const listView = useApplicationListView({
    applications,
    initialPageSize,
    initialPageSizeFromPreference,
    routeAppView,
  });

  const {
    snapshot,
    viewMode,
    bookmarksOnly,
    includeArchived,
    selectedCompanies,
    selectedStatuses,
    searchQuery,
    pageSize,
    hasSyncedPageSize,
    setSelectedCompanies,
    setSelectedStatuses,
    setSearchQuery,
    clearFilters,
    resetToHome,
    handleViewModeToggle,
    handleIncludeArchivedChange,
    handlePageChange: setListPage,
    handlePageSizeChange: setListPageSize,
    handleCompanyFilter,
    queuePendingCompanyFilterForNavigation,
    resetListPagination,
  } = listView;

  const {
    companyNames,
    visibleApplications,
    visibleApplicationIds,
    hasActiveFilters,
    pagination: paginatedApplications,
    isArchivedViewEmpty,
    isBookmarksViewEmpty,
    isFilteredEmpty,
  } = snapshot;

  const applicationsListRef = useRef<HTMLDivElement>(null);
  const lastEscapeAtRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    prefetch,
    prefetchMany,
    notesByApplicationId,
    isLoading,
    setNotes,
    refetch: refetchNotes,
    removeApplication: clearNotesCache,
    clearAll: clearNotesCacheAll,
  } = useApplicationNotesCache({ initialNotesByApplicationId });

  const {
    prefetch: prefetchStatusHistory,
    statusHistoryByApplicationId,
    isLoading: isStatusHistoryLoading,
    refetch: refetchStatusHistory,
    removeApplication: clearStatusHistoryCache,
    clearAll: clearStatusHistoryCacheAll,
  } = useApplicationStatusHistoryCache();

  useEffect(() => {
    setApplications(initialApplications);
  }, [initialApplications]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    function onScroll() {
      const list = applicationsListRef.current;
      if (!list) return;
      hoveredCardIdRef.current = null;
      list.dataset.scrollHoverLocked = "";
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const el = applicationsListRef.current;
        if (el && !keyboardHighlightIdRef.current) delete el.dataset.scrollHoverLocked;
      }, 150);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timeout);
    };
  }, []);

  const handleApplicationChange = useCallback(
    (application: JobApplication) => {
      let statusChanged = false;

      setApplications((prev) => {
        const existing = prev.find((item) => item.id === application.id);
        statusChanged = existing !== undefined && existing.status !== application.status;
        return upsertApplication(prev, application);
      });

      if (statusChanged) {
        void refetchNotes(application.id);
      }
    },
    [refetchNotes],
  );

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === selectedId) ?? null,
    [applications, selectedId],
  );
  const pendingDeleteApplication = useMemo(
    () => applications.find((application) => application.id === pendingDeleteId) ?? null,
    [applications, pendingDeleteId],
  );
  const selectedNotes = useMemo(
    () => (selectedId ? (notesByApplicationId[selectedId] ?? []) : []),
    [selectedId, notesByApplicationId],
  );
  const selectedNotesLoading = useMemo(() => {
    if (!selectedId) return false;
    return isLoading(selectedId) || notesByApplicationId[selectedId] === undefined;
  }, [selectedId, notesByApplicationId, isLoading]);
  const selectedStatusHistory = useMemo(
    () => (selectedId ? (statusHistoryByApplicationId[selectedId] ?? []) : []),
    [selectedId, statusHistoryByApplicationId],
  );
  const selectedStatusHistoryLoading = useMemo(() => {
    if (!selectedId) return false;
    return isStatusHistoryLoading(selectedId) || statusHistoryByApplicationId[selectedId] === undefined;
  }, [selectedId, statusHistoryByApplicationId, isStatusHistoryLoading]);

  useEffect(() => {
    if (!selectedApplication || !detailOpen) return;

    const matchesView = applicationMatchesViewMode(selectedApplication, viewMode, includeArchived);
    const matchesBookmarks = !bookmarksOnly || selectedApplication.pinned;
    if (!matchesView || !matchesBookmarks) {
      setDetailOpen(false);
    }
  }, [bookmarksOnly, detailOpen, includeArchived, selectedApplication, viewMode]);

  useEffect(() => {
    prefetchMany(visibleApplicationIds);
  }, [visibleApplicationIds, prefetchMany]);

  const openAddForm = useCallback(() => {
    setFormOpen(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isModKeyChord(event, "k")) return;
      if (isEditableKeyboardTarget(event.target)) return;
      event.preventDefault();
      openAddForm();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openAddForm]);

  useEffect(() => {
    if (applications.length === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!isSearchFocusSlash(event)) return;
      if (formOpen || detailOpen || pendingDeleteId !== null) return;
      if (isEditableKeyboardTarget(event.target)) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applications.length, detailOpen, formOpen, pendingDeleteId]);

  const handleOpenApplication = useCallback(
    (id: string) => {
      void prefetch(id, { notifyOnError: true });
      void prefetchStatusHistory(id, { notifyOnError: true });
      setSelectedId(id);
      setDetailOpen(true);
    },
    [prefetch, prefetchStatusHistory],
  );

  const handlePrefetchNotes = useCallback(
    (id: string) => {
      void prefetch(id);
      void prefetchStatusHistory(id);
    },
    [prefetch, prefetchStatusHistory],
  );

  const handleDetailOpenChange = useCallback((open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      detailClosingIdRef.current = selectedIdRef.current;
    } else {
      detailClosingIdRef.current = null;
    }
  }, []);

  const handleCompanyFilterFromDetail = useCallback(
    (company: string) => {
      if (routeAppView && routeAppView !== "applications") {
        queuePendingCompanyFilterForNavigation(company);
      }
      handleCompanyFilter(company);
      setDetailOpen(false);
      navigateToApplications?.();
    },
    [handleCompanyFilter, navigateToApplications, queuePendingCompanyFilterForNavigation, routeAppView],
  );

  const handleDetailCloseComplete = useCallback(() => {
    const closingId = detailClosingIdRef.current;
    if (closingId === null) return;
    detailClosingIdRef.current = null;
    setSelectedId((current) => (current === closingId ? null : current));
    if (visibleApplicationIds.includes(closingId)) {
      setKeyboardHighlightId(closingId);
    }
  }, [visibleApplicationIds]);

  const requestDelete = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);

  const updateApplicationStatus = useCallback(
    async (id: string, status: ApplicationStatus): Promise<JobApplication | null> => {
      let previousApplication: JobApplication | undefined;

      setApplications((prev) => {
        const application = prev.find((item) => item.id === id);
        if (!application || application.status === status) return prev;
        previousApplication = application;
        return upsertApplication(prev, { ...application, status });
      });

      if (!previousApplication) return null;

      const snapshotApplication = previousApplication;

      try {
        const updated = await updateApplication(id, { status });
        setApplications((prev) => {
          const current = prev.find((item) => item.id === id);
          if (!current || current.status !== status) return prev;
          return upsertApplication(prev, updated);
        });
        void refetchNotes(id);
        void refetchStatusHistory(id);
        return updated;
      } catch (error) {
        setApplications((prev) => {
          const current = prev.find((item) => item.id === id);
          if (!current || current.status !== status) return prev;
          return upsertApplication(prev, snapshotApplication);
        });
        toast.error(errorMessage(error, toastMessages.statusUpdateFailed));
        return null;
      }
    },
    [refetchNotes, refetchStatusHistory],
  );

  const handleStatusChange = useCallback(
    (id: string, status: ApplicationStatus) => {
      void updateApplicationStatus(id, status);
    },
    [updateApplicationStatus],
  );

  const handlePinChange = useCallback((id: string, pinned: boolean) => {
    void (async () => {
      let previousApplication: JobApplication | undefined;

      setApplications((prev) => {
        const application = prev.find((item) => item.id === id);
        if (!application || application.pinned === pinned) return prev;
        previousApplication = application;
        return upsertApplication(prev, { ...application, pinned });
      });

      if (!previousApplication) return;

      const snapshotApplication = previousApplication;

      try {
        const updated = await updateApplication(id, { pinned });
        setApplications((prev) => {
          const current = prev.find((item) => item.id === id);
          if (!current || current.pinned !== pinned) return prev;
          return upsertApplication(prev, updated);
        });
      } catch (error) {
        setApplications((prev) => {
          const current = prev.find((item) => item.id === id);
          if (!current || current.pinned !== pinned) return prev;
          return upsertApplication(prev, snapshotApplication);
        });
        toast.error(
          errorMessage(error, pinned ? toastMessages.applicationPinFailed : toastMessages.applicationUnpinFailed),
        );
      }
    })();
  }, []);

  const handleDeleteDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isDeleting) {
        setPendingDeleteId(null);
      }
    },
    [isDeleting],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setIsDeleting(true);
    try {
      await deleteApplication(id);
      setPendingDeleteId(null);
      clearNotesCache(id);
      clearStatusHistoryCache(id);
      setApplications((prev) => removeApplication(prev, id));
      if (selectedId === id) {
        handleDetailOpenChange(false);
      }
      toast.success(toastMessages.applicationDeleted);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.deleteApplicationFailed));
    } finally {
      setIsDeleting(false);
    }
  }, [pendingDeleteId, clearNotesCache, clearStatusHistoryCache, selectedId, handleDetailOpenChange]);

  const handleBackupImported = useCallback(
    (nextApplications: JobApplication[]) => {
      setApplications(sortApplications(nextApplications));
      clearNotesCacheAll();
      clearStatusHistoryCacheAll();
      resetListPagination();
      setSelectedId(null);
      setKeyboardHighlightId(null);
      setDetailOpen(false);
      setFormOpen(false);
    },
    [clearNotesCacheAll, clearStatusHistoryCacheAll, resetListPagination],
  );

  const handleApplicationsUpdated = useCallback((nextApplications: JobApplication[]) => {
    setApplications(sortApplications(nextApplications));
  }, []);

  const handleNotesChange = useCallback(
    (nextNotes: ApplicationNote[]) => {
      const id = selectedIdRef.current;
      if (id) setNotes(id, nextNotes);
    },
    [setNotes],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setListPage(page);
      applicationsListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [setListPage],
  );

  const handlePageSizeChange = useCallback(
    (nextPageSize: ApplicationPageSize) => {
      setListPageSize(nextPageSize);
      applicationsListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [setListPageSize],
  );

  const handleCardMouseEnter = useCallback((id: string) => {
    hoveredCardIdRef.current = id;
    setKeyboardHighlightId(null);
  }, []);

  const handleCardMouseLeave = useCallback(() => {
    hoveredCardIdRef.current = null;
  }, []);

  const scrollCardIntoView = useCallback((id: string) => {
    const card = applicationsListRef.current?.querySelector<HTMLElement>(`[data-application-id="${id}"]`);
    card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!shouldClearKeyboardHighlight(keyboardHighlightId, visibleApplicationIds)) return;
    setKeyboardHighlightId(null);
  }, [keyboardHighlightId, visibleApplicationIds]);

  useEffect(() => {
    const list = applicationsListRef.current;
    if (!list) return;
    if (keyboardHighlightId) {
      list.dataset.scrollHoverLocked = "";
    } else {
      delete list.dataset.scrollHoverLocked;
    }
  }, [keyboardHighlightId]);

  useEffect(() => {
    function onMouseMove() {
      if (keyboardHighlightIdRef.current === null) return;
      setKeyboardHighlightId(null);
      hoveredCardIdRef.current = null;
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-application-id]")) return;
      hoveredCardIdRef.current = null;
    }

    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (visibleApplicationIds.length === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      const navKey = cardNavigationKeyFromEvent(event);
      if (!navKey) return;

      if (
        !canHandleApplicationCardNavigation({
          formOpen,
          detailOpen,
          pendingDeleteId,
          visibleCardCount: visibleApplicationIds.length,
          target: event.target,
        })
      ) {
        return;
      }

      if (navKey === "enter") {
        const highlightId = keyboardHighlightIdRef.current;
        if (!highlightId) return;
        event.preventDefault();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        handleOpenApplication(highlightId);
        return;
      }

      event.preventDefault();
      const currentId = keyboardHighlightIdRef.current;
      const nextId = resolveNextCardId(visibleApplicationIds, currentId, navKey, hoveredCardIdRef.current);
      if (!nextId || nextId === currentId) return;
      const list = applicationsListRef.current;
      if (list) list.dataset.scrollHoverLocked = "";
      setKeyboardHighlightId(nextId);
      scrollCardIntoView(nextId);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailOpen, formOpen, handleOpenApplication, pendingDeleteId, scrollCardIntoView, visibleApplicationIds]);

  useEffect(() => {
    if (!hasActiveFilters || applications.length === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (formOpen || detailOpen || pendingDeleteId !== null) {
        lastEscapeAtRef.current = null;
        return;
      }
      if (!consumeDoubleEscape(event, lastEscapeAtRef)) return;
      event.preventDefault();
      clearFilters();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applications.length, clearFilters, detailOpen, formOpen, hasActiveFilters, pendingDeleteId]);

  return {
    applications,
    formOpen,
    setFormOpen,
    openAddForm,
    selectedApplication,
    pendingDeleteApplication,
    pendingDeleteId,
    isDeleting,
    detailOpen,
    keyboardHighlightId,
    viewMode,
    bookmarksOnly,
    includeArchived,
    showIncludeArchived: shouldShowIncludeArchived({ routeAppView, viewMode, bookmarksOnly }),
    selectedCompanies,
    selectedStatuses,
    searchQuery,
    pageSize,
    hasSyncedPageSize,
    companyNames,
    visibleApplications,
    visibleApplicationIds,
    hasActiveFilters,
    paginatedApplications,
    isArchivedViewEmpty,
    isBookmarksViewEmpty,
    isFilteredEmpty,
    applicationsListRef,
    searchInputRef,
    selectedNotes,
    selectedNotesLoading,
    selectedStatusHistory,
    selectedStatusHistoryLoading,
    setSelectedCompanies,
    setSelectedStatuses,
    setSearchQuery,
    clearFilters,
    resetToHome,
    handleViewModeToggle,
    handleIncludeArchivedChange,
    handleOpenApplication,
    handlePrefetchNotes,
    handleDetailOpenChange,
    handleDetailCloseComplete,
    handleApplicationChange,
    handleStatusChange,
    handlePinChange,
    handleDeleteDialogOpenChange,
    confirmDelete,
    handleBackupImported,
    handleApplicationsUpdated,
    handleNotesChange,
    handlePageChange,
    handlePageSizeChange,
    handleCompanyFilter,
    handleCompanyFilterFromDetail,
    handleCardMouseEnter,
    handleCardMouseLeave,
    requestDelete,
  };
}

export type AuthenticatedAppController = ReturnType<typeof useAuthenticatedAppController>;
