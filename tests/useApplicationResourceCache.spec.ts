/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useApplicationResourceCache } from "@/hooks/useApplicationResourceCache";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let cache: ReturnType<typeof useApplicationResourceCache<string>>;
function mount(load: (id: string) => Promise<string[]>, initialEntries = {}) {
  function Probe() {
    cache = useApplicationResourceCache({ load, initialEntries, errorMessage: "Failed" });
    return null;
  }
  root = createRoot(document.createElement("div"));
  act(() => root.render(React.createElement(Probe)));
}
afterEach(() => act(() => root.unmount()));

it("uses seeded entries and deduplicates concurrent requests", async () => {
  let resolve!: (items: string[]) => void;
  const load = vi.fn(
    () =>
      new Promise<string[]>((done) => {
        resolve = done;
      }),
  );
  mount(load, { seeded: ["existing"] });
  await act(() => cache.prefetch("seeded"));
  expect(load).not.toHaveBeenCalled();
  let pending!: Promise<void>;
  act(() => {
    pending = cache.prefetch("new");
    expect(cache.prefetch("new")).toBe(pending);
  });
  expect(cache.isLoading("new")).toBe(true);
  await act(async () => {
    resolve(["loaded"]);
    await pending;
  });
  expect(cache.getEntries("new")).toEqual(["loaded"]);
  expect(cache.isLoading("new")).toBe(false);
  await act(() => cache.prefetch("new"));
  expect(load).toHaveBeenCalledTimes(1);
  act(() => cache.removeApplication("new"));
  expect(cache.getEntries("new")).toBeUndefined();
  act(() => cache.clearAll());
  expect(cache.entries).toEqual({});
});

it("allows explicit retry after a failed prefetch", async () => {
  const load = vi
    .fn<(id: string) => Promise<string[]>>()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce(["retried"]);
  mount(load);
  await act(() => cache.prefetch("a"));
  expect(cache.getEntries("a")).toEqual([]);
  expect(cache.isLoading("a")).toBe(false);
  await act(() => cache.refetch("a"));
  expect(cache.getEntries("a")).toEqual(["retried"]);
});
