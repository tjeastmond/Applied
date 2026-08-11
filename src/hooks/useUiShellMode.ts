"use client";

import { useCallback, useEffect, useState } from "react";

export type UiShellMode = "classic" | "shell";

export const UI_SHELL_MODE_STORAGE_KEY = "applied-dev-ui-mode";

export function readStoredUiShellMode(): UiShellMode {
  if (typeof window === "undefined") {
    return "shell";
  }

  const stored = window.localStorage.getItem(UI_SHELL_MODE_STORAGE_KEY);
  return stored === "classic" ? "classic" : "shell";
}

export function persistUiShellMode(mode: UiShellMode): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(UI_SHELL_MODE_STORAGE_KEY, mode);
}

export function useUiShellMode() {
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

  return { mode, setMode, toggleMode, hasHydrated };
}
