import { AdminTeamCaptainsPage } from "@/components/admin/AdminTeamCaptainsPage";
import { SCOPES } from "@/lib/competition/scopes";

export default function NationalTeamCaptainsPage() {
  return <AdminTeamCaptainsPage scope={SCOPES.NATIONAL} />;
}
