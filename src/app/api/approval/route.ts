import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { effectiveAccess, AS_COOKIE } from "@/lib/viewas";
import { decide } from "@/lib/approval";
import { HttpError } from "@/lib/policy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = await auth();
  const email = s?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ code: "tool_error", message: "Belum login." }, { status: 401 });
  try {
    const { real, acc } = await effectiveAccess(email, (await cookies()).get(AS_COOKIE)?.value);
    if (!real || real.status !== "Disetujui") throw new HttpError(403, "Tidak punya akses.");
    const b = await req.json();
    // Saat 'Lihat sebagai', acc.viewAs terisi sehingga decide() menolak.
    return NextResponse.json(await decide(String(b?.eventId), String(b?.decision), (acc || real) as any));
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("api/approval", e);
    return NextResponse.json({ code: "tool_error", message: e instanceof HttpError ? e.message : "Kesalahan di server." }, { status });
  }
}
