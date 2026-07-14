import { AdminClubLocationsPage } from "@/components/admin/AdminClubLocationsPage";
import { createServiceClient } from "@/lib/supabase/server-client";

export default async function AdminLocationsPage() {
  const supabase = createServiceClient();
  const { data: regions } = await supabase
    .from("regions")
    .select("id, code, name")
    .order("name");

  return <AdminClubLocationsPage regions={regions ?? []} />;
}
