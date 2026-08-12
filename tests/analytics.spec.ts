import { describe, expect, it } from "vitest";
import {
  ANALYTICS_PATH,
  analyticsFiltersToUrl,
  analyticsFiltersToSearchParams,
  analyticsRelativeBarScale,
  analyticsStatusesByActivity,
  analyticsVolumeLabelIndexes,
  defaultAnalyticsFilters,
  formatAnalyticsCompanyCount,
  formatAnalyticsCount,
  formatAnalyticsRate,
  formatAnalyticsVolumeTickLabel,
  isIncompleteAnalyticsDateRange,
  isAnalyticsRoute,
  isInvalidAnalyticsDateRange,
  parseAnalyticsFilters,
  toggleAnalyticsStatusFromPane,
} from "@/lib/analytics";

describe("analytics filters", () => {
  it("uses the analytics defaults for an empty query", () => {
    expect(parseAnalyticsFilters(new URLSearchParams())).toEqual(defaultAnalyticsFilters());
    expect(analyticsFiltersToSearchParams(defaultAnalyticsFilters()).toString()).toBe("");
  });

  it("parses repeated filters and archived exclusion", () => {
    const filters = parseAnalyticsFilters(
      new URLSearchParams("range=6m&company=Acme&company=Beta&status=interviewing&status=offer&archived=0"),
    );

    expect(filters).toEqual({
      range: "6m",
      companies: ["Acme", "Beta"],
      statuses: ["interviewing", "offer"],
      includeArchived: false,
    });
    expect(analyticsFiltersToSearchParams(filters).getAll("company")).toEqual(["Acme", "Beta"]);
    expect(analyticsFiltersToSearchParams(filters).getAll("status")).toEqual(["interviewing", "offer"]);
    expect(analyticsFiltersToUrl(filters)).toBe(
      "/analytics?range=6m&company=Acme&company=Beta&status=interviewing&status=offer&archived=0",
    );
  });

  it("keeps valid custom dates and detects reversed ranges", () => {
    const filters = parseAnalyticsFilters(new URLSearchParams("range=custom&from=2026-08-12&to=2026-08-01"));

    expect(filters.from).toBe("2026-08-12");
    expect(filters.to).toBe("2026-08-01");
    expect(isInvalidAnalyticsDateRange(filters)).toBe(true);
    expect(isIncompleteAnalyticsDateRange(filters)).toBe(false);
  });

  it("waits for both custom dates before requesting analytics", () => {
    const filters = parseAnalyticsFilters(new URLSearchParams("range=custom&from=2026-08-01"));

    expect(isIncompleteAnalyticsDateRange(filters)).toBe(true);
    expect(isInvalidAnalyticsDateRange(filters)).toBe(false);
  });

  it("drops unknown filters and dates outside custom range mode", () => {
    expect(
      parseAnalyticsFilters(
        new URLSearchParams("range=unexpected&status=unknown&company=%20&from=2026-01-01&to=2026-02-01"),
      ),
    ).toEqual(defaultAnalyticsFilters());
  });

  it("selects an unselected status, then deselects it", () => {
    const selected = toggleAnalyticsStatusFromPane([], "interviewing");

    expect(selected).toEqual(["interviewing"]);
    expect(toggleAnalyticsStatusFromPane(selected, "interviewing")).toEqual([]);
  });

  it("removes only the activated status when multiple statuses are selected", () => {
    expect(toggleAnalyticsStatusFromPane(["applied", "interviewing", "offer"], "interviewing")).toEqual([
      "applied",
      "offer",
    ]);
  });

  it("keeps pane single-select behavior when activating an unselected status", () => {
    expect(toggleAnalyticsStatusFromPane(["applied", "offer"], "waiting")).toEqual(["waiting"]);
  });

  it("serializes a cleared status filter without empty params while preserving other filters", () => {
    const filters = parseAnalyticsFilters(new URLSearchParams("range=6m&company=Acme&status=offer&archived=0"));
    const statuses = toggleAnalyticsStatusFromPane(filters.statuses, "offer");

    expect(analyticsFiltersToUrl({ ...filters, statuses })).toBe("/analytics?range=6m&company=Acme&archived=0");
  });
});

describe("analytics presentation helpers", () => {
  it("recognizes only the dedicated analytics route", () => {
    expect(ANALYTICS_PATH).toBe("/analytics");
    expect(isAnalyticsRoute("/analytics")).toBe(true);
    expect(isAnalyticsRoute("/analytics/other")).toBe(false);
    expect(isAnalyticsRoute("/")).toBe(false);
  });

  it("formats KPI values and nulls", () => {
    expect(formatAnalyticsCount(1234)).toBe("1,234");
    expect(formatAnalyticsCount(null)).toBe("—");
    expect(formatAnalyticsRate(12.5)).toBe("12.5%");
    expect(formatAnalyticsRate(25)).toBe("25%");
    expect(formatAnalyticsRate(null)).toBe("—");
  });

  it("formats stable company-count header copy", () => {
    expect(formatAnalyticsCompanyCount(0)).toBe("0 companies");
    expect(formatAnalyticsCompanyCount(1)).toBe("1 company");
    expect(formatAnalyticsCompanyCount(1234)).toBe("1,234 companies");
  });

  it("sorts statuses by activity and uses label order for ties", () => {
    const sortedStatuses = analyticsStatusesByActivity([
      { status: "waiting", count: 2, percentage: 20 },
      { status: "offer", count: 4, percentage: 40 },
      { status: "applied", count: 4, percentage: 40 },
    ]);

    expect(sortedStatuses.map((option) => option.label)).toEqual([
      "Applied",
      "Offer",
      "Waiting",
      "Interviewing",
      "No Response",
      "Passed",
      "Rejected",
      "To Apply",
    ]);
  });

  it("calculates bounded status bar scales with a visible nonzero minimum", () => {
    expect(analyticsRelativeBarScale(0, 10)).toBe(0);
    expect(analyticsRelativeBarScale(1, 100)).toBe(0.03);
    expect(analyticsRelativeBarScale(5, 10)).toBe(0.5);
    expect(analyticsRelativeBarScale(10, 10)).toBe(1);
    expect(analyticsRelativeBarScale(20, 10)).toBe(1);
  });

  it("limits volume labels without dropping daily buckets", () => {
    expect([...analyticsVolumeLabelIndexes(30)]).toEqual([0, 6, 12, 17, 23, 29]);
    expect([...analyticsVolumeLabelIndexes(13)]).toEqual([0, 2, 5, 7, 10, 12]);
    expect([...analyticsVolumeLabelIndexes(4)]).toEqual([0, 1, 2, 3]);
  });

  it("formats daily volume ticks as collision-safe short dates", () => {
    expect(formatAnalyticsVolumeTickLabel("2026-07-14")).toBe("Jul 14");
    expect(formatAnalyticsVolumeTickLabel("2026-08-01")).toBe("Aug 1");
    expect(formatAnalyticsVolumeTickLabel("not-a-date")).toBe("not-a-date");
  });
});
