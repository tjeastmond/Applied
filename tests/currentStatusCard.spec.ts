import React from "react";
import { parseHTML } from "linkedom";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CurrentStatusCard } from "@/components/analytics/CurrentStatusCard";
import type { ApplicationStatus } from "@/types";

describe("CurrentStatusCard", () => {
  it("renders every statistic in shared count, separator, and percentage columns", () => {
    const markup = renderToStaticMarkup(
      React.createElement(CurrentStatusCard, {
        status: [
          { status: "applied", count: 113, percentage: 49.8 },
          { status: "passed", count: 57, percentage: 25.1 },
          { status: "rejected", count: 50, percentage: 22 },
          { status: "to_apply", count: 6, percentage: 2.6 },
          { status: "interviewing", count: 1, percentage: 0.4 },
        ],
        selectedStatuses: new Set<ApplicationStatus>(),
        onStatusSelect: () => undefined,
      }),
    );
    const { document } = parseHTML(markup);
    const rows = document.querySelectorAll("li > button");
    const statistics = document.querySelectorAll<HTMLElement>("[data-status-statistics]");

    expect(rows).toHaveLength(8);
    expect(
      Array.from(rows).every((row) => row.classList.contains("grid-cols-[minmax(6.5rem,auto)_minmax(0,1fr)_12ch]")),
    ).toBe(true);
    expect(statistics).toHaveLength(8);
    expect(
      Array.from(statistics).every(
        (item) =>
          item.classList.contains("w-[12ch]") &&
          item.classList.contains("grid-cols-[minmax(3ch,1fr)_1ch_6ch]") &&
          item.classList.contains("whitespace-nowrap") &&
          item.classList.contains("tabular-nums"),
      ),
    ).toBe(true);
    expect(Array.from(statistics).every((item) => item.children.length === 3)).toBe(true);
    expect(
      Array.from(document.querySelectorAll("[data-status-count]")).every((item) =>
        item.classList.contains("text-right"),
      ),
    ).toBe(true);
    expect(
      Array.from(document.querySelectorAll("[data-status-separator]")).every((item) =>
        item.classList.contains("text-center"),
      ),
    ).toBe(true);
    expect(
      Array.from(document.querySelectorAll("[data-status-percentage]")).every((item) =>
        item.classList.contains("text-right"),
      ),
    ).toBe(true);
  });
});
