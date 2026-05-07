import { createClient } from "@/lib/supabase-server";

export async function UserChip() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  return (
    <form action="/auth/signout" method="post" className="flex items-center gap-2">
      <span className="kbd flex items-center gap-1.5">
        <span className="block w-1.5 h-1.5 rounded-full bg-accent" />
        {user.email}
      </span>
      <button
        type="submit"
        className="kbd hover:text-loss hover:border-loss/30 transition cursor-pointer"
        title="Sign out"
      >
        sign out
      </button>
    </form>
  );
}
