export function relativeTime(at: number, now: number) {
  const mins = Math.max(0, Math.floor((now - at) / 60000));
  return mins < 1
    ? "Just now"
    : mins < 60
      ? `${mins}m ago`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h ago`
        : `${Math.floor(mins / 1440)}d ago`;
}
export function shortDate(at: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(at);
}
export const titleCase = (s: string) =>
  s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const statusTone = (
  s: string,
): "green" | "amber" | "red" | "neutral" | "blue" =>
  ["succeeded", "healthy", "activated", "customer", "high"].includes(s)
    ? "green"
    : ["pending_approval", "needs_attention", "pending"].includes(s)
      ? "amber"
      : ["failed", "error", "excluded", "paused"].includes(s)
        ? "red"
        : ["scheduled", "working", "executing", "qualified"].includes(s)
          ? "blue"
          : "neutral";
