import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { effectiveAccess, AS_COOKIE } from "@/lib/viewas";
import { at, getRecord } from "@/lib/airtable";
import { BASE_BPK, HttpError, T } from "@/lib/policy";

export const dynamic = "force-dynamic";
const REC = /^rec[A-Za-z0-9]{14}$/;
const PD = { event: "flduf15moMpZSklGL", st: "fldNGGEcwHqIsQPct" };

/** Admin/Superadmin menghapus pendaftar dari event = status jadi "Batal" (baris tetap ada, bisa dipulihkan di Airtable). */
export async function POST(req: Request) {
  try {
    const email = (await auth())?.user?.email?.toLowerCase();
    if (!email) throw new HttpError(401, "Belum login.");
    const { real, acc } = await effectiveAccess(email, (await cookies()).get(AS_COOKIE)?.value);
    if (acc?.viewAs) throw new HttpError(403, "Mode Lihat sebagai hanya pratinjau. Kembali ke akun Anda untuk menghapus pendaftar.");
    if (!real || real.status !== "Disetujui" || !["Admin", "Superadmin"].includes(real.level) || !real.tabs.includes("Event")) throw new HttpError(403, "Hanya Admin atau Superadmin dengan menu Event yang boleh menghapus pendaftar.");
    const b = await req.json();
    const ev = String(b?.event || ""), id = String(b?.id || "");
    if (b?.aksi !== "batal" || !REC.test(ev) || !REC.test(id)) throw new HttpError(400, "Data tidak valid.");
    const r = await getRecord(BASE_BPK, T.pendaftaran, id).catch(() => null);
    if (!r || !((r.fields[PD.event] as string[]) || []).includes(ev)) throw new HttpError(400, "Pendaftar ini bukan dari event tersebut.");
    const st = r.fields[PD.st] as any;
    if (!/^batal/i.test(String(st?.name ?? st ?? ""))) {
      await at(`/v0/${BASE_BPK}/${T.pendaftaran}`, { method: "PATCH", body: JSON.stringify({ records: [{ id, fields: { [PD.st]: "Batal" } }] }) });
      console.log("EVENT hapus pendaftar", email, ev, id);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("api/event-pendaftar", e);
    return NextResponse.json({ code: "tool_error", message: e instanceof HttpError ? e.message : "Kesalahan di server." }, { status });
  }
}
