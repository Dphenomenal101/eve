import { eventSchema, type ProductEvent } from "./schema";
import { z } from "zod";
const posthogSchema = z.object({
  uuid: z.string().optional(),
  event: z.union([
    z.string(),
    z.object({
      uuid: z.string().optional(),
      event: z.string(),
      timestamp: z.string(),
      distinct_id: z.string(),
      properties: z.record(z.string(), z.unknown()),
    }),
  ]),
  timestamp: z.string().optional(),
  distinct_id: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});
export function normalizePostHog(
  raw: unknown,
  workspaceId: string,
): ProductEvent {
  const outer = posthogSchema.parse(raw),
    e = typeof outer.event === "object" ? outer.event : outer;
  const props = e.properties ?? {};
  const stableId = e.uuid ?? props.$insert_id;
  if (typeof stableId !== "string")
    throw new Error("PostHog events must include a stable uuid or $insert_id.");
  const occurredAt = Date.parse(e.timestamp ?? "");
  const str = (value: unknown) =>
    typeof value === "string" ? value : undefined;
  return eventSchema.parse({
    eventId: stableId,
    workspaceId,
    eventName: typeof e.event === "string" ? e.event : "",
    occurredAt,
    userId: str(e.distinct_id),
    userEmail: str(props.email ?? props.$email),
    productWorkspaceId: str(props.productWorkspaceId ?? props.workspace_id),
    companyDomain: str(props.companyDomain ?? props.company_domain),
    properties: Object.fromEntries(
      ["name", "title", "page", "plan", "usage_percent"]
        .filter((key) =>
          ["string", "number", "boolean"].includes(typeof props[key]),
        )
        .map((key) => [key, props[key]]),
    ),
  });
}
export async function readLimitedBody(
  req: Request,
  limit = 65536,
): Promise<string> {
  if (Number(req.headers.get("content-length") ?? 0) > limit)
    throw new Error("Payload too large.");
  if (!req.body) return "";
  const reader = req.body.getReader(),
    decoder = new TextDecoder();
  let size = 0,
    result = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Payload too large.");
    }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}
