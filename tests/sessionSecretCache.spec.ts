import { beforeEach, describe, expect, test, vi } from "vitest";

const getCredentialById = vi.fn();
const repo = { getCredentialById };
vi.mock("@/lib/server/db", () => ({ getUserRepository: () => repo }));

import { signSessionCookie } from "@/lib/appAccessAuth";
import {
  buildSessionCookieHeader,
  clearSessionSecretCache,
  getSessionSecret,
  verifySessionWithFreshRetry,
} from "@/lib/server/sessionSecret";

describe("getSessionSecret cache", () => {
  beforeEach(() => {
    getCredentialById.mockReset().mockResolvedValue({ passwordHash: "h1" });
    clearSessionSecretCache();
  });

  test("reads the repository once within the TTL", async () => {
    expect(await getSessionSecret("tok")).toBe("tok:h1");
    expect(await getSessionSecret("tok")).toBe("tok:h1");
    expect(getCredentialById).toHaveBeenCalledTimes(1);
  });

  test("an in-flight read that finishes after a clear is not cached", async () => {
    let resolveStale!: (v: { passwordHash: string }) => void;
    getCredentialById.mockReturnValueOnce(new Promise((r) => (resolveStale = r)));
    const stale = getSessionSecret("tok");
    clearSessionSecretCache();
    resolveStale({ passwordHash: "old" });
    expect(await stale).toBe("tok:old");
    expect(await getSessionSecret("tok")).toBe("tok:h1");
    expect(getCredentialById).toHaveBeenCalledTimes(2);
  });

  test("signing a cookie reads fresh even when the cache is warm", async () => {
    await getSessionSecret("tok");
    getCredentialById.mockResolvedValue({ passwordHash: "h2" });
    await buildSessionCookieHeader("tok");
    expect(getCredentialById).toHaveBeenCalledTimes(2);
    expect(await getSessionSecret("tok")).toBe("tok:h2");
    expect(getCredentialById).toHaveBeenCalledTimes(2);
  });

  test("a cookie signed with a newer hash is accepted via one fresh read", async () => {
    await getSessionSecret("tok");
    getCredentialById.mockResolvedValue({ passwordHash: "h2" });
    const cookie = await signSessionCookie("tok:h2", Date.now() + 60_000);
    expect(await verifySessionWithFreshRetry("tok", cookie)).toBe(true);
    expect(getCredentialById).toHaveBeenCalledTimes(2);
  });

  test("a cookie signed with an unknown hash is rejected", async () => {
    await getSessionSecret("tok");
    const cookie = await signSessionCookie("tok:other", Date.now() + 60_000);
    expect(await verifySessionWithFreshRetry("tok", cookie)).toBe(false);
  });

  test("clear forces a fresh read", async () => {
    await getSessionSecret("tok");
    getCredentialById.mockResolvedValue({ passwordHash: "h2" });
    clearSessionSecretCache();
    expect(await getSessionSecret("tok")).toBe("tok:h2");
    expect(getCredentialById).toHaveBeenCalledTimes(2);
  });
});
