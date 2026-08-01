import { getTranslations } from "next-intl/server";
import { ConfirmLoginForm } from "@/components/auth/ConfirmLoginForm";

type Props = {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
};

/**
 * Magic Link interstitial. Prefetchers may GET this page; verification only
 * happens when the user clicks Continue (POST /api/auth/confirm).
 */
export default async function AuthConfirmPage({ searchParams }: Props) {
  const { token_hash, type } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <main className="page-container flex flex-col gap-6">
      <header className="sr-only">
        <h1>{t("confirmTitle")}</h1>
      </header>
      <ConfirmLoginForm
        tokenHash={token_hash?.trim() || null}
        type={type?.trim() || "email"}
      />
    </main>
  );
}
