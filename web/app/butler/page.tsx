import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ButlerModeRoundNav } from "@/components/butler/ButlerModeRoundNav";
import { ButlerOverallModeTabs } from "@/components/butler/ButlerOverallModeTabs";
import {
  ButlerOverallPlayerStandings,
  ButlerOverallStandings,
} from "@/components/butler/ButlerOverallStandings";
import { ButlerStandingsTabs } from "@/components/butler/ButlerStandingsTabs";
import { createPublicClient } from "@/lib/supabase/server-client";
import { resolvePublicHonorGroup } from "@/lib/butler/honor-group";
import {
  getPublishedCombinationStandings,
  getPublishedPlayerStandings,
} from "@/lib/butler/public-standings";
import { formatImps } from "@/lib/butler/format";
import { formatPairDisplayName } from "@/lib/butler/person-name";

export default async function ButlerOverviewPage() {
  const t = await getTranslations("butler");
  const client = createPublicClient();
  const group = await resolvePublicHonorGroup(client);

  if (!group) {
    return (
      <main className="page-container">
        <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
        <p className="mt-2 text-sm text-zinc-600">{t("empty")}</p>
      </main>
    );
  }

  const [standings, playerStandings, pubsResult, boardsResult] =
    await Promise.all([
      getPublishedCombinationStandings(client, group.id),
      getPublishedPlayerStandings(client, group.id),
      client
        .from("honor_round_publication")
        .select("tournament_round")
        .eq("group_id", group.id)
        .eq("status", "published")
        .order("tournament_round"),
      client
        .from("honor_boards")
        .select("id, tournament_round, board_number")
        .eq("group_id", group.id)
        .eq("publication_status", "published")
        .order("tournament_round")
        .order("board_number"),
    ]);

  const publishedRounds = new Set(
    (pubsResult.data ?? []).map((p) => p.tournament_round as number),
  );
  for (const r of standings.rounds) {
    publishedRounds.add(r.tournamentRound);
  }

  const firstBoardByRound = new Map<number, string>();
  for (const board of boardsResult.data ?? []) {
    const round = board.tournament_round as number;
    if (!firstBoardByRound.has(round)) {
      firstBoardByRound.set(round, board.id as string);
    }
  }

  const modeRounds = [...publishedRounds]
    .sort((a, b) => a - b)
    .map((tournamentRound) => ({
      tournamentRound,
      firstBoardId: firstBoardByRound.get(tournamentRound) ?? null,
    }));

  return (
    <main className="page-container max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        {t("title")}
      </h1>
      <p className="mt-1 text-sm text-zinc-600">{t("subtitle")}</p>

      <ButlerModeRoundNav
        rounds={modeRounds}
        handsLabel={t("handDiagrams")}
        frequencyLabel={t("frequencySheets")}
        selectRoundLabel={t("selectRound")}
        modeAriaLabel={t("modeNavAria")}
        roundAriaLabel={t("roundNavAria")}
      />

      {standings.combinations.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600">{t("empty")}</p>
      ) : (
        <ButlerStandingsTabs
          overallLabel={t("tabOverall")}
          byRoundLabel={t("roundMatrix")}
          ariaLabel={t("tabAria")}
          overall={
            <ButlerOverallModeTabs
              pairLabel={t("viewPair")}
              playerLabel={t("viewPlayer")}
              ariaLabel={t("viewModeAria")}
              pair={
                <ButlerOverallStandings
                  combinations={standings.combinations}
                  maxRounds={standings.rounds.length}
                />
              }
              player={
                <ButlerOverallPlayerStandings
                  players={playerStandings}
                  maxRounds={standings.rounds.length}
                />
              }
            />
          }
          byRound={
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="sticky left-0 z-10 whitespace-nowrap bg-zinc-50 px-3 py-2 font-medium">
                      {t("pair")}
                    </th>
                    {standings.rounds.map((r) => (
                      <th
                        key={r.tournamentRound}
                        className="whitespace-nowrap px-3 py-2 text-right font-medium"
                      >
                        <Link
                          href={`/butler/rounds/${r.tournamentRound}`}
                          className="link-inline"
                        >
                          R{r.tournamentRound}
                        </Link>
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                      {t("total")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {standings.combinations.map((row, index) => {
                    const stripe =
                      index % 2 === 1 ? "bg-zinc-50" : "bg-white";
                    return (
                      <tr key={row.combinationId}>
                        <td
                          className={`sticky left-0 z-10 px-3 py-2 whitespace-nowrap ${stripe}`}
                        >
                          <Link
                            href={`/butler/pairs/${row.combinationId}`}
                            className="link-inline"
                          >
                            {formatPairDisplayName(row.displayName)}
                          </Link>
                        </td>
                        {standings.rounds.map((r) => {
                          const cell =
                            standings.matrix[row.combinationId]?.[
                              r.tournamentRound
                            ];
                          return (
                            <td
                              key={r.tournamentRound}
                              className={`px-3 py-2 text-right font-mono tabular-nums ${stripe}`}
                            >
                              {cell ? formatImps(cell.imps) : "—"}
                            </td>
                          );
                        })}
                        <td
                          className={`px-3 py-2 text-right font-mono tabular-nums ${stripe}`}
                        >
                          {formatImps(row.totalImps)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          }
        />
      )}
    </main>
  );
}
