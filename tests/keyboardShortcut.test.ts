import { describe, expect, it } from "vitest";
import {
  appKeyboardShortcuts,
  consumeDoubleEscape,
  DOUBLE_ESCAPE_INTERVAL_MS,
  isAdminOpenShortcut,
  isModKeyChord,
  isSearchFocusSlash,
  isShortcutsHelpOpenShortcut,
  modKShortcutDisplayLabel,
  modSShortcutDisplayLabel,
} from "@/lib/keyboardShortcut";

function keyEvent(init: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    ...init,
    metaKey: init.metaKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
  } as KeyboardEvent;
}

describe("isModKeyChord", () => {
  it("matches Meta+K and Ctrl+K", () => {
    expect(isModKeyChord(keyEvent({ key: "k", metaKey: true }), "k")).toBe(true);
    expect(isModKeyChord(keyEvent({ key: "K", ctrlKey: true }), "k")).toBe(true);
  });

  it("ignores K without modifier", () => {
    expect(isModKeyChord(keyEvent({ key: "k" }), "k")).toBe(false);
  });

  it("matches Meta+S and Ctrl+S", () => {
    expect(isModKeyChord(keyEvent({ key: "s", metaKey: true }), "s")).toBe(true);
    expect(isModKeyChord(keyEvent({ key: "S", ctrlKey: true }), "s")).toBe(true);
  });

  it("matches Meta+Enter and Ctrl+Enter", () => {
    expect(isModKeyChord(keyEvent({ key: "Enter", metaKey: true }), "Enter")).toBe(true);
    expect(isModKeyChord(keyEvent({ key: "Enter", ctrlKey: true }), "Enter")).toBe(true);
  });
});

describe("isAdminOpenShortcut", () => {
  it("matches unmodified lowercase a", () => {
    expect(isAdminOpenShortcut(keyEvent({ key: "a" }))).toBe(true);
  });

  it("ignores a with modifiers", () => {
    expect(isAdminOpenShortcut(keyEvent({ key: "a", metaKey: true }))).toBe(false);
    expect(isAdminOpenShortcut(keyEvent({ key: "a", ctrlKey: true }))).toBe(false);
    expect(isAdminOpenShortcut(keyEvent({ key: "a", altKey: true }))).toBe(false);
    expect(isAdminOpenShortcut(keyEvent({ key: "a", shiftKey: true }))).toBe(false);
  });

  it("ignores uppercase A and other keys", () => {
    expect(isAdminOpenShortcut(keyEvent({ key: "A" }))).toBe(false);
    expect(isAdminOpenShortcut(keyEvent({ key: "b" }))).toBe(false);
  });
});

describe("isShortcutsHelpOpenShortcut", () => {
  it("matches unmodified question mark", () => {
    expect(isShortcutsHelpOpenShortcut(keyEvent({ key: "?", shiftKey: true }))).toBe(true);
  });

  it("ignores question mark with meta or ctrl", () => {
    expect(isShortcutsHelpOpenShortcut(keyEvent({ key: "?", metaKey: true }))).toBe(false);
    expect(isShortcutsHelpOpenShortcut(keyEvent({ key: "?", ctrlKey: true }))).toBe(false);
  });

  it("ignores other keys", () => {
    expect(isShortcutsHelpOpenShortcut(keyEvent({ key: "/" }))).toBe(false);
  });
});

describe("isSearchFocusSlash", () => {
  it("matches unmodified slash", () => {
    expect(isSearchFocusSlash(keyEvent({ key: "/" }))).toBe(true);
  });

  it("ignores slash with modifiers", () => {
    expect(isSearchFocusSlash(keyEvent({ key: "/", shiftKey: true }))).toBe(false);
    expect(isSearchFocusSlash(keyEvent({ key: "/", metaKey: true }))).toBe(false);
  });

  it("ignores other keys", () => {
    expect(isSearchFocusSlash(keyEvent({ key: "?" }))).toBe(false);
  });
});

describe("appKeyboardShortcuts", () => {
  it("returns the full shortcut catalog", () => {
    const shortcuts = appKeyboardShortcuts();
    expect(shortcuts).toHaveLength(8);

    const globalKeys = shortcuts.filter((entry) => entry.context === "Global").map((entry) => entry.keys);
    expect(globalKeys).toContain(modKShortcutDisplayLabel());
    expect(globalKeys).toContain("/");
    expect(globalKeys).toContain("Esc Esc");
    expect(globalKeys).toContain("a");
    expect(globalKeys).toContain("?");

    const detailKeys = shortcuts.filter((entry) => entry.context === "Detail Drawer").map((entry) => entry.keys);
    expect(detailKeys).toHaveLength(3);
    expect(detailKeys).toContain(modSShortcutDisplayLabel());
    expect(detailKeys).toContain("Esc");
  });

  it("includes focus search and clear filters descriptions", () => {
    const shortcuts = appKeyboardShortcuts();
    expect(shortcuts.find((entry) => entry.keys === "/")?.description).toBe("Focus search");
    expect(shortcuts.find((entry) => entry.keys === "Esc Esc")?.description).toBe("Clear filters");
  });
});

describe("consumeDoubleEscape", () => {
  it("returns false on the first press", () => {
    const lastPressAtRef = { current: null as number | null };
    expect(consumeDoubleEscape(keyEvent({ key: "Escape" }), lastPressAtRef, 100)).toBe(false);
  });

  it("returns true when the second press is within the interval", () => {
    const lastPressAtRef = { current: null as number | null };
    consumeDoubleEscape(keyEvent({ key: "Escape" }), lastPressAtRef, 100);
    expect(consumeDoubleEscape(keyEvent({ key: "Escape" }), lastPressAtRef, 100 + DOUBLE_ESCAPE_INTERVAL_MS)).toBe(
      true,
    );
  });

  it("returns false when the second press is too late", () => {
    const lastPressAtRef = { current: null as number | null };
    consumeDoubleEscape(keyEvent({ key: "Escape" }), lastPressAtRef, 100);
    expect(consumeDoubleEscape(keyEvent({ key: "Escape" }), lastPressAtRef, 100 + DOUBLE_ESCAPE_INTERVAL_MS + 1)).toBe(
      false,
    );
  });

  it("ignores key repeat", () => {
    const lastPressAtRef = { current: null as number | null };
    consumeDoubleEscape(keyEvent({ key: "Escape" }), lastPressAtRef, 100);
    expect(consumeDoubleEscape(keyEvent({ key: "Escape", repeat: true }), lastPressAtRef, 150)).toBe(false);
  });
});
