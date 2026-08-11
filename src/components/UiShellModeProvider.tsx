"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  persistUiShellMode,
  readStoredUiShellMode,
  type UiShellMode,
} from "@/hooks/useUiShellMode";

type UiShellModeContextValue = {
  mode: UiShellMode;
  setMode: (mode: UiShellMode) => void;
  toggleMode: () => void;
  hasHydrated: boolean;
};

const UiShellModeContext = createContext<UiShellModeContextValue | null>(null);

export function UiShellModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UiShellMode>("shell");
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setModeState(readStoredUiShellMode());
    setHasHydrated(true);
  }, []);

  const setMode = useCallback((next: UiShellMode) => {
    setModeState(next);
    persistUiShellMode(next);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => {
      const next: UiShellMode = current === "shell" ? "classic" : "shell";
      persistUiShellMode(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, toggleMode, hasHydrated }),
    [mode, setMode, toggleMode, hasHydrated],
  );

  return <UiShellModeContext.Provider value={value}>{children}</UiShellModeContext.Provider>;
}

export function useUiShellModeContext(): UiShellModeContextValue {
  const context = useContext(UiShellModeContext);
  if (!context) {
    throw new Error("useUiShellModeContext must be used within a UiShellModeProvider");
  }
  return context;
}
