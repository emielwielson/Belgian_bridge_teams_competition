import { AdminAuditLogPage } from "@/components/admin/AdminAuditLogPage";
import { requireManagedAdminScope } from "@/lib/auth/admin-hub-access";
import { SCOPES } from "@/lib/competition/scopes";

export default async function NationalAuditLogPage() {
  await requireManagedAdminScope(SCOPES.NATIONAL);
  return <AdminAuditLogPage scope={SCOPES.NATIONAL} />;
}
