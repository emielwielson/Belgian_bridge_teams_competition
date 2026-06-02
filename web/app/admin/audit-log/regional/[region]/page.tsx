import { AdminAuditLogPage } from "@/components/admin/AdminAuditLogPage";
import { parseRegionParam, SCOPES, type RegionCode } from "@/lib/competition/scopes";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ region: string }> };

export default async function RegionalAuditLogPage({ params }: Props) {
  const { region } = await params;
  const regionCode = parseRegionParam(region);
  if (!regionCode) notFound();

  return (
    <AdminAuditLogPage
      scope={SCOPES.REGIONAL}
      regionCode={regionCode as RegionCode}
    />
  );
}
