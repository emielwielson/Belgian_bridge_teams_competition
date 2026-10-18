import { AdminMissingScoresPage } from "@/components/admin/AdminMissingScoresPage";
import { requireManagedAdminScope } from "@/lib/auth/admin-hub-access";
import { SCOPES } from "@/lib/competition/scopes";

export default async function NationalMissingScoresPage() {
  await requireManagedAdminScope(SCOPES.NATIONAL);
  return <AdminMissingScoresPage scope={SCOPES.NATIONAL} />;
}
