/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  canHandleApplicationCardNavigation,
  cardNavigationKeyFromEvent,
  resolveNextCardId,
  stepCardIndex,
} from "@/lib/applicationCardNavigation";

describe("stepCardIndex", () => {
  it("returns -1 for empty lists", () => {
    expect(stepCardIndex(-1, "down", 0)).toBe(-1);
  });

  it("starts at the first card on down when nothing is selected", () => {
    expect(stepCardIndex(-1, "down", 3)).toBe(0);
  });

  it("does not move up when nothing is selected", () => {
    expect(stepCardIndex(-1, "up", 3)).toBe(-1);
  });

  it("does not wrap at list edges", () => {
    expect(stepCardIndex(0, "up", 3)).toBe(0);
    expect(stepCardIndex(2, "down", 3)).toBe(2);
  });

  it("moves one step within the list", () => {
    expect(stepCardIndex(1, "down", 3)).toBe(2);
    expect(stepCardIndex(1, "up", 3)).toBe(0);
  });
});

describe("resolveNextCardId", () => {
  const ids = ["a", "b", "c"];

  it("returns null for empty visible lists", () => {
    expect(resolveNextCardId([], null, "down")).toBeNull();
  });

  it("selects the first card on down when current id is missing", () => {
    expect(resolveNextCardId(ids, null, "down")).toBe("a");
    expect(resolveNextCardId(ids, null, "up")).toBeNull();
  });

  it("starts from an active hover seed when keyboard highlight is inactive", () => {
    expect(resolveNextCardId(ids, null, "down", "b")).toBe("c");
    expect(resolveNextCardId(ids, null, "up", "b")).toBe("a");
    expect(resolveNextCardId(ids, null, "up", "a")).toBe("a");
    expect(resolveNextCardId(ids, null, "down", "c")).toBe("c");
  });

  it("starts from the first card when hover seed was cleared", () => {
    expect(resolveNextCardId(ids, null, "down", null)).toBe("a");
    expect(resolveNextCardId(ids, null, "up", null)).toBeNull();
  });

  it("prefers keyboard highlight over hover seed", () => {
    expect(resolveNextCardId(ids, "a", "down", "c")).toBe("b");
  });

  it("ignores stale ids that are no longer visible", () => {
    expect(resolveNextCardId(ids, "missing", "down")).toBe("a");
  });

  it("returns adjacent visible ids", () => {
    expect(resolveNextCardId(ids, "b", "down")).toBe("c");
    expect(resolveNextCardId(ids, "b", "up")).toBe("a");
  });

  it("does not wrap at visible list edges", () => {
    expect(resolveNextCardId(ids, "a", "up")).toBe("a");
    expect(resolveNextCardId(ids, "c", "down")).toBe("c");
  });
});

describe("cardNavigationKeyFromEvent", () => {
  it("maps arrow and enter keys", () => {
    expect(cardNavigationKeyFromEvent({ key: "ArrowDown" })).toBe("down");
    expect(cardNavigationKeyFromEvent({ key: "ArrowUp" })).toBe("up");
    expect(cardNavigationKeyFromEvent({ key: "Enter" })).toBe("enter");
  });

  it("returns null for unrelated keys", () => {
    expect(cardNavigationKeyFromEvent({ key: "Escape" })).toBeNull();
    expect(cardNavigationKeyFromEvent({ key: "/" })).toBeNull();
  });
});

describe("canHandleApplicationCardNavigation", () => {
  const base = {
    formOpen: false,
    detailOpen: false,
    pendingDeleteId: null,
    visibleCardCount: 2,
    target: document.body,
  };

  it("allows navigation on the list page", () => {
    expect(canHandleApplicationCardNavigation(base)).toBe(true);
  });

  it("blocks when overlays are open or the list is empty", () => {
    expect(canHandleApplicationCardNavigation({ ...base, formOpen: true })).toBe(false);
    expect(canHandleApplicationCardNavigation({ ...base, detailOpen: true })).toBe(false);
    expect(canHandleApplicationCardNavigation({ ...base, pendingDeleteId: "x" })).toBe(false);
    expect(canHandleApplicationCardNavigation({ ...base, visibleCardCount: 0 })).toBe(false);
  });

  it("blocks when focus is in an editable field", () => {
    const input = document.createElement("input");
    expect(canHandleApplicationCardNavigation({ ...base, target: input })).toBe(false);
  });
});
