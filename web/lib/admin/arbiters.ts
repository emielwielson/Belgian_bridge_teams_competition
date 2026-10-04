import type { SupabaseClient } from "@supabase/supabase-js";
import {
  filterKindCodesToManaged,
  getArbiterAccess,
  managerCanGrantHonor,
} from "@/lib/auth/arbiter-scope";
import {
  COMPETITION_KIND_CODES,
  getManagedCompetitionKinds,
  managesKindCode,
  resolveCompetitionKindId,
  type CompetitionKindCode,
  type ManagedCompetitionKinds,
} from "@/lib/auth/competition-scope";
import { AuthError } from "@/lib/auth/auth-error";
import { ROLES } from "@/lib/auth/roles";
import {
  ensureAuthUserForLogin,
  normalizeLoginEmail,
  isValidLoginEmailFormat,
} from "@/lib/auth/login-email";
import { defaultLocale, type Locale } from "@/i18n/config";
import {
  loadUserDisplayName,
  upsertUserDisplayName,
} from "@/lib/auth/actor-display-name";

export type ArbiterListItem = {
  userId: string;
  email: string | null;
  displayName: string | null;
  playerName: string | null;
  kinds: CompetitionKindCode[];
  chiefKinds: CompetitionKindCode[];
  honor: boolean;
};

const ALL_KIND_CODES: CompetitionKindCode[] = [
  COMPETITION_KIND_CODES.NATIONAL,
  COMPETITION_KIND_CODES.FLANDERS,
  COMPETITION_KIND_CODES.WALLONIA,
  COMPETITION_KIND_CODES.ZWEIFFEL,
];

export function parseKindCodes(raw: unknown): CompetitionKindCode[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(ALL_KIND_CODES);
  const out: CompetitionKindCode[] = [];
  for (const item of raw) {
    if (typeof item === "string" && allowed.has(item)) {
      out.push(item as CompetitionKindCode);
    }
  }
  return [...new Set(out)];
}

/**
 * Chief kinds must be a subset of the arbiter's scoped kinds.
 */
export function parseChiefKindCodes(
  raw: unknown,
  scopedKinds: CompetitionKindCode[],
): CompetitionKindCode[] {
  const scoped = new Set(scopedKinds);
  return parseKindCodes(raw).filter((code) => scoped.has(code));
}

async function clearChiefForKind(
  service: SupabaseClient,
  kindId: string,
): Promise<void> {
  const { error } = await service
    .from("arbiter_competition_scopes")
    .update({ is_chief: false })
    .eq("competition_kind_id", kindId)
    .eq("is_chief", true);
  if (error) throw error;
}

async function setChiefForUserKinds(
  service: SupabaseClient,
  userId: string,
  managed: ManagedCompetitionKinds,
  desiredChief: CompetitionKindCode[],
  currentKinds: CompetitionKindCode[],
): Promise<void> {
  for (const code of ALL_KIND_CODES) {
    if (!managesKindCode(managed, code)) continue;
    if (!currentKinds.includes(code)) continue;

    const kindId = await resolveCompetitionKindId(service, code);
    const shouldBeChief = desiredChief.includes(code);

    if (shouldBeChief) {
      await clearChiefForKind(service, kindId);
      const { error } = await service
        .from("arbiter_competition_scopes")
        .update({ is_chief: true })
        .eq("user_id", userId)
        .eq("competition_kind_id", kindId);
      if (error) throw error;
    } else {
      const { error } = await service
        .from("arbiter_competition_scopes")
        .update({ is_chief: false })
        .eq("user_id", userId)
        .eq("competition_kind_id", kindId);
      if (error) throw error;
    }
  }
}

async function findAuthUserIdByEmail(
  service: SupabaseClient,
  normalizedEmail: string,
): Promise<string | null> {
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const matched = data.users.find(
      (u) =>
        u.email != null && normalizeLoginEmail(u.email) === normalizedEmail,
    );
    if (matched) return matched.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function linkedPlayerName(
  service: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: links } = await service
    .from("player_auth_links")
    .select("player_id, player:players(name)")
    .eq("auth_user_id", userId)
    .limit(1);
  const link = links?.[0];
  if (!link) return null;
  const raw = link.player as unknown;
  const player = Array.isArray(raw) ? raw[0] : raw;
  return (player as { name?: string } | null)?.name ?? null;
}

function arbiterOverlapsManaged(
  managed: ManagedCompetitionKinds,
  kinds: CompetitionKindCode[],
  honor: boolean,
): boolean {
  if (kinds.some((k) => managesKindCode(managed, k))) return true;
  if (honor && managerCanGrantHonor(managed)) return true;
  return false;
}

export async function listArbitersForManager(
  service: SupabaseClient,
  managed: ManagedCompetitionKinds,
): Promise<ArbiterListItem[]> {
  const { data: roleRows, error } = await service
    .from("user_roles")
    .select("user_id")
    .eq("role", ROLES.ARBITER);
  if (error) throw error;

  const items: ArbiterListItem[] = [];
  for (const row of roleRows ?? []) {
    const access = await getArbiterAccess(service, row.user_id, [
      ROLES.ARBITER,
    ]);
    if (!arbiterOverlapsManaged(managed, access.kinds, access.honor)) {
      continue;
    }
    const { data: authData } = await service.auth.admin.getUserById(row.user_id);
    const [displayName, playerName] = await Promise.all([
      loadUserDisplayName(service, row.user_id),
      linkedPlayerName(service, row.user_id),
    ]);
    items.push({
      userId: row.user_id,
      email: authData.user?.email ?? null,
      displayName,
      playerName,
      kinds: access.kinds,
      chiefKinds: access.chiefKinds,
      honor: access.honor,
    });
  }

  items.sort((a, b) =>
    (a.displayName ?? a.email ?? a.userId).localeCompare(
      b.displayName ?? b.email ?? b.userId,
    ),
  );
  return items;
}

export async function createOrEnsureArbiter(options: {
  service: SupabaseClient;
  managed: ManagedCompetitionKinds;
  email: string;
  displayName: string;
  kinds: CompetitionKindCode[];
  chiefKinds?: CompetitionKindCode[];
  honor: boolean;
  locale?: Locale;
}): Promise<ArbiterListItem> {
  const { service, managed } = options;
  const email = normalizeLoginEmail(options.email);
  if (!isValidLoginEmailFormat(email)) {
    throw new Error("Invalid email");
  }
  const displayName = options.displayName.trim();
  if (!displayName) {
    throw new Error("Display name is required");
  }

  const grantedKinds = filterKindCodesToManaged(managed, options.kinds);
  const grantHonor =
    options.honor && managerCanGrantHonor(managed) ? true : false;

  if (grantedKinds.length === 0 && !grantHonor) {
    throw new AuthError(
      "Forbidden: assign at least one managed competition or Honor",
      403,
    );
  }

  const desiredChief = parseChiefKindCodes(
    options.chiefKinds ?? [],
    grantedKinds,
  );

  await ensureAuthUserForLogin(service, email, options.locale ?? defaultLocale);
  const userId = await findAuthUserIdByEmail(service, email);
  if (!userId) {
    throw new Error("Failed to create auth user");
  }

  const { error: roleError } = await service.from("user_roles").upsert(
    { user_id: userId, role: ROLES.ARBITER },
    { onConflict: "user_id,role" },
  );
  if (roleError) throw roleError;

  for (const code of grantedKinds) {
    const kindId = await resolveCompetitionKindId(service, code);
    const { error } = await service.from("arbiter_competition_scopes").upsert(
      { user_id: userId, competition_kind_id: kindId, is_chief: false },
      { onConflict: "user_id,competition_kind_id" },
    );
    if (error) throw error;
  }

  if (grantHonor) {
    const { error } = await service
      .from("arbiter_honor_access")
      .upsert({ user_id: userId }, { onConflict: "user_id" });
    if (error) throw error;
  }

  await setChiefForUserKinds(
    service,
    userId,
    managed,
    desiredChief,
    grantedKinds,
  );

  await upsertUserDisplayName(service, userId, displayName);

  const access = await getArbiterAccess(service, userId, [ROLES.ARBITER]);
  const playerName = await linkedPlayerName(service, userId);
  return {
    userId,
    email,
    displayName,
    playerName,
    kinds: access.kinds,
    chiefKinds: access.chiefKinds,
    honor: access.honor,
  };
}

export async function updateArbiterScopes(options: {
  service: SupabaseClient;
  managed: ManagedCompetitionKinds;
  userId: string;
  displayName?: string;
  kinds: CompetitionKindCode[];
  chiefKinds?: CompetitionKindCode[];
  honor: boolean;
}): Promise<ArbiterListItem> {
  const { service, managed, userId } = options;

  const { data: roleRow } = await service
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", ROLES.ARBITER)
    .maybeSingle();
  if (!roleRow) {
    throw new Error("Arbiter not found");
  }

  const current = await getArbiterAccess(service, userId, [ROLES.ARBITER]);
  const desiredManaged = filterKindCodesToManaged(managed, options.kinds);
  const desiredHonor =
    managerCanGrantHonor(managed) ? options.honor : current.honor;
  const desiredChief = parseChiefKindCodes(
    options.chiefKinds ?? current.chiefKinds,
    [
      ...desiredManaged,
      ...current.kinds.filter((k) => !managesKindCode(managed, k)),
    ],
  );

  // Kinds the manager controls: sync to desiredManaged
  for (const code of ALL_KIND_CODES) {
    if (!managesKindCode(managed, code)) continue;
    const kindId = await resolveCompetitionKindId(service, code);
    const shouldHave = desiredManaged.includes(code);
    const has = current.kinds.includes(code);
    if (shouldHave && !has) {
      const { error } = await service.from("arbiter_competition_scopes").upsert(
        { user_id: userId, competition_kind_id: kindId, is_chief: false },
        { onConflict: "user_id,competition_kind_id" },
      );
      if (error) throw error;
    } else if (!shouldHave && has) {
      const { error } = await service
        .from("arbiter_competition_scopes")
        .delete()
        .eq("user_id", userId)
        .eq("competition_kind_id", kindId);
      if (error) throw error;
    }
  }

  if (managerCanGrantHonor(managed)) {
    if (desiredHonor && !current.honor) {
      const { error } = await service
        .from("arbiter_honor_access")
        .upsert({ user_id: userId }, { onConflict: "user_id" });
      if (error) throw error;
    } else if (!desiredHonor && current.honor) {
      const { error } = await service
        .from("arbiter_honor_access")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
    }
  }

  const accessAfterScopes = await getArbiterAccess(service, userId, [
    ROLES.ARBITER,
  ]);
  await setChiefForUserKinds(
    service,
    userId,
    managed,
    desiredChief.filter((c) => accessAfterScopes.kinds.includes(c)),
    accessAfterScopes.kinds,
  );

  const access = await getArbiterAccess(service, userId, [ROLES.ARBITER]);
  if (access.kinds.length === 0 && !access.honor) {
    // Keep role only if they still have something; otherwise revoke role
    const { error } = await service
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", ROLES.ARBITER);
    if (error) throw error;
  }

  if (options.displayName != null) {
    await upsertUserDisplayName(service, userId, options.displayName);
  }

  const { data: authData } = await service.auth.admin.getUserById(userId);
  const [displayName, playerName] = await Promise.all([
    loadUserDisplayName(service, userId),
    linkedPlayerName(service, userId),
  ]);
  return {
    userId,
    email: authData.user?.email ?? null,
    displayName,
    playerName,
    kinds: access.kinds,
    chiefKinds: access.chiefKinds,
    honor: access.honor,
  };
}

export async function removeArbiter(options: {
  service: SupabaseClient;
  managed: ManagedCompetitionKinds;
  userId: string;
}): Promise<void> {
  const { service, managed, userId } = options;
  const current = await getArbiterAccess(service, userId, [ROLES.ARBITER]);

  const unmanagedKinds = current.kinds.filter(
    (k) => !managesKindCode(managed, k),
  );
  const unmanagedHonor = current.honor && !managerCanGrantHonor(managed);
  if (unmanagedKinds.length > 0 || unmanagedHonor) {
    throw new AuthError(
      "Forbidden: cannot remove arbiter who has scopes outside your management",
      403,
    );
  }

  await service
    .from("arbiter_competition_scopes")
    .delete()
    .eq("user_id", userId);
  await service.from("arbiter_honor_access").delete().eq("user_id", userId);
  const { error } = await service
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", ROLES.ARBITER);
  if (error) throw error;
}

export async function loadCallerManagedKinds(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
): Promise<ManagedCompetitionKinds> {
  return getManagedCompetitionKinds(supabase, userId, roles);
}
