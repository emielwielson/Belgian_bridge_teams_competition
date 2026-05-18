import Link from "next/link";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="page-container flex flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Belgian Bridge Competition
      </h1>
      {error === "forbidden" ? (
        <p className="max-w-md rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          You do not have access to that page. Club managers need a row in{" "}
          <code className="rounded bg-amber-100 px-1">club_manager_assignments</code>{" "}
          for their club (and usually the{" "}
          <code className="rounded bg-amber-100 px-1">club_manager</code> role).
          Ask a competition admin, or open{" "}
          <Link href="/club-manager" className="font-medium underline">
            Club manager
          </Link>{" "}
          if you are already set up.
        </p>
      ) : null}
      <p className="max-w-md text-zinc-600">
        Core league flow MVP — authentication and public standings are live.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/standings" className="btn-secondary">
          Standings
        </Link>
        <Link href="/login" className="btn-primary">
          Sign in
        </Link>
        <Link href="/api/health" className="btn-secondary">
          API health
        </Link>
      </div>
    </main>
  );
}
