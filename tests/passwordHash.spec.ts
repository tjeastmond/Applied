import { describe, expect, test } from "vitest";
import { hashPassword, runDummyPasswordVerify, verifyPassword } from "@/lib/server/passwordHash";

describe("passwordHash", () => {
  test("hashes and verifies passwords", async () => {
    const encoded = hashPassword("correcthorse123");
    expect(encoded.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword("correcthorse123", encoded)).resolves.toBe(true);
    await expect(verifyPassword("wrongpassword1", encoded)).resolves.toBe(false);
  });

  test("dummy password verify completes without throwing", async () => {
    await expect(runDummyPasswordVerify("any-password-value")).resolves.toBeUndefined();
  });
});
