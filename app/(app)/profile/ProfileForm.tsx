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
    confirmPw.length > 0 && newPw !== confirmPw
      ? "Passwords don't match."
      : null;

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
    setPwStatus("saving");
    const { error } = await setOrChangePassword({
      email,
      currentPassword: currentPw || undefined,
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

  const pwHeadline = hasPasswordProvider ? "Change password" : "Set a password";
  const pwDescription = hasPasswordProvider
    ? "Replace your password. Leave current password blank if you don't remember it — your active session is trusted."
    : "You signed in via magic link. Pick a password so you can also sign in directly.";

  return (
    <div className="space-y-4">
      {/* Display name */}
      <SettingsCard
        title="Display name"
        description="How you want to be addressed in this dashboard."
      >
        <form onSubmit={onSaveName} className="space-y-3">
          <label className="block">
            <span className="sr-only">Display name</span>
            <input
              type="text"
              placeholder="e.g. Qamar Mohyuddin"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="input"
              aria-label="Display name"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={nameStatus === "saving"}
              className="btn btn-sm btn-primary"
            >
              {nameStatus === "saving" ? "Saving…" : "Save"}
            </button>
            {nameStatus === "saved" && (
              <span className="text-[12px] text-accent">Saved.</span>
            )}
            {nameStatus === "error" && nameError && (
              <span className="text-[12px] text-danger">{nameError}</span>
            )}
          </div>
        </form>
      </SettingsCard>

      {/* Password */}
      <SettingsCard title={pwHeadline} description={pwDescription}>
        <form onSubmit={onSavePassword} className="space-y-3">
          {hasPasswordProvider && (
            <Field
              label="Current password"
              optional
              htmlFor="profile-current-pw"
            >
              <input
                id="profile-current-pw"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="input"
              />
            </Field>
          )}
          <Field label="New password" htmlFor="profile-new-pw">
            <div className="relative">
              <input
                id="profile-new-pw"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={newPw}
                minLength={8}
                onChange={(e) => setNewPw(e.target.value)}
                className="input pr-14"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-muted hover:text-foreground px-1.5 py-1 rounded transition-colors"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? "hide" : "show"}
              </button>
            </div>
            {newPwStrengthError && (
              <div className="text-[11.5px] text-danger mt-1.5">
                {newPwStrengthError}
              </div>
            )}
            {!newPwStrengthError && newPw && (
              <div className="text-[11.5px] text-accent mt-1.5">Looks good.</div>
            )}
          </Field>
          <Field label="Confirm new password" htmlFor="profile-confirm-pw">
            <input
              id="profile-confirm-pw"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="input"
            />
            {confirmMismatch && (
              <div className="text-[11.5px] text-danger mt-1.5">
                {confirmMismatch}
              </div>
            )}
          </Field>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pwStatus === "saving"}
              className="btn btn-sm btn-primary"
            >
              {pwStatus === "saving"
                ? "Saving…"
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
              <span className="text-[12px] text-danger">{pwError}</span>
            )}
          </div>
        </form>
      </SettingsCard>

      {/* Sign out */}
      <SettingsCard
        title="Sign out"
        description="Ends your session and returns you to the sign-in page."
      >
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn btn-sm btn-danger-ghost">
            Sign out
          </button>
        </form>
      </SettingsCard>
    </div>
  );
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5 max-w-lg">
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-[12px] text-muted mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="text-[10.5px] uppercase tracking-[0.12em] text-muted font-medium font-num block mb-1.5"
      >
        {label}
        {optional && (
          <span className="text-dim normal-case tracking-normal font-normal ml-1.5">
            (optional)
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
