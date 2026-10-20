import Link from "next/link";
import { getPublicSupabase } from "@/lib/supabase";
import type { AuditResult } from "@/lib/audit";
import { explainAudit } from "@/lib/insights";

export const dynamic = "force-dynamic";
export default async function PublicShare({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getPublicSupabase();
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!db || !validId) return <main className="extra-page"><h1>Report unavailable</h1><p>No public report found.</p><Link href="/">SiteLens Home</Link></main>;
  // Note: this query uses the public anon/publishable key. RLS only permits public rows.
  const { data } = await db.from("reports").select("result, is_public").eq("id", id).eq("is_public", true).maybeSingle();
  const r = (data?.result ?? null) as AuditResult | null;
  if (!r || r.isDemo || !r.scores) return <main className="extra-page"><h1>Private or missing report</h1><p>The owner might have disabled sharing.</p><Link href="/">SiteLens Home</Link></main>;
  return <main className="extra-page"><Link href="/">← SiteLens</Link><p className="section-chip">PUBLIC LIGHTHOUSE REPORT</p><h1>Shared website audit</h1>
    <p>{r.finalUrl} · {r.strategy} · {new Date(r.auditedAt).toLocaleString()}</p>
    <div className="extra-grid">{Object.entries(r.scores).map(([key, value]) => <div className="extra-card" key={key}><span>{key}</span><strong>{value ?? "—"}/100</strong></div>)}</div>
    <h2>Measured metrics</h2><div className="extra-grid">{Object.entries(r.metrics).map(([key, value]) => <div className="extra-card" key={key}><span>{key.toUpperCase()}</span><strong>{value || "N/A"}</strong></div>)}</div>
    <h2>Recommendations</h2><ol className="extra-list">{explainAudit(r).map((text, i) => <li key={i}>{text}</li>)}</ol>
    <p className="notice">These Lighthouse results reflect one lab audit. They are not a guarantee of production performance.</p>
  </main>;
}
