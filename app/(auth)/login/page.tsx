"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const ALLOWED_DOMAIN = "@open.cx";

function LoginInner() {
  const params = useSearchParams();
  const errorParam = params.get("error");
  const [mode, setMode] = useState<"password" | "magic">("password");

  // Password form state
  const [pwEmail, setPwEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwStatus, setPwStatus] = useState<"idle" | "signing" | "error">("idle");
  const [pwError, setPwError] = useState("");

  // Magic link form state
  const [magicEmail, setMagicEmail] = useState("");
  const [magicStatus, setMagicStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [magicError, setMagicError] = useState("");

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    const trimmed = pwEmail.trim().toLowerCase();
    if (!trimmed.endsWith(ALLOWED_DOMAIN)) {
      setPwStatus("error");
      setPwError("Only @open.cx emails are allowed.");
      return;
    }
    setPwStatus("signing");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    if (error) {
      setPwStatus("error");
      setPwError(error.message);
      return;
    }
    window.location.href = "/";
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setMagicError("");
    const trimmed = magicEmail.trim().toLowerCase();
    if (!trimmed.endsWith(ALLOWED_DOMAIN)) {
      setMagicStatus("error");
      setMagicError("Only @open.cx emails are allowed.");
      return;
    }
    setMagicStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setMagicStatus("error");
      setMagicError(error.message);
      return;
    }
    setMagicStatus("sent");
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="w-full max-w-md card p-10">
        <div className="flex items-center gap-2.5 mb-8">
          <span className="block w-2 h-2 rounded-full bg-accent" />
          <span className="font-display italic text-[19px] text-ink leading-none">open.cx</span>
          <span className="font-num text-[10px] uppercase tracking-[0.18em] text-dim">outbound</span>
        </div>

        <h1 className="font-display text-[34px] tracking-tight text-ink mb-2 leading-tight">Sign in</h1>
        <p className="text-[14px] text-ink2 mb-8 leading-relaxed">
          Restricted to the open.cx team. Your email must end in <span className="font-num">@open.cx</span>.
        </p>

        {errorParam === "domain" && (
          <div className="mb-5 px-4 py-3 rounded border border-loss/30 bg-loss/8 text-[13px] text-loss">
            That account is not on the open.cx allowlist.
          </div>
        )}
        {errorParam === "no-session" && (
          <div className="mb-5 px-4 py-3 rounded border border-loss/30 bg-loss/8 text-[13px] text-loss">
            Session expired. Sign in again.
          </div>
        )}

        {/* Mode tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-surface2 rounded">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`flex-1 py-1.5 rounded text-[12px] font-medium transition ${mode === "password" ? "bg-bg text-ink" : "text-muted hover:text-ink"}`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setMode("magic")}
            className={`flex-1 py-1.5 rounded text-[12px] font-medium transition ${mode === "magic" ? "bg-bg text-ink" : "text-muted hover:text-ink"}`}
          >
            Email magic link
          </button>
        </div>

        {/* Password flow */}
        {mode === "password" && (
          <form onSubmit={signInWithPassword} className="space-y-4">
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2">Work email</span>
              <input
                type="email"
                required
                autoFocus
                placeholder="you@open.cx"
                value={pwEmail}
                onChange={(e) => setPwEmail(e.target.value)}
                className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition"
              />
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2 flex items-center justify-between">
                <span>Password</span>
                <Link href="/auth/forgot" className="text-[10.5px] normal-case tracking-normal text-accent hover:underline">
                  Forgot?
                </Link>
              </span>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 pr-16 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-dim hover:text-ink px-2"
                >
                  {showPw ? "hide" : "show"}
                </button>
              </div>
            </label>
            {pwError && <div className="text-[12px] text-loss">{pwError}</div>}
            <button
              type="submit"
              disabled={pwStatus === "signing"}
              className="w-full bg-accent text-bg font-medium py-2.5 rounded text-[14px] hover:bg-accent2 transition disabled:opacity-50"
            >
              {pwStatus === "signing" ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}

        {/* Magic link flow */}
        {mode === "magic" && (
          magicStatus === "sent" ? (
            <div className="px-4 py-4 rounded border border-accent/30 bg-accent/8 text-[14px] text-accent">
              Check your inbox. The link is valid for one hour.
            </div>
          ) : (
            <form onSubmit={sendMagicLink} className="space-y-4">
              <label className="block">
                <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2">Work email</span>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="you@open.cx"
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition"
                />
              </label>
              {magicError && <div className="text-[12px] text-loss">{magicError}</div>}
              <button
                type="submit"
                disabled={magicStatus === "sending"}
                className="w-full bg-accent text-bg font-medium py-2.5 rounded text-[14px] hover:bg-accent2 transition disabled:opacity-50"
              >
                {magicStatus === "sending" ? "Sending..." : "Send magic link"}
              </button>
            </form>
          )
        )}

        <div className="mt-8 pt-6 border-t border-line text-[12px] text-muted text-center">
          New here? <Link href="/auth/signup" className="text-accent hover:underline">Create an account</Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
