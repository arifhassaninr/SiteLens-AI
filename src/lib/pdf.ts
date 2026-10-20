import type { AuditResult } from "@/lib/audit";
import { makeReportText } from "@/lib/audit";
export async function downloadAuditPdf(result: AuditResult, explanation?: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 44;
  let y = 52;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(22);
  pdf.text("SiteLens  |  Website Audit", margin, y);
  y += 27;
  pdf.setFontSize(10); pdf.setTextColor(80);
  pdf.text(result.isDemo ? "ILLUSTRATIVE DEMO - NO LIVE SCAN" : "Google Lighthouse report", margin, y);
  y += 27; pdf.setTextColor(25); pdf.setFontSize(11); pdf.setFont("helvetica", "normal");
  const lines = makeReportText(result).split("\n");
  if (explanation) lines.push("", "AI explanation (review before acting):", ...explanation.split("\n"));
  for (const line of lines) {
    // Keep text within a page, split long lines and create new pages as needed.
    const wrapped = pdf.splitTextToSize(line || " ", width - margin * 2) as string[];
    for (const part of wrapped) {
      if (y > height - 55) { pdf.addPage(); y = 54; }
      pdf.text(part, margin, y); y += 16;
    }
  }
  const hostname = (() => { try { return new URL(result.finalUrl).hostname; } catch { return "website"; } })();
  pdf.save(`sitelens-${hostname.replace(/[^a-z0-9.-]/gi, "-")}.pdf`);
}
