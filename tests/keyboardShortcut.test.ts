import { describe, expect, it } from "vitest";
import {
  consumeDoubleEscape,
  DOUBLE_ESCAPE_INTERVAL_MS,
  isModKeyChord,
  isSearchFocusSlash,
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
