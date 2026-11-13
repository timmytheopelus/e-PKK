// Aturan alur persetujuan Program Kerja. Fungsi murni, tanpa I/O.
import type { Peran } from "./proker-roles";

export type Tahap = "Koord Bidang" | "Kolaborasi" | "Sekjen";
export type Keputusan = { tahap: Tahap; seksi?: string; keputusan: "Setuju" | "Tolak" };

const norm = (s: string) => s.trim().toLowerCase();

/** Seksi lain (selain pengaju) yang harus menyetujui kolaborasi. */
export function seksiKolaborasi(p: { seksiPengaju: string; seksiTerlibat: string[] }): string[] {
  return p.seksiTerlibat.filter((s) => norm(s) !== norm(p.seksiPengaju));
}

export function nextStatus(
  p: { status: string; seksiTerlibat: string[]; seksiPengaju: string },
  setuju: Keputusan[],
): string {
  if (["Berjalan", "Selesai"].includes(p.status)) return p.status;
  const perlu = seksiKolaborasi(p);
  const perluSet = new Set(perlu.map(norm));
  // Persetujuan/penolakan kolaborasi dari seksi yang tidak (lagi) terlibat diabaikan.
  const sah = setuju.filter((s) => s.tahap !== "Kolaborasi" || (s.seksi && perluSet.has(norm(s.seksi))));
  if (sah.some((s) => s.keputusan === "Tolak")) return "Ditolak";
  const ya = (t: Tahap) => sah.some((s) => s.tahap === t && s.keputusan === "Setuju");
  if (!ya("Koord Bidang")) return "Menunggu Koord Bidang";
  const sudah = new Set(sah.filter((s) => s.tahap === "Kolaborasi" && s.keputusan === "Setuju").map((s) => norm(s.seksi || "")));
  if (perlu.some((s) => !sudah.has(norm(s)))) return "Menunggu Kolaborasi";
  return ya("Sekjen") ? "Disetujui" : "Menunggu Sekjen";
}

const STATUS_TAHAP: Record<Tahap, string> = {
  "Koord Bidang": "Menunggu Koord Bidang",
  Kolaborasi: "Menunggu Kolaborasi",
  Sekjen: "Menunggu Sekjen",
};

export function canAct(
  peran: Peran,
  p: { bidang: string; seksiPengaju: string; seksiTerlibat: string[]; status: string },
  tahap: string,
  seksi?: string,
): boolean {
  if (!(tahap in STATUS_TAHAP) || p.status !== STATUS_TAHAP[tahap as Tahap]) return false;
  if (tahap === "Koord Bidang") return peran.koordBidang.some((b) => norm(b) === norm(p.bidang));
  if (tahap === "Sekjen") return peran.sekjen;
  const s = norm(seksi || "");
  return !!s && seksiKolaborasi(p).some((x) => norm(x) === s) && peran.koordSeksi.some((x) => norm(x) === s);
}
