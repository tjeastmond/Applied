import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { extractJobSalary } from "@/lib/server/services/extractJobSalary";

function parseDocument(html: string) {
  const { document } = parseHTML(html);
  return document;
}

describe("extractJobSalary", () => {
  it("formats JSON-LD baseSalary ranges", () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">{
        "@type": "JobPosting",
        "baseSalary": {
          "@type": "MonetaryAmount",
          "currency": "USD",
          "value": {
            "@type": "QuantitativeValue",
            "minValue": 190000,
            "maxValue": 240000,
            "unitText": "YEAR"
          }
        }
      }</script>
    </head><body></body></html>`;

    const salary = extractJobSalary(
      new URL("https://www.ycombinator.com/companies/fathom/jobs/abc"),
      parseDocument(html),
      html,
    );

    expect(salary).toEqual({ salaryRange: "$190K–$240K" });
  });

  it("reads salaryRange from embedded JSON scoped to a Work at a Startup job id", () => {
    const html = `<!doctype html><html><body>
      {"id":84795,"title":"Software Engineer","salaryRange":"$150K - $250K"}
      {"id":94337,"title":"Founding SDR","salaryRange":"$80K - $160K"}
    </body></html>`;

    const salary = extractJobSalary(
      new URL("https://www.workatastartup.com/jobs/84795"),
      parseDocument(html),
      html,
    );

    expect(salary).toEqual({ salaryRange: "$150K - $250K" });
  });

  it("reads HTML-escaped embedded salaryRange values", () => {
    const html = `<!doctype html><html><body>
      &quot;id&quot;:84795,&quot;salaryRange&quot;:&quot;$150K - $250K&quot;
    </body></html>`;

    const salary = extractJobSalary(
      new URL("https://www.workatastartup.com/jobs/84795"),
      parseDocument(html),
      html,
    );

    expect(salary).toEqual({ salaryRange: "$150K - $250K" });
  });

  it("falls back to labeled salary text in the page body", () => {
    const html = `<!doctype html><html><body>
      <p>Compensation Range: $160,000 - $200,000 per year</p>
    </body></html>`;

    const salary = extractJobSalary(new URL("https://jobs.example.com/role"), parseDocument(html), html);

    expect(salary).toEqual({ salaryRange: "$160,000 - $200,000 per year" });
  });

  it("returns null salaryRange when nothing is found", () => {
    const html = `<!doctype html><html><body><p>No compensation listed.</p></body></html>`;

    const salary = extractJobSalary(new URL("https://jobs.example.com/role"), parseDocument(html), html);

    expect(salary).toEqual({ salaryRange: null });
  });
});
