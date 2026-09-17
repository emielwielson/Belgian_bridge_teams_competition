import { notFound } from "next/navigation";
import { ButlerPairResultsView } from "@/components/butler/ButlerPairResultsView";

export default async function ButlerRoundPairPage({
  params,
}: {
  params: Promise<{ round: string; combinationId: string }>;
}) {
  const { round: roundSeg, combinationId } = await params;
  const round = Number(roundSeg);
  if (!Number.isInteger(round) || round < 1) notFound();

  return (
    <ButlerPairResultsView
      combinationId={combinationId}
      tournamentRound={round}
    />
  );
}
