import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccess } from "@/lib/access";
import { renderDashboard } from "@/ui/render";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await auth();
  const email = s?.user?.email;
  const url = new URL(req.url);
  const kelola = url.searchParams.get("kelola") === "1";
  if (!email) return NextResponse.redirect(new URL(kelola ? "/masuk?kelola=1" : "/masuk", req.url));
  const acc = await getAccess(email);
  if (!acc || acc.status !== "Disetujui" || !acc.tabs.length) return NextResponse.redirect(new URL("/", req.url));
  return new NextResponse(renderDashboard(acc, kelola), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
