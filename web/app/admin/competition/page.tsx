import Link from "next/link";
import { adminScopePath, SCOPES, REGION_CODES } from "@/lib/competition/scopes";

export default function CompetitionHubPage() {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-8">
      <Link href="/admin" className="text-sm text-zinc-600">
        ← Admin
      </Link>
      <h1 className="text-2xl font-semibold">Competition scopes</h1>
      <nav className="flex flex-col gap-3">
        <Link
          href={adminScopePath(SCOPES.NATIONAL)}
          className="rounded-lg border bg-white px-4 py-3 font-medium"
        >
          National
        </Link>
        <Link
          href={adminScopePath(SCOPES.REGIONAL, REGION_CODES.FLANDERS)}
          className="rounded-lg border bg-white px-4 py-3 font-medium"
        >
          Flanders (regional)
        </Link>
        <Link
          href={adminScopePath(SCOPES.REGIONAL, REGION_CODES.WALLONIA)}
          className="rounded-lg border bg-white px-4 py-3 font-medium"
        >
          Wallonia (regional)
        </Link>
      </nav>
    </main>
  );
}
