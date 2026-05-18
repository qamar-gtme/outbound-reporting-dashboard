import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { SectionHead } from "@/components/SectionHead";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const identities = user.identities ?? [];
  const hasPasswordProvider = identities.some((i) => i.provider === "email");
  const providersFromMeta =
    (user.app_metadata?.providers as string[] | undefined) ?? [];

  const providerLabels: string[] = [];
  if (providersFromMeta.includes("email") || hasPasswordProvider) {
    providerLabels.push("Email");
  }
  if (!hasPasswordProvider) {
    providerLabels.push("Magic link");
  }
  if (providerLabels.length === 0) providerLabels.push("Email");

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    "";

  return (
    <div>
      <SectionHead
        eyebrow="Settings"
        title="Profile"
        description="Sign-in details, display name, and password. Email changes are handled by an admin."
      />

      {/* Account summary */}
      <section className="card p-5 mb-4 max-w-lg">
        <h2 className="text-[13px] font-semibold text-foreground mb-4">
          Account
        </h2>
        <dl className="grid grid-cols-1 gap-y-3 text-[13px]">
          <Field label="Email" value={user.email ?? "—"} mono />
          <Field label="User ID" value={user.id} mono small />
          <Field label="Account created" value={fmtDate(user.created_at)} />
          <Field
            label="Last sign-in"
            value={fmtDate(user.last_sign_in_at)}
          />
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted font-medium font-num mb-1.5">
              Sign-in methods
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {providerLabels.map((p) => (
                <span
                  key={p}
                  className={`kbd ${p === "Magic link" ? "text-info" : "text-accent"}`}
                >
                  {p}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </section>

      <ProfileForm
        email={user.email ?? ""}
        initialDisplayName={displayName}
        hasPasswordProvider={hasPasswordProvider}
      />
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted font-medium font-num shrink-0">
        {label}
      </dt>
      <dd
        className={`${mono ? "font-num" : ""} ${
          small ? "text-[11px]" : "text-[12.5px]"
        } text-ink2 text-right break-all min-w-0`}
      >
        {value}
      </dd>
    </div>
  );
}
