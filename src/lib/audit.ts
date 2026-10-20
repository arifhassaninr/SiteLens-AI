export type Strategy = "mobile" | "desktop";
export type ScoreKey = "performance" | "accessibility" | "bestPractices" | "seo";
export type Scores = Record<ScoreKey, number | null>;
export type MetricKey = "fcp" | "lcp" | "cls" | "tbt" | "si";
export type Metrics = Record<MetricKey, string | null>;
export type Recommendation = {
  id: string;
  title: string;
  description: string;
  savings: string | null;
  priority: "high" | "medium";
};
export type AuditResult = {
  url: string;
  finalUrl: string;
  strategy: Strategy;
  scores: Scores;
  metrics: Metrics;
  recommendations: Recommendation[];
  auditedAt: string;
  isDemo: boolean;
};

// This data is illustrative only. It is NEVER represented as a real website scan.
export const SAMPLE_RESULT: AuditResult = {
  url: "https://example.com",
  finalUrl: "https://example.com",
  strategy: "mobile",
  scores: { performance: 74, accessibility: 91, bestPractices: 88, seo: 97 },
  metrics: { fcp: "1.4 s", lcp: "2.6 s", cls: "0.09", tbt: "140 ms", si: "2.1 s" },
  recommendations: [
    { id: "demo-1", title: "Reduce unused JavaScript", description: "Remove code that isn't needed on the initial page and defer noncritical bundles.", savings: "Potential improvement", priority: "high" },
    { id: "demo-2", title: "Serve modern, properly sized images", description: "Use responsive dimensions and efficient formats like WebP or AVIF where supported.", savings: "Potential improvement", priority: "high" },
    { id: "demo-3", title: "Eliminate render-blocking resources", description: "Consider inlining critical styles and delaying scripts that are not essential above the fold.", savings: "Potential improvement", priority: "medium" },
  ],
  auditedAt: "",
  isDemo: true,
};

export function grade(score: number | null): "good" | "needs-work" | "poor" | "unknown" {
  if (score === null) return "unknown";
  return score >= 90 ? "good" : score >= 50 ? "needs-work" : "poor";
}

export function makeReportText(result: AuditResult): string {
  const { scores, metrics } = result;
  const fmt = (n: number | null) => (n === null ? "N/A" : `${n}/100`);
  return [
    `SiteLens — ${result.isDemo ? "DEMO EXAMPLE" : "Lighthouse Audit"}`,
    `Website: ${result.finalUrl}`,
    `Device: ${result.strategy}`,
    `Performance: ${fmt(scores.performance)}`,
    `Accessibility: ${fmt(scores.accessibility)}`,
    `Best practices: ${fmt(scores.bestPractices)}`,
    `SEO: ${fmt(scores.seo)}`,
    `FCP: ${metrics.fcp ?? "N/A"} | LCP: ${metrics.lcp ?? "N/A"} | CLS: ${metrics.cls ?? "N/A"}`,
    "Recommendations:",
    ...(result.recommendations.length
      ? result.recommendations.map((x, i) => `${i + 1}. ${x.title}`)
      : ["No applicable suggestions returned by Lighthouse."]),
    result.isDemo ? "Illustrative sample only — no site was scanned." : `Audited: ${new Date(result.auditedAt).toLocaleString()}`,
  ].join("\n");
}
