import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COMPETITION_KIND_CODES,
  resolveCompetitionKindId,
  type CompetitionKindCode,
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

export type CompetitionManagerListItem = {
  userId: string;
  email: string | null;
  displayName: string | null;
  playerName: string | null;
  kinds: CompetitionKindCode[];
  isGlobal: boolean;
};

const ALL_KIND_CODES: CompetitionKindCode[] = [
  COMPETITION_KIND_CODES.NATIONAL,
  COMPETITION_KIND_CODES.FLANDERS,
  COMPETITION_KIND_CODES.WALLONIA,
  COMPETITION_KIND_CODES.ZWEIFFEL,
];

const KIND_ORDER = new Map(
  ALL_KIND_CODES.map((code, index) => [code, index]),
);

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

export function validateManagerScopeInput(
  isGlobal: boolean,
  kinds: CompetitionKindCode[],
): CompetitionKindCode[] {
  if (isGlobal) {
    return [];
  }
  if (kinds.length === 0) {
    throw new AuthError(
      "Forbidden: assign at least one competition or mark as global",
      403,
    );
  }
  return kinds;
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

async function loadManagerScopes(
  service: SupabaseClient,
  userId: string,
): Promise<{ kinds: CompetitionKindCode[]; isGlobal: boolean }> {
  const { data: scopes, error } = await service
    .from("competition_manager_scopes")
    .select("competition_kind_id, kind:competition_kinds(code)")
    .eq("user_id", userId);
  if (error) throw error;

  if (!scopes || scopes.length === 0) {
    return { kinds: [], isGlobal: true };
  }

  const kinds: CompetitionKindCode[] = [];
  for (const row of scopes) {
    const raw = row.kind as unknown;
    const kind = Array.isArray(raw) ? raw[0] : raw;
    const code = (kind as { code?: string } | null)?.code;
    if (code && ALL_KIND_CODES.includes(code as CompetitionKindCode)) {
      kinds.push(code as CompetitionKindCode);
    }
  }

  kinds.sort(
    (a, b) => (KIND_ORDER.get(a) ?? 99) - (KIND_ORDER.get(b) ?? 99),
  );

  return { kinds, isGlobal: false };
}

async function replaceManagerScopes(
  service: SupabaseClient,
  userId: string,
  kinds: CompetitionKindCode[],
): Promise<void> {
  const { error: deleteError } = await service
    .from("competition_manager_scopes")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  for (const code of kinds) {
    const kindId = await resolveCompetitionKindId(service, code);
    const { error } = await service.from("competition_manager_scopes").upsert(
      { user_id: userId, competition_kind_id: kindId },
      { onConflict: "user_id,competition_kind_id" },
    );
    if (error) throw error;
  }
}

async function toListItem(
  service: SupabaseClient,
  userId: string,
  emailFallback?: string | null,
): Promise<CompetitionManagerListItem> {
  const { data: authData } = await service.auth.admin.getUserById(userId);
  const [displayName, playerName] = await Promise.all([
    loadUserDisplayName(service, userId),
    linkedPlayerName(service, userId),
  ]);
  const scopes = await loadManagerScopes(service, userId);
  return {
    userId,
    email: authData.user?.email ?? emailFallback ?? null,
    displayName,
    playerName,
    kinds: scopes.kinds,
    isGlobal: scopes.isGlobal,
  };
}

export async function listCompetitionManagers(
  service: SupabaseClient,
): Promise<CompetitionManagerListItem[]> {
  const { data: roleRows, error } = await service
    .from("user_roles")
    .select("user_id")
    .eq("role", ROLES.COMPETITION_MANAGER);
  if (error) throw error;

  const items: CompetitionManagerListItem[] = [];
  for (const row of roleRows ?? []) {
    items.push(await toListItem(service, row.user_id));
  }

  items.sort((a, b) =>
    (a.displayName ?? a.email ?? a.userId).localeCompare(
      b.displayName ?? b.email ?? b.userId,
    ),
  );
  return items;
}

export async function createOrEnsureCompetitionManager(options: {
  service: SupabaseClient;
  email: string;
  displayName: string;
  kinds: CompetitionKindCode[];
  isGlobal: boolean;
  locale?: Locale;
}): Promise<CompetitionManagerListItem> {
  const { service } = options;
  const email = normalizeLoginEmail(options.email);
  if (!isValidLoginEmailFormat(email)) {
    throw new Error("Invalid email");
  }
  const displayName = options.displayName.trim();
  if (!displayName) {
    throw new Error("Display name is required");
  }

  const kinds = validateManagerScopeInput(options.isGlobal, options.kinds);

  await ensureAuthUserForLogin(service, email, options.locale ?? defaultLocale);
  const userId = await findAuthUserIdByEmail(service, email);
  if (!userId) {
    throw new Error("Failed to create auth user");
  }

  const { error: roleError } = await service.from("user_roles").upsert(
    { user_id: userId, role: ROLES.COMPETITION_MANAGER },
    { onConflict: "user_id,role" },
  );
  if (roleError) throw roleError;

  await replaceManagerScopes(service, userId, kinds);
  await upsertUserDisplayName(service, userId, displayName);

  return toListItem(service, userId, email);
}

export async function updateCompetitionManagerScopes(options: {
  service: SupabaseClient;
  userId: string;
  displayName?: string;
  kinds: CompetitionKindCode[];
  isGlobal: boolean;
}): Promise<CompetitionManagerListItem> {
  const { service, userId } = options;

  const { data: roleRow } = await service
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", ROLES.COMPETITION_MANAGER)
    .maybeSingle();
  if (!roleRow) {
    throw new Error("Competition manager not found");
  }

  const kinds = validateManagerScopeInput(options.isGlobal, options.kinds);
  await replaceManagerScopes(service, userId, kinds);
  if (options.displayName != null) {
    await upsertUserDisplayName(service, userId, options.displayName);
  }

  return toListItem(service, userId);
}

export async function removeCompetitionManager(options: {
  service: SupabaseClient;
  userId: string;
}): Promise<void> {
  const { service, userId } = options;

  const { error: scopesError } = await service
    .from("competition_manager_scopes")
    .delete()
    .eq("user_id", userId);
  if (scopesError) throw scopesError;

  const { error } = await service
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", ROLES.COMPETITION_MANAGER);
  if (error) throw error;
}
