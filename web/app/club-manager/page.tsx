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
    <main className="page-container flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Club manager</h1>
      <p className="text-sm text-zinc-600">
        Manage players and memberships for your assigned clubs.
      </p>
      {clubs.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No clubs assigned. Ask a competition manager to add you in{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs text-zinc-800">
            club_manager_assignments
          </code>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {clubs.map((club) => (
            <li key={club.id}>
              <Link
                href={`/club-manager/${club.id}`}
                className="card block font-medium hover:border-zinc-400"
              >
                {club.name}
                {club.region?.name && (
                  <span className="mt-0.5 block text-sm font-normal text-zinc-600">
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
