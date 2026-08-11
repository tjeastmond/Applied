"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type SidebarContextValue = {
  collapsed: boolean;
  transitionsEnabled: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (value: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export const SIDEBAR_COLLAPSED_STORAGE_KEY = "applied-dev-sidebar-collapsed";

export function readStoredSidebarCollapsed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);

  useEffect(() => {
    setCollapsedState(readStoredSidebarCollapsed());

    const frame = requestAnimationFrame(() => {
      setTransitionsEnabled(true);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(value));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ collapsed, transitionsEnabled, toggleCollapsed, setCollapsed, mobileOpen, setMobileOpen }),
    [collapsed, transitionsEnabled, toggleCollapsed, setCollapsed, mobileOpen],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
