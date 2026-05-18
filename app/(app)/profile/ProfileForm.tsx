"use client";

import { useState } from "react";
import {
  setOrChangePassword,
  updateDisplayName,
  validatePasswordStrength,
} from "@/lib/auth";

type Props = {
  email: string;
  initialDisplayName: string;
  hasPasswordProvider: boolean;
};

export function ProfileForm({
  email,
  initialDisplayName,
  hasPasswordProvider: initialHasPasswordProvider,
}: Props) {
  // Track whether the user has a password yet, so when they "set" one for the
  // first time we can flip the headline to "Change password" without reload.
  const [hasPasswordProvider, setHasPasswordProvider] = useState(
    initialHasPasswordProvider,
  );

  // ── Display name ──────────────────────────────────────────────────
  const [name, setName] = useState(initialDisplayName);
  const [nameStatus, setNameStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [nameError, setNameError] = useState("");

  async function onSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameError("");
    setNameStatus("saving");
    const { error } = await updateDisplayName(name);
    if (error) {
      setNameStatus("error");
      setNameError(error.message);
      return;
    }
    setNameStatus("saved");
    setTimeout(() => setNameStatus("idle"), 1800);
  }

  // ── Password ──────────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwStatus, setPwStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [pwError, setPwError] = useState("");

  const newPwStrengthError = newPw ? validatePasswordStrength(newPw) : null;
  const confirmMismatch =
    confirmPw.length > 0 && newPw !== confirmPw ? "Passwords don't match." : null;

  async function onSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");

    if (!newPw || !confirmPw) {
      setPwStatus("error");
      setPwError("Enter a new password and confirm it.");
      return;
    }
    const strength = validatePasswordStrength(newPw);
    if (strength) {
      setPwStatus("error");
      setPwError(strength);
      return;
    }
    if (newPw !== confirmPw) {
      setPwStatus("error");
      setPwError("Passwords don't match.");
      return;
    }
    if (hasPasswordProvider && !currentPw) {
      setPwStatus("error");
      setPwError("Enter your current password.");
      return;
    }

    setPwStatus("saving");
    const { error } = await setOrChangePassword({
      email,
      currentPassword: hasPasswordProvider ? currentPw : undefined,
      newPassword: newPw,
    });
    if (error) {
      setPwStatus("error");
      setPwError(error.message);
      return;
    }
    setPwStatus("saved");
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    // First-time set → flip the UI into "change" mode without reload.
    if (!hasPasswordProvider) setHasPasswordProvider(true);
    setTimeout(() => setPwStatus("idle"), 1800);
  }

  // ── Sign out ──────────────────────────────────────────────────────
  // POST to existing /auth/signout route (matches UserChip pattern).

  const pwHeadline = hasPasswordProvider ? "Change password" : "Set a password";
  const pwDescription = hasPasswordProvider
    ? "Replace your existing password."
    : "You signed in via magic link. Pick a password so you can also sign in directly.";

  return (
    <>
      {/* Display name */}
      <h2 className="font-display text-[22px] tracking-tight text-ink font-medium mt-12 mb-4 pb-3 border-b border-line">
        Display name
      </h2>
      <form onSubmit={onSaveName} className="card p-6 mb-2 max-w-xl">
        <label className="block">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2">
            How you want to be addressed
          </span>
          <input
            type="text"
            placeholder="e.g. Qamar Mohyuddin"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition"
          />
        </label>
        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={nameStatus === "saving"}
            className="bg-accent text-bg font-medium px-5 py-2 rounded text-[13px] hover:bg-accent2 transition disabled:opacity-50"
          >
            {nameStatus === "saving" ? "Saving..." : "Save name"}
          </button>
          {nameStatus === "saved" && (
            <span className="text-[12px] text-accent">Saved.</span>
          )}
          {nameStatus === "error" && nameError && (
            <span className="text-[12px] text-loss">{nameError}</span>
          )}
        </div>
      </form>

      {/* Password */}
      <h2 className="font-display text-[22px] tracking-tight text-ink font-medium mt-12 mb-2 pb-3 border-b border-line">
        {pwHeadline}
      </h2>
      <p className="text-[13px] text-ink2 mb-4 max-w-xl leading-relaxed">
        {pwDescription}
      </p>
      <form onSubmit={onSavePassword} className="card p-6 mb-2 max-w-xl space-y-4">
        {hasPasswordProvider && (
          <label className="block">
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2">
              Current password
            </span>
            <input
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition"
            />
          </label>
        )}
        <label className="block">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2">
            New password
          </span>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              value={newPw}
              minLength={8}
              onChange={(e) => setNewPw(e.target.value)}
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
          {newPwStrengthError && (
            <div className="text-[11.5px] text-loss mt-1.5">
              {newPwStrengthError}
            </div>
          )}
          {!newPwStrengthError && newPw && (
            <div className="text-[11.5px] text-accent mt-1.5">Looks good.</div>
          )}
        </label>
        <label className="block">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium block mb-2">
            Confirm new password
          </span>
          <input
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            className="w-full bg-surface2 border border-line2 rounded px-4 py-2.5 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none transition"
          />
          {confirmMismatch && (
            <div className="text-[11.5px] text-loss mt-1.5">{confirmMismatch}</div>
          )}
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pwStatus === "saving"}
            className="bg-accent text-bg font-medium px-5 py-2 rounded text-[13px] hover:bg-accent2 transition disabled:opacity-50"
          >
            {pwStatus === "saving"
              ? "Saving..."
              : hasPasswordProvider
                ? "Update password"
                : "Set password"}
          </button>
          {pwStatus === "saved" && (
            <span className="text-[12px] text-accent">
              {hasPasswordProvider ? "Password updated." : "Password set."}
            </span>
          )}
          {pwStatus === "error" && pwError && (
            <span className="text-[12px] text-loss">{pwError}</span>
          )}
        </div>
      </form>

      {/* Sign out */}
      <h2 className="font-display text-[22px] tracking-tight text-ink font-medium mt-12 mb-4 pb-3 border-b border-line">
        Sign out
      </h2>
      <form action="/auth/signout" method="post" className="card p-6 max-w-xl">
        <p className="text-[13px] text-ink2 mb-4 leading-relaxed">
          Ends your session and returns you to the sign-in page.
        </p>
        <button
          type="submit"
          className="bg-surface2 border border-line2 text-ink font-medium px-5 py-2 rounded text-[13px] hover:border-loss/40 hover:text-loss transition"
        >
          Sign out
        </button>
      </form>
    </>
  );
}
