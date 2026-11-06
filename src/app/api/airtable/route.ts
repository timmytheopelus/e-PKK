import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccess } from "@/lib/access";
import { handleCall } from "@/lib/proxy";
import { HttpError } from "@/lib/policy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const s = await auth();
  const email = s?.user?.email;
  if (!email) return NextResponse.json({ code: "tool_error", message: "Belum login." }, { status: 401 });
  try {
    const acc = await getAccess(email);
    if (!acc || acc.status !== "Disetujui") throw new HttpError(403, "Akun belum disetujui.");
    const body = await req.json();
    const out = await handleCall(String(body?.tool), body?.input, acc);
    return NextResponse.json(out);
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("api/airtable", e);
    return NextResponse.json({ code: e?.code || "upstream_error", message: e instanceof HttpError ? e.message : "Kesalahan di server." }, { status });
  }
}
