import { isIP } from "node:net";
import { NextResponse } from "next/server";
import type { AuditResult, Recommendation, Strategy } from "@/lib/audit";

export const runtime = "nodejs";

// This endpoint only calls Google's API, never makes direct requests to user URLs.
function normalizePublicUrl(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 2048 || raw.trim().length < 4) {
    throw new Error("Enter a valid public website URL.");
  }
  const trimmed = raw.trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Enter a valid website address, such as https://example.com.");
  }
  const host = url.hostname.toLowerCase();
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username || url.password || url.port ||
    !host.includes(".") || isIP(host) !== 0 ||
    host === "localhost" ||
    [".localhost", ".local", ".internal", ".test", ".invalid", ".example", ".onion"].some((part) => host.endsWith(part)) ||
    !/^[a-z0-9.-]+$/i.test(host) ||
    host.split(".").some((segment) => !segment || segment.startsWith("-") || segment.endsWith("-"))
  ) {
    throw new Error("Use a public website domain without a custom port or login credentials.");
  }
  url.hash = "";
  return url.toString();
}

type LhAudit = {
  id?: string;
  title?: string;
  description?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  details?: { type?: string; overallSavingsMs?: number; overallSavingsBytes?: number };
};
type LhResponse = {
  lighthouseResult?: {
    finalUrl?: string;
    runtimeError?: { message?: string };
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<string, LhAudit>;
  };
  error?: { message?: string };
};

function score(data: LhResponse, name: string): number | null {
  const value = data.lighthouseResult?.categories?.[name]?.score;
  return typeof value === "number" ? Math.round(value * 100) : null;
}

function metric(data: LhResponse, id: string): string | null {
  return data.lighthouseResult?.audits?.[id]?.displayValue ?? null;
}

function simplifyDescription(description: string): string {
  // Lighthouse descriptions can contain Markdown links. Display a plain summary.
  return description
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 210)
    .trim();
}

function recommendations(data: LhResponse): Recommendation[] {
  const audits = data.lighthouseResult?.audits ?? {};
  return Object.entries(audits)
    .filter(([id, a]) =>
      !!a.title &&
      !["screenshot-thumbnails", "final-screenshot"].includes(id) &&
      typeof a.score === "number" &&
      a.score < 0.9 &&
      a.scoreDisplayMode !== "notApplicable" &&
      (a.details?.type === "opportunity" || (a.details?.overallSavingsMs ?? 0) > 0)
    )
    .sort(([, a], [, b]) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))
    .slice(0, 6)
    .map(([id, a]) => ({
      id,
      title: a.title ?? id,
      description: simplifyDescription(a.description ?? "Review this Lighthouse recommendation."),
      savings: a.displayValue || null,
      priority: (a.details?.overallSavingsMs ?? 0) >= 500 ? "high" as const : "medium" as const,
    }));
}

export async function POST(req: Request) {
  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  try {
    if (typeof input !== "object" || input === null) {
      throw new Error("A website URL is required.");
    }
    const values = input as Record<string, unknown>;
    const url = normalizePublicUrl(values.url);
    const strategy: Strategy = values.strategy === "desktop" ? "desktop" : "mobile";
    // Run the same Lighthouse audit for either canonical host variant.
    // No direct request is made from this server to the user-supplied website.
    async function runPageSpeed(targetUrl: string) {
      const endpoint = new URL("https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed");
      endpoint.searchParams.set("url", targetUrl);
      endpoint.searchParams.set("strategy", strategy);
      endpoint.searchParams.set("locale", "en");
      for (const category of ["performance", "accessibility", "best-practices", "seo"]) {
        endpoint.searchParams.append("category", category);
      }
      if (process.env.PAGESPEED_API_KEY) {
        endpoint.searchParams.set("key", process.env.PAGESPEED_API_KEY);
      }
      const response = await fetch(endpoint.toString(), {
        cache: "no-store",
        signal: AbortSignal.timeout(90_000),
      });
      const data = (await response.json()) as LhResponse;
      return { response, data };
    }

    let auditedUrl = url;
    let { response, data } = await runPageSpeed(auditedUrl);

    // If Lighthouse cannot load the document, retry with/without www once.
    // Do NOT retry on authentication, quota or ordinary low scores.
    const failure = [data.error?.message, data.lighthouseResult?.runtimeError?.message]
      .filter(Boolean).join(" ");
    const parsedUrl = new URL(url);
    const isDocumentLoadFailure = /FAILED_DOCUMENT_REQUEST|ERR_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED/i.test(failure);
    let alternative: string | null = null;
    if (parsedUrl.hostname.startsWith("www.")) {
      parsedUrl.hostname = parsedUrl.hostname.slice(4);
      alternative = parsedUrl.toString();
    } else if (parsedUrl.hostname.split(".").length === 2) {
      parsedUrl.hostname = `www.${parsedUrl.hostname}`;
      alternative = parsedUrl.toString();
    }

    if (isDocumentLoadFailure && alternative) {
      try {
        const retry = await runPageSpeed(alternative);
        if (retry.response.ok && !retry.data.error &&
            !retry.data.lighthouseResult?.runtimeError && retry.data.lighthouseResult?.categories) {
          auditedUrl = alternative;
          response = retry.response;
          data = retry.data;
        }
      } catch {
        // Keep original Lighthouse error if the alternative host also fails.
      }
    }
    if (!response.ok || data.error) {
      const message = data.error?.message ?? "PageSpeed service is temporarily unavailable.";
      return NextResponse.json({ error: message.slice(0, 260) }, { status: response.status === 429 ? 429 : 502 });
    }
    if (data.lighthouseResult?.runtimeError) {
      return NextResponse.json({ error: data.lighthouseResult.runtimeError.message ?? "Lighthouse could not analyze this website." }, { status: 502 });
    }
    if (!data.lighthouseResult?.categories) {
      return NextResponse.json({ error: "No audit result returned. Try a different public URL." }, { status: 502 });
    }
    const report: AuditResult = {
      url: auditedUrl,
      finalUrl: data.lighthouseResult.finalUrl ?? auditedUrl,
      strategy,
      scores: {
        performance: score(data, "performance"),
        accessibility: score(data, "accessibility"),
        bestPractices: score(data, "best-practices"),
        seo: score(data, "seo"),
      },
      metrics: {
        fcp: metric(data, "first-contentful-paint"),
        lcp: metric(data, "largest-contentful-paint"),
        cls: metric(data, "cumulative-layout-shift"),
        tbt: metric(data, "total-blocking-time"),
        si: metric(data, "speed-index"),
      },
      recommendations: recommendations(data),
      auditedAt: new Date().toISOString(),
      isDemo: false,
    };
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unable to complete this request.";
    if (/timed out|aborted/i.test(msg)) {
      return NextResponse.json({ error: "The audit took too long. Please try again." }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
