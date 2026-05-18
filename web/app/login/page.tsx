import { LoginForm } from "@/components/auth/LoginForm";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-600">
          We will email you a magic link — no password required.
        </p>
      </header>
      <LoginForm nextPath={next} />
    </main>
  );
}
