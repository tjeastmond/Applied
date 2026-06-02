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
});
