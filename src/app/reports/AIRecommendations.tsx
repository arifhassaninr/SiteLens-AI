"use client";

import type { ReactNode } from "react";

type Block =
  | { type: "bullet"; text: string }
  | { type: "step"; number: number; title: string; details: string[] }
  | { type: "paragraph"; text: string };
type Section = { title: string; blocks: Block[] };

// Gemini usually returns Markdown. Parse the small subset it uses for audit reports,
// and render with React elements (never untrusted HTML / dangerouslySetInnerHTML).
function parseSections(markdown: string): Section[] {
  const result: Section[] = [];
  let current: Section = { title: "Overview", blocks: [] };
  let lastStep: Extract<Block, { type: "step" }> | null = null;
  const flush = () => {
    if (current.blocks.length > 0) result.push(current);
  };

  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\t/g, "  ");
    const text = line.trim();
    if (!text) { lastStep = null; continue; }
    const heading = /^#{1,6}\s+(.+)$/.exec(text);
    if (heading) {
      flush();
      current = { title: heading[1].trim().replace(/\*\*/g, ""), blocks: [] };
      lastStep = null;
      continue;
    }
    const step = /^(\d{1,2})[.)]\s+(.+)$/.exec(text);
    if (step) {
      const item: Extract<Block, { type: "step" }> = {
        type: "step", number: Number(step[1]), title: step[2], details: [],
      };
      current.blocks.push(item);
      lastStep = item;
      continue;
    }
    const bullet = /^[-*+]\s+(.+)$/.exec(text);
    if (bullet) {
      // A bullet nested below a numbered step describes how to complete it.
      if (lastStep && line.match(/^\s+/)) lastStep.details.push(bullet[1]);
      else current.blocks.push({ type: "bullet", text: bullet[1] });
      continue;
    }
    if (lastStep && /^\s{2,}/.test(line)) {
      lastStep.details.push(text);
      continue;
    }
    lastStep = null;
    const previous = current.blocks[current.blocks.length - 1];
    // Join wrapped prose lines; don't merge lines from distinct list entries.
    if (previous?.type === "paragraph") previous.text += ` ${text}`;
    else current.blocks.push({ type: "paragraph", text });
  }
  flush();
  return result.length ? result : [{ title: "Analysis", blocks: [{ type: "paragraph", text: markdown }] }];
}

function stripInlineMarkdown(s: string) {
  return s.trim().replace(/^\*\*(.+)\*\*$/, "$1");
}

function richText(value: string): ReactNode[] {
  // Keep generated text safe: React escapes everything. No HTML injection or URL embedding.
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}

function kindFor(title: string): "evidence" | "plan" | "causes" | "general" {
  if (/measured|evidence|metric|lighthouse (data|scores)/i.test(title)) return "evidence";
  if (/action plan|prioriti|next steps|implementation|fixes/i.test(title)) return "plan";
  if (/cause|issue|diagnos|observation/i.test(title)) return "causes";
  return "general";
}

export default function AIRecommendations({ markdown, onCopy }: { markdown: string; onCopy?: () => void }) {
  const sections = parseSections(markdown);
  return (
    <div className="ai-report-view" aria-label="AI audit recommendations">
      <div className="ai-report-header">
        <div>
          <span className="ai-report-eyebrow"><span className="ai-status-dot" /> AI ANALYSIS READY</span>
          <h3>Website improvement roadmap</h3>
          <p>Findings from your Lighthouse audit, organized into practical next steps.</p>
        </div>
        {onCopy && <button className="ai-copy-button" onClick={onCopy} type="button">Copy AI plan ↗</button>}
      </div>

      <div className="ai-report-sections">
        {sections.map((section, sectionIndex) => {
          const kind = kindFor(section.title);
          const evidence = kind === "evidence";
          return (
            <section className={`ai-report-section ai-kind-${kind}`} key={`${section.title}-${sectionIndex}`}>
              <div className="ai-section-title">
                <span className="ai-section-index">{String(sectionIndex + 1).padStart(2, "0")}</span>
                <h4>{section.title}</h4>
              </div>
              <div className={evidence ? "ai-evidence-grid" : "ai-section-body"}>
                {section.blocks.map((block, i) => {
                  if (block.type === "step") {
                    return <article className="ai-step-card" key={i}>
                      <span className="ai-step-num">{String(block.number).padStart(2, "0")}</span>
                      <div className="ai-step-info">
                        <h5>{richText(stripInlineMarkdown(block.title))}</h5>
                        {block.details.length > 0 && <ul>{block.details.map((detail, j) => <li key={j}>{richText(detail)}</li>)}</ul>}
                      </div>
                    </article>;
                  }
                  if (evidence && block.type === "bullet") {
                    const match = /^(?:\*\*)?([^*]+?:)(?:\*\*)?\s*(.+)$/.exec(block.text);
                    if (match) return <div key={i} className="ai-evidence-item">
                      <span>{stripInlineMarkdown(match[1].replace(/:$/, ""))}</span>
                      <b>{richText(match[2])}</b>
                    </div>;
                  }
                  if (block.type === "bullet") {
                    return <div className="ai-observation" key={i}><span className="ai-observation-bullet" aria-hidden="true" />
                      <p>{richText(block.text)}</p></div>;
                  }
                  return <p className={evidence ? "ai-evidence-note" : "ai-paragraph"} key={i}>
                    {richText(block.text)}
                  </p>;
                })}
              </div>
            </section>
          );
        })}
      </div>
      <p className="ai-disclaimer">AI-generated guidance from Lighthouse data. Possible causes are hypotheses, not confirmed code-level findings. Re-test after changes.</p>
    </div>
  );
}
