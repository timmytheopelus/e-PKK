import { describe, it, expect } from "vitest";
import { hitungSeksi, Orang } from "@/lib/seksi-hadir";

const O = (umat: string, nama: string, ...jab: [string, string, string][]): Orang => ({ umat, nama, jab: jab.map(([bidang, seksi, peran]) => ({ bidang, seksi, peran })) });
const orang = [
  O("u1", "Ani", ["Inreach", "Sekretariat", "Ketua"]),
  O("u2", "Budi", ["Inreach", "Sekretariat", "Anggota"]),
  O("u3", "Cici", ["Inreach", "Dana Usaha", "Ketua"]),
  O("u4", "Dedi", ["Inreach", "Dana Usaha", "Wakil"]),
  O("u5", "Eka", ["Inreach", "Litbang", "Ketua"]),
  O("u6", "Fani", ["Inreach", "Litbang", "Anggota"]),
  O("u7", "Gita", ["", "Formasi", "Anggota"]),
];
const row = (r: any[], s: string) => r.find((x) => x.seksi === s)!;

describe("hitungSeksi", () => {
  const r = hitungSeksi(orang, new Set(["u1", "u4"]));
  it("ketua hadir: status ketua, tanpa perwakilan lain", () => {
    expect(row(r, "Sekretariat").status).toBe("ketua");
    expect(row(r, "Sekretariat").ketua).toEqual([{ nama: "Ani", status: "hadir" }]);
  });
  it("ketua tidak hadir tapi wakil/anggota hadir: diwakili, nama perwakilan terlihat", () => {
    expect(row(r, "Dana Usaha").status).toBe("diwakili");
    expect(row(r, "Dana Usaha").perwakilan).toEqual(["Dedi"]);
    expect(row(r, "Dana Usaha").ketua[0].status).toBe("diwakili");
  });
  it("tidak ada satu pun anggota: kosong", () => {
    expect(row(r, "Litbang").status).toBe("kosong");
    expect(row(r, "Litbang").ketua[0].status).toBe("tidak");
  });
  it("seksi tanpa ketua di data tetap dihitung dari anggotanya", () => {
    expect(row(r, "Formasi").status).toBe("kosong");
    expect(row(hitungSeksi(orang, new Set(["u7"])), "Formasi").status).toBe("diwakili");
  });
  it("orang yang merangkap dua seksi dihitung di keduanya", () => {
    const x = hitungSeksi([O("u1", "Ani", ["A", "S1", "Ketua"], ["A", "S2", "Anggota"]), O("u2", "Budi", ["A", "S2", "Ketua"])], new Set(["u1"]));
    expect(row(x, "S1").status).toBe("ketua");
    expect(row(x, "S2").status).toBe("diwakili");
  });
});

describe("hitungSeksi: daftar anggota untuk detail", () => {
  const r = hitungSeksi(orang, new Set(["u1", "u4"]));
  it("setiap seksi memuat semua anggota dengan peran dan status hadir", () => {
    expect(row(r, "Dana Usaha").daftar).toEqual([
      { nama: "Cici", peran: "Ketua", hadir: false },
      { nama: "Dedi", peran: "Wakil", hadir: true },
    ]);
    expect(row(r, "Sekretariat").daftar.map((x: any) => x.nama)).toEqual(["Ani", "Budi"]);
  });
});
