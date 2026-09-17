import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="setup-screen">
      <span className="eve-wordmark">
        eve<span>✳</span>
      </span>
      <h1>This page isn’t here.</h1>
      <p>It may be unpublished, or the link may have changed.</p>
      <Link className="btn btn-primary" href="/overview">
        Return to Eve
      </Link>
    </main>
  );
}
