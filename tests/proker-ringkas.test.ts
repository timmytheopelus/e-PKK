import { describe, it, expect } from "vitest";
import { hitungRingkas } from "../src/lib/proker-ringkas";

describe("hitungRingkas", () => {
  it("daftar kosong menghasilkan nol, bukan NaN", () => {
    expect(hitungRingkas([])).toEqual({ selesai: { n: 0, nilai: 0 }, berjalan: { n: 0, nilai: 0 }, menunggu: { n: 0, nilai: 0 } });
  });
  it("mengelompokkan status dan mengabaikan Draft dan Ditolak", () => {
    const r = hitungRingkas([
      { status: "Selesai", totalPengeluaran: 100 }, { status: "Disetujui", totalPengeluaran: 200 }, { status: "Berjalan", totalPengeluaran: 300 },
      { status: "Menunggu Sekjen", totalPengeluaran: 50 }, { status: "Menunggu Koord Bidang", totalPengeluaran: 25 },
      { status: "Draft", totalPengeluaran: 999 }, { status: "Ditolak", totalPengeluaran: 888 },
    ]);
    expect(r).toEqual({ selesai: { n: 1, nilai: 100 }, berjalan: { n: 2, nilai: 500 }, menunggu: { n: 2, nilai: 75 } });
  });
});
