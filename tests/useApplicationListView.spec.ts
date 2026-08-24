/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useApplicationListView } from "@/hooks/useApplicationListView";
import { INCLUDE_ARCHIVED_STORAGE_KEY } from "@/lib/applicationArchive";
import {
  clearPendingCompanyFilter,
  peekPendingCompanyFilter,
  type ApplicationListViewSnapshot,
} from "@/lib/applicationListView";
import type { AppView } from "@/lib/appView";
import type { ApplicationStatus, JobApplication } from "@/types";
import { makeJobApplication } from "./fixtures/jobApplication";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const applications: JobApplication[] = [
  makeJobApplication({ id: "to-apply", company: "Numeral", status: "to_apply", archived: false }),
  makeJobApplication({ id: "archived", company: "Numeral", status: "passed", archived: true }),
  makeJobApplication({ id: "other", company: "Beta", status: "applied", archived: false }),
];

type ListViewApi = ReturnType<typeof useApplicationListView>;

let latest: ListViewApi | undefined;
let root: Root | undefined;
let container: HTMLDivElement | undefined;

function Probe({ routeAppView }: { routeAppView: AppView }) {
  latest = useApplicationListView({
    applications,
    initialPageSize: 10,
    initialPageSizeFromPreference: true,
    routeAppView,
  });
  return null;
}

function renderListView(routeAppView: AppView) {
  if (!container) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  }
  act(() => {
    root?.render(React.createElement(Probe, { routeAppView }));
  });
}

function visibleIds(snapshot: ApplicationListViewSnapshot) {
  return snapshot.filteredApplications.map((application) => application.id);
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = undefined;
  container?.remove();
  container = undefined;
  latest = undefined;
  clearPendingCompanyFilter();
  window.localStorage.removeItem(INCLUDE_ARCHIVED_STORAGE_KEY);
});

describe("useApplicationListView company click from To Apply", () => {
  it("shows active and archived roles after leaving To Apply", () => {
    renderListView("toApply");
    expect(visibleIds(latest!.snapshot)).toEqual(["to-apply"]);

    act(() => {
      latest!.handleCompanyFilter("Numeral");
      latest!.queuePendingCompanyFilterForNavigation("Numeral");
    });
    expect(visibleIds(latest!.snapshot)).toEqual(["to-apply", "archived"]);

    renderListView("applications");

    expect(latest!.toApplyOnly).toBe(false);
    expect(latest!.includeArchived).toBe(true);
    expect([...latest!.selectedCompanies]).toEqual(["Numeral"]);
    expect(latest!.selectedStatuses.size).toBe(0);
    expect(visibleIds(latest!.snapshot)).toEqual(["to-apply", "archived"]);
  });

  it("still includes archived roles if the list remounts on To Apply before home loads", () => {
    renderListView("toApply");
    act(() => {
      latest!.handleCompanyFilter("Numeral");
      latest!.queuePendingCompanyFilterForNavigation("Numeral");
    });
    expect(peekPendingCompanyFilter()).toBe("Numeral");

    act(() => {
      root?.unmount();
    });
    root = undefined;
    container?.remove();
    container = undefined;
    latest = undefined;

    renderListView("toApply");
    expect(peekPendingCompanyFilter()).toBe("Numeral");

    renderListView("applications");
    expect(latest!.includeArchived).toBe(true);
    expect([...latest!.selectedCompanies]).toEqual(["Numeral"]);
    expect(visibleIds(latest!.snapshot)).toEqual(["to-apply", "archived"]);
  });

  it("clears status filters when applying a company from To Apply", () => {
    renderListView("toApply");
    act(() => {
      latest!.setSelectedStatuses(new Set<ApplicationStatus>(["to_apply"]));
      latest!.handleCompanyFilter("Numeral");
      latest!.queuePendingCompanyFilterForNavigation("Numeral");
    });

    renderListView("applications");
    expect(latest!.selectedStatuses.size).toBe(0);
    expect(visibleIds(latest!.snapshot)).toEqual(["to-apply", "archived"]);
  });
});
