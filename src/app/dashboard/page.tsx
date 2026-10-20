"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, ChevronRight,
  Clock3, Copy, ExternalLink, FileDown, FileText, Globe2, LayoutDashboard,
  Link2, LockKeyhole, LogOut, Menu, Monitor, Plus, Search, ShieldCheck,
  Smartphone, Sparkles, Trash2, WandSparkles, X,
} from "lucide-react";
import type { AuditResult } from "@/lib/audit";
import { KEY, readAudits } from "@/lib/storage";
import { fetchCloudAudits, type CloudReport } from "@/lib/cloud";
import { getBrowserSupabase } from "@/lib/supabase";
import { downloadAuditPdf } from "@/lib/pdf";
import "./dashboard-pro.css";

type AuditEntry = {
  key: string;
  report: AuditResult;
  source: "cloud" | "browser";
  cloudId?: string;
  isPublic: boolean;
  href: string;
  date: string;
};

type Filter = "all" | "cloud" | "browser";

function host(url: string): string {
  try { return new URL(url).hostname; } catch { return url || "Unknown website"; }
}
function shortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function scoreClass(score: number | null): string {
  if (score == null) return "sl-score-na";
  if (score >= 90) return "sl-score-good";
  if (score >= 50) return "sl-score-mid";
  return "sl-score-low";
}

const tools = [
  { title: "New website audit", text: "Analyze a public website with Lighthouse scores.", href: "/audit", icon: Globe2, tag: "LIVE SCAN", strong: true },
  { title: "AI action plan", text: "Turn an existing audit into prioritized AI guidance.", href: "/reports", icon: Sparkles, tag: "AI INSIGHTS", strong: false },
  { title: "Before / After", text: "Compare two versions of a website visually.", href: "/redesign", icon: WandSparkles, tag: "DESIGN LAB", strong: false },
  { title: "My reports", text: "Reopen reports, download PDFs and manage sharing.", href: "#recent-audits", icon: FileText, tag: "REPORTS", strong: false },
];

export default function Dashboard() {
  const router = useRouter();
  const [local, setLocal] = useState<AuditResult[]>([]);
  const [cloud, setCloud] = useState<CloudReport[]>([]);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLocal(readAudits());
    const db = getBrowserSupabase();
    if (!db) { setEmail(""); setUserId(""); setCloud([]); setLoading(false); return; }
    try {
      const { data, error } = await db.auth.getUser();
      if (error) throw error;
      const user = data.user;
      setEmail(user?.email ?? "");
      setUserId(user?.id ?? "");
      setCloud(user ? await fetchCloudAudits() : []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load cloud reports.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void loadData();
    const db = getBrowserSupabase();
    if (!db) return;
    const { data: { subscription } } = db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUserId(""); setEmail(""); setCloud([]);
      } else if (event === "SIGNED_IN") {
        void loadData();
      }
    });
    return () => subscription.unsubscribe();
  }, [loadData]);

  const allEntries = useMemo<AuditEntry[]>(() => {
    const remote = cloud.map((r) => ({
      key: `cloud-${r.id}`, report: r.result, source: "cloud" as const,
      cloudId: r.id, isPublic: r.is_public,
      href: `/reports?id=${encodeURIComponent(r.id)}`, date: r.created_at,
    }));
    const browser = local.map((r, i) => ({
      key: `local-${i}`, report: r, source: "browser" as const,
      isPublic: false, href: `/reports?index=${i}`, date: r.auditedAt,
    }));
    return [...remote, ...browser].sort((a, b) => {
      const left = new Date(a.date).getTime() || 0;
      const right = new Date(b.date).getTime() || 0;
      return right - left;
    });
  }, [cloud, local]);

  const filtered = useMemo(() => allEntries.filter((entry) => {
    if (filter !== "all" && entry.source !== filter) return false;
    const haystack = `${entry.report.finalUrl} ${entry.report.strategy}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [allEntries, filter, query]);

  const latest = allEntries[0];
  const measured = allEntries.map((r) => r.report.scores.performance).filter((v): v is number => typeof v === "number");
  const average = measured.length ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) : null;
  const siteCount = new Set(allEntries.map((r) => host(r.report.finalUrl))).size;

  async function signOut() {
    const db = getBrowserSupabase();
    if (!db || signingOut) return;
    setSigningOut(true); setNotice("");
    try {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      setCloud([]); setEmail(""); setUserId("");
      router.replace("/auth"); router.refresh();
    } catch (err) { setNotice(err instanceof Error ? err.message : "Sign out failed."); }
    finally { setSigningOut(false); }
  }

  async function deleteCloud(id: string) {
    if (!userId || !window.confirm("Permanently delete this cloud report?")) return;
    const db = getBrowserSupabase(); if (!db) return;
    setNotice(""); setWorkingId(id);
    const { error } = await db.from("reports").delete().eq("id", id).eq("user_id", userId);
    if (error) setNotice(error.message);
    else setCloud((list) => list.filter((r) => r.id !== id));
    setWorkingId("");
  }

  async function shareReport(entry: AuditEntry) {
    if (!entry.cloudId || !userId) return;
    const db = getBrowserSupabase(); if (!db) return;
    const next = !entry.isPublic;
    if (next && !window.confirm("Enable a public link? Anyone who has the link will be able to read this report.")) return;
    setWorkingId(entry.cloudId); setNotice("");
    const { error } = await db.from("reports").update({ is_public: next })
      .eq("id", entry.cloudId).eq("user_id", userId);
    if (error) setNotice(error.message);
    else {
      setCloud((list) => list.map((r) => r.id === entry.cloudId ? { ...r, is_public: next } : r));
      setNotice(next ? "Public link enabled. Use Copy link to share this audit." : "Public access disabled.");
    }
    setWorkingId("");
  }

  async function copyLink(id: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${id}`);
      setNotice("Public report link copied.");
    } catch { setNotice(`Copy manually: ${window.location.origin}/share/${id}`); }
  }

  async function exportPdf(entry: AuditEntry) {
    setNotice("");
    try { await downloadAuditPdf(entry.report); }
    catch (err) { setNotice(err instanceof Error ? err.message : "Unable to generate PDF."); }
  }

  function clearLocal() {
    if (!window.confirm("Remove reports stored only in this browser? Cloud reports will not be affected.")) return;
    window.localStorage.removeItem(KEY);
    setLocal([]);
  }

  return (
    <main className="sl-workspace">
      <aside className={`sl-side ${menuOpen ? "sl-side-open" : ""}`} aria-label="Workspace navigation">
        <div className="sl-side-logo"><span className="sl-brand-symbol"><Activity size={20}/></span><span>site<span className="sl-brand-aqua">lens.</span></span><button className="sl-mobile-close" type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={20}/></button></div>
        <p className="sl-nav-label">WORKSPACE</p>
        <nav className="sl-side-nav">
          <a className="sl-nav-active" href="/dashboard"><LayoutDashboard size={18}/> Overview</a>
          <a href="/audit"><Globe2 size={18}/> Website Analyzer</a>
          <a href="#recent-audits" onClick={() => setMenuOpen(false)}><FileText size={18}/> Saved Reports</a>
          <a href="/redesign"><WandSparkles size={18}/> Before / After</a>
          <a href="/reports"><Sparkles size={18}/> AI Recommendations</a>
        </nav>
        <p className="sl-nav-label sl-tools-label">ACCOUNT</p>
        <nav className="sl-side-nav"><a href="/auth"><ShieldCheck size={18}/> My account</a><a href="/"><ArrowUpRight size={18}/> Public website</a></nav>
        <div className="sl-side-bottom"><span className="sl-status-dot"/> Lighthouse-powered analysis<br/><small>AI suggestions need a saved audit</small></div>
      </aside>
      {menuOpen && <button className="sl-menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close menu"/>}
      <div className="sl-main">
        <header className="sl-topbar">
          <div className="sl-top-left"><button className="sl-menu-toggle" type="button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={23}/></button><span className="sl-breadcrumb">Workspace <ChevronRight size={15}/> <strong>Overview</strong></span></div>
          <div className="sl-top-right"><span className="sl-session-badge"><span className="sl-status-dot"/> {loading ? "Checking account" : email ? "Account connected" : "Guest mode"}</span>{email ? <button className="sl-account-btn" type="button" onClick={signOut} disabled={signingOut} title={email}><span className="sl-avatar">{email.slice(0,1).toUpperCase()}</span><span className="sl-account-name">{email}</span><LogOut size={16}/></button> : <a className="sl-login-top" href="/auth">Log in <ArrowRight size={15}/></a>}</div>
        </header>
        <div className="sl-content">
          <div className="sl-head-row"><div><p className="sl-overline">YOUR WEBSITE INTELLIGENCE HUB</p><h1>{email ? "Welcome to your workspace" : "Explore your workspace"}</h1><p className="sl-lead">Audit websites, get AI improvement plans, export reports, and compare redesigns—all from one place.</p></div><a className="sl-primary-btn" href="/audit"><Plus size={18}/> New audit <ArrowRight size={17}/></a></div>
          {notice && <div className="sl-notice" role="status"><span>{notice}</span><button aria-label="Dismiss message" type="button" onClick={() => setNotice("")}><X size={17}/></button></div>}
          {!email && !loading && <div className="sl-intro"><LockKeyhole size={19}/><div><strong>All core tools work without an account.</strong><span>Log in only to back up audits and manage private or shared cloud reports.</span></div><a href="/auth">Connect account <ArrowRight size={16}/></a></div>}
          <section className="sl-stats" aria-label="Actual audit statistics">
            <div className="sl-stat"><span>Total audits <BarChart3 size={17}/></span><strong>{loading ? "…" : allEntries.length}</strong><small>Cloud + this browser</small></div>
            <div className="sl-stat"><span>Websites analyzed <Globe2 size={17}/></span><strong>{loading ? "…" : siteCount}</strong><small>Unique website domains</small></div>
            <div className="sl-stat"><span>Avg. performance <Activity size={17}/></span><strong className={scoreClass(average)}>{average == null ? "—" : `${average}/100`}</strong><small>{measured.length ? "Across saved audits" : "Run an audit to calculate"}</small></div>
            <div className="sl-stat"><span>Cloud reports <ShieldCheck size={17}/></span><strong>{loading ? "…" : cloud.length}</strong><small>{email ? "Private unless shared" : "Sign in for cloud storage"}</small></div>
          </section>
          <div className="sl-section-heading"><div><p className="sl-overline">GET STARTED</p><h2>What would you like to do?</h2></div></div>
          <section className="sl-tool-grid" aria-label="SiteLens tools">
            {tools.map((tool) => { const Icon = tool.icon; return <a key={tool.title} href={tool.title === "AI action plan" ? (latest?.href ?? "/audit") : tool.href} className={`sl-tool ${tool.strong ? "sl-tool-featured" : ""}`}><span className="sl-tool-top"><span className="sl-tool-icon"><Icon size={22}/></span><span className="sl-tool-tag">{tool.tag}</span></span><strong>{tool.title}</strong><p>{tool.text}</p><span className="sl-tool-bottom">Open tool <ArrowUpRight size={17}/></span></a>; })}
          </section>
          <div className="sl-section-heading sl-recent-heading" id="recent-audits"><div><p className="sl-overline">AUDIT HISTORY</p><h2>Recent reports</h2></div><a href="/audit" className="sl-text-link">New scan <ArrowRight size={17}/></a></div>
          <section className="sl-history">
            <div className="sl-history-controls"><div className="sl-filter-pills" role="group" aria-label="Filter reports"><button type="button" className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>All ({allEntries.length})</button><button type="button" className={filter === "cloud" ? "selected" : ""} onClick={() => setFilter("cloud")}>Cloud ({cloud.length})</button><button type="button" className={filter === "browser" ? "selected" : ""} onClick={() => setFilter("browser")}>Browser ({local.length})</button></div><label className="sl-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search websites…" aria-label="Search audited websites"/></label></div>
            {loading ? <div className="sl-empty"><Activity size={27}/><h3>Loading your audit history…</h3></div> : !allEntries.length ? <div className="sl-empty"><div className="sl-empty-icon"><Globe2 size={29}/></div><h3>Your first report starts here</h3><p>Analyze a website to unlock performance scores, AI recommendations and exportable reports. You can start without signing in.</p><a href="/audit" className="sl-primary-btn"><Plus size={17}/> Analyze a website <ArrowRight size={17}/></a></div> : !filtered.length ? <div className="sl-empty"><Search size={24}/><h3>No matching reports</h3><p>Try another search or choose a different filter.</p><button className="sl-text-link" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button></div> : <div className="sl-report-list">
              {filtered.map((entry) => <article className="sl-report-item" key={entry.key}>
                <div className="sl-report-icon"><Globe2 size={20}/></div>
                <div className="sl-report-info"><a href={entry.href} className="sl-report-title">{host(entry.report.finalUrl)} <ArrowUpRight size={14}/></a><span>{entry.report.strategy === "mobile" ? <Smartphone size={13}/> : <Monitor size={13}/>} {entry.report.strategy === "mobile" ? "Mobile" : "Desktop"} <span className="sl-dot-sep">·</span> <Clock3 size={13}/> {shortDate(entry.date)} <span className="sl-dot-sep">·</span><span className="sl-source-label">{entry.source === "cloud" ? <><ShieldCheck size={13}/> Cloud</> : "This browser"}</span></span></div>
                <div className={`sl-perf-score ${scoreClass(entry.report.scores.performance)}`}><strong>{entry.report.scores.performance ?? "—"}</strong><small>Performance</small></div>
                <div className="sl-report-actions"><a href={entry.href} title="Open report and AI analysis" aria-label={`Open report for ${host(entry.report.finalUrl)}`}><ExternalLink size={17}/></a><button type="button" title="Download PDF" aria-label={`Download PDF for ${host(entry.report.finalUrl)}`} onClick={() => void exportPdf(entry)}><FileDown size={17}/></button>
                  {entry.source === "cloud" && entry.cloudId && <><button type="button" disabled={workingId === entry.cloudId} title={entry.isPublic ? "Disable public link" : "Enable public link"} aria-label={entry.isPublic ? "Disable public link" : "Enable public link"} onClick={() => void shareReport(entry)}>{entry.isPublic ? <Link2 size={17}/> : <LockKeyhole size={17}/>}</button>{entry.isPublic && <button type="button" title="Copy public link" aria-label="Copy public link" onClick={() => void copyLink(entry.cloudId!)}><Copy size={17}/></button>}<button type="button" disabled={workingId === entry.cloudId} title="Delete report" aria-label="Delete cloud report" onClick={() => void deleteCloud(entry.cloudId!)}><Trash2 size={17}/></button></>}
                </div>
              </article>)}
            </div>}
            {local.length > 0 && <div className="sl-history-footer"><span>Browser reports are stored on this device. Only new signed-in audits automatically sync to Supabase.</span><button type="button" onClick={clearLocal}>Clear browser history</button></div>}
          </section>
          <div className="sl-bottom-grid"><div className="sl-next-card"><span className="sl-mini-label">NEXT STEP</span><h3>{latest ? `Improve ${host(latest.report.finalUrl)}` : "Analyze your first website"}</h3><p>{latest ? "Reopen your latest report and generate an AI action plan based on its Lighthouse findings." : "Start with your website, or audit a public competitor to explore performance opportunities."}</p><a href={latest?.href ?? "/audit"}> {latest ? "Open latest report" : "Start analysis"} <ArrowRight size={17}/></a></div><div className="sl-private-card"><div className="sl-private-heading"><ShieldCheck size={22}/> Your data, your control</div><p>Cloud reports are private by default. A public report link is created only when you enable sharing.</p><a href="#recent-audits">Manage reports <ArrowRight size={17}/></a></div></div>
          <footer className="sl-footer"><span>SiteLens · Website Intelligence</span><span>Scores are Lighthouse measurements. AI recommendations should be verified before changes are deployed.</span></footer>
        </div>
      </div>
    </main>
  );
}
