import { describe, expect, test } from "vitest";
import { resolveLoginPanelLayout } from "@/lib/loginPanelLayout";

describe("resolveLoginPanelLayout", () => {
  test("shows create account and dev quick login in local sqlite dev", () => {
    const layout = resolveLoginPanelLayout(true, true);
    expect(layout.primaryMode).toBe("create-account");
    expect(layout.requireSetupToken).toBe(false);
    expect(layout.showDevQuickLogin).toBe(true);
    expect(layout.showTokenPaste).toBe(false);
  });

  test("shows sign in and token paste in production", () => {
    const layout = resolveLoginPanelLayout(false, false);
    expect(layout.primaryMode).toBe("sign-in");
    expect(layout.showDevQuickLogin).toBe(false);
    expect(layout.showTokenPaste).toBe(true);
  });

  test("requires the access token inside create account when not dev sqlite", () => {
    const layout = resolveLoginPanelLayout(true, false);
    expect(layout.primaryMode).toBe("create-account");
    expect(layout.requireSetupToken).toBe(true);
    expect(layout.showDevQuickLogin).toBe(false);
    expect(layout.showTokenPaste).toBe(false);
  });

  test("shows sign in with dev quick login after setup in local dev", () => {
    const layout = resolveLoginPanelLayout(false, true);
    expect(layout.primaryMode).toBe("sign-in");
    expect(layout.showDevQuickLogin).toBe(true);
    expect(layout.showTokenPaste).toBe(false);
  });
});
