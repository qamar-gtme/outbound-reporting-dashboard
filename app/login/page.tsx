"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const ALLOWED_DOMAIN = "@open.cx";

function LoginInner() {
  const params = useSearchParams();
  const errorParam = params.get("error");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith(ALLOWED_DOMAIN)) {
      setStatus("error");
      setErrorMsg("Only @open.cx emails are allowed.");
      return;
    }
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
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
          Enter your @open.cx email. A magic link will land in your inbox.
        </p>

        {errorParam === "domain" && status === "idle" && (
          <div className="mb-5 px-4 py-3 rounded border border-loss/30 bg-loss/8 text-[13px] text-loss">
            That email is not on the open.cx domain. Use a company address.
          </div>
        )}

        {status === "sent" ? (
          <div className="px-4 py-4 rounded border border-accent/30 bg-accent/8 text-[14px] text-accent">
            Check your inbox. The link is valid for one hour.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2">Work email</span>
              <input
                type="email"
                required
                autoFocus
                placeholder="you@open.cx"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition"
              />
            </label>

            {errorMsg && (
              <div className="text-[12px] text-loss">{errorMsg}</div>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full bg-accent text-bg font-medium py-2.5 rounded text-[14px] hover:bg-accent2 transition disabled:opacity-50"
            >
              {status === "sending" ? "Sending magic link..." : "Send magic link"}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-line text-[11px] text-dim">
          Access restricted to @open.cx team members.
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
