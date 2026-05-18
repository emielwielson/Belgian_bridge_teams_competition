import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Belgian Bridge Competition</h1>
      <p className="max-w-md text-center text-zinc-600">
        Core league flow MVP — authentication and public standings are live.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/standings"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:border-zinc-500"
        >
          Standings
        </Link>
        <Link
          href="/login"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Sign in
        </Link>
        <Link
          href="/api/health"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500"
        >
          API health
        </Link>
      </div>
    </main>
  );
}
