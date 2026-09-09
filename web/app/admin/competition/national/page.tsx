import { NationalCompetitionSetup } from "@/components/admin/NationalCompetitionSetup";
import { requireManagedAdminScope } from "@/lib/auth/admin-hub-access";
import { SCOPES } from "@/lib/competition/scopes";

export default async function NationalCompetitionPage() {
  await requireManagedAdminScope(SCOPES.NATIONAL);
  return <NationalCompetitionSetup />;
}
