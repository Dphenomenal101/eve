import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { notFound } from "next/navigation";
import { PageRenderer } from "@/components/page-renderer";
import { pageSpecSchema, type Dataset } from "@/domain/schema";
export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  title: "A starting point for your team",
};
export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) notFound();
  const page = await fetchQuery(
    makeFunctionReference<"query">("workspace:publicPage"),
    { slug },
  );
  if (!page) notFound();
  const spec = pageSpecSchema.parse(page.spec);
  return (
    <main id="main-content" className="public-page">
      <PageRenderer
        spec={spec}
        brand={page.brand as Dataset["brandProfiles"][number]}
      />
    </main>
  );
}
