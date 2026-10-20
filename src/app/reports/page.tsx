"use client";
import "./report-upgrade.css";
import { useEffect, useState } from "react";
import type { AuditResult } from "@/lib/audit";
import { makeReportText } from "@/lib/audit";
import { explainAudit } from "@/lib/insights";
import { readAudits } from "@/lib/storage";
import { getBrowserSupabase } from "@/lib/supabase";
import { downloadAuditPdf } from "@/lib/pdf";
import type { CloudReport } from "@/lib/cloud";
import AIRecommendations from "./AIRecommendations";

export default function Reports() {
  const [report, setReport] = useState<AuditResult | null>(null);
  const [cloudId, setCloudId] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [owned, setOwned] = useState(false);
  const [busy, setBusy] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      const db = getBrowserSupabase();
      if (!db) { setNotice("Sign in and configure Supabase to view cloud reports."); setBusy(false); return; }
      db.auth.getUser().then(({ data: { user } }) => {
        if (!user) throw Error("Sign in to access your cloud report.");
        return db.from("reports").select("id,user_id,result,is_public,created_at").eq("id", id).eq("user_id", user.id).single();
      }).then(({ data, error }) => {
        if (error || !data) throw Error("Cloud report not found or not owned by your account.");
        const r = data as CloudReport;
        setCloudId(r.id); setIsPublic(r.is_public); setOwned(true); setReport(r.result);
      }).catch(e => setNotice(e instanceof Error ? e.message : "Could not load report."))
        .finally(() => setBusy(false));
    } else {
      const items = readAudits();
      const index = Number(params.get("index") ?? "0");
      if (Number.isSafeInteger(index) && index >= 0) setReport(items[index] ?? null);
      setBusy(false);
    }
  }, []);
  async function generateAi() {
    if (!report || report.isDemo) return;
    setAiBusy(true); setNotice("");
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ report }) });
      const data = await response.json() as { explanation?: string; error?: string };
      if (!response.ok) throw Error(data.error ?? "AI unavailable.");
      setAiText(data.explanation ?? "No AI analysis returned.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not generate explanation."); }
    finally { setAiBusy(false); }
  }
  async function toggleSharing() {
    if (!cloudId || !owned) return;
    setNotice("");
    const db = getBrowserSupabase(); if (!db) return;
    const next = !isPublic;
    const { error } = await db.from("reports").update({ is_public: next }).eq("id", cloudId);
    if (error) return setNotice(error.message);
    setIsPublic(next);
    setNotice(next ? "Public link enabled. Anyone with the link can read this audit." : "Public access disabled.");
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/share/${cloudId}`); setNotice("Share link copied."); }
    catch { setNotice("Copy failed. Select the link manually."); }
  }
  return <main className="extra-page"><a href="/dashboard">← Saved audits</a><p className="section-chip">LIGHTHOUSE INTELLIGENCE</p><h1>Detailed audit report</h1>
    {busy ? <p>Loading report...</p> : !report ? <p>Report not found. <a href="/audit">Run a live audit</a> first. {notice}</p> : <>
      <p className="report-url">{report.finalUrl} · {report.strategy} · {new Date(report.auditedAt).toLocaleString()}</p>
      <div className="extra-grid">{Object.entries(report.scores).map(([key, score]) => <div className="extra-card" key={key}><small>{key}</small><strong>{score ?? "—"}<span> / 100</span></strong></div>)}</div>
      <h2>Core metrics</h2><div className="extra-grid">{Object.entries(report.metrics).map(([key, val]) => <div key={key} className="extra-card"><small>{key.toUpperCase()}</small><strong>{val ?? "N/A"}</strong></div>)}</div>
      <h2>Actionable recommendations</h2><p>Rule-based explanations derived from your Lighthouse results, not AI-generated.</p><ol className="extra-list">{explainAudit(report).map((x, i) => <li key={i}>{x}</li>)}</ol>
      <section className="ai-panel"><p className="section-chip">AI EXPLANATIONS</p><h2>Get a prioritized action plan</h2><p>AI uses the scores and opportunities from this audit. It does not inspect your source code, so verify suggestions before implementing.</p>
        <button className="extra-button" disabled={aiBusy} onClick={generateAi}>{aiBusy ? "Generating analysis..." : "✨ Generate AI recommendations"}</button>
        {aiText && <div className="ai-output" aria-live="polite"><AIRecommendations markdown={aiText} onCopy={() => navigator.clipboard.writeText(aiText).then(() => setNotice("AI plan copied.")).catch(() => setNotice("Could not copy AI plan."))} /></div>}
      </section>
      <h2>Export & sharing</h2><div className="extra-actions">
        <button className="extra-button" onClick={() => downloadAuditPdf(report, aiText).catch(() => setNotice("PDF generation failed."))}>Download PDF</button>
        <button className="extra-button" onClick={() => navigator.clipboard.writeText(makeReportText(report)).then(() => setNotice("Report copied.")).catch(() => setNotice("Copy failed."))}>Copy text</button>
        <button className="extra-button" onClick={() => window.print()}>Print report</button>
      </div>
      {cloudId && owned ? <div className="share-panel"><p><b>Public share link:</b> {isPublic ? "Enabled" : "Disabled (private)"}</p>
        <div className="extra-actions"><button className="extra-button" onClick={toggleSharing}>{isPublic ? "Disable public link" : "Enable public link"}</button>
          {isPublic && <button className="extra-button" onClick={copyLink}>Copy public link</button>}</div>
        {isPublic && <p className="break-anywhere">{typeof window !== "undefined" ? `${window.location.origin}/share/${cloudId}` : ""}</p>}
        <small>Only enable sharing if you are comfortable making these scores and website URL public.</small>
      </div> : <div className="notice">This is a local-only report. For a public link, <a href="/auth">sign in</a> and run a new audit so it saves to Supabase.</div>}
    </>}
    {notice && <p role="status" className="notice warning">{notice}</p>}
  </main>;
}
