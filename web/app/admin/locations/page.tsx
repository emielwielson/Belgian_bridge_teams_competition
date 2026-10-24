import { AdminClubLocationsPage } from "@/components/admin/AdminClubLocationsPage";
import { getManagedAdminHubLinks } from "@/lib/auth/admin-hub-access";
import { COMPETITION_KIND_CODES } from "@/lib/auth/competition-scope";
import { createServiceClient } from "@/lib/supabase/server-client";

export default async function AdminLocationsPage() {
  const [hubLinks, regionsResult] = await Promise.all([
    getManagedAdminHubLinks(),
    createServiceClient()
      .from("regions")
      .select("id, code, name")
      .order("name"),
  ]);

  const canManageHonorVenues = hubLinks.some(
    (link) => link.kind === COMPETITION_KIND_CODES.NATIONAL,
  );

  return (
    <AdminClubLocationsPage
      regions={regionsResult.data ?? []}
      canManageHonorVenues={canManageHonorVenues}
    />
  );
}
