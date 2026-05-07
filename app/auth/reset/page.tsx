"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function ResetPage() {
  const router = useRouter();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (pw1.length < 8) {
      setStatus("error");
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setStatus("error");
      setErrorMsg("Passwords don't match.");
      return;
    }
    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("saved");
    setTimeout(() => router.push("/"), 1200);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md card p-10">
        <div className="flex items-center gap-2.5 mb-8">
          <span className="block w-2 h-2 rounded-full bg-accent" />
          <span className="font-display italic text-[19px] text-ink leading-none">open.cx</span>
          <span className="font-num text-[10px] uppercase tracking-[0.18em] text-dim">outbound</span>
        </div>

        <h1 className="font-display text-[34px] tracking-tight text-ink mb-2 leading-tight">Set new password</h1>
        <p className="text-[14px] text-ink2 mb-8 leading-relaxed">
          Pick a strong password. At least 8 characters.
        </p>

        {status === "saved" ? (
          <div className="px-4 py-4 rounded border border-accent/30 bg-accent/8 text-[14px] text-accent">
            Password updated. Redirecting...
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2">New password</span>
              <div className="relative">
                <input type={showPw ? "text" : "password"} required minLength={8} placeholder="********"
                  autoFocus value={pw1} onChange={(e) => setPw1(e.target.value)}
                  className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 pr-16 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-dim hover:text-ink px-2">
                  {showPw ? "hide" : "show"}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2">Confirm new password</span>
              <input type={showPw ? "text" : "password"} required minLength={8} placeholder="********"
                value={pw2} onChange={(e) => setPw2(e.target.value)}
                className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition" />
            </label>
            {errorMsg && <div className="text-[12px] text-loss">{errorMsg}</div>}
            <button type="submit" disabled={status === "saving"} className="w-full bg-accent text-bg font-medium py-2.5 rounded text-[14px] hover:bg-accent2 transition disabled:opacity-50">
              {status === "saving" ? "Saving..." : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
