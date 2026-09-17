import { redirect } from "next/navigation";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  redirect(`/overview${q.demo ? `?demo=${q.demo}` : ""}`);
}
