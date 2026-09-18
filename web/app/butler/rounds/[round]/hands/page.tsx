import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HandDiagram } from "@/components/boards/HandDiagram";
import type { BoardHands, Dealer, Vulnerability } from "@/lib/boards/types";
import { handDiagramLabelsFromButler } from "@/lib/boards/hand-diagram-labels";
import { createPublicClient } from "@/lib/supabase/server-client";
import { resolvePublicHonorGroup } from "@/lib/butler/honor-group";

export default async function ButlerRoundHandsPage({
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
  if (!group) notFound();

  const { data: pub } = await client
    .from("honor_round_publication")
    .select("status")
    .eq("group_id", group.id)
    .eq("tournament_round", round)
    .maybeSingle();
  if (pub?.status !== "published") notFound();

  const { data: boards } = await client
    .from("honor_boards")
    .select("id, board_number, dealer, vulnerability, hands")
    .eq("group_id", group.id)
    .eq("tournament_round", round)
    .eq("publication_status", "published")
    .order("board_number");

  return (
    <main className="page-container max-w-5xl">
      <p className="text-sm">
        <Link
          href={`/butler/rounds/${round}`}
          className="text-zinc-600 hover:underline"
        >
          {t("backRound", { round })}
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        {t("roundTitle", { round })} — {t("allHands")}
      </h1>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {(boards ?? []).map((b) => {
          const dealer = (b.dealer as Dealer | null) ?? "N";
          const vulnerability =
            (b.vulnerability as Vulnerability | null) ?? "NONE";
          return (
            <div key={b.id}>
            <Link
              href={`/butler/boards/${b.id}`}
              className="link-inline mb-2 inline-block text-sm"
            >
              {t("dealTitle", { board: b.board_number })}
            </Link>
              {b.hands ? (
                <HandDiagram
                  boardNumber={b.board_number}
                  dealer={dealer}
                  vulnerability={vulnerability}
                  hands={b.hands as BoardHands}
                  labels={handDiagramLabelsFromButler(t, {
                    dealer,
                    vulnerability,
                    boardNumber: b.board_number,
                  })}
                  showBoardNumber={false}
                />
              ) : (
                <p className="text-sm text-zinc-500">{t("noBoards")}</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
