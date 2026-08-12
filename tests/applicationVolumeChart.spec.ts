import React from "react";
import { parseHTML } from "linkedom";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ApplicationVolumeChart,
  applicationVolumeBarWidthClass,
  DENSE_VOLUME_BAR_WIDTH_CLASS,
  SPARSE_VOLUME_BAR_WIDTH_CLASS,
} from "@/components/analytics/ApplicationVolumeChart";

function dailyVolume(bucketCount: number) {
  return Array.from({ length: bucketCount }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return {
      bucketStart: `2026-07-${day}`,
      bucketEnd: `2026-07-${day}`,
      label: `Jul ${index + 1}`,
      count: index === bucketCount - 1 ? 2 : 0,
    };
  });
}

function weeklyVolume(bucketCount: number) {
  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(Date.UTC(2026, 3, 6 + index * 7));
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setUTCDate(bucketEnd.getUTCDate() + 6);

    return {
      bucketStart: bucketStart.toISOString().slice(0, 10),
      bucketEnd: bucketEnd.toISOString().slice(0, 10),
      label: `Week ${index + 1}`,
      count: index === bucketCount - 1 ? 2 : 0,
    };
  });
}

describe("ApplicationVolumeChart", () => {
  it("uses skinny bars for dense daily buckets and chunky bars for sparse cadences", () => {
    expect(applicationVolumeBarWidthClass(dailyVolume(30))).toBe(DENSE_VOLUME_BAR_WIDTH_CLASS);
    expect(applicationVolumeBarWidthClass(dailyVolume(14))).toBe(SPARSE_VOLUME_BAR_WIDTH_CLASS);
    expect(applicationVolumeBarWidthClass(weeklyVolume(14))).toBe(SPARSE_VOLUME_BAR_WIDTH_CLASS);
    expect(
      applicationVolumeBarWidthClass([
        {
          bucketStart: "2026-07-01",
          bucketEnd: "2026-07-31",
          label: "Jul 2026",
          count: 2,
        },
      ]),
    ).toBe(SPARSE_VOLUME_BAR_WIDTH_CLASS);
  });

  it("renders accessible bucket controls and a screen-reader-only data table without a disclosure", () => {
    const markup = renderToStaticMarkup(React.createElement(ApplicationVolumeChart, { volume: dailyVolume(30) }));
    const { document } = parseHTML(markup);
    const plot = document.querySelector<HTMLElement>('[data-testid="application-volume-plot"]');
    const bucketButtons = document.querySelectorAll('button[aria-label$="applications"]');
    const visibleBar = document.querySelector<HTMLElement>("[data-volume-bar][style]");
    const ticks = document.querySelectorAll<HTMLElement>("[data-volume-tick]");
    const dataTable = document.querySelector("table");
    const dataRows = dataTable?.querySelectorAll("tbody tr");

    expect(plot?.classList.contains("h-56")).toBe(true);
    expect(plot?.classList.contains("sm:h-64")).toBe(true);
    expect(plot?.style.gridTemplateColumns).toBe("repeat(30, minmax(0, 1fr))");
    expect(plot?.style.columnGap).toBe("clamp(1px, 0.45vw, 4px)");
    expect(bucketButtons).toHaveLength(30);
    expect(plot?.children).toHaveLength(30);
    expect(Array.from(plot?.children ?? []).every((element) => element.tagName === "BUTTON")).toBe(true);
    expect(Array.from(bucketButtons).every((button) => button.classList.contains("w-full"))).toBe(true);
    expect(Array.from(bucketButtons).every((button) => button.classList.contains("min-w-0"))).toBe(true);
    expect(visibleBar?.style.height).toBe("100%");
    expect(visibleBar?.getAttribute("style")).not.toContain("transform");
    expect(visibleBar?.classList.contains(DENSE_VOLUME_BAR_WIDTH_CLASS)).toBe(true);
    expect(ticks).toHaveLength(6);
    expect(ticks[0]?.textContent).toBe("Jul 1");
    expect(ticks[5]?.textContent).toBe("Jul 30");
    expect(ticks[0]?.style.left).toBe("0%");
    expect(ticks[5]?.style.left).toBe("100%");
    expect(Array.from(ticks).every((tick) => tick.classList.contains("whitespace-nowrap"))).toBe(true);
    expect(Array.from(ticks).filter((tick) => tick.classList.contains("hidden"))).toHaveLength(2);
    expect(dataTable?.classList.contains("sr-only")).toBe(true);
    expect(dataTable?.classList.contains("table-fixed")).toBe(true);
    expect(dataTable?.querySelector("caption")?.textContent).toBe("Application volume data");
    expect(dataRows).toHaveLength(30);
    expect(dataRows?.[29]?.textContent).toContain("Jul 30");
    expect(dataRows?.[29]?.textContent).toContain("2026-07-30");
    expect(dataRows?.[29]?.textContent).toContain("2");
    expect(markup).not.toContain("View Data");
    expect(markup).not.toContain("Hide Data");
    expect(markup).not.toMatch(/overflow-(?:auto|scroll|x-auto|y-auto)/);
    expect(markup).not.toContain("overflow-x-auto");
    expect(markup).not.toContain("min-w-8");
  });
});
