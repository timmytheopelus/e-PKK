import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccess } from "@/lib/access";
import { templateXlsx } from "@/lib/sep";

export const dynamic = "force-dynamic";

export async function GET() {
  const email = (await auth())?.user?.email?.toLowerCase();
  const acc = email ? await getAccess(email) : null;
  if (!acc || acc.status !== "Disetujui" || !acc.tabs.includes("KEP")) return new NextResponse("Tidak punya akses.", { status: 403 });
  return new NextResponse(new Uint8Array(templateXlsx()), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": 'attachment; filename="template-peserta-sep.xlsx"' } });
}
