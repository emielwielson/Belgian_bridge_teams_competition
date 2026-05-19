import { ArbiterInbox } from "@/components/arbiter/ArbiterInbox";

export default function ArbiterPage() {
  return (
    <main className="page-container">
      <h1 className="text-2xl font-semibold text-zinc-900">Arbiter inbox</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Open requests from team captains. Mark resolved when handled.
      </p>
      <div className="mt-6">
        <ArbiterInbox />
      </div>
    </main>
  );
}
