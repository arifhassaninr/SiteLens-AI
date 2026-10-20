"use client";
import { useEffect, useState, type FormEvent } from "react";
import { getBrowserSupabase, supabaseConfigured } from "@/lib/supabase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const enabled = supabaseConfigured();
  useEffect(() => {
    const db = getBrowserSupabase();
    if (!db) return;
    db.auth.getUser().then(({ data }) => setCurrent(data.user?.email ?? null));
    const { data: subscription } = db.auth.onAuthStateChange((_event, session) => setCurrent(session?.user.email ?? null));
    return () => subscription.subscription.unsubscribe();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const db = getBrowserSupabase();
    if (!db) return setMessage("Supabase isn't configured yet. Add the public URL and anon key to .env.local.");
    setBusy(true); setMessage("");
    try {
      if (mode === "signup") {
        const { error, data } = await db.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth" } });
        if (error) throw error;
        setMessage(data.session ? "Account created. You are signed in." : "Check your email for the confirmation link, then sign in.");
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage("Signed in. You can open your Dashboard.");
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : "Sign-in failed."); }
    finally { setBusy(false); }
  }
  async function signOut() {
    const db = getBrowserSupabase(); if (!db) return;
    const { error } = await db.auth.signOut();
    setMessage(error ? error.message : "Signed out.");
  }
  return <main className="extra-page"><a href="/">← SiteLens home</a><h1>Account</h1>
    <p>Sign in to save audits privately to your Supabase cloud account, and choose which reports to share.</p>
    {!enabled && <div className="notice warning">Login is disabled until you configure Supabase in .env.local.</div>}
    {current ? <section className="extra-card" style={{ maxWidth: 520 }}><h2>Signed in</h2><p>{current}</p><div className="extra-actions"><a className="extra-button" href="/dashboard">Open dashboard →</a><button className="extra-button" onClick={signOut}>Sign out</button></div></section> :
      <form onSubmit={submit} className="account-form"><div className="segmented"><button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>Log in</button><button className={mode === "signup" ? "active" : ""} type="button" onClick={() => setMode("signup")}>Sign up</button></div>
        <label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <label htmlFor="password">Password</label><input id="password" type="password" minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} required />
        <button className="extra-button" disabled={busy || !enabled}>{busy ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}</button>
        <p>Use an account only if you meet the provider's age and service eligibility requirements.</p>
      </form>}
    {message && <p role="status" className="notice">{message}</p>}
  </main>;
}
