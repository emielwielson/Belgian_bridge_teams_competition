import Link from "next/link";
import { ClubOverviewView } from "@/components/club-manager/ClubOverviewView";

type Props = { params: Promise<{ clubId: string }> };

export default async function ClubDetailPage({ params }: Props) {
  const { clubId } = await params;

  return (
    <main className="page-container flex flex-col gap-6">
      <Link href="/club-manager" className="link-back">
        ← My clubs
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900">My club</h1>
      <ClubOverviewView clubId={clubId} />
    </main>
  );
}
