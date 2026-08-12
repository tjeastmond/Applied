/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { defaultAnalyticsFilters, type AnalyticsFilters as AnalyticsFilterState } from "@/lib/analytics";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function setInputValue(input: HTMLInputElement, value: string) {
  Object.defineProperty(input, "value", { configurable: true, value, writable: true });
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function renderFilters(filters: AnalyticsFilterState, onDateChange = vi.fn(), onRangeChange = vi.fn()) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      React.createElement(AnalyticsFilters, {
        companies: ["Acme"],
        filters,
        onRangeChange,
        onCompaniesChange: vi.fn(),
        onStatusesChange: vi.fn(),
        onDateChange,
        onClearFilters: vi.fn(),
      }),
    );
  });

  return { container, onDateChange, onRangeChange };
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("AnalyticsFilters", () => {
  it("renders the shared filters and calendar icon without an archived control", () => {
    const rendered = renderFilters(defaultAnalyticsFilters());

    expect(rendered.container.querySelector(".lucide-calendar")).not.toBeNull();
    expect(rendered.container.querySelector("select")).toBeNull();
    expect(rendered.container.textContent).toContain("Filter By Company");
    expect(rendered.container.textContent).toContain("Filter By Status");
    expect(rendered.container.textContent).not.toContain("Include Archived");
  });

  it("uses the shared filter trigger visuals without press motion", () => {
    const rendered = renderFilters(defaultAnalyticsFilters());
    const rangeTrigger = rendered.container.querySelector<HTMLButtonElement>('button[aria-label="Date Range"]');
    const companyTrigger = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Filter By Company"),
    );
    const statusTrigger = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Filter By Status"),
    );

    expect(rangeTrigger).not.toBeNull();
    expect(companyTrigger).not.toBeNull();
    expect(statusTrigger).not.toBeNull();
    for (const trigger of [rangeTrigger, companyTrigger, statusTrigger]) {
      for (const className of [
        "cursor-pointer",
        "h-8",
        "rounded-lg",
        "border-border",
        "hover:bg-muted",
        "active:transform-none",
      ]) {
        expect(trigger?.classList.contains(className)).toBe(true);
      }
      expect(trigger?.classList.contains("active:translate-y-px")).toBe(false);
    }

    expect(rangeTrigger?.getAttribute("aria-expanded")).toBe("false");
    expect(rangeTrigger?.querySelector(".lucide-chevron-down")?.classList.contains("transition-transform")).toBe(true);
  });

  it("blurs a custom date input after a valid selection", () => {
    const onDateChange = vi.fn();
    const rendered = renderFilters(
      {
        ...defaultAnalyticsFilters(),
        range: "custom",
        from: "2026-08-10",
      },
      onDateChange,
    );
    const [fromInput] = rendered.container.querySelectorAll<HTMLInputElement>('input[type="date"]');

    fromInput.focus();
    act(() => {
      setInputValue(fromInput, "2026-08-11");
    });
    expect(onDateChange).toHaveBeenCalledWith("from", "2026-08-11");
    expect(document.activeElement).not.toBe(fromInput);
  });
});
