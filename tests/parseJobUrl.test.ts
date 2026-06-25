import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import type { LookupAddress, LookupAllOptions } from "node:dns";
import { lookup } from "node:dns/promises";
import { parseJobUrl } from "@/lib/server/services/parseJobUrl";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

const mockedLookup = vi.mocked(lookup);

function mockDnsLookup(address: string): void {
  mockedLookup.mockImplementation(((_hostname: string, options?: LookupAllOptions) => {
    const record: LookupAddress = { address, family: 4 };
    if (options?.all) {
      return Promise.resolve([record]);
    }
    return Promise.resolve(record);
  }) as typeof lookup);
}

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
  mockDnsLookup("93.184.216.34");
});

describe("parseJobUrl", () => {
  beforeEach(() => {
    mockDnsLookup("93.184.216.34");
  });

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
    expect(result.salaryRange).toBeNull();
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

  it("returns parsed titles without stripping board suffixes", async () => {
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
    expect(result.title).toBe("Founding Engineer | Y Combinator");
  });

  it("extracts salaryRange from Work at a Startup embedded job data", async () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="Software Engineer at MindFort | Y Combinator's Work at a Startup" />
    </head><body>
      &quot;id&quot;:84795,&quot;title&quot;:&quot;Software Engineer &quot;,&quot;salaryRange&quot;:&quot;$150K - $250K&quot;
    </body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const result = await parseJobUrl("https://www.workatastartup.com/jobs/84795");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.salaryRange).toBe("$150K - $250K");
  });

  it("extracts salaryRange from JSON-LD baseSalary", async () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">{
        "@type": "JobPosting",
        "title": "Security Engineer, Cloud",
        "hiringOrganization": { "@type": "Organization", "name": "Ramp" },
        "baseSalary": {
          "@type": "MonetaryAmount",
          "currency": "USD",
          "value": {
            "@type": "QuantitativeValue",
            "minValue": 211400,
            "maxValue": 290600,
            "unitText": "YEAR"
          }
        }
      }</script>
    </head><body></body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const result = await parseJobUrl("https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.salaryRange).toBe("$211K–$291K");
  });

  it("returns Work at a Startup titles without normalization", async () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="Software Engineer  at MindFort | Y Combinator's Work at a Startup" />
    </head><body></body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const result = await parseJobUrl("https://www.workatastartup.com/jobs/84795");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.title).toBe("Software Engineer  at MindFort | Y Combinator's Work at a Startup");
  });

  it("extracts the hiring company from Y Combinator job pages", async () => {
    const html = `<!doctype html><html><head>
      <meta property="og:site_name" content="Y Combinator" />
      <meta name="title" content="Backend Engineer (Remote) at Fathom" />
      <meta property="og:title" content="Backend Engineer (Remote) at Fathom | Y Combinator" />
      <title>Backend Engineer (Remote) at Fathom | Y Combinator</title>
      <script type="application/ld+json">{
        "@type": "JobPosting",
        "hiringOrganization": { "@type": "Organization", "name": "Fathom" }
      }</script>
    </head><body></body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const result = await parseJobUrl(
      "https://www.ycombinator.com/companies/fathom/jobs/Pg8RFWC-backend-engineer-remote",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.company).toBe("Fathom");
  });

  it("falls back to the YC company slug when metadata is sparse", async () => {
    const html = `<!doctype html><html><head>
      <meta property="og:site_name" content="Y Combinator" />
      <meta property="og:title" content="Founding Engineer | Y Combinator" />
    </head><body></body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const result = await parseJobUrl("https://www.ycombinator.com/companies/acme-corp/jobs/abc");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.company).toBe("Acme Corp");
  });

  it("extracts the hiring company from Ashby job pages", async () => {
    const html = `<!doctype html><html><head>
      <meta name="title" content="Security Engineer, Cloud @ Ramp" />
      <meta property="og:title" content="Security Engineer, Cloud" />
      <script type="application/ld+json">{
        "@type": "JobPosting",
        "hiringOrganization": { "@type": "Organization", "name": "Ramp" }
      }</script>
    </head><body></body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const result = await parseJobUrl("https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.company).toBe("Ramp");
  });

  it("extracts title and company from Paraform /share/ job pages", async () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="Staff Engineer at Ramp" />
      <script id="__NEXT_DATA__" type="application/json">{
        "props": {
          "pageProps": {
            "initialRoleData": {
              "name": "Staff Engineer",
              "company": { "name": "Ramp" }
            }
          }
        }
      }</script>
    </head><body>
      <div class="-mb-1 font-normal text-neutral-700">Ramp</div>
      <div class="mt-1 text-2xl font-book">Staff Engineer</div>
    </body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const result = await parseJobUrl("https://www.paraform.com/share/ramp/cm123abc");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.title).toBe("Staff Engineer");
    expect(result.company).toBe("Ramp");
  });

  it("extracts title and company from Paraform /company/ job pages", async () => {
    const html = `<!doctype html><html><head>
      <title>Security Engineer at Acme Corp</title>
      <meta property="og:title" content="Acme Corp" />
      <script id="__NEXT_DATA__" type="application/json">{
        "props": {
          "pageProps": {
            "page_title": "Security Engineer at Acme Corp",
            "company_name": "Acme Corp",
            "baseRole": { "name": "Security Engineer" },
            "baseCompany": { "name": "Acme Corp" }
          }
        }
      }</script>
      <script type="application/ld+json">{
        "@type": "JobPosting",
        "title": "Security Engineer",
        "hiringOrganization": { "name": "Acme Corp" }
      }</script>
    </head><body></body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const result = await parseJobUrl("https://www.paraform.com/company/acme-corp/cm123abc");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.title).toBe("Security Engineer");
    expect(result.company).toBe("Acme Corp");
  });

  it("blocks loopback IP literals without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await parseJobUrl("http://127.0.0.1/job");

    expect(result).toEqual({
      ok: false,
      error: "URL resolves to a private or restricted address",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks hostnames resolving to link-local addresses", async () => {
    mockDnsLookup("169.254.169.254");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await parseJobUrl("http://metadata.example/latest");

    expect(result).toEqual({
      ok: false,
      error: "URL resolves to a private or restricted address",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
