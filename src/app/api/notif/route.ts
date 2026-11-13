import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccess } from "@/lib/access";
import { daftarNotif, tandaiDibaca } from "@/lib/notif";
import { HttpError } from "@/lib/policy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = await auth();
  const email = s?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ code: "tool_error", message: "Belum login." }, { status: 401 });
  try {
    // Selalu akun yang login sebenarnya (bukan 'Lihat sebagai'): notifikasi bersifat pribadi.
    const real = await getAccess(email);
    if (!real || real.status !== "Disetujui") throw new HttpError(403, "Tidak punya akses.");
    const b = await req.json();
    if (b?.aksi === "daftar") return NextResponse.json({ items: await daftarNotif(real) });
    if (b?.aksi === "baca") { await tandaiDibaca(real, b.ids); return NextResponse.json({ ok: true }); }
    throw new HttpError(400, "Aksi tidak dikenal.");
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("api/notif", e);
    return NextResponse.json({ code: "tool_error", message: e instanceof HttpError ? e.message : "Kesalahan di server." }, { status });
  }
}
