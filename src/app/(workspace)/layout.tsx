import { Suspense } from "react";
import { EveProvider } from "@/components/eve-provider";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="loading-screen">Opening Eve…</div>}>
      <EveProvider demoEnabled={process.env.EVE_ENABLE_DEMO_MODE === "true"}>
        <Shell>{children}</Shell>
      </EveProvider>
    </Suspense>
  );
}
