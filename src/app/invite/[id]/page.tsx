"use client";
import { use, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui";
export default function Invite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params),
    session = authClient.useSession();
  const [message, setMessage] = useState("");
  return (
    <main id="main-content" className="setup-screen">
      <span className="eve-wordmark">
        eve<span>✳</span>
      </span>
      <h1>Good work happens together.</h1>
      <p>
        Accept your workspace invitation using the email address it was sent to.
      </p>
      {session.data ? (
        <Button
          variant="primary"
          onClick={async () => {
            const result = await authClient.organization.acceptInvitation({
              invitationId: id,
            });
            if (result.error)
              setMessage(
                result.error.message ?? "Invitation could not be accepted.",
              );
            else window.location.assign("/overview?demo=0");
          }}
        >
          Accept invitation
        </Button>
      ) : (
        <Link
          className="btn btn-primary"
          href={`/login?returnTo=${encodeURIComponent(`/invite/${id}`)}`}
        >
          Sign in first
        </Link>
      )}
      {message && <p role="alert">{message}</p>}
    </main>
  );
}
