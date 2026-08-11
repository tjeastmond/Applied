"use client";

import { useUiShellModeContext } from "@/components/UiShellModeProvider";

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
  return useUiShellModeContext();
}
