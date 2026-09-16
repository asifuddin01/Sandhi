import type { Options as ReactMarkdownOptions } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

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
