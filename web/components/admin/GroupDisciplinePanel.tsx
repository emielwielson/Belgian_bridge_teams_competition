"use client";

import { PenaltyManagement } from "./PenaltyManagement";
import { RulingManagement } from "./RulingManagement";
import { WarningManagement } from "./WarningManagement";

type Props = {
  groupId: string | null;
  teams: { id: string; name: string }[];
};

export function GroupDisciplinePanel({ groupId, teams }: Props) {
  if (!groupId) return null;

  return (
    <div className="flex flex-col gap-4">
      <PenaltyManagement groupId={groupId} teams={teams} />
      <WarningManagement groupId={groupId} teams={teams} />
      <RulingManagement groupId={groupId} />
    </div>
  );
}
