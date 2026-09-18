"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  arbiterKindHref,
  isCompetitionKindCode,
} from "@/lib/auth/arbiter-scope";
import type { CompetitionKindCode } from "@/lib/auth/competition-scope";

type Props = {
  active: CompetitionKindCode | "honor";
  kinds?: CompetitionKindCode[];
  showHonor?: boolean;
};

export function ArbiterNav({
  active,
  kinds = [],
  showHonor = true,
}: Props) {
  const t = useTranslations("arbiter.nav");

  const linkClass = (isActive: boolean) =>
    isActive
      ? "border-b-2 border-zinc-900 pb-1 text-sm font-medium text-zinc-900"
      : "pb-1 text-sm font-medium text-zinc-600 hover:text-zinc-900";

  const kindTabs = kinds.filter(isCompetitionKindCode);

  if (kindTabs.length === 0 && !showHonor) return null;

  function kindLabel(kind: CompetitionKindCode): string {
    switch (kind) {
      case "national":
        return t("national");
      case "flanders":
        return t("flanders");
      case "wallonia":
        return t("wallonia");
    }
  }

  return (
    <nav
      className="flex flex-wrap gap-4 border-b border-zinc-200"
      aria-label={t("label")}
    >
      {kindTabs.map((kind) => (
        <Link
          key={kind}
          href={arbiterKindHref(kind)}
          className={linkClass(active === kind)}
        >
          {kindLabel(kind)}
        </Link>
      ))}
      {showHonor ? (
        <Link href="/arbiter/honor" className={linkClass(active === "honor")}>
          {t("honor")}
        </Link>
      ) : null}
    </nav>
  );
}
