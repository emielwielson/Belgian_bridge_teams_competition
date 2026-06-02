import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { loadManagedClubsForUser } from "@/lib/auth/user-access";
import { createSessionClient } from "@/lib/supabase/server-client";

export default async function ClubManagerPage() {
  const t = await getTranslations("club");
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/club-manager");
  }

  const clubs = await loadManagedClubsForUser(supabase, user.id);

  return (
    <main className="page-container flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900">{t("hubTitle")}</h1>
      <p className="text-sm text-zinc-600">{t("hubDescription")}</p>
      {clubs.length === 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">{t("noClubTitle")}</p>
          <p className="mt-2">
            {t.rich("noClubBody", {
              roleCode: () => (
                <code className="rounded bg-amber-100 px-1">club_manager</code>
              ),
              assignmentsCode: () => (
                <code className="rounded bg-amber-100 px-1">
                  club_manager_assignments
                </code>
              ),
            })}
          </p>
          <p className="mt-3 font-medium">{t("sqlInstructionsTitle")}</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>
              {t.rich("sqlStep1", {
                clubsTable: () => (
                  <code className="rounded bg-amber-100 px-1">clubs</code>
                ),
              })}
            </li>
            <li>{t("sqlStep2")}</li>
            <li>{t("sqlStep3")}</li>
          </ol>
          <pre className="mt-2 overflow-x-auto rounded bg-amber-100/80 p-3 text-xs">
{`-- Step 1: club_manager role (required for /club-manager routes)
insert into public.user_roles (user_id, role)
values ('${user.id}', 'club_manager')
on conflict (user_id, role) do nothing;

-- Step 2: link user to club (required for club data & "My club")
insert into public.club_manager_assignments (user_id, club_id)
values ('${user.id}', '<clubs.id>')
on conflict (user_id, club_id) do nothing;`}
          </pre>
          <p className="mt-2 text-amber-900">
            {t.rich("sqlReplaceClubId", {
              clubIdPlaceholder: () => (
                <code className="rounded bg-amber-100 px-1">&lt;clubs.id&gt;</code>
              ),
            })}
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
