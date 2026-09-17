import type { Options as ReactMarkdownOptions } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function textContent(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textContent).join("");
}

export function markdownHeadingId(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return slug || "section";
}

/** Add stable anchors to prose headings for an adjacent table of contents. */
function rehypeHeadingIds() {
  return (tree: HastNode) => {
    const occurrences = new Map<string, number>();

    function visit(node: HastNode): void {
      if (node.tagName === "h2" || node.tagName === "h3") {
        const base = markdownHeadingId(textContent(node));
        const occurrence = (occurrences.get(base) ?? 0) + 1;
        occurrences.set(base, occurrence);
        node.properties = {
          ...node.properties,
          id: occurrence === 1 ? base : `${base}-${occurrence}`,
        };
      }

      node.children?.forEach(visit);
    }

    visit(tree);
  };
}

/** Treat an image title as its visible figure caption. */
function rehypeFigureCaptions() {
  return (tree: HastNode) => {
    function visit(node: HastNode): void {
      node.children = node.children?.map((child) => {
        if (child.tagName !== "p") {
          visit(child);
          return child;
        }

        const meaningful = (child.children ?? []).filter(
          (item) => item.type !== "text" || Boolean(item.value?.trim()),
        );
        const image = meaningful.length === 1 ? meaningful[0] : undefined;
        const title =
          image?.tagName === "img" && typeof image.properties?.title === "string"
            ? image.properties.title.trim()
            : "";

        if (!image || !title) return child;

        image.properties = { ...image.properties, title: undefined };
        return {
          type: "element",
          tagName: "figure",
          properties: {},
          children: [
            image,
            {
              type: "element",
              tagName: "figcaption",
              properties: {},
              children: [{ type: "text", value: title }],
            },
          ],
        };
      });
    }

    visit(tree);
  };
}

/**
 * Sanitize untrusted Markdown before trusted renderers expand math and code.
 *
 * KaTeX's own security guidance recommends this ordering: allow only the
 * source classes it consumes, sanitize, then let KaTeX create its MathML.
 * This avoids allowing arbitrary inline styles merely to preserve KaTeX.
 */
export const markdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", /^language-./, "math-inline", "math-display"],
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ["className", "math", "math-display"],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", "math", "math-inline"],
    ],
  },
};

/** Shared, server-safe options for every rendered Markdown surface. */
export const safeMarkdownOptions = {
  skipHtml: true,
  remarkPlugins: [remarkGfm, remarkMath],
  rehypePlugins: [
    [rehypeSanitize, markdownSanitizeSchema],
    rehypeHeadingIds,
    rehypeFigureCaptions,
    rehypeKatex,
    [
      rehypePrettyCode,
      {
        theme: {
          dark: "github-dark-default",
          light: "github-light-default",
        },
        keepBackground: false,
      },
    ],
  ],
} satisfies Omit<ReactMarkdownOptions, "children">;
