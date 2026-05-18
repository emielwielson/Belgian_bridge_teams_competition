import { LoginForm } from "@/components/auth/LoginForm";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;

  return (
    <main className="page-container flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-600">
          We will email you a magic link — no password required.
        </p>
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
