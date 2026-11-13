import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { effectiveAccess, AS_COOKIE } from "@/lib/viewas";
import { laporanSeksi, infoEvent } from "@/lib/seksi-hadir";
import { HttpError } from "@/lib/policy";

export const dynamic = "force-dynamic";
const REC = /^rec[A-Za-z0-9]{14}$/;

export async function POST(req: Request) {
  try {
    const email = (await auth())?.user?.email?.toLowerCase();
    if (!email) throw new HttpError(401, "Belum login.");
    const { real, acc } = await effectiveAccess(email, (await cookies()).get(AS_COOKIE)?.value);
    const a = acc || real;
    if (!real || real.status !== "Disetujui" || !a?.tabs.includes("Event")) throw new HttpError(403, "Tidak punya akses menu Event.");
    const b = await req.json();
    const id = String(b?.event || "");
    if (!REC.test(id)) throw new HttpError(400, "Event tidak valid.");
    const dasar = b?.dasar === "hadir" ? "hadir" : "daftar";
    const ev = await infoEvent(id);
    return NextResponse.json({ ...(await laporanSeksi(id, dasar, ev)), tgl: ev.tgl });
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("api/event-seksi", e);
    return NextResponse.json({ code: "tool_error", message: e instanceof HttpError ? e.message : "Kesalahan di server." }, { status });
  }
}
