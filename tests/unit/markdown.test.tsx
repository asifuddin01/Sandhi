import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Prose } from "@/components/Prose";

async function renderMarkdown(markdown: string): Promise<string> {
  return renderToStaticMarkup(await Prose({ children: markdown }));
}

describe("Prose", () => {
  it("drops embedded HTML and unsafe URL protocols", async () => {
    const html = await renderMarkdown(
      '<script>alert("xss")</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1))',
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });

  it("retains math source classes through sanitation and renders KaTeX", async () => {
    const html = await renderMarkdown("The relation is $a^2 + b^2 = c^2$.");

    expect(html).toContain('class="katex"');
    expect(html).toContain("<math");
    expect(html).toContain("a^2 + b^2 = c^2");
  });

  it("supports GFM and server-side syntax highlighting", async () => {
    const html = await renderMarkdown(
      "| Item | State |\n| --- | --- |\n| Test | Done |\n\n```ts\nconst safe = true\n```",
    );

    expect(html).toContain("<table>");
    expect(html).toContain('data-language="ts"');
    expect(html).toContain("--shiki-dark");
  });
});
