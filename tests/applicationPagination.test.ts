import { describe, expect, it } from "vitest";
import {
  APPLICATION_VIEW_ALL_PAGE_SIZE,
  applicationPageSizeTriggerLabel,
  clampPage,
  formatApplicationPageRange,
  paginateItems,
  parseApplicationPageSize,
} from "../src/lib/applicationPagination";

describe("applicationPagination", () => {
  it("clamps page to valid bounds", () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(3, 5)).toBe(3);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(2, 0)).toBe(1);
  });

  it("paginates items with correct ranges", () => {
    const items = Array.from({ length: 25 }, (_, index) => index + 1);

    expect(paginateItems(items, 1, 10)).toMatchObject({
      items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      page: 1,
      totalPages: 3,
      rangeStart: 1,
      rangeEnd: 10,
      totalCount: 25,
    });

    expect(paginateItems(items, 3, 10)).toMatchObject({
      items: [21, 22, 23, 24, 25],
      page: 3,
      rangeStart: 21,
      rangeEnd: 25,
    });

    expect(paginateItems(items, 99, 10)).toMatchObject({
      page: 3,
      rangeStart: 21,
      rangeEnd: 25,
    });
  });

  it("formats page ranges", () => {
    expect(formatApplicationPageRange(0, 0, 0)).toBe("No applications");
    expect(formatApplicationPageRange(1, 1, 1)).toBe("1 of 1");
    expect(formatApplicationPageRange(1, 10, 42)).toBe("1–10 of 42");
  });

  it("parses stored page size values", () => {
    expect(parseApplicationPageSize("5")).toBe(5);
    expect(parseApplicationPageSize("all")).toBe(APPLICATION_VIEW_ALL_PAGE_SIZE);
    expect(parseApplicationPageSize("10")).toBe(10);
    expect(parseApplicationPageSize("invalid")).toBeNull();
    expect(parseApplicationPageSize(undefined)).toBeNull();
  });

  it("supports five per page and view all", () => {
    const items = Array.from({ length: 12 }, (_, index) => index + 1);

    expect(paginateItems(items, 1, 5)).toMatchObject({
      items: [1, 2, 3, 4, 5],
      totalPages: 3,
      rangeStart: 1,
      rangeEnd: 5,
    });

    expect(paginateItems(items, 2, APPLICATION_VIEW_ALL_PAGE_SIZE)).toMatchObject({
      items,
      page: 1,
      totalPages: 1,
      rangeStart: 1,
      rangeEnd: 12,
    });

    expect(applicationPageSizeTriggerLabel(APPLICATION_VIEW_ALL_PAGE_SIZE)).toBe("View all");
    expect(applicationPageSizeTriggerLabel(5)).toBe("5 per page");
  });
});
