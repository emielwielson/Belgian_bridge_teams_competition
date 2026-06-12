import { StandingsHome } from "@/components/standings/StandingsHome";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function StandingsPage({ searchParams }: Props) {
  const { error } = await searchParams;
  return <StandingsHome showForbidden={error === "forbidden"} />;
}
