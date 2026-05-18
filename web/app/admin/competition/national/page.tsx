import { CompetitionScopePage } from "@/components/admin/CompetitionScopePage";
import { SCOPES } from "@/lib/competition/scopes";

export default function NationalCompetitionPage() {
  return <CompetitionScopePage scope={SCOPES.NATIONAL} />;
}
