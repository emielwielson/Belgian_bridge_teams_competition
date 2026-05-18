import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server-client";

async function loadGroups() {
  const supabase = await createSessionClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (!season) return [];

  const { data: leagues } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("season_id", season.id);

  const leagueIds = leagues?.map((l) => l.id) ?? [];
  if (leagueIds.length === 0) return [];

  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name, league_id")
    .in("league_id", leagueIds);

  const divisionIds = divisions?.map((d) => d.id) ?? [];
  if (divisionIds.length === 0) return [];

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name, division_id")
    .in("division_id", divisionIds);

  const leagueById = new Map(leagues?.map((l) => [l.id, l.name]) ?? []);
  const divisionById = new Map(
    divisions?.map((d) => [d.id, { name: d.name, leagueId: d.league_id }]) ?? [],
  );

  return (groups ?? []).map((group) => {
    const division = divisionById.get(group.division_id);
    return {
      id: group.id,
      name: group.name,
      division_name: division?.name,
      league_name: division ? leagueById.get(division.leagueId) : undefined,
    };
  });
}

export default async function StandingsPage() {
  const groups = await loadGroups();

  return (
    <main className="page-container flex max-w-lg flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Standings</h1>
        <p className="mt-1 text-sm text-zinc-600">Public group standings</p>
      </header>
      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500">No groups in the active season yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/standings/${group.id}`}
                className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400"
              >
                <span className="font-medium">{group.name}</span>
                {(group.league_name || group.division_name) && (
                  <span className="mt-0.5 block text-sm text-zinc-500">
                    {[group.league_name, group.division_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
