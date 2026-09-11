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

  it("removes unsafe tags nested inside a disallowed wrapper", () => {
    // Regression: stripDisallowedTags used to unwrap a disallowed element
    // (e.g. <div>/<section>) by lifting its children to the parent without
    // re-sanitizing them first, letting nested <script>/<iframe>/attributes
    // survive.
    const withScript = sanitizeStoredHtml("<div><script>alert(1)</script></div>");
    expect(withScript ?? "").not.toContain("script");

    const withIframe = sanitizeStoredHtml('<div><iframe src="https://evil.test"></iframe></div>');
    expect(withIframe ?? "").not.toContain("iframe");

    const withEventHandler = sanitizeStoredHtml('<section><div><img src="x" onerror="alert(1)"></div></section>');
    expect(withEventHandler ?? "").not.toContain("img");
    expect(withEventHandler ?? "").not.toContain("onerror");

    const withAttrsOnAllowedTag = sanitizeStoredHtml('<section><p onclick="alert(1)">Hi</p></section>');
    expect(withAttrsOnAllowedTag).toBe("<p>Hi</p>");
  });
});
