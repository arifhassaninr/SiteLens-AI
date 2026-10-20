import type { AuditResult } from "@/lib/audit";
export const KEY = "sitelens-audits";
export function readAudits(): AuditResult[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(data)) return [];
    return data.filter((r): r is AuditResult => !!r && typeof r === "object" && typeof r.finalUrl === "string" && !r.isDemo);
  } catch { return []; }
}
