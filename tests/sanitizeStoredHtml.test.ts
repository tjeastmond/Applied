import { describe, expect, it } from "vitest";
import { sanitizeStoredHtml } from "@/lib/server/services/extractFullJd";

describe("sanitizeStoredHtml", () => {
  it("removes scripts and unsafe tags while keeping allowed markup", () => {
    const html = sanitizeStoredHtml(
      '<p>Role summary</p><script>alert("xss")</script><iframe src="https://evil.test"></iframe><p><strong>Need</strong> TypeScript</p>',
    );

    expect(html).toContain("<p>Role summary</p>");
    expect(html).toContain("<strong>Need</strong>");
    expect(html).not.toContain("script");
    expect(html).not.toContain("iframe");
  });
});
