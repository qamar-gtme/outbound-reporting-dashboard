import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { SectionHead, SubHead } from "@/components/SectionHead";
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
  const providersFromMeta = (user.app_metadata?.providers as string[] | undefined) ?? [];

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
        eyebrow="Account"
        title="Profile"
        description="Your sign-in details, display name, and password. Email changes are handled by an admin."
      />

      <SubHead title="Account" />
      <div className="card p-6 mb-2 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
        <Field label="Email" value={user.email ?? "—"} mono />
        <Field label="User ID" value={user.id} mono small />
        <Field label="Account created" value={fmtDate(user.created_at)} />
        <Field label="Last sign-in" value={fmtDate(user.last_sign_in_at)} />
        <div className="md:col-span-2">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium mb-2">
            Sign-in methods
          </div>
          <div className="flex flex-wrap gap-2">
            {providerLabels.map((p) => (
              <span
                key={p}
                className={`kbd ${p === "Magic link" ? "text-info" : "text-accent"}`}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

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
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium mb-1.5">
        {label}
      </div>
      <div
        className={`${mono ? "font-num" : ""} ${small ? "text-[11.5px]" : "text-[13.5px]"} text-ink2 break-all`}
      >
        {value}
      </div>
    </div>
  );
}
