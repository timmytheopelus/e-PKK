import { NextResponse } from "next/server";
import { submitPublic } from "@/lib/sep";
import { HttpError } from "@/lib/policy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "x";
    return NextResponse.json(await submitPublic(String(b?.token || ""), b, ip));
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error("api/daftar", e);
    return NextResponse.json({ message: e instanceof HttpError ? e.message : "Kesalahan di server." }, { status });
  }
}
