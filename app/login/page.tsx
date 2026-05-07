"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const ALLOWED_DOMAIN = "@open.cx";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 6.5 29 4.5 24 4.5 16.5 4.5 10 8.6 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c4.9 0 9.4-1.9 12.7-5l-5.9-4.9c-2 1.4-4.4 2.4-6.8 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.9 39.4 16.4 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l5.9 4.9c-.4.4 6.6-4.8 6.6-15.1 0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.16-.02-2.1-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 015.79 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.67.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function LoginInner() {
  const params = useSearchParams();
  const errorParam = params.get("error");
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneStep, setPhoneStep] = useState<"enter" | "verify">("enter");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "verifying" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function signInOAuth(provider: "google" | "github" | "apple") {
    setErrorMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: provider === "google" ? { access_type: "offline", prompt: "consent" } : undefined,
      },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  async function sendPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    const trimmed = phone.trim();
    if (!trimmed.startsWith("+") || trimmed.length < 8) {
      setStatus("error");
      setErrorMsg("Use international format e.g. +1...");
      return;
    }
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone: trimmed });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("idle");
    setPhoneStep("verify");
  }

  async function verifyPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setStatus("verifying");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      phone: phone.trim(),
      token: otp.trim(),
      type: "sms",
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    window.location.href = "/auth/callback";
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
          Restricted to open.cx team. Choose any provider, your email or phone must be on the allowlist.
        </p>

        {errorParam === "domain" && status === "idle" && (
          <div className="mb-5 px-4 py-3 rounded border border-loss/30 bg-loss/8 text-[13px] text-loss">
            That account is not on the open.cx allowlist.
          </div>
        )}

        {/* OAuth buttons */}
        <div className="space-y-2 mb-6">
          <button
            type="button"
            onClick={() => signInOAuth("google")}
            className="w-full flex items-center justify-center gap-3 bg-surface2 border border-line2 hover:border-line2 hover:bg-surface3 text-ink py-2.5 rounded text-[14px] transition"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => signInOAuth("github")}
            className="w-full flex items-center justify-center gap-3 bg-surface2 border border-line2 hover:bg-surface3 text-ink py-2.5 rounded text-[14px] transition"
          >
            <GitHubIcon />
            Continue with GitHub
          </button>
          <button
            type="button"
            onClick={() => signInOAuth("apple")}
            className="w-full flex items-center justify-center gap-3 bg-surface2 border border-line2 hover:bg-surface3 text-ink py-2.5 rounded text-[14px] transition"
          >
            <AppleIcon />
            Continue with Apple
          </button>
        </div>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-line" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-dim font-num">or</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-surface2 rounded">
          <button
            type="button"
            onClick={() => { setMode("email"); setStatus("idle"); setErrorMsg(""); }}
            className={`flex-1 py-1.5 rounded text-[12px] font-medium transition ${mode === "email" ? "bg-bg text-ink" : "text-muted hover:text-ink"}`}
          >
            Email magic link
          </button>
          <button
            type="button"
            onClick={() => { setMode("phone"); setStatus("idle"); setErrorMsg(""); setPhoneStep("enter"); }}
            className={`flex-1 py-1.5 rounded text-[12px] font-medium transition flex items-center justify-center gap-1.5 ${mode === "phone" ? "bg-bg text-ink" : "text-muted hover:text-ink"}`}
          >
            <PhoneIcon /> Phone
          </button>
        </div>

        {/* Email flow */}
        {mode === "email" && (
          status === "sent" ? (
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition"
                />
              </label>
              <button type="submit" disabled={status === "sending"} className="w-full bg-accent text-bg font-medium py-2.5 rounded text-[14px] hover:bg-accent2 transition disabled:opacity-50">
                {status === "sending" ? "Sending..." : "Send magic link"}
              </button>
            </form>
          )
        )}

        {/* Phone flow */}
        {mode === "phone" && (
          phoneStep === "enter" ? (
            <form onSubmit={sendPhoneOtp} className="space-y-4">
              <label className="block">
                <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2">Phone (international)</span>
                <input
                  type="tel"
                  required
                  placeholder="+15555550100"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition font-num"
                />
              </label>
              <button type="submit" disabled={status === "sending"} className="w-full bg-accent text-bg font-medium py-2.5 rounded text-[14px] hover:bg-accent2 transition disabled:opacity-50">
                {status === "sending" ? "Sending code..." : "Send SMS code"}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyPhoneOtp} className="space-y-4">
              <div className="text-[12px] text-muted">
                Code sent to <span className="text-ink font-num">{phone}</span>
                <button type="button" onClick={() => { setPhoneStep("enter"); setOtp(""); }} className="ml-2 text-accent hover:underline">change</button>
              </div>
              <label className="block">
                <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2">6-digit code</span>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 text-[16px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition font-num text-center tracking-[0.4em]"
                />
              </label>
              <button type="submit" disabled={status === "verifying"} className="w-full bg-accent text-bg font-medium py-2.5 rounded text-[14px] hover:bg-accent2 transition disabled:opacity-50">
                {status === "verifying" ? "Verifying..." : "Verify code"}
              </button>
            </form>
          )
        )}

        {errorMsg && <div className="text-[12px] text-loss mt-3">{errorMsg}</div>}

        <div className="mt-8 pt-6 border-t border-line text-[11px] text-dim leading-relaxed">
          Email sign-in restricted to <span className="font-num">@open.cx</span>. Phone sign-in restricted to numbers in the allowlist.
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
