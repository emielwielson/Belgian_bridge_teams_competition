"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

type Props = {
  active: "inbox" | "honor";
};

export function ArbiterNav({ active }: Props) {
  const t = useTranslations("arbiter.nav");

  const linkClass = (isActive: boolean) =>
    isActive
      ? "border-b-2 border-zinc-900 pb-1 text-sm font-medium text-zinc-900"
      : "pb-1 text-sm font-medium text-zinc-600 hover:text-zinc-900";

  return (
    <nav className="flex gap-4 border-b border-zinc-200" aria-label={t("label")}>
      <Link href="/arbiter" className={linkClass(active === "inbox")}>
        {t("inbox")}
      </Link>
      <Link href="/arbiter/honor" className={linkClass(active === "honor")}>
        {t("honor")}
      </Link>
    </nav>
  );
}
