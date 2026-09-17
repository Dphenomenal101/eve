import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { magicLink, organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  ownerAc,
  adminAc,
  memberAc,
} from "better-auth/plugins/organization/access";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";
export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  { local: { schema: authSchema } },
);
const ac = createAccessControl(defaultStatements);
const operator = ac.newRole(memberAc.statements),
  viewer = ac.newRole({});
const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
async function sendAuthEmail(to: string, subject: string, url: string) {
  if (!process.env.AUTH_EMAIL_API_KEY || !process.env.AUTH_EMAIL_FROM)
    throw new Error(
      "Authentication email is not configured. Contact your workspace administrator.",
    );
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AUTH_EMAIL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM,
      to: [to],
      subject,
      html: `<p>${escapeHtml(subject)}</p><p><a href="${escapeHtml(url)}">Continue to Eve</a></p><p>If you did not request this, you can ignore this message.</p>`,
    }),
  });
  if (!result.ok)
    throw new Error("Authentication email could not be delivered.");
}
export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    appName: "Eve",
    baseURL: process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    trustedOrigins: process.env.SITE_URL ? [process.env.SITE_URL] : [],
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          socialProviders: {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
          },
        }
      : {}),
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true },
    plugins: [
      magicLink({
        expiresIn: 600,
        sendMagicLink: async ({ email, url }) =>
          sendAuthEmail(email, "Your sign-in link for Eve", url),
      }),
      organization({
        ac,
        roles: { owner: ownerAc, admin: adminAc, operator, viewer },
        creatorRole: "owner",
        allowUserToCreateOrganization: true,
        sendInvitationEmail: async (data) =>
          sendAuthEmail(
            data.email,
            `Join ${data.organization.name} on Eve`,
            `${process.env.SITE_URL}/invite/${data.id}`,
          ),
      }),
      convex({ authConfig }),
    ],
  }) satisfies BetterAuthOptions;
export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));
