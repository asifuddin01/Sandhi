import { MarkdownAsync } from "react-markdown";

import { safeMarkdownOptions } from "@/lib/markdown";

export interface ProseProps {
  children: string;
  className?: string;
}

/** Render sanitized Markdown entirely on the server, including async Shiki. */
export async function Prose({ children, className }: ProseProps) {
  const content = await MarkdownAsync({
    ...safeMarkdownOptions,
    children,
  });

  return (
    <div className={["prose", className].filter(Boolean).join(" ")}>
      {content}
    </div>
  );
}

export default Prose;
