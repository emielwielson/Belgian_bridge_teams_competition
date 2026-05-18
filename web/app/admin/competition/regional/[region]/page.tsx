import { CompetitionScopePage } from "@/components/admin/CompetitionScopePage";
import { createServiceClient } from "@/lib/supabase/server-client";
import {
  parseRegionParam,
  SCOPES,
  type RegionCode,
} from "@/lib/competition/scopes";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ region: string }> };

export default async function RegionalCompetitionPage({ params }: Props) {
  const { region } = await params;
  const regionCode = parseRegionParam(region);
  if (!regionCode) notFound();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("regions")
    .select("id")
    .eq("code", regionCode)
    .single();

  if (!data) notFound();

  return (
    <CompetitionScopePage
      scope={SCOPES.REGIONAL}
      regionCode={regionCode as RegionCode}
      regionId={data.id}
    />
  );
}
