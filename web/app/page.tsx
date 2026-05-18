import Link from "next/link";

export default function Home() {
  return (
    <main className="page-container flex flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Belgian Bridge Competition
      </h1>
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
