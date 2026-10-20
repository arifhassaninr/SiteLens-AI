"use client";

import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Copy,
  Download,
  Gauge,
  Globe2,
  Laptop,
  Lightbulb,
  LoaderCircle,
  Monitor,
  SearchCheck,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { saveCloudAudit } from "@/lib/cloud";
import {
  grade,
  makeReportText,
  SAMPLE_RESULT,
  type AuditResult,
  type MetricKey,
  type ScoreKey,
  type Strategy,
} from "@/lib/audit";

type ScoreConfig = { key: ScoreKey; label: string; hint: string };
const SCORE_ITEMS: ScoreConfig[] = [
  { key: "performance", label: "Performance", hint: "Page load experience" },
  { key: "accessibility", label: "Accessibility", hint: "Usable by more people" },
  { key: "bestPractices", label: "Best practices", hint: "Modern web standards" },
  { key: "seo", label: "SEO", hint: "Search discoverability" },
];
const METRIC_ITEMS: { key: MetricKey; label: string; full: string }[] = [
  { key: "fcp", label: "FCP", full: "First Contentful Paint" },
  { key: "lcp", label: "LCP", full: "Largest Contentful Paint" },
  { key: "cls", label: "CLS", full: "Cumulative Layout Shift" },
  { key: "tbt", label: "TBT", full: "Total Blocking Time" },
  { key: "si", label: "Speed index", full: "Speed Index" },
];

function ScoreRing({ value, main = false }: { value: number | null; main?: boolean }) {
  const state = grade(value);
  return (
    <div className={`score-ring ${state} ${main ? "score-ring-large" : ""}`} style={{ "--angle": `${(value ?? 0) * 3.6}deg` } as CSSProperties}>
      <div className="score-ring-core">
        <strong>{value ?? "—"}</strong>
        {main && <span>out of 100</span>}
      </div>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("mobile");
  const [result, setResult] = useState<AuditResult>(SAMPLE_RESULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  async function runAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, strategy }),
      });
      const json: AuditResult & { error?: string } = await response.json();
      if (!response.ok) throw new Error(json.error || "Audit failed. Please try again.");
      setResult(json);
      try {
        const existing = JSON.parse(localStorage.getItem("sitelens-audits") || "[]");
        localStorage.setItem("sitelens-audits", JSON.stringify([json, ...(Array.isArray(existing) ? existing : [])].slice(0, 25)));
        void saveCloudAudit(json).catch(() => {});
      } catch { /* Storage may be unavailable. */ }
      document.getElementById("report")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to run the audit.");
    } finally {
      setLoading(false);
    }
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(makeReportText(result));
      setCopied(true);
    } catch {
      setError("Could not copy automatically. Try selecting and copying the report manually.");
    }
  }

  return (
    <div className="site-shell">
      <div className="aurora aurora-one" aria-hidden="true" />
      <div className="aurora aurora-two" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="SiteLens home">
          <span className="brand-mark"><Activity size={21} strokeWidth={2.8} /></span>
          <span>site<span className="brand-accent">lens</span><span className="brand-dot">.</span></span>
        </a>
        <nav aria-label="Main navigation" className={`main-nav ${mobileMenu ? "main-nav-open" : ""}`}>
          <a href="#audit" onClick={() => setMobileMenu(false)}>Website audit</a>
          <a href="#report" onClick={() => setMobileMenu(false)}>Sample report</a>
          <a href="/dashboard" onClick={() => setMobileMenu(false)}>Dashboard</a><a href="/auth" onClick={() => setMobileMenu(false)}>Login</a><a href="/redesign" onClick={() => setMobileMenu(false)}>Before / After</a><a href="#how-it-works" onClick={() => setMobileMenu(false)}>How it works</a>
        </nav>
        <a className="nav-cta" href="#audit">Run free audit <ArrowUpRight size={16} /></a>
        <button className="mobile-menu-button" aria-label="Toggle navigation" aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}><span>☰</span></button>
      </header>

      <main id="top">
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot" /> INSIGHTS POWERED BY GOOGLE LIGHTHOUSE</div>
            <h1 id="hero-title">Your website can <span className="text-gradient">perform better.</span></h1>
            <p className="hero-description">Find what&apos;s slowing your site down. Get real performance, SEO, accessibility and best-practice scores — plus clear ways to improve.</p>
            <div className="hero-points">
              <span><CheckCircle2 size={17} /> Real Lighthouse data</span>
              <span><CheckCircle2 size={17} /> Actionable next steps</span>
              <span><CheckCircle2 size={17} /> No account required</span>
            </div>
            <a href="#audit" className="hero-link">Analyze your website <ArrowRight size={18} /></a>
          </div>
          <div className="hero-visual" aria-label="Illustration of a website performance dashboard">
            <div className="orb orb-a" /><div className="orb orb-b" />
            <div className="floating-pill top-floating"><Sparkles size={16} /> Illustrative preview</div>
            <div className="mock-window">
              <div className="mock-window-top"><span className="window-dots"><i /><i /><i /></span><span>website-overview.app</span><span className="window-lock">●</span></div>
              <div className="mock-window-body">
                <div className="mock-side"><div className="mock-side-logo"/><div/><div/><div/><div/></div>
                <div className="mock-main"><div className="mock-line-long"/><div className="mock-line-small"/>
                  <div className="mock-stats"><div className="mock-stat"><span>PERFORMANCE</span><b>94</b><small>↑ 12.8%</small></div><div className="mock-stat"><span>ACCESSIBILITY</span><b>98</b><small>↑ 4.2%</small></div></div>
                  <div className="mock-chart"><div className="chart-bars">{[34,48,40,65,56,72,83,74,95,110,101,124].map((n, i) => <span key={i} style={{ height: `${n}px` }}/>)}</div></div>
                </div>
              </div>
            </div>
            <div className="floating-pill bottom-floating"><span className="mini-badge"><Zap size={14}/></span><span><b>Audit your own site</b><small>Real Lighthouse scores</small></span></div>
          </div>
        </section>

        <section id="audit" className="audit-section wrap" aria-labelledby="audit-heading">
          <div className="audit-card">
            <div className="audit-head"><span className="section-chip"><SearchCheck size={15} /> FREE WEBSITE ANALYZER</span><h2 id="audit-heading">See what your site is capable of.</h2><p>Enter a public URL to run a live Lighthouse audit.</p></div>
            <form className="audit-form" onSubmit={runAudit}>
              <label htmlFor="website-url" className="sr-only">Public website URL</label>
              <div className="url-input"><Globe2 size={20} /><input id="website-url" type="text" inputMode="url" autoComplete="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://yourwebsite.com" required maxLength={2048}/></div>
              <div className="form-bottom"><div className="device-toggle" role="group" aria-label="Device type"><button type="button" className={strategy === "mobile" ? "active" : ""} aria-pressed={strategy === "mobile"} onClick={() => setStrategy("mobile")}><Smartphone size={16}/> Mobile</button><button type="button" className={strategy === "desktop" ? "active" : ""} aria-pressed={strategy === "desktop"} onClick={() => setStrategy("desktop")}><Monitor size={16}/> Desktop</button></div><button className="run-button" disabled={loading} type="submit">{loading ? <><LoaderCircle size={18} className="spin" /> Analyzing…</> : <><Zap size={18} fill="currentColor" /> Analyze website <ArrowRight size={16}/></>}</button></div>
            </form>
            {loading && <p className="form-note" role="status"><LoaderCircle size={15} className="spin"/> Lighthouse scans can take up to 90 seconds. Please keep this tab open.</p>}
            {error && <div className="error-alert" role="alert"><TriangleAlert size={17}/><span>{error}</span></div>}
            <div className="trust-line"><ShieldCheck size={15} /> We only send your URL to Google PageSpeed Insights. No account needed. <span>·</span> Public websites only.</div>
          </div>
        </section>

        <section id="report" className="report-section wrap" aria-labelledby="report-heading">
          <div className="section-topline"><div><span className="kicker">THE AUDIT REPORT</span><h2 id="report-heading">Clarity, not complexity.</h2><p>See your scores, key metrics and prioritized improvements in one place.</p></div><div className="report-actions"><button type="button" onClick={copyReport}><Copy size={16}/>{copied ? "Copied!" : "Copy summary"}</button><button type="button" onClick={() => window.print()}><Download size={16}/> Print / PDF</button></div></div>
          {!result.isDemo && <div className="feature-link-row"><a href="/dashboard">View saved audits →</a><a href="/reports">Detailed report →</a></div>}
          <article className="report-board">
            <div className="report-board-header"><div className="report-site"><span className="report-globe"><Globe2 size={19}/></span><div><strong>{result.isDemo ? "Illustrative sample report" : (() => { try {return new URL(result.finalUrl).hostname;} catch {return result.finalUrl;} })()}</strong><span>{result.isDemo ? "Sample scores — no website was scanned" : result.finalUrl}</span></div></div><div className="report-badges"><span className={`report-tag ${result.isDemo ? "demo-tag" : "live-tag"}`}>{result.isDemo ? "● DEMO DATA" : "● LIVE AUDIT"}</span><span className="report-tag"><span>{result.strategy === "mobile" ? <Smartphone size={14}/> : <Laptop size={14}/>}</span>{result.strategy}</span></div></div>
            <div className="report-content">
              <div className="performance-panel"><span className="panel-overline">OVERALL PERFORMANCE</span><ScoreRing value={result.scores.performance} main/><h3>{result.scores.performance === null ? "Not available" : result.scores.performance >= 90 ? "Looking great!" : result.scores.performance >= 50 ? "Room to improve" : "Needs attention"}</h3><p>{result.isDemo ? "Explore this example, then run your own audit." : "Measured using Google Lighthouse."}</p><span className="performance-source"><Activity size={14}/> Google Lighthouse</span></div>
              <div className="scores-panel"><span className="panel-overline">CATEGORY BREAKDOWN</span><div className="score-grid">{SCORE_ITEMS.map(item => <div className="category-card" key={item.key}><ScoreRing value={result.scores[item.key]} /><div><strong>{item.label}</strong><small>{item.hint}</small></div></div>)}</div></div>
            </div>
            <div className="metrics-panel"><div className="subheading"><span><Gauge size={18}/> Core performance metrics</span><small>Lighthouse lab measurements</small></div><div className="metrics-grid">{METRIC_ITEMS.map(metricItem => <div className="metric-box" key={metricItem.key}><span title={metricItem.full}>{metricItem.label}</span><strong>{result.metrics[metricItem.key] ?? "—"}</strong><small>{metricItem.full}</small></div>)}</div></div>
            <div className="insights-panel"><div className="subheading"><span><Lightbulb size={18}/> Recommended improvements</span><small>{result.recommendations.length} suggestions</small></div><div className="recommendation-list">{result.recommendations.length ? result.recommendations.map((recommendation, index) => <div className="recommendation" key={recommendation.id}><span className="rec-number">{String(index + 1).padStart(2, "0")}</span><div><div className="rec-title"><strong>{recommendation.title}</strong><span className={`priority ${recommendation.priority}`}>{recommendation.priority} priority</span></div><p>{recommendation.description}</p></div><span className="rec-saving">{recommendation.savings ?? "Review"}</span></div>) : <div className="empty-rec"><Check size={18}/> No prioritized performance opportunities were returned.</div>}</div></div>
            <div className="report-footer"><span><Clock3 size={14}/> {result.isDemo ? "Sample — not a measured result" : `Audited ${new Date(result.auditedAt).toLocaleString()}`}</span><span>Generated with SiteLens <span className="brand-accent">✦</span></span></div>
          </article>
        </section>

        <section className="features-section wrap" id="how-it-works" aria-labelledby="features-heading"><div className="centered-heading"><span className="kicker">BUILT FOR BETTER WEBSITES</span><h2 id="features-heading">Everything you need to spot the gaps.</h2><p>Go from “something feels slow” to specific next steps.</p></div><div className="features-grid"><div className="feature-card"><span className="feature-icon mint"><BarChart3 size={22}/></span><h3>Real performance scores</h3><p>Measure Lighthouse performance, SEO, accessibility and best practices for mobile or desktop.</p><span className="feature-bottom">Evidence-based insight <ChevronRight size={15}/></span></div><div className="feature-card"><span className="feature-icon blue"><SearchCheck size={22}/></span><h3>Actionable recommendations</h3><p>Find performance opportunities surfaced by Lighthouse, sorted by estimated time savings.</p><span className="feature-bottom">Clear priorities <ChevronRight size={15}/></span></div><div className="feature-card"><span className="feature-icon purple"><Code2 size={22}/></span><h3>Shareable takeaways</h3><p>Copy an audit summary or print a clean report to PDF to send to teammates or clients.</p><span className="feature-bottom">Easy to communicate <ChevronRight size={15}/></span></div></div></section>

        <section className="end-cta wrap"><div><span className="kicker">BUILD A FASTER WEB</span><h2>Your next improvement starts with a URL.</h2><p>Try your own website and discover practical opportunities.</p></div><a href="#audit" className="run-button end-button">Start a free audit <ArrowRight size={17}/></a></section>
      </main>
      <footer className="footer wrap"><a href="#top" className="brand"><span className="brand-mark"><Activity size={17}/></span><span>site<span className="brand-accent">lens</span><span className="brand-dot">.</span></span></a><span>Portfolio MVP by Arif Hassan · Built with Next.js & Google PageSpeed Insights</span><a href="#top">Back to top ↑</a></footer>
    </div>
  );
}
