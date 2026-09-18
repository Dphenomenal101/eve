"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Dataset } from "../src/domain/schema";
import { decryptCredential } from "../src/server/credentials";
import { providerFor } from "../src/domain/engine";
import {
  sendEmail,
  startCall,
  writeCrm,
  recentInboxReply,
  crmSaysCustomer,
} from "../src/server/providers";
/** Durable Convex scheduler adapter. State and the dispatch claim survive runtime interruption. */
export const tick = internalAction({
  args: { workspaceId: v.string() },
  handler: async (ctx, { workspaceId }) => {
    if (workspaceId.startsWith("demo-"))
      throw new Error("Live runtime cannot execute demo workspaces.");
    const state: Dataset = await ctx.runQuery(
      internal.workspace.internalState,
      { workspaceId },
    );
    if (!state.workspace.active || state.workspace.paused) return;
    for (const candidate of state.actions.filter(
      (a) => a.status === "scheduled",
    )) {
      if ((candidate.scheduledAt ?? 0) > Date.now()) continue;
      const claimed = await ctx.runMutation(internal.workspace.claim, {
        workspaceId,
        actionId: candidate.id,
      });
      if (!claimed) continue;
      try {
        const latest: Dataset = await ctx.runQuery(
          internal.workspace.internalState,
          { workspaceId },
        );
        const action = latest.actions.find((a) => a.id === candidate.id)!;
        if (
          latest.accounts
            .find((a) => a.id === action.accountId)
            ?.domain.endsWith(".example")
        )
          throw new Error("Test prospects cannot invoke live providers.");
        const provider = providerFor(action.kind);
        const connection = latest.connections.find(
          (c) => c.provider === provider,
        );
        const guard = async () => {
          const allowed = await ctx.runMutation(
            internal.workspace.recheckClaim,
            { workspaceId, actionId: action.id },
          );
          if (!allowed)
            throw new Error(
              "Account or policy changed before dispatch. The action was stopped.",
            );
        };
        let providerId: string;
        if (action.kind === "page") {
          await guard();
          providerId = `published:${latest.pageSpecs.find((p) => p.artifactId === action.artifactId)!.id}`;
        } else if (action.kind === "crm") {
          if (!connection?.providerAccountId)
            throw new Error("CRM connection is unavailable.");
          providerId = await writeCrm(latest, action, connection, guard);
        } else {
          if (!provider) throw new Error("Action provider is unavailable.");
          const credential = await ctx.runQuery(internal.workspace.credential, {
            workspaceId,
            provider,
          });
          if (!credential)
            throw new Error("Provider credential is unavailable.");
          const decrypted = JSON.parse(
            decryptCredential(
              credential.ciphertext,
              workspaceId,
              provider,
              process.env.EVE_ENCRYPTION_KEY ?? "",
            ),
          ) as { key: string };
          if (await crmSaysCustomer(latest, action)) {
            await ctx.runMutation(internal.workspace.stopCustomer, {
              workspaceId,
              accountId: action.accountId,
            });
          }
          if (action.kind === "email") {
            const reply = await recentInboxReply(
              latest,
              action,
              decrypted.key,
              credential.resourceId,
            );
            if (reply)
              await ctx.runMutation(internal.workspace.receiveOutcome, {
                workspaceId,
                provider: "agentmail",
                eventId: `poll-${reply.thread_id}-${reply.received_timestamp}`,
                accountId: action.accountId,
                type: "reply",
                text:
                  reply.preview ??
                  "Recent inbound reply detected before dispatch.",
              });
          }
          await guard();
          providerId =
            action.kind === "email"
              ? await sendEmail(
                  latest,
                  action,
                  decrypted.key,
                  credential.resourceId,
                )
              : await startCall(
                  latest,
                  action,
                  decrypted.key,
                  credential.resourceId,
                );
        }
        await ctx.runMutation(internal.workspace.finish, {
          workspaceId,
          actionId: action.id,
          providerId,
        });
      } catch {
        await ctx.runMutation(internal.workspace.finish, {
          workspaceId,
          actionId: candidate.id,
          providerId: "",
          error:
            "The provider did not confirm a complete operation. Check the provider using this action’s reference; automatic retries are disabled to prevent duplicates.",
        });
      }
    }
  },
});
export const sweep = internalAction({
  args: {},
  handler: async (ctx) => {
    const ids: string[] = await ctx.runQuery(
      internal.workspace.activeWorkspaces,
      {},
    );
    for (const workspaceId of ids)
      await ctx.scheduler.runAfter(0, internal.runtime.tick, { workspaceId });
    await ctx.runMutation(internal.workspace.expireInterrupted, {});
  },
});
