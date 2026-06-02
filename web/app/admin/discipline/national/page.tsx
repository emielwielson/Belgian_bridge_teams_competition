import { AdminDisciplinePage } from "@/components/admin/AdminDisciplinePage";
import { SCOPES } from "@/lib/competition/scopes";

export default function NationalDisciplinePage() {
  return <AdminDisciplinePage scope={SCOPES.NATIONAL} />;
}
