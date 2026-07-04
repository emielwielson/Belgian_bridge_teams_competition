import type { SupabaseClient } from "@supabase/supabase-js";

export type CaptainContact = {
  teamId: string;
  name: string;
  email: string | null;
};

function unwrapOne<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function resolveCaptainEmail(
  supabase: SupabaseClient,
  captainPlayer: { id: string; email?: string | null },
): Promise<string | null> {
  const { data: links, error: linkError } = await supabase
    .from("player_auth_links")
    .select("auth_user_id")
    .eq("player_id", captainPlayer.id)
    .limit(1);
  if (linkError) throw linkError;

  const authUserId = links?.[0]?.auth_user_id;
  if (authUserId) {
    const { data, error } = await supabase.auth.admin.getUserById(authUserId);
    if (!error && data.user?.email) {
      return data.user.email;
    }
  }

  const playerEmail = captainPlayer.email?.trim();
  return playerEmail || null;
}

export async function loadCaptainContactsForTeams(
  supabase: SupabaseClient,
  teamIds: string[],
): Promise<CaptainContact[]> {
  if (teamIds.length === 0) return [];

  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, captain_id, captain:players(id, name, email)")
    .in("id", teamIds);

  if (error) throw error;

  const contacts: CaptainContact[] = [];
  for (const team of teams ?? []) {
    const captain = unwrapOne(
      team.captain as
        | { id: string; name: string; email: string | null }
        | { id: string; name: string; email: string | null }[]
        | null,
    );
    if (!captain?.id) continue;

    const email = await resolveCaptainEmail(supabase, captain);
    contacts.push({
      teamId: team.id,
      name: captain.name,
      email,
    });
  }

  return contacts;
}

export function captainEmailsFromContacts(contacts: CaptainContact[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const contact of contacts) {
    const email = contact.email?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

export function splitRequestingAndReceivingCaptains(
  contacts: CaptainContact[],
  homeTeamId: string,
  awayTeamId: string,
  requestingTeamId: string,
): { requesting: CaptainContact; receiving: CaptainContact } {
  const byTeamId = new Map(contacts.map((c) => [c.teamId, c]));
  const requesting = byTeamId.get(requestingTeamId);
  const receivingTeamId =
    requestingTeamId === homeTeamId ? awayTeamId : homeTeamId;
  const receiving = byTeamId.get(receivingTeamId);

  if (!requesting || !receiving) {
    throw new Error("Could not resolve requesting and receiving captains");
  }

  return { requesting, receiving };
}

export function toCaptainContactFields(
  requesting: CaptainContact,
  receiving: CaptainContact,
): {
  requestingCaptainName: string;
  requestingCaptainEmail: string | null;
  receivingCaptainName: string;
  receivingCaptainEmail: string | null;
} {
  return {
    requestingCaptainName: requesting.name,
    requestingCaptainEmail: requesting.email,
    receivingCaptainName: receiving.name,
    receivingCaptainEmail: receiving.email,
  };
}

export function captainContactWebhookFields(
  requesting: CaptainContact,
  receiving: CaptainContact,
): Record<string, string | null> {
  return {
    requesting_captain_name: requesting.name,
    requesting_captain_email: requesting.email,
    receiving_captain_name: receiving.name,
    receiving_captain_email: receiving.email,
  };
}
