import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { effectiveAccess, AS_COOKIE } from "@/lib/viewas";
import { handleCall } from "@/lib/proxy";
import { HttpError } from "@/lib/policy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const s = await auth();
  const email = s?.user?.email;
  if (!email) return NextResponse.json({ code: "tool_error", message: "Belum login." }, { status: 401 });
  try {
    const { acc } = await effectiveAccess(email, (await cookies()).get(AS_COOKIE)?.value);
    if (!acc || acc.status !== "Disetujui") throw new HttpError(403, "Akun belum disetujui.");
    const body = await req.json();
    if (acc.viewAs && /^(update|create|add)_/.test(String(body?.tool))) throw new HttpError(403, "Mode Lihat sebagai hanya pratinjau: data tidak bisa diubah.");
    const out = await handleCall(String(body?.tool), body?.input, acc);
    return NextResponse.json(out);
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("api/airtable", e);
    return NextResponse.json({ code: e?.code || "upstream_error", message: e instanceof HttpError ? e.message : "Kesalahan di server." }, { status });
  }
}
