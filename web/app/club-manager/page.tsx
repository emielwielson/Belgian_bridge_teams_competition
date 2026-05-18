"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Club = { id: string; name: string; region?: { name: string } };

export default function ClubManagerPage() {
  const [clubs, setClubs] = useState<Club[]>([]);

  useEffect(() => {
    fetch("/api/clubs/mine")
      .then((r) => r.json())
      .then((b) => setClubs(b.clubs ?? []));
  }, []);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Club manager</h1>
      <p className="text-sm text-zinc-600">
        Manage players and memberships for your assigned clubs.
      </p>
      {clubs.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No clubs assigned. Ask a competition manager to add you in{" "}
          <code className="text-xs">club_manager_assignments</code>.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {clubs.map((club) => (
            <li key={club.id}>
              <Link
                href={`/club-manager/${club.id}`}
                className="block rounded-lg border bg-white px-4 py-3 font-medium hover:border-zinc-400"
              >
                {club.name}
                {club.region?.name && (
                  <span className="mt-0.5 block text-sm font-normal text-zinc-500">
                    {club.region.name}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
