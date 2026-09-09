import {
  COMPETITION_KIND_CODES,
  getManagedCompetitionKinds,
  managesKindCode,
  type CompetitionKindCode,
} from "@/lib/auth/competition-scope";
import { requireRoles, COMPETITION_ADMIN_ROLES } from "@/lib/auth/route-auth";
import {
  REGION_CODES,
  SCOPES,
  type CompetitionScope,
  type RegionCode,
} from "@/lib/competition/scopes";
import { notFound } from "next/navigation";

export type AdminHubLink = {
  kind: CompetitionKindCode;
  scope: CompetitionScope;
  regionCode?: RegionCode;
  labelKey: "national" | "flandersRegional" | "walloniaRegional";
};

const ALL_HUB_LINKS: AdminHubLink[] = [
  {
    kind: COMPETITION_KIND_CODES.NATIONAL,
    scope: SCOPES.NATIONAL,
    labelKey: "national",
  },
  {
    kind: COMPETITION_KIND_CODES.FLANDERS,
    scope: SCOPES.REGIONAL,
    regionCode: REGION_CODES.FLANDERS,
    labelKey: "flandersRegional",
  },
  {
    kind: COMPETITION_KIND_CODES.WALLONIA,
    scope: SCOPES.REGIONAL,
    regionCode: REGION_CODES.WALLONIA,
    labelKey: "walloniaRegional",
  },
];

export async function getManagedAdminHubLinks(): Promise<AdminHubLink[]> {
  const { user, roles, supabase } = await requireRoles([
    ...COMPETITION_ADMIN_ROLES,
  ]);
  const managed = await getManagedCompetitionKinds(supabase, user.id, roles);
  return ALL_HUB_LINKS.filter((link) => managesKindCode(managed, link.kind));
}

export async function requireManagedAdminScope(
  scope: CompetitionScope,
  regionCode?: RegionCode,
): Promise<void> {
  const { user, roles, supabase } = await requireRoles([
    ...COMPETITION_ADMIN_ROLES,
  ]);
  const managed = await getManagedCompetitionKinds(supabase, user.id, roles);
  const kind: CompetitionKindCode =
    scope === SCOPES.NATIONAL
      ? COMPETITION_KIND_CODES.NATIONAL
      : regionCode === REGION_CODES.WALLONIA
        ? COMPETITION_KIND_CODES.WALLONIA
        : COMPETITION_KIND_CODES.FLANDERS;
  if (!managesKindCode(managed, kind)) {
    notFound();
  }
}
