import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Belgian Bridge Competition</h1>
      <p className="max-w-md text-center text-zinc-600">
        Core league flow MVP — setup in progress.
      </p>
      <Link
        href="/api/health"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        API health check
      </Link>
    </main>
  );
}
