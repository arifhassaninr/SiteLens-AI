import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
// The in-memory fallback is ONLY for local development. Serverless production requires Upstash.
const local = new Map<string, { count: number; expires: number }>();
const MAX_ENTRIES = 5000;

function fingerprint(req: Request, area: string) {
  // On Vercel, x-forwarded-for is set by the trusted edge. Never use as auth identity.
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim().slice(0, 80);
  return createHash("sha256").update(`${area}:${ip}`).digest("hex");
}

export async function checkRateLimit(req: Request, area: "audit" | "ai"): Promise<NextResponse | null> {
  const limit = area === "audit" ? 10 : 6; // per rolling-ish hour
  const key = `sitelens:${area}:${fingerprint(req, area)}`;
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (restUrl && restToken) {
    try {
      // Atomic MULTI/EXEC group; TTL refreshes with each attempt.
      const r = await fetch(`${restUrl.replace(/\/$/, "")}/multi-exec`, {
        method: "POST",
        headers: { Authorization: `Bearer ${restToken}`, "Content-Type": "application/json" },
        body: JSON.stringify([["INCR", key], ["EXPIRE", key, 3600]]),
        signal: AbortSignal.timeout(5000), cache: "no-store",
      });
      if (!r.ok) throw new Error("Rate limiter unavailable");
      const payload = await r.json() as Array<{ result?: number; error?: string }> | { error?: string };
      if (!Array.isArray(payload) || payload.some(x => x.error)) throw new Error("Rate-limiter transaction failed");
      const count = Number(payload[0]?.result);
      if (!Number.isFinite(count)) throw new Error("Invalid rate-limiter response");
      if (count > limit) return NextResponse.json({ error: "Hourly request limit reached. Try again later." }, { status: 429 });
      return null;
    } catch {
      return NextResponse.json({ error: "Traffic protection unavailable. Try again soon." }, { status: 503 });
    }
  }
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Live audits are disabled until production rate limiting is configured." }, { status: 503 });
  }
  const now = Date.now();
  if (local.size > MAX_ENTRIES) for (const [k, v] of local) if (v.expires < now) local.delete(k);
  if (local.size > MAX_ENTRIES) local.clear();
  const item = local.get(key);
  const next = item && item.expires > now ? { count: item.count + 1, expires: item.expires } : { count: 1, expires: now + 3600_000 };
  local.set(key, next);
  if (next.count > limit) return NextResponse.json({ error: "Hourly request limit reached. Try again later." }, { status: 429 });
  return null;
}
