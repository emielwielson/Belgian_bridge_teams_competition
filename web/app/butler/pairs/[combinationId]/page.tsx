import { ButlerPairResultsView } from "@/components/butler/ButlerPairResultsView";

export default async function ButlerPairSeasonPage({
  params,
}: {
  params: Promise<{ combinationId: string }>;
}) {
  const { combinationId } = await params;
  return (
    <ButlerPairResultsView
      combinationId={combinationId}
      tournamentRound={null}
    />
  );
}
