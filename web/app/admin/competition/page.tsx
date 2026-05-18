import Link from "next/link";
import { adminScopePath, SCOPES, REGION_CODES } from "@/lib/competition/scopes";

export default function CompetitionHubPage() {
  return (
    <main className="page-container flex flex-col gap-6">
      <Link href="/admin" className="link-back">
        ← Admin
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900">Competition scopes</h1>
      <nav className="flex flex-col gap-3">
        <Link
          href={adminScopePath(SCOPES.NATIONAL)}
          className="card font-medium hover:border-zinc-400"
        >
          National
        </Link>
        <Link
          href={adminScopePath(SCOPES.REGIONAL, REGION_CODES.FLANDERS)}
          className="card font-medium hover:border-zinc-400"
        >
          Flanders (regional)
        </Link>
        <Link
          href={adminScopePath(SCOPES.REGIONAL, REGION_CODES.WALLONIA)}
          className="card font-medium hover:border-zinc-400"
        >
          Wallonia (regional)
        </Link>
      </nav>
    </main>
  );
}
