import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { effectiveAccess, AS_COOKIE } from "@/lib/viewas";
import { ajukanProgram, putuskan, daftarProgram, infoProgram } from "@/lib/proker";
import { HttpError } from "@/lib/policy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = await auth();
  const email = s?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ code: "tool_error", message: "Belum login." }, { status: 401 });
  try {
    const { real, acc } = await effectiveAccess(email, (await cookies()).get(AS_COOKIE)?.value);
    if (!real || real.status !== "Disetujui") throw new HttpError(403, "Tidak punya akses.");
    const a = (acc || real) as any; // saat 'Lihat sebagai' acc.viewAs terisi: aksi tulis ditolak di lib
    const b = await req.json();
    if (b?.aksi === "daftar") return NextResponse.json({ programs: await daftarProgram(a) });
    if (b?.aksi === "info") return NextResponse.json(await infoProgram(a));
    if (b?.aksi === "ajukan") return NextResponse.json(await ajukanProgram(a, b));
    if (b?.aksi === "putuskan") return NextResponse.json(await putuskan(a, b));
    throw new HttpError(400, "Aksi tidak dikenal.");
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("api/proker", e);
    return NextResponse.json({ code: "tool_error", message: e instanceof HttpError ? e.message : "Kesalahan di server." }, { status });
  }
}
