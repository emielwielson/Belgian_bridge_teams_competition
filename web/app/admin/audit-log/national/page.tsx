import { AdminAuditLogPage } from "@/components/admin/AdminAuditLogPage";
import { SCOPES } from "@/lib/competition/scopes";

export default function NationalAuditLogPage() {
  return <AdminAuditLogPage scope={SCOPES.NATIONAL} />;
}
