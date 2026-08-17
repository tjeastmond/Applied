import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as appAccessAuthModule from "@/lib/appAccessAuth";
import * as appAccessTokenModule from "@/lib/server/appAccessToken";
import * as dbModule from "@/lib/server/db";
import { resetDatabaseBackend } from "@/lib/server/db";
import { issueAppSessionResponse } from "@/lib/server/issueAppSession";

describe("issueAppSessionResponse", () => {
  beforeEach(() => {
    delete process.env.APP_ACCESS_TOKEN;
    resetDatabaseBackend();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.APP_ACCESS_TOKEN;
    resetDatabaseBackend();
  });

  test("returns 503 when no app access token can be configured", async () => {
    vi.spyOn(appAccessTokenModule, "ensureAppAccessTokenHydrated").mockImplementation(() => undefined);
    vi.spyOn(appAccessAuthModule, "getAppAccessToken").mockReturnValue(undefined);
    vi.spyOn(dbModule, "getAppAccessConfigRepository").mockReturnValue(null);

    const response = await issueAppSessionResponse("password", "/api/auth/password-login");
    expect(response.status).toBe(503);
  });
});
