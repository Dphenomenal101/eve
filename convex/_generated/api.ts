/* Runtime references work before first deploy. Convex codegen replaces this with inferred APIs. */
import { anyApi, componentsGeneric } from "convex/server";
export const api = anyApi;
export const internal = anyApi;
export const components = componentsGeneric() as unknown as {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi & {
    access: {
      memberships: import("convex/server").FunctionReference<
        "query",
        "public",
        { userId: string },
        Array<{ organizationId: string; role: string }>
      >;
    };
  };
};
