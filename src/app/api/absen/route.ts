import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { effectiveAccess, AS_COOKIE } from "@/lib/viewas";
import { buatToken, infoAbsen, tandaiHadir } from "@/lib/absen";
import { HttpError } from "@/lib/policy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = await req.json();
    // Publik (berbekal token bertanda tangan): daftar nama dan tandai hadir.
    if (b?.aksi === "daftar") return NextResponse.json(await infoAbsen(String(b.token || "")));
    if (b?.aksi === "tandai") return NextResponse.json(await tandaiHadir(String(b.token || ""), String(b.pendaftaran || ""), b.hadir === true));
    // Membuat link: harus login dan punya menu Event.
    if (b?.aksi === "link") {
      const email = (await auth())?.user?.email?.toLowerCase();
      if (!email) throw new HttpError(401, "Belum login.");
      const { real, acc } = await effectiveAccess(email, (await cookies()).get(AS_COOKIE)?.value);
      const a = (acc || real) as any;
      if (!real || real.status !== "Disetujui" || a?.viewAs || !a?.tabs?.includes("Event")) throw new HttpError(403, "Tidak punya akses.");
      return NextResponse.json({ token: buatToken(String(b.event || "")) });
    }
    throw new HttpError(400, "Aksi tidak dikenal.");
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("api/absen", e);
    return NextResponse.json({ code: "tool_error", message: e instanceof HttpError ? e.message : "Kesalahan di server." }, { status });
  }
}
