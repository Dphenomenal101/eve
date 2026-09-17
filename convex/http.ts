import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";
import { eventSchema } from "../src/domain/schema";
import { normalizePostHog, readLimitedBody } from "../src/domain/ingestion";
const http = httpRouter();
authComponent.registerRoutes(http, createAuth);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const ingestHandler = httpAction(async (ctx, req) => {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer "))
      return json({ error: "Missing ingestion credential." }, 401);
    const bytes = new TextEncoder().encode(auth.slice(7));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const workspaceId = await ctx.runQuery(
      internal.workspace.authenticateIngestion,
      { hash },
    );
    if (!workspaceId)
      return json({ error: "Invalid ingestion credential." }, 401);
    const raw = JSON.parse(await readLimitedBody(req));
    const isPosthog = new URL(req.url).pathname === "/webhooks/posthog";
    const event = isPosthog
      ? normalizePostHog(raw, workspaceId)
      : eventSchema.parse(raw);
    if (event.workspaceId !== workspaceId)
      return json({ error: "Workspace does not match the credential." }, 403);
    const result = await ctx.runMutation(internal.workspace.ingestEvent, {
      workspaceId,
      event,
    });
    return json(result, 202);
  } catch {
    return json(
      {
        error:
          "Event rejected. Check the schema, identity fields, timestamp, sensitive properties, and rate limit.",
      },
      400,
    );
  }
});
http.route({ path: "/events", method: "POST", handler: ingestHandler });
http.route({
  path: "/webhooks/posthog",
  method: "POST",
  handler: ingestHandler,
});
const webhook = httpAction(async (ctx, req) => {
  const parts = new URL(req.url).pathname.split("/");
  const provider = parts[2],
    workspaceId = parts[3];
  if (!workspaceId || !["agentmail", "retell"].includes(provider))
    return json({ error: "Unknown webhook." }, 404);
  try {
    const body = await readLimitedBody(req, 131072);
    const headers = Object.fromEntries(
      [
        "svix-id",
        "svix-timestamp",
        "svix-signature",
        "webhook-id",
        "webhook-timestamp",
        "webhook-signature",
        "x-retell-signature",
      ].flatMap((k) => {
        const value = req.headers.get(k);
        return value ? [[k, value]] : [];
      }),
    );
    const result = await ctx.runAction(internal.providers.receiveWebhook, {
      workspaceId,
      provider,
      body,
      headers,
    });
    return json(result);
  } catch {
    return json(
      {
        error:
          "Webhook rejected: signature, resource, or payload could not be verified.",
      },
      401,
    );
  }
});
http.route({
  pathPrefix: "/webhooks/agentmail/",
  method: "POST",
  handler: webhook,
});
http.route({
  pathPrefix: "/webhooks/retell/",
  method: "POST",
  handler: webhook,
});
export default http;
