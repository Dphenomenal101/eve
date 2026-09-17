import { queryGeneric } from "convex/server";
import { v } from "convex/values";
export const memberships = queryGeneric({
  args: { userId: v.string() },
  returns: v.array(v.object({ organizationId: v.string(), role: v.string() })),
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("member")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((r) => ({
      organizationId: r.organizationId as string,
      role: r.role as string,
    }));
  },
});
