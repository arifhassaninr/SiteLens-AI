"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Globe2,
  LoaderCircle,
  Monitor,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Zap,
} from "lucide-react";
import type { AuditResult, Strategy } from "@/lib/audit";
import { KEY, readAudits } from "@/lib/storage";
import { saveCloudAudit } from "@/lib/cloud";

const categoryNames: { key: keyof AuditResult["scores"]; label: string }[] = [
  { key: "performance", label: "Performance" },
  { key: "accessibility", label: "Accessibility" },
  { key: "bestPractices", label: "Best practices" },
  { key: "seo", label: "SEO" },
];

export default function AuditPage() {
  const [url, setUrl] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("mobile");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [cloudInfo, setCloudInfo] = useState("");

  async function handleAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    setResult(null);
    setSaved(false);
    setCloudInfo("");

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, strategy }),
      });

      const data = (await response.json()) as AuditResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Unable to run the Lighthouse audit.");
      }
      if (!data.finalUrl || !data.scores || data.isDemo) {
        throw new Error("The server did not return a valid live audit.");
      }

      setResult(data);
      try {
        // Uses exactly the same browser storage as V2 Dashboard and Reports.
        localStorage.setItem(KEY, JSON.stringify([data, ...readAudits()].slice(0, 25)));
        setSaved(true);
        // Cloud backup is optional and requires Supabase login.
        void saveCloudAudit(data).then(({ message }) => setCloudInfo(message)).catch(() => setCloudInfo("Cloud sync unavailable; local report is still saved."));
      } catch {
        // Browsers can disable localStorage, but the report should still show.
        setSaved(false);
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Audit failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="extra-page">
      <a href="/"><ArrowLeft size={15} style={{ display: "inline", verticalAlign: "middle" }} /> Home</a>
      <h1>Free Website Analyzer</h1>
      <p>Get real Google Lighthouse scores for performance, accessibility, best practices, and SEO.</p>

      <section className="audit-section" aria-label="Run a website audit">
        <div className="audit-card">
          <div className="audit-head">
            <span className="section-chip"><CheckCircle2 size={16} /> LIVE LIGHTHOUSE AUDIT</span>
            <h2>See what your site is capable of.</h2>
            <p>Enter a public website URL. No account required.</p>
          </div>

          <form className="audit-form" onSubmit={handleAudit}>
            <label htmlFor="audit-url" className="sr-only">Public website URL</label>
            <div className="url-input">
              <Globe2 size={19} aria-hidden="true" />
              <input
                id="audit-url"
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="https://example.com"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
                maxLength={2048}
                disabled={loading}
              />
            </div>
            <div className="form-bottom">
              <div className="device-toggle" role="group" aria-label="Choose audit device">
                <button type="button" className={strategy === "mobile" ? "active" : ""}
                  aria-pressed={strategy === "mobile"} disabled={loading} onClick={() => setStrategy("mobile")}>
                  <Smartphone size={16} /> Mobile
                </button>
                <button type="button" className={strategy === "desktop" ? "active" : ""}
                  aria-pressed={strategy === "desktop"} disabled={loading} onClick={() => setStrategy("desktop")}>
                  <Monitor size={16} /> Desktop
                </button>
              </div>
              <button type="submit" className="run-button" disabled={loading}>
                {loading ? <><LoaderCircle size={18} className="spin" /> Analyzing...</> : <><Zap size={18} /> Analyze website <ArrowRight size={16} /></>}
              </button>
            </div>
          </form>
          {loading && <p className="form-note" role="status">A live Lighthouse scan may take up to 90 seconds.</p>}
          {error && <div className="error-alert" role="alert"><TriangleAlert size={18} /><span>{error}</span></div>}
          <p className="trust-line"><ShieldCheck size={16} /> Your URL is sent to Google PageSpeed Insights. Results are saved in this browser, and sync to Supabase only when signed in.</p>
        </div>
      </section>

      {cloudInfo && <p role="status" className="notice">{cloudInfo}</p>}
      {result && (
        <section aria-label="Website audit result" style={{ marginTop: 42 }}>
          <h2>Live audit results</h2>
          <p style={{ overflowWrap: "anywhere" }}>{result.finalUrl} · {result.strategy} · {new Date(result.auditedAt).toLocaleString()}</p>
          <div className="extra-grid">
            {categoryNames.map(({ key, label }) => (
              <div key={key} className="extra-card">
                <span>{label}</span>
                <strong>{result.scores[key] ?? "—"}<small> / 100</small></strong>
              </div>
            ))}
          </div>
          <div className="extra-actions">
            {saved ? (
              <>
                <a href="/reports?index=0" className="extra-button">Open detailed report →</a>
                <a href="/dashboard" className="extra-button">Saved audits →</a>
              </>
            ) : (
              <p>The audit succeeded, but your browser did not allow saving it. Enable local storage to see it in Dashboard.</p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
