import { describe, expect, it } from "vitest";
import { sanitizeHttpUrl, sanitizePlainText } from "@/lib/sanitize";

describe("sanitizePlainText", () => {
  it("strips control characters and HTML", () => {
    expect(sanitizePlainText("  Hello<script>alert(1)</script>  ")).toBe("Hello");
    expect(sanitizePlainText("A\u0000B")).toBe("AB");
  });
});

describe("sanitizeHttpUrl", () => {
  it("normalizes valid http and https URLs", () => {
    expect(sanitizeHttpUrl("https://jobs.example.com/role")).toBe("https://jobs.example.com/role");
  });

  it("rejects unsupported protocols", () => {
    expect(() => sanitizeHttpUrl("javascript:alert(1)")).toThrow("URL must use http or https");
  });
});
