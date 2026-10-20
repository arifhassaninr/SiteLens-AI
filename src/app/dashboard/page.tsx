"use client";
import { useEffect, useState } from "react";
import type { AuditResult } from "@/lib/audit";
import { KEY, readAudits } from "@/lib/storage";
import { fetchCloudAudits, type CloudReport } from "@/lib/cloud";
import { getBrowserSupabase } from "@/lib/supabase";

function displayHost(r: AuditResult) {
  try { return new URL(r.finalUrl).hostname; } catch { return "Unknown website"; }
}

export default function Dashboard() {
  const [local, setLocal] = useState<AuditResult[]>([]);
  const [cloud, setCloud] = useState<CloudReport[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setLocal(readAudits());
    const db = getBrowserSupabase();
    if (!db) { setBusy(false); return; }
    db.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      return fetchCloudAudits();
    }).then(setCloud).catch(e => setNotice(e instanceof Error ? e.message : "Could not load cloud reports."))
      .finally(() => setBusy(false));
  }, []);
  async function removeReport(id: string) {
    if (!confirm("Delete this cloud report?")) return;
    const db = getBrowserSupabase(); if (!db) return;
    const { error } = await db.from("reports").delete().eq("id", id);
    if (error) return setNotice(error.message);
    setCloud(x => x.filter(y => y.id !== id));
  }
  return <main className="extra-page"><a href="/">← SiteLens</a>
    <div className="page-top"><div><p className="section-chip">YOUR WORKSPACE</p><h1>Saved audits</h1><p>Local scans stay in this browser. Sign in to sync new audits privately to Supabase.</p></div><a className="extra-button" href="/audit">+ New audit</a></div>
    <div className="notice">{email ? `Signed in as ${email}. New audits can sync to your account.` : "Not signed in. Local reports still work. "}<a href="/auth">{email ? "Account settings" : "Sign in / sign up"}</a></div>
    {notice && <p role="alert" className="notice warning">{notice}</p>}
    <h2>Cloud reports {busy && <span className="muted">(loading...)</span>}</h2>
    {cloud.length ? <div className="extra-grid">{cloud.map(r => <article className="extra-card" key={r.id}>
      <b>{displayHost(r.result)}</b><span>{r.result.strategy} · {r.result.scores.performance ?? "N/A"}/100 performance</span>
      <small>{new Date(r.created_at).toLocaleString()} · {r.is_public ? "Public link enabled" : "Private"}</small>
      <div className="extra-actions"><a className="extra-button" href={`/reports?id=${encodeURIComponent(r.id)}`}>View report</a><button className="subtle-button" onClick={() => removeReport(r.id)}>Delete</button></div>
    </article>)}</div> : !busy && <div className="empty-panel">No cloud reports yet. Sign in and run a fresh audit.</div>}
    <h2>This browser</h2><div className="extra-grid">
      {local.length ? local.map((r, i) => <a key={i} className="extra-card" href={`/reports?index=${i}`}><b>{displayHost(r)}</b><span>{r.strategy} · Performance {r.scores.performance ?? "N/A"}/100</span><small>{new Date(r.auditedAt).toLocaleString()} · Browser-only</small></a>)
        : <div className="empty-panel">No local scans saved yet. <a href="/audit">Run first audit →</a></div>}
    </div>
    {!!local.length && <button className="subtle-button" onClick={() => { if (confirm("Clear all audits saved only in this browser?")) { localStorage.removeItem(KEY); setLocal([]); } }}>Clear local history</button>}
  </main>;
}
