import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <nav className="flex flex-col gap-3">
        <Link
          href="/admin/competition"
          className="rounded-lg border border-zinc-200 bg-white px-4 py-3 font-medium hover:border-zinc-400"
        >
          Competition setup
        </Link>
      </nav>
    </main>
  );
}
