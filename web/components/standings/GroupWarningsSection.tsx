import { getTranslations } from "next-intl/server";
import type { GroupWarningRow } from "@/lib/competition/standings-queries";

type Props = {
  warnings: GroupWarningRow[];
};

export async function GroupWarningsSection({ warnings }: Props) {
  const t = await getTranslations("standings.warnings");

  if (warnings.length === 0) return null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-zinc-900">{t("title")}</h2>
      <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
      <ul className="mt-4 divide-y divide-zinc-100">
        {warnings.map((warning) => (
          <li key={warning.id} className="py-3 first:pt-0">
            <div>
              <p className="font-medium text-zinc-900">
                {warning.team?.name ?? t("teamFallback")}
              </p>
              <p className="mt-1 text-sm text-zinc-600">{warning.reason}</p>
              <p className="mt-1 text-xs text-zinc-500">{warning.warning_date}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
