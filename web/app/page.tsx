import Link from "next/link";
import { getTranslations } from "next-intl/server";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const { error } = await searchParams;
  const t = await getTranslations("home");

  return (
    <main className="page-container flex flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
      {error === "forbidden" ? (
        <p className="max-w-md rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {t("forbidden")}
        </p>
      ) : null}
      <p className="max-w-md text-zinc-600">{t("tagline")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/standings" className="btn-secondary">
          {t("standings")}
        </Link>
        <Link href="/login" className="btn-primary">
          {t("signIn")}
        </Link>
        <Link href="/api/health" className="btn-secondary">
          {t("apiHealth")}
        </Link>
      </div>
    </main>
  );
}
