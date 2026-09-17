"use client";
import { Button } from "@/components/ui";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="setup-screen">
      <span className="eve-wordmark">
        eve<span>✳</span>
      </span>
      <h1>Something interrupted the view.</h1>
      <p>Your saved actions remain in the workspace. Try loading it again.</p>
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
      <a href="/overview" className="text-link">
        Return to overview
      </a>
    </main>
  );
}
