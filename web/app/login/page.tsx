import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("subtitle")}</p>
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {decodeURIComponent(error)}
          </p>
        )}
      </header>
      <LoginForm nextPath={next} />
    </main>
  );
}
