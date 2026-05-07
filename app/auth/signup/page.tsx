"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

const ALLOWED_DOMAIN = "@open.cx";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith(ALLOWED_DOMAIN)) {
      setStatus("error");
      setErrorMsg("Only @open.cx emails are allowed.");
      return;
    }
    if (password.length < 8) {
      setStatus("error");
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md card p-10">
        <div className="flex items-center gap-2.5 mb-8">
          <span className="block w-2 h-2 rounded-full bg-accent" />
          <span className="font-display italic text-[19px] text-ink leading-none">open.cx</span>
          <span className="font-num text-[10px] uppercase tracking-[0.18em] text-dim">outbound</span>
        </div>

        <h1 className="font-display text-[34px] tracking-tight text-ink mb-2 leading-tight">Create account</h1>
        <p className="text-[14px] text-ink2 mb-8 leading-relaxed">
          Sign up with your @open.cx email and a password. We'll send a confirmation link.
        </p>

        {status === "sent" ? (
          <div className="px-4 py-4 rounded border border-accent/30 bg-accent/8 text-[14px] text-accent">
            Check your inbox to confirm your account.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2">Work email</span>
              <input type="email" required autoFocus placeholder="you@open.cx" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition" />
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2">Password</span>
              <div className="relative">
                <input type={showPw ? "text" : "password"} required minLength={8} placeholder="At least 8 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 pr-16 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-dim hover:text-ink px-2">
                  {showPw ? "hide" : "show"}
                </button>
              </div>
            </label>
            {errorMsg && <div className="text-[12px] text-loss">{errorMsg}</div>}
            <button type="submit" disabled={status === "sending"} className="w-full bg-accent text-bg font-medium py-2.5 rounded text-[14px] hover:bg-accent2 transition disabled:opacity-50">
              {status === "sending" ? "Creating..." : "Create account"}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-line text-[12px] text-muted text-center">
          Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
