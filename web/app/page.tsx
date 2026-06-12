import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const { error } = await searchParams;
  redirect(error ? `/standings?error=${error}` : "/standings");
}
