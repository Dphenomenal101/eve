"use client";
import Link from "next/link";
import { useEve } from "./eve-provider";
import { PageRenderer } from "./page-renderer";
export function DemoPagePreview({ slug }: { slug: string }) {
  const { data } = useEve();
  const page = data.pageSpecs
    .filter((p) => p.slug === slug && p.status === "published")
    .sort((a, b) => b.revision - a.revision)[0];
  return (
    <main id="main-content" className="public-page">
      <div className="demo-banner">
        <strong>Demo page</strong>
        <span>Only available in your demo session. No live publication.</span>
        <Link href="/rehearsal?demo=1">Back to Eve →</Link>
      </div>
      {page ? (
        <PageRenderer
          spec={page.spec}
          brand={data.brandProfiles.find(
            (b) => b.version === page.brandVersion,
          )}
        />
      ) : (
        <div className="setup-screen">
          <h1>This page hasn’t been published.</h1>
          <p>Approve the page in Eve to open its demo preview.</p>
          <Link className="btn btn-primary" href="/rehearsal?demo=1">
            Review the page
          </Link>
        </div>
      )}
    </main>
  );
}
