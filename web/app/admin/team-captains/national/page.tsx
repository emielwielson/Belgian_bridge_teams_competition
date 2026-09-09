import { AdminTeamCaptainsPage } from "@/components/admin/AdminTeamCaptainsPage";
import { requireManagedAdminScope } from "@/lib/auth/admin-hub-access";
import { SCOPES } from "@/lib/competition/scopes";

export default async function NationalTeamCaptainsPage() {
  await requireManagedAdminScope(SCOPES.NATIONAL);
  return <AdminTeamCaptainsPage scope={SCOPES.NATIONAL} />;
}
