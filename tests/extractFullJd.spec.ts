import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildFullJd } from "@/lib/server/services/extractFullJd";

describe("buildFullJd", () => {
  it("builds summary and minimal HTML from job description content", () => {
    const html = `<!doctype html><html><body>
      <div class="job-description">
        <h2>About the role</h2>
        <p>We are looking for a senior engineer to lead platform work. You will mentor teammates and ship reliable systems.</p>
        <ul><li>5+ years experience</li><li>Strong TypeScript skills</li></ul>
        <script>alert("x")</script>
      </div>
    </body></html>`;
    const { document } = parseHTML(html);
    const result = buildFullJd(document, null);

    expect(result).toContain("<strong>Summary</strong>");
    expect(result).toContain("<h2>About the role</h2>");
    expect(result).toContain("<li>5+ years experience</li>");
    expect(result).not.toContain("<script>");
  });

  it("ignores stylesheet text from style tags when measuring body content", () => {
    const css = "body{margin:0;}".repeat(20_000);
    const html = `<!doctype html><html><body>
      <style>${css}</style>
      <div class="job-description">
        <p>We are hiring a platform engineer to design reliable APIs and mentor teammates on best practices.</p>
      </div>
    </body></html>`;
    const { document } = parseHTML(html);
    const result = buildFullJd(document, null);

    expect(result).toContain("platform engineer");
    expect(result?.length ?? 0).toBeLessThan(10_000);
    expect(result).not.toContain("margin:0");
  });

  it("falls back to meta description when body content is sparse", () => {
    const html = `<!doctype html><html><body><h1>Title only</h1></body></html>`;
    const { document } = parseHTML(html);
    const result = buildFullJd(document, "Build great products with a talented team every day.");

    expect(result).toContain("Build great products");
  });
});
