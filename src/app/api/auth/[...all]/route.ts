import { liveAuth } from "@/lib/auth-server";
export async function GET(req: Request) {
  if (!process.env.NEXT_PUBLIC_CONVEX_SITE_URL)
    return Response.json(
      { error: "Live authentication is not configured." },
      { status: 503 },
    );
  return liveAuth().handler.GET(req);
}
export async function POST(req: Request) {
  if (!process.env.NEXT_PUBLIC_CONVEX_SITE_URL)
    return Response.json(
      { error: "Live authentication is not configured." },
      { status: 503 },
    );
  return liveAuth().handler.POST(req);
}
