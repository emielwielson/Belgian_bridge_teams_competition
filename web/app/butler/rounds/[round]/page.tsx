import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createPublicClient } from "@/lib/supabase/server-client";
import { resolvePublicHonorGroup } from "@/lib/butler/honor-group";
import { getPublishedRoundStandings } from "@/lib/butler/public-standings";
import { formatImps } from "@/lib/butler/format";

export default async function ButlerRoundPage({
  params,
}: {
  params: Promise<{ round: string }>;
}) {
  const t = await getTranslations("butler");
  const { round: roundSeg } = await params;
  const round = Number(roundSeg);
  if (!Number.isInteger(round) || round < 1) notFound();

  const client = createPublicClient();
  const group = await resolvePublicHonorGroup(client);
  if (!group || round > group.round_count) notFound();

  const { data: pub } = await client
    .from("honor_round_publication")
    .select("status")
    .eq("group_id", group.id)
    .eq("tournament_round", round)
    .maybeSingle();
  if (pub?.status !== "published") notFound();

  const standings = await getPublishedRoundStandings(client, group.id, round);
  const { data: boards } = await client
    .from("honor_boards")
    .select("id, board_number")
    .eq("group_id", group.id)
    .eq("tournament_round", round)
    .eq("publication_status", "published")
    .order("board_number")
    .limit(1);

  const firstBoard = boards?.[0] ?? null;

  return (
    <main className="page-container max-w-5xl">
      <p className="text-sm">
        <Link href="/butler" className="text-zinc-600 hover:underline">
          {t("backOverview")}
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
        {t("roundTitle", { round })}
      </h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/butler/rounds/${round}/hands`} className="btn-secondary">
          {t("handDiagrams")}
        </Link>
        {firstBoard ? (
          <Link
            href={`/butler/boards/${firstBoard.id}`}
            className="btn-secondary"
          >
            {t("frequencySheets")}
          </Link>
        ) : (
          <span className="btn-secondary pointer-events-none opacity-50">
            {t("frequencySheets")}
          </span>
        )}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">{t("roundStandings")}</h2>
        {standings.length === 0 ? (
          <p className="text-sm text-zinc-600">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("rank")}</th>
                  <th className="px-3 py-2 font-medium">{t("pair")}</th>
                  <th className="px-3 py-2 font-medium">{t("team")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("imps")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {standings.map((row) => (
                  <tr key={row.combinationId}>
                    <td className="px-3 py-2 tabular-nums text-zinc-500">
                      {row.rank}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/butler/rounds/${round}/pairs/${row.combinationId}`}
                        className="link-inline"
                      >
                        {row.displayName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{row.teamName}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatImps(row.totalImps)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
