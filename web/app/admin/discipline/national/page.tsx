import { AdminDisciplinePage } from "@/components/admin/AdminDisciplinePage";
import { requireManagedAdminScope } from "@/lib/auth/admin-hub-access";
import { SCOPES } from "@/lib/competition/scopes";

export default async function NationalDisciplinePage() {
  await requireManagedAdminScope(SCOPES.NATIONAL);
  return <AdminDisciplinePage scope={SCOPES.NATIONAL} />;
}
