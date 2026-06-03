import { describe, expect, it } from "vitest";
import { splitTextWithUrls } from "@/lib/linkifyText";

describe("splitTextWithUrls", () => {
  it("returns plain text unchanged", () => {
    expect(splitTextWithUrls("Follow up Friday")).toEqual([{ type: "text", value: "Follow up Friday" }]);
  });

  it("linkifies a standalone https URL", () => {
    expect(splitTextWithUrls("https://www.linkedin.com/in/jinglee/")).toEqual([
      { type: "link", href: "https://www.linkedin.com/in/jinglee/", label: "https://www.linkedin.com/in/jinglee/" },
    ]);
  });

  it("linkifies URLs embedded in note text", () => {
    expect(
      splitTextWithUrls("Heard about this role from Jing Lee: https://www.linkedin.com/in/jinglee/"),
    ).toEqual([
      { type: "text", value: "Heard about this role from Jing Lee: " },
      { type: "link", href: "https://www.linkedin.com/in/jinglee/", label: "https://www.linkedin.com/in/jinglee/" },
    ]);
  });

  it("leaves trailing sentence punctuation outside the link", () => {
    expect(splitTextWithUrls("See https://example.com/path.")).toEqual([
      { type: "text", value: "See " },
      { type: "link", href: "https://example.com/path", label: "https://example.com/path" },
      { type: "text", value: "." },
    ]);
  });

  it("does not linkify non-http schemes", () => {
    expect(splitTextWithUrls("javascript:alert(1)")).toEqual([
      { type: "text", value: "javascript:alert(1)" },
    ]);
  });
});
