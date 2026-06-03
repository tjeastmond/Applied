import { describe, expect, it } from "vitest";
import { isModKeyChord } from "@/lib/keyboardShortcut";

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
