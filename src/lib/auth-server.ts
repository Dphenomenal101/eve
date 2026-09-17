import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
/** Construct lazily so a credential-free demo build does not initialize live auth. */
export function liveAuth() {
  if (
    !process.env.NEXT_PUBLIC_CONVEX_URL ||
    !process.env.NEXT_PUBLIC_CONVEX_SITE_URL
  )
    throw new Error("Live authentication is not configured.");
  return convexBetterAuthNextJs({
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
    convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  });
}
