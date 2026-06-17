import { describe, expect, test } from "vitest";
import { resolveAgentTokenSource } from "@/lib/agentTokenLimits";

describe("resolveAgentTokenSource", () => {
  test("returns none when neither env nor database tokens are configured", () => {
    expect(resolveAgentTokenSource(false, false)).toBe("none");
  });

  test("returns env when only env token is configured", () => {
    expect(resolveAgentTokenSource(true, false)).toBe("env");
  });

  test("returns database when only DB tokens are configured", () => {
    expect(resolveAgentTokenSource(false, true)).toBe("database");
  });

  test("returns both when env and DB tokens are configured", () => {
    expect(resolveAgentTokenSource(true, true)).toBe("both");
  });
});
