import { getTranslations } from "next-intl/server";
import type { GroupRulingRow } from "@/lib/competition/standings-queries";

type Props = {
  rulings: GroupRulingRow[];
};

export async function GroupRulingsSection({ rulings }: Props) {
  const t = await getTranslations("standings.rulings");

  if (rulings.length === 0) return null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-zinc-900">{t("title")}</h2>
      <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
      <ul className="mt-4 divide-y divide-zinc-100">
        {rulings.map((ruling) => {
          const m = ruling.match;
          const matchLabel = m
            ? t("matchLine", {
                round: m.round,
                homeTeam: m.home_team?.name ?? "?",
                awayTeam: m.away_team?.name ?? "?",
              })
            : t("matchFallback");
          return (
            <li key={ruling.id} className="py-3 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900">{matchLabel}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {ruling.ruling_date ?? "—"}
                    {ruling.board != null
                      ? t("board", { board: ruling.board })
                      : ""}
                    {ruling.arbiter_request_id ? t("fromArbiterRequest") : ""}
                  </p>
                </div>
                {ruling.signed_url ? (
                  <a
                    href={ruling.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-emerald-800 underline"
                  >
                    {t("viewRuling")}
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
