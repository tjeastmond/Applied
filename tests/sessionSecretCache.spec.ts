import { beforeEach, describe, expect, test, vi } from "vitest";

const getCredentialById = vi.fn();
const repo = { getCredentialById };
vi.mock("@/lib/server/db", () => ({ getUserRepository: () => repo }));

import { clearSessionSecretCache, getSessionSecret } from "@/lib/server/sessionSecret";

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

  test("clear forces a fresh read", async () => {
    await getSessionSecret("tok");
    getCredentialById.mockResolvedValue({ passwordHash: "h2" });
    clearSessionSecretCache();
    expect(await getSessionSecret("tok")).toBe("tok:h2");
    expect(getCredentialById).toHaveBeenCalledTimes(2);
  });
});
