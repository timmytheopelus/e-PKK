import { describe, it, expect } from "vitest";
import { nextStatus, canAct } from "../src/lib/proker-flow";
import { peranFromRows } from "../src/lib/proker-roles";

const base = { status: "Menunggu Koord Bidang", seksiPengaju: "Forkom 1", seksiTerlibat: ["Forkom 1"] };
const kb = { tahap: "Koord Bidang" as const, keputusan: "Setuju" as const };
const sj = { tahap: "Sekjen" as const, keputusan: "Setuju" as const };
const kol = (seksi: string, keputusan: "Setuju" | "Tolak" = "Setuju") => ({ tahap: "Kolaborasi" as const, seksi, keputusan });

describe("nextStatus", () => {
  it("tanpa persetujuan tetap Menunggu Koord Bidang", () => {
    expect(nextStatus(base, [])).toBe("Menunggu Koord Bidang");
  });
  it("Koord Bidang setuju tanpa seksi lain -> Menunggu Sekjen", () => {
    expect(nextStatus(base, [kb])).toBe("Menunggu Sekjen");
  });
  it("Koord Bidang setuju dengan seksi lain belum setuju -> Menunggu Kolaborasi", () => {
    const p = { ...base, seksiTerlibat: ["Forkom 1", "Forkom 2"] };
    expect(nextStatus(p, [kb])).toBe("Menunggu Kolaborasi");
  });
  it("semua kolaborasi setuju -> Menunggu Sekjen", () => {
    const p = { ...base, seksiTerlibat: ["Forkom 1", "Forkom 2"] };
    expect(nextStatus(p, [kb, kol("Forkom 2")])).toBe("Menunggu Sekjen");
  });
  it("Sekjen setuju -> Disetujui", () => {
    expect(nextStatus(base, [kb, sj])).toBe("Disetujui");
  });
  it("satu Tolak di tahap mana pun -> Ditolak", () => {
    expect(nextStatus(base, [{ tahap: "Koord Bidang", keputusan: "Tolak" }])).toBe("Ditolak");
    const p = { ...base, seksiTerlibat: ["Forkom 1", "Forkom 2"] };
    expect(nextStatus(p, [kb, kol("Forkom 2", "Tolak")])).toBe("Ditolak");
    expect(nextStatus(base, [kb, { tahap: "Sekjen", keputusan: "Tolak" }])).toBe("Ditolak");
  });
  it("Sekjen setuju sebelum Koord Bidang tidak memajukan status", () => {
    expect(nextStatus(base, [sj])).toBe("Menunggu Koord Bidang");
  });
  it("Sekjen setuju sebelum kolaborasi selesai tidak memajukan status", () => {
    const p = { ...base, seksiTerlibat: ["Forkom 1", "Forkom 2"] };
    expect(nextStatus(p, [kb, sj])).toBe("Menunggu Kolaborasi");
  });
  it("persetujuan kolaborasi dari seksi yang sudah dihapus diabaikan", () => {
    const p = { ...base, seksiTerlibat: ["Forkom 1", "Forkom 2"] };
    expect(nextStatus(p, [kb, kol("Sekolah")])).toBe("Menunggu Kolaborasi");
    // penolakan dari seksi yang sudah dihapus juga tidak berlaku
    expect(nextStatus(base, [kb, kol("Sekolah", "Tolak")])).toBe("Menunggu Sekjen");
  });
  it("status Berjalan/Selesai tidak diubah", () => {
    expect(nextStatus({ ...base, status: "Berjalan" }, [])).toBe("Berjalan");
    expect(nextStatus({ ...base, status: "Selesai" }, [])).toBe("Selesai");
  });
});

describe("canAct", () => {
  const none = { koordBidang: [], koordSeksi: [], sekjen: false, bendahara: false, pimpinan: false };
  const prog = { bidang: "Kesekretariatan", seksiPengaju: "Forkom 1", seksiTerlibat: ["Forkom 1", "Forkom 2"] };
  it("Koord Seksi A tidak bisa bertindak atas seksi B", () => {
    const p = { ...none, koordSeksi: ["Forkom 1"] };
    expect(canAct(p, { ...prog, status: "Menunggu Kolaborasi" }, "Kolaborasi", "Forkom 2")).toBe(false);
    expect(canAct({ ...none, koordSeksi: ["Forkom 2"] }, { ...prog, status: "Menunggu Kolaborasi" }, "Kolaborasi", "Forkom 2")).toBe(true);
  });
  it("Koord Bidang hanya untuk bidangnya", () => {
    const st = { ...prog, status: "Menunggu Koord Bidang" };
    expect(canAct({ ...none, koordBidang: ["Outreach"] }, st, "Koord Bidang")).toBe(false);
    expect(canAct({ ...none, koordBidang: ["Kesekretariatan"] }, st, "Koord Bidang")).toBe(true);
  });
  it("Sekjen hanya saat Menunggu Sekjen", () => {
    const sjn = { ...none, sekjen: true };
    expect(canAct(sjn, { ...prog, status: "Menunggu Koord Bidang" }, "Sekjen")).toBe(false);
    expect(canAct(sjn, { ...prog, status: "Menunggu Sekjen" }, "Sekjen")).toBe(true);
  });
});

describe("peranFromRows", () => {
  const J = (bidang: string, seksi: string, peran: string) => ({ bidang, seksi, peran });
  it("Ketua seksi biasa = koordSeksi", () => {
    const p = peranFromRows([J("Kesekretariatan", "Forkom 1", "Ketua")], false);
    expect(p.koordSeksi).toEqual(["Forkom 1"]);
    expect(p.koordBidang).toEqual([]);
  });
  it("Ketua seksi 'Pimpinan <Bidang>' = koordBidang bidang itu", () => {
    const p = peranFromRows([J("Outreach", "Pimpinan Outreach", "Ketua")], false);
    expect(p.koordBidang).toEqual(["Outreach"]);
    expect(p.koordSeksi).toEqual([]);
  });
  it("Anggota tidak punya peran koordinator", () => {
    const p = peranFromRows([J("Kesekretariatan", "Forkom 1", "Anggota")], false);
    expect(p.koordSeksi).toEqual([]);
  });
  it("Pimpinan/Penasihat = pimpinan; sekjen dari argumen", () => {
    expect(peranFromRows([J("Pimpinan", "Pimpinan Inti", "Pimpinan")], false).pimpinan).toBe(true);
    expect(peranFromRows([J("Pimpinan", "Penasihat & Pastor", "Penasihat")], false).pimpinan).toBe(true);
    expect(peranFromRows([], true).sekjen).toBe(true);
  });
});
