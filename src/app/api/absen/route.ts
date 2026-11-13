import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { effectiveAccess, AS_COOKIE } from "@/lib/viewas";
import { bolehAbsen, buatToken, infoAbsen, simpanHadir } from "@/lib/absen";
import { HttpError } from "@/lib/policy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const email = (await auth())?.user?.email?.toLowerCase();
    if (!email) throw new HttpError(401, "Belum login.");
    const { real, acc } = await effectiveAccess(email, (await cookies()).get(AS_COOKIE)?.value);
    const b = await req.json();
    // Membuat link: pemegang menu Event atau Absensi (akun asli, bukan Lihat sebagai).
    if (b?.aksi === "link") {
      if (!real || real.status !== "Disetujui" || acc?.viewAs || !(real.tabs.includes("Event") || real.tabs.includes("Absensi"))) throw new HttpError(403, "Tidak punya akses.");
      return NextResponse.json({ token: buatToken(String(b.event || "")) });
    }
    // Daftar nama dan tandai hadir: hanya akun dengan menu Absensi.
    if (!bolehAbsen(real) || acc?.viewAs) throw new HttpError(403, "Akun Anda belum punya akses menu Absensi. Hubungi sekretariat.");
    if (b?.aksi === "daftar") return NextResponse.json(await infoAbsen(String(b.token || "")));
    if (b?.aksi === "simpan") {
      const r = await simpanHadir(String(b.token || ""), Array.isArray(b.perubahan) ? b.perubahan.map((c: any) => ({ pendaftaran: String(c?.pendaftaran || ""), hadir: c?.hadir === true })) : []);
      console.log("ABSEN", email, "+" + r.ditambah, "-" + r.dihapus);
      return NextResponse.json(r);
    }
    throw new HttpError(400, "Aksi tidak dikenal.");
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("api/absen", e);
    return NextResponse.json({ code: "tool_error", message: e instanceof HttpError ? e.message : "Kesalahan di server." }, { status });
  }
}
