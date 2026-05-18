import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="page-container flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Admin</h1>
      <nav className="flex flex-col gap-3">
        <Link href="/admin/competition" className="card font-medium hover:border-zinc-400">
          Competition setup
        </Link>
      </nav>
    </main>
  );
}
