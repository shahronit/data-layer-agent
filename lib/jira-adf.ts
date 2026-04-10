/** Minimal Atlassian Document Format for Jira Cloud issue descriptions. */

export type AdfDoc = {
  type: "doc";
  version: 1;
  content: AdfBlock[];
};

type AdfBlock = {
  type: "paragraph";
  content: AdfInline[];
};

type AdfInline = { type: "text"; text: string } | { type: "hardBreak" };

function paragraphFromLines(text: string): AdfBlock {
  const lines = text.split("\n");
  const content: AdfInline[] = [];
  lines.forEach((line, i) => {
    if (i > 0) content.push({ type: "hardBreak" });
    content.push({ type: "text", text: line || " " });
  });
  return { type: "paragraph", content };
}

/** Split on blank lines into paragraphs; lines within a block keep hard breaks. */
export function plainTextToAdf(plain: string): AdfDoc {
  const blocks = plain
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => paragraphFromLines(p));

  if (blocks.length === 0) {
    return { type: "doc", version: 1, content: [paragraphFromLines(" ")] };
  }

  return { type: "doc", version: 1, content: blocks };
}
