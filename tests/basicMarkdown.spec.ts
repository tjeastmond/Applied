import { describe, expect, it } from "vitest";
import { parseBasicMarkdown, parseInlineMarkdown } from "@/lib/basicMarkdown";

describe("parseInlineMarkdown", () => {
  it("returns plain text unchanged", () => {
    expect(parseInlineMarkdown("Follow up Friday")).toEqual([{ type: "text", value: "Follow up Friday" }]);
  });

  it("parses bold, italic, and inline code", () => {
    expect(parseInlineMarkdown("**bold** and *italic* with `code`")).toEqual([
      { type: "bold", children: [{ type: "text", value: "bold" }] },
      { type: "text", value: " and " },
      { type: "italic", children: [{ type: "text", value: "italic" }] },
      { type: "text", value: " with " },
      { type: "code", value: "code" },
    ]);
  });

  it("parses markdown links with http(s) hrefs", () => {
    expect(parseInlineMarkdown("See [Example](https://example.com)")).toEqual([
      { type: "text", value: "See " },
      { type: "link", href: "https://example.com", label: "Example" },
    ]);
  });

  it("leaves unsafe markdown links as plain text", () => {
    expect(parseInlineMarkdown("[Click me](javascript:alert)")).toEqual([
      { type: "text", value: "[Click me](javascript:alert)" },
    ]);
  });

  it("linkifies bare https URLs", () => {
    expect(parseInlineMarkdown("https://www.linkedin.com/in/jinglee/")).toEqual([
      { type: "link", href: "https://www.linkedin.com/in/jinglee/", label: "https://www.linkedin.com/in/jinglee/" },
    ]);
  });

  it("leaves trailing sentence punctuation outside autolinks", () => {
    expect(parseInlineMarkdown("See https://example.com/path.")).toEqual([
      { type: "text", value: "See " },
      { type: "link", href: "https://example.com/path", label: "https://example.com/path" },
      { type: "text", value: "." },
    ]);
  });
});

describe("parseBasicMarkdown", () => {
  it("parses a single paragraph", () => {
    expect(parseBasicMarkdown("Line one\nLine two")).toEqual([{ type: "paragraph", text: "Line one\nLine two" }]);
  });

  it("parses blank-line-separated paragraphs", () => {
    expect(parseBasicMarkdown("First paragraph\n\nSecond paragraph")).toEqual([
      { type: "paragraph", text: "First paragraph" },
      { type: "paragraph", text: "Second paragraph" },
    ]);
  });

  it("parses unordered lists", () => {
    expect(parseBasicMarkdown("- First item\n- Second item")).toEqual([
      { type: "unordered-list", items: ["First item", "Second item"] },
    ]);
  });

  it("parses ordered lists", () => {
    expect(parseBasicMarkdown("1. First item\n2. Second item")).toEqual([
      { type: "ordered-list", items: ["First item", "Second item"] },
    ]);
  });

  it("parses headings", () => {
    expect(parseBasicMarkdown("### Part 1: Debugging")).toEqual([
      { type: "heading", level: 3, text: "Part 1: Debugging" },
    ]);
  });

  it("parses headings followed by list items", () => {
    expect(parseBasicMarkdown("### Part 1\n- First item\n- Second item\n### Part 2\n- Third item")).toEqual([
      { type: "heading", level: 3, text: "Part 1" },
      { type: "unordered-list", items: ["First item", "Second item"] },
      { type: "heading", level: 3, text: "Part 2" },
      { type: "unordered-list", items: ["Third item"] },
    ]);
  });
});
