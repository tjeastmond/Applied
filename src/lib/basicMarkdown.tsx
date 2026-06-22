import { Fragment, type ReactNode } from "react";
import { isProbablyHttpUrl } from "@/lib/applicationForm";
import { splitTextWithUrls } from "@/lib/linkifyText";
import { cn } from "@/lib/utils";

export type MarkdownBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] };

export type InlineMarkdownNode =
  | { type: "text"; value: string }
  | { type: "bold"; children: InlineMarkdownNode[] }
  | { type: "italic"; children: InlineMarkdownNode[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; label: string };

const HEADING = /^(#{1,6})\s+(.+)$/;
const UNORDERED_LIST_ITEM = /^[-*]\s+(.+)$/;
const ORDERED_LIST_ITEM = /^\d+\.\s+(.+)$/;

const HEADING_CLASS: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: "text-base font-semibold tracking-tight",
  2: "text-sm font-semibold tracking-tight",
  3: "text-sm font-semibold",
  4: "text-sm font-medium",
  5: "text-sm font-medium",
  6: "text-sm font-medium",
};

function sanitizeMarkdownHref(raw: string): string | null {
  const href = raw.trim();
  return isProbablyHttpUrl(href) ? href : null;
}

function parseInlineSegment(segment: string): InlineMarkdownNode[] {
  const nodes: InlineMarkdownNode[] = [];
  const pattern =
    /(`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\n]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_)/g;

  let lastIndex = 0;
  for (const match of segment.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      nodes.push(...splitTextWithUrls(segment.slice(lastIndex, start)).map(linkifySegmentToNode));
    }

    if (match[1]?.startsWith("`")) {
      nodes.push({ type: "code", value: match[2] ?? "" });
    } else if (match[3] !== undefined && match[4] !== undefined) {
      const href = sanitizeMarkdownHref(match[4]);
      if (href) {
        nodes.push({ type: "link", href, label: match[3] });
      } else {
        nodes.push({ type: "text", value: match[0] });
      }
    } else if (match[5] !== undefined) {
      nodes.push({ type: "bold", children: parseInlineSegment(match[5]) });
    } else if (match[6] !== undefined) {
      nodes.push({ type: "bold", children: parseInlineSegment(match[6]) });
    } else if (match[7] !== undefined) {
      nodes.push({ type: "italic", children: parseInlineSegment(match[7]) });
    } else if (match[8] !== undefined) {
      nodes.push({ type: "italic", children: parseInlineSegment(match[8]) });
    } else {
      nodes.push({ type: "text", value: match[0] });
    }

    lastIndex = start + match[0].length;
  }

  if (lastIndex < segment.length) {
    nodes.push(...splitTextWithUrls(segment.slice(lastIndex)).map(linkifySegmentToNode));
  }

  return nodes.length > 0 ? nodes : [{ type: "text", value: segment }];
}

function linkifySegmentToNode(segment: ReturnType<typeof splitTextWithUrls>[number]): InlineMarkdownNode {
  if (segment.type === "link") {
    return { type: "link", href: segment.href, label: segment.label };
  }
  return { type: "text", value: segment.value };
}

export function parseInlineMarkdown(text: string): InlineMarkdownNode[] {
  return parseInlineSegment(text);
}

export function parseBasicMarkdown(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = content.split("\n");
  let paragraphLines: string[] = [];
  let index = 0;

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
    paragraphLines = [];
  }

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (line.trim() === "") {
      flushParagraph();
      index += 1;
      continue;
    }

    const headingMatch = line.match(HEADING);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        text: headingMatch[2],
      });
      index += 1;
      continue;
    }

    if (UNORDERED_LIST_ITEM.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && UNORDERED_LIST_ITEM.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(UNORDERED_LIST_ITEM, "$1"));
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (ORDERED_LIST_ITEM.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && ORDERED_LIST_ITEM.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(ORDERED_LIST_ITEM, "$1"));
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    paragraphLines.push(line);
    index += 1;
  }

  flushParagraph();
  return blocks;
}

function renderLink(href: string, label: string, key: number): ReactNode {
  return (
    <a
      key={key}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      className="inline-block max-w-full truncate align-bottom text-blue-600 dark:text-blue-400"
    >
      {label}
    </a>
  );
}

function renderInlineNodes(nodes: InlineMarkdownNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (node.type) {
      case "text":
        return (
          <Fragment key={key}>
            <span className="break-words">{node.value}</span>
          </Fragment>
        );
      case "bold":
        return (
          <strong key={key} className="font-semibold">
            {renderInlineNodes(node.children, key)}
          </strong>
        );
      case "italic":
        return <em key={key}>{renderInlineNodes(node.children, key)}</em>;
      case "code":
        return (
          <code
            key={key}
            className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em] break-words whitespace-pre-wrap"
          >
            {node.value}
          </code>
        );
      case "link":
        return renderLink(node.href, node.label, index);
      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  });
}

function renderHeading(level: 1 | 2 | 3 | 4 | 5 | 6, text: string, key: string): ReactNode {
  const className = HEADING_CLASS[level];
  const children = renderInlineNodes(parseInlineMarkdown(text), key);

  switch (level) {
    case 1:
      return <h1 className={className}>{children}</h1>;
    case 2:
      return <h2 className={className}>{children}</h2>;
    case 3:
      return <h3 className={className}>{children}</h3>;
    case 4:
      return <h4 className={className}>{children}</h4>;
    case 5:
      return <h5 className={className}>{children}</h5>;
    case 6:
      return <h6 className={className}>{children}</h6>;
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

export function renderBasicMarkdown(content: string): ReactNode {
  const blocks = parseBasicMarkdown(content);

  if (blocks.length === 0) {
    return null;
  }

  return blocks.map((block, index) => {
    const key = `block-${index}`;
    const hasPriorHeading = blocks.slice(0, index).some((priorBlock) => priorBlock.type === "heading");

    let blockContent: ReactNode;

    switch (block.type) {
      case "paragraph":
        blockContent = (
          <p className="max-w-full min-w-0 overflow-hidden break-words whitespace-pre-wrap">
            {renderInlineNodes(parseInlineMarkdown(block.text), key)}
          </p>
        );
        break;
      case "heading":
        blockContent = renderHeading(block.level, block.text, key);
        break;
      case "unordered-list":
        blockContent = (
          <ul className="list-disc space-y-1 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={`${key}-${itemIndex}`} className="break-words">
                {renderInlineNodes(parseInlineMarkdown(item), `${key}-${itemIndex}`)}
              </li>
            ))}
          </ul>
        );
        break;
      case "ordered-list":
        blockContent = (
          <ol className="list-decimal space-y-1 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={`${key}-${itemIndex}`} className="break-words">
                {renderInlineNodes(parseInlineMarkdown(item), `${key}-${itemIndex}`)}
              </li>
            ))}
          </ol>
        );
        break;
      default: {
        const _exhaustive: never = block;
        blockContent = _exhaustive;
      }
    }

    return (
      <div key={key} className={cn(block.type === "heading" && hasPriorHeading && "pt-4")}>
        {blockContent}
      </div>
    );
  });
}
