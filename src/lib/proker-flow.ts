// Aturan alur persetujuan Program Kerja. Fungsi murni, tanpa I/O.
// Alur: seksi mengajukan -> Sekjen / Koordinator BPK (akun dengan peran sekjen) menyetujui -> Disetujui.
// Tahap Koordinator Bidang dan Kolaborasi sudah tidak dipakai; program lama yang masih berstatus
// "Menunggu Koord Bidang" / "Menunggu Kolaborasi" ikut menunggu keputusan yang sama.
import type { Peran } from "./proker-roles";

export type Tahap = "Sekjen";
export type Keputusan = { tahap: Tahap; seksi?: string; keputusan: "Setuju" | "Tolak" };

const norm = (s: string) => s.trim().toLowerCase();

/** Seksi lain (selain pengaju) yang terlibat. Hanya informasi, tidak lagi perlu menyetujui. */
export function seksiKolaborasi(p: { seksiPengaju: string; seksiTerlibat: string[] }): string[] {
  return p.seksiTerlibat.filter((s) => norm(s) !== norm(p.seksiPengaju));
}

/** Status yang masih menunggu keputusan (termasuk status lama dari alur sebelumnya). */
export const STATUS_MENUNGGU = ["Menunggu Sekjen", "Menunggu Koord Bidang", "Menunggu Kolaborasi"];

export function nextStatus(p: { status: string }, setuju: Keputusan[]): string {
  if (["Berjalan", "Selesai"].includes(p.status)) return p.status;
  const sj = setuju.filter((s) => s.tahap === "Sekjen");
  if (sj.some((s) => s.keputusan === "Tolak")) return "Ditolak";
  return sj.some((s) => s.keputusan === "Setuju") ? "Disetujui" : "Menunggu Sekjen";
}

export function canAct(peran: Peran, p: { status: string }, tahap: string): boolean {
  return tahap === "Sekjen" && STATUS_MENUNGGU.includes(p.status) && peran.sekjen;
}
