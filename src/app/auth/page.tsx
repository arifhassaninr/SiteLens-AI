"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase, supabaseConfigured } from "@/lib/supabase";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const enabled = supabaseConfigured();

  useEffect(() => {
    const db = getBrowserSupabase();
    if (!db) {
      setCheckingSession(false);
      return;
    }

    let active = true;
    // Returning visitors with a valid session go straight to their dashboard.
    void db.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (data.user) router.replace("/dashboard");
      else setCheckingSession(false);
    }).catch(() => {
      if (active) setCheckingSession(false);
    });

    // Also handle Supabase's email confirmation flow returning to /auth.
    const { data: { subscription } } = db.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        router.replace("/dashboard");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = getBrowserSupabase();
    if (!db) {
      setMessage("Supabase isn't configured yet. Add the public URL and anon key to .env.local.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { error, data } = await db.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/dashboard");
        } else {
          setMessage("Check your email for the confirmation link. After verification, you'll go to your Dashboard.");
        }
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/dashboard");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="extra-page">
      <a href="/">← SiteLens home</a>
      <h1>Account</h1>
      <p>Sign in to save audits privately to your Supabase account and manage your reports.</p>

      {!enabled && (
        <div className="notice warning">
          Login is disabled until you configure Supabase in .env.local.
        </div>
      )}

      {enabled && checkingSession ? (
        <p role="status" className="notice">Checking your session...</p>
      ) : (
        <form onSubmit={submit} className="account-form">
          <div className="segmented">
            <button className={mode === "login" ? "active" : ""} type="button" onClick={() => { setMode("login"); setMessage(""); }}>Log in</button>
            <button className={mode === "signup" ? "active" : ""} type="button" onClick={() => { setMode("signup"); setMessage(""); }}>Sign up</button>
          </div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} required />
          <button className="extra-button" disabled={busy || !enabled} type="submit">
            {busy ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>
          <p>Use an account only if you meet the provider's age and service eligibility requirements.</p>
        </form>
      )}

      {message && <p role="status" className="notice">{message}</p>}
    </main>
  );
}
