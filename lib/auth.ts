"use client";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-browser";

/**
 * True if the user has an `email` identity (i.e. a real password is set on
 * the account). Magic-link-only users have no email identity, so this
 * returns false for them and the UI flips into "Set a password" mode.
 */
export function hasEmailPasswordProvider(user: User | null | undefined): boolean {
  if (!user) return false;
  const identities = user.identities ?? [];
  return identities.some((i) => i.provider === "email");
}

/** Format the human-readable provider list for the Account card. */
export function describeProviders(user: User | null | undefined): string[] {
  if (!user) return [];
  const labels = new Set<string>();
  // app_metadata.providers is the most complete list of providers ever used.
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [];
  providers.forEach((p) => {
    if (p === "email") labels.add("Email");
  });
  // If the user has signed in by magic link but never set a password, there
  // is no `email` identity yet — surface that explicitly.
  if (!hasEmailPasswordProvider(user)) labels.add("Magic link");
  if (labels.size === 0) labels.add("Email");
  return Array.from(labels);
}

export async function updateDisplayName(name: string) {
  const supabase = createClient();
  const trimmed = name.trim();
  return supabase.auth.updateUser({ data: { display_name: trimmed } });
}

type SetOrChangeArgs = {
  email: string;
  currentPassword?: string;
  newPassword: string;
};

/**
 * Set OR change the user's password.
 *  - If `currentPassword` is provided, verify it via signInWithPassword first.
 *    This is the "change password" path for users who already have one set.
 *  - If not provided, we assume the caller has determined this user has no
 *    password yet (magic-link-only) and call `updateUser({ password })`
 *    directly. Supabase accepts this as long as the session is valid.
 */
export async function setOrChangePassword({
  email,
  currentPassword,
  newPassword,
}: SetOrChangeArgs) {
  const supabase = createClient();

  if (currentPassword) {
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (verifyError) {
      return { error: { message: "Current password is incorrect." } };
    }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: { message: error.message } };
  return { error: null };
}

/** Basic strength: ≥8 chars, at least one letter and one number. */
export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 8) return "At least 8 characters.";
  if (!/[A-Za-z]/.test(pw)) return "Must include at least one letter.";
  if (!/[0-9]/.test(pw)) return "Must include at least one number.";
  return null;
}
