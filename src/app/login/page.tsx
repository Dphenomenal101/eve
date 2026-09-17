"use client";
import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, Check, Globe } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button, Input } from "@/components/ui";
export default function Login() {
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState("");
  const callbackURL =
    typeof window !== "undefined" &&
    /^\/invite\/[a-zA-Z0-9_-]+$/.test(
      new URLSearchParams(window.location.search).get("returnTo") ?? "",
    )
      ? new URLSearchParams(window.location.search).get("returnTo")!
      : "/overview?demo=0";
  const configured = !!process.env.NEXT_PUBLIC_CONVEX_URL;
  return (
    <main id="main-content" className="setup-screen">
      <Link href="/" className="eve-wordmark">
        eve<span>✳</span>
      </Link>
      <span className="eyebrow">YOUR NEXT GREAT CUSTOMER IS ALREADY HERE</span>
      <h1>
        A thoughtful teammate.
        <br />A warm welcome back.
      </h1>
      <p>Sign in to your workspace. Eve will pick up where you left off.</p>
      {!configured ? (
        <>
          <p>Connect a Convex deployment to enable live authentication.</p>
          <Link href="/overview?demo=1" className="btn btn-primary">
            Explore the demo
            <ArrowRight size={15} />
          </Link>
        </>
      ) : sent ? (
        <div className="login-message">
          <Check size={24} />
          <h2>Check your inbox.</h2>
          <p>
            A sign-in link is on its way to {email}. It expires in 10 minutes.
          </p>
        </div>
      ) : (
        <div className="login-form">
          <Button
            onClick={async () => {
              const result = await authClient.signIn.social({
                provider: "google",
                callbackURL,
              });
              if (result.error)
                setError(result.error.message ?? "Google sign-in failed.");
            }}
          >
            <Globe size={15} />
            Continue with Google
          </Button>
          <div className="login-divider">or use your work email</div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const result = await authClient.signIn.magicLink({
                email,
                callbackURL,
              });
              if (result.error)
                setError(
                  result.error.message ?? "Sign-in link could not be sent.",
                );
              else setSent(true);
              setBusy(false);
            }}
          >
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              aria-label="Work email"
              required
            />
            <Button type="submit" variant="primary" loading={busy}>
              <Mail size={14} />
              Email me a sign-in link
            </Button>
          </form>
          {error && (
            <p className="inline-alert" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
