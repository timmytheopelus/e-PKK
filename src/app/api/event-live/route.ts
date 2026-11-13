import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { effectiveAccess, AS_COOKIE } from "@/lib/viewas";
import { ringkasHadir } from "@/lib/absen";
import { HttpError } from "@/lib/policy";

export const dynamic = "force-dynamic";
const REC = /^rec[A-Za-z0-9]{14}$/;

/** Jumlah hadir dan terdaftar untuk event yang sedang berlangsung (menu Event). */
export async function POST(req: Request) {
  try {
    const email = (await auth())?.user?.email?.toLowerCase();
    if (!email) throw new HttpError(401, "Belum login.");
    const { real, acc } = await effectiveAccess(email, (await cookies()).get(AS_COOKIE)?.value);
    const a = acc || real;
    if (!real || real.status !== "Disetujui" || !a?.tabs.includes("Event")) throw new HttpError(403, "Tidak punya akses menu Event.");
    const b = await req.json();
    const ids = [...new Set((Array.isArray(b?.events) ? b.events : []).map(String).filter((x: string) => REC.test(x)))].slice(0, 6) as string[];
    const items: Record<string, { hadir: number; daftar: number }> = {};
    for (const id of ids) items[id] = await ringkasHadir(id);
    return NextResponse.json({ items });
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("api/event-live", e);
    return NextResponse.json({ code: "tool_error", message: e instanceof HttpError ? e.message : "Kesalahan di server." }, { status });
  }
}
