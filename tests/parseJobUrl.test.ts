import { describe, expect, it, vi, afterEach } from "vitest";
import { parseJobUrl } from "@/lib/server/services/parseJobUrl";

const sampleHtml = `<!doctype html>
<html>
  <head>
    <meta property="og:title" content="Senior Engineer" />
    <meta property="og:site_name" content="Acme Corp" />
    <meta property="og:description" content="Build great things with our team every day." />
    <title>Fallback Title</title>
  </head>
  <body>
    <div class="job-description">
      <p>Build great things with our team every day. Own critical services and collaborate across teams.</p>
      <ul><li>TypeScript</li><li>Distributed systems</li></ul>
    </div>
  </body>
</html>`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseJobUrl", () => {
  it("extracts metadata and full_jd from HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(sampleHtml, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      ),
    );

    const result = await parseJobUrl("https://jobs.example.com/posting");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.title).toBe("Senior Engineer");
    expect(result.company).toBe("Acme Corp");
    expect(result.fullJd).toContain("<strong>Summary</strong>");
    expect(result.fullJd).toContain("<li>TypeScript</li>");
  });

  it("returns an error for invalid URLs", async () => {
    const result = await parseJobUrl("not-a-url");
    expect(result).toEqual({ ok: false, error: "Invalid URL" });
  });

  it("returns an error for non-HTML responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const result = await parseJobUrl("https://jobs.example.com/posting");
    expect(result).toEqual({ ok: false, error: "Response is not HTML" });
  });

  it("falls back to title tag and hostname", async () => {
    const html = `<!doctype html><html><head><title>Fallback Title</title></head><body></body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const result = await parseJobUrl("https://careers.stripe.com/jobs/123");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.title).toBe("Fallback Title");
    expect(result.company).toBe("Stripe");
    expect(result.fullJd).toBeNull();
  });

  it("strips the Y Combinator suffix from parsed titles", async () => {
    const html = `<!doctype html><html><head><meta property="og:title" content="Founding Engineer | Y Combinator" /></head><body></body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const result = await parseJobUrl("https://www.ycombinator.com/companies/acme/jobs/abc");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.title).toBe("Founding Engineer");
  });
});
