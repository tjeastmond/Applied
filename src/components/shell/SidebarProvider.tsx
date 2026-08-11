"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type SidebarContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (value: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export const SIDEBAR_COLLAPSED_STORAGE_KEY = "applied-dev-sidebar-collapsed";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (stored === "true") setCollapsedState(true);
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
    () => ({ collapsed, toggleCollapsed, setCollapsed, mobileOpen, setMobileOpen }),
    [collapsed, toggleCollapsed, setCollapsed, mobileOpen],
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
