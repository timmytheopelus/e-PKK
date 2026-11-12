import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccess } from "@/lib/access";
import { AS_COOKIE } from "@/lib/viewas";
import { HttpError } from "@/lib/policy";

export const dynamic = "force-dynamic";

/** Superadmin memilih (atau mengakhiri) mode "Lihat sebagai". Hak asli diperiksa dari sesi login, bukan dari cookie. */
export async function POST(req: Request) {
  const s = await auth();
  const email = s?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ message: "Belum login." }, { status: 401 });
  try {
    const real = await getAccess(email);
    if (!real || real.status !== "Disetujui" || real.level !== "Superadmin") throw new HttpError(403, "Khusus Superadmin.");
    const b = await req.json();
    const target = b?.email ? String(b.email).trim().toLowerCase() : "";
    const res = NextResponse.json({ ok: true });
    if (!target || target === email) { res.cookies.set(AS_COOKIE, "", { path: "/", maxAge: 0 }); return res; }
    const t = await getAccess(target);
    if (!t || t.status !== "Disetujui" || !t.tabs.length) throw new HttpError(400, "Pengguna itu belum aktif atau belum punya menu.");
    console.log("VIEWAS", email, "->", target);
    res.cookies.set(AS_COOKIE, target, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 4 });
    return res;
  } catch (e: any) {
    return NextResponse.json({ message: e instanceof HttpError ? e.message : "Kesalahan di server." }, { status: e instanceof HttpError ? e.status : 500 });
  }
}
