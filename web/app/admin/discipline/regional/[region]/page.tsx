import { AdminDisciplinePage } from "@/components/admin/AdminDisciplinePage";
import { requireManagedAdminScope } from "@/lib/auth/admin-hub-access";
import { parseRegionParam, SCOPES, type RegionCode } from "@/lib/competition/scopes";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ region: string }> };

export default async function RegionalDisciplinePage({ params }: Props) {
  const { region } = await params;
  const regionCode = parseRegionParam(region);
  if (!regionCode) notFound();

  await requireManagedAdminScope(SCOPES.REGIONAL, regionCode);

  return (
    <AdminDisciplinePage
      scope={SCOPES.REGIONAL}
      regionCode={regionCode as RegionCode}
    />
  );
}
