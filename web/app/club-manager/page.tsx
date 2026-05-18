import Link from "next/link";
import { redirect } from "next/navigation";
import { loadManagedClubsForUser } from "@/lib/auth/user-access";
import { createSessionClient } from "@/lib/supabase/server-client";

export default async function ClubManagerPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/club-manager");
  }

  const clubs = await loadManagedClubsForUser(supabase, user.id);

  if (clubs.length === 1) {
    redirect(`/club-manager/${clubs[0].id}`);
  }

  return (
    <main className="page-container flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Club manager</h1>
      <p className="text-sm text-zinc-600">
        Manage players and memberships for your assigned clubs.
      </p>
      {clubs.length === 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">No club assigned yet</p>
          <p className="mt-2">
            A competition manager must link your account to a club. You need
            both the <code className="rounded bg-amber-100 px-1">club_manager</code>{" "}
            role and a row in{" "}
            <code className="rounded bg-amber-100 px-1">
              club_manager_assignments
            </code>
            .
          </p>
          <p className="mt-3 font-medium">In Supabase SQL (as competition admin)</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>
              Copy your user id from Authentication → Users (column{" "}
              <code className="rounded bg-amber-100 px-1">id</code>).
            </li>
            <li>
              Copy the club id from Table Editor →{" "}
              <code className="rounded bg-amber-100 px-1">clubs</code>.
            </li>
            <li>Run:</li>
          </ol>
          <pre className="mt-2 overflow-x-auto rounded bg-amber-100/80 p-3 text-xs">
{`insert into public.user_roles (user_id, role)
values ('${user.id}', 'club_manager')
on conflict do nothing;

insert into public.club_manager_assignments (user_id, club_id)
values ('${user.id}', '<clubs.id>');`}
          </pre>
          <p className="mt-2 text-amber-900">
            Your user id is pre-filled above. Replace{" "}
            <code className="rounded bg-amber-100 px-1">&lt;clubs.id&gt;</code>{" "}
            with the club uuid, then sign out and back in.
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-2">
          {clubs.map((club) => (
            <li key={club.id}>
              <Link
                href={`/club-manager/${club.id}`}
                className="card block font-medium hover:border-zinc-400"
              >
                {club.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
