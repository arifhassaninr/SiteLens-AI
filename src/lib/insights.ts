import type { AuditResult } from "@/lib/audit";
export function explainAudit(r: AuditResult): string[] {
 const items: string[] = [];
 if (r.scores.performance !== null && r.scores.performance < 90) items.push("Performance can be improved. Start with the highest-priority Lighthouse opportunities and verify with a new audit after each change.");
 if (r.scores.accessibility !== null && r.scores.accessibility < 90) items.push("Review accessibility failures. Check keyboard navigation, image alternatives, labels, and contrast; then test with assistive technology.");
 if (r.scores.seo !== null && r.scores.seo < 90) items.push("Review crawlability, page titles, meta descriptions, and semantic page structure.");
 if (r.scores.bestPractices !== null && r.scores.bestPractices < 90) items.push("Review browser console issues, third-party dependencies, and security best practices.");
 for (const rec of r.recommendations.slice(0,4)) items.push(`${rec.title}: ${rec.description}`);
 return items.length ? items : ["All reported categories look strong. Check the detailed opportunities and remember that lab scores can vary between runs."];
}
