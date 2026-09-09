import { AdminTeamCaptainsPage } from "@/components/admin/AdminTeamCaptainsPage";
import { requireManagedAdminScope } from "@/lib/auth/admin-hub-access";
import { parseRegionParam, SCOPES, type RegionCode } from "@/lib/competition/scopes";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ region: string }> };

export default async function RegionalTeamCaptainsPage({ params }: Props) {
  const { region } = await params;
  const regionCode = parseRegionParam(region);
  if (!regionCode) notFound();

  await requireManagedAdminScope(SCOPES.REGIONAL, regionCode);

  return (
    <AdminTeamCaptainsPage
      scope={SCOPES.REGIONAL}
      regionCode={regionCode as RegionCode}
    />
  );
}
