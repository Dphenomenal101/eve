import { notFound } from "next/navigation";
import { DemoProvider } from "@/components/eve-provider";
import { DemoPagePreview } from "@/components/demo-page-preview";
export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Personalized page · Eve demo",
};
export default async function Preview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (process.env.EVE_ENABLE_DEMO_MODE !== "true") notFound();
  const { slug } = await params;
  return (
    <DemoProvider>
      <DemoPagePreview slug={slug} />
    </DemoProvider>
  );
}
