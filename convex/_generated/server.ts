import {
  queryGeneric,
  mutationGeneric,
  actionGeneric,
  internalQueryGeneric,
  internalMutationGeneric,
  internalActionGeneric,
  httpActionGeneric,
  type QueryBuilder,
  type MutationBuilder,
  type ActionBuilder,
  type HttpActionBuilder,
  type GenericQueryCtx,
  type GenericMutationCtx,
  type GenericActionCtx,
} from "convex/server";
import type { DataModel } from "./dataModel";
export const query: QueryBuilder<DataModel, "public"> = queryGeneric;
export const mutation: MutationBuilder<DataModel, "public"> = mutationGeneric;
export const action: ActionBuilder<DataModel, "public"> = actionGeneric;
export const internalQuery: QueryBuilder<DataModel, "internal"> =
  internalQueryGeneric;
export const internalMutation: MutationBuilder<DataModel, "internal"> =
  internalMutationGeneric;
export const internalAction: ActionBuilder<DataModel, "internal"> =
  internalActionGeneric;
export const httpAction: HttpActionBuilder = httpActionGeneric;
export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export type ActionCtx = GenericActionCtx<DataModel>;
