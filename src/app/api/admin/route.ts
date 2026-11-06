import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccess } from "@/lib/access";
import { adminCall } from "@/lib/admin";
import { HttpError } from "@/lib/policy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = await auth();
  const email = s?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ code: "tool_error", message: "Belum login." }, { status: 401 });
  try {
    const acc = await getAccess(email);
    if (!acc || acc.status !== "Disetujui" || acc.level !== "Superadmin") throw new HttpError(403, "Khusus Superadmin.");
    const b = await req.json();
    return NextResponse.json(await adminCall(String(b?.action), b?.input, email));
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("api/admin", e);
    return NextResponse.json({ code: "tool_error", message: e instanceof HttpError ? e.message : "Kesalahan di server." }, { status });
  }
}
