import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { PlayerSelectForm } from "@/components/auth/PlayerSelectForm";
import {
  getLinkedPlayers,
  getPlayerSelectionState,
} from "@/lib/auth/active-player";
import { createSessionClient } from "@/lib/supabase/server-client";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

function safeNextPath(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/";
}

export default async function SelectPlayerPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const t = await getTranslations("auth.selectPlayer");

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/auth/select-player?next=${encodeURIComponent(nextPath)}`)}`);
  }

  const state = await getPlayerSelectionState(supabase, user.id);
  if (!state.needsSelection) {
    redirect(nextPath);
  }

  const linkedPlayers = await getLinkedPlayers(supabase, user.id);
  if (linkedPlayers.length < 2) {
    redirect(nextPath);
  }

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("subtitle")}</p>
      </header>
      <PlayerSelectForm players={linkedPlayers} nextPath={nextPath} />
    </main>
  );
}
