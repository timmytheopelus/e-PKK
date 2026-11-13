// Ringkasan angka Program Kerja: jumlah dan nilai (anggaran pengeluaran terencana) per kelompok status.
export type Grup = "selesai" | "berjalan" | "menunggu";
export type Ringkas = Record<Grup, { n: number; nilai: number }>;

export const GRUP_STATUS: Record<Grup, readonly string[]> = {
  selesai: ["Selesai"],
  berjalan: ["Disetujui", "Berjalan"],
  menunggu: ["Menunggu Koord Bidang", "Menunggu Kolaborasi", "Menunggu Sekjen"],
};

export function hitungRingkas(list: { status: string; totalPengeluaran: number }[]): Ringkas {
  const out: Ringkas = { selesai: { n: 0, nilai: 0 }, berjalan: { n: 0, nilai: 0 }, menunggu: { n: 0, nilai: 0 } };
  for (const p of list) {
    for (const g of Object.keys(GRUP_STATUS) as Grup[]) {
      if (GRUP_STATUS[g].includes(p.status)) { out[g].n += 1; out[g].nilai += Number(p.totalPengeluaran) || 0; }
    }
  }
  return out;
}
