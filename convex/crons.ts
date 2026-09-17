import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval(
  "Execute due actions and reconcile interruptions",
  { minutes: 1 },
  internal.runtime.sweep,
  {},
);
export default crons;
