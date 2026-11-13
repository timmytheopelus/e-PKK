import { describe, it, expect } from "vitest";
import { nextStatus, canAct } from "../src/lib/proker-flow";
import { peranFromRows } from "../src/lib/proker-roles";


describe("nextStatus (alur baru)", () => {
  const sj = (keputusan: "Setuju" | "Tolak") => ({ tahap: "Sekjen" as const, keputusan });
  it("tanpa keputusan tetap Menunggu Sekjen", () => {
    expect(nextStatus({ status: "Menunggu Sekjen" }, [])).toBe("Menunggu Sekjen");
  });
  it("Sekjen setuju -> Disetujui tanpa tahap lain", () => {
    expect(nextStatus({ status: "Menunggu Sekjen" }, [sj("Setuju")])).toBe("Disetujui");
  });
  it("Sekjen tolak -> Ditolak", () => {
    expect(nextStatus({ status: "Menunggu Sekjen" }, [sj("Tolak")])).toBe("Ditolak");
  });
  it("Berjalan dan Selesai tidak berubah", () => {
    expect(nextStatus({ status: "Berjalan" }, [])).toBe("Berjalan");
    expect(nextStatus({ status: "Selesai" }, [])).toBe("Selesai");
  });
});

describe("canAct (alur baru)", () => {
  const none = { koordBidang: [], koordSeksi: [], sekjen: false, bendahara: false, pimpinan: false };
  it("hanya peran sekjen yang bisa bertindak", () => {
    expect(canAct({ ...none, koordBidang: ["Kesekretariatan"], koordSeksi: ["Forkom 1"] }, { status: "Menunggu Sekjen" }, "Sekjen")).toBe(false);
    expect(canAct({ ...none, sekjen: true }, { status: "Menunggu Sekjen" }, "Sekjen")).toBe(true);
  });
  it("status lama Menunggu Koord Bidang / Kolaborasi ikut menunggu Sekjen", () => {
    for (const status of ["Menunggu Koord Bidang", "Menunggu Kolaborasi"]) expect(canAct({ ...none, sekjen: true }, { status }, "Sekjen")).toBe(true);
  });
  it("tidak bisa bertindak pada program yang sudah diputuskan atau tahap lain", () => {
    for (const status of ["Draft", "Disetujui", "Ditolak", "Berjalan", "Selesai"]) expect(canAct({ ...none, sekjen: true }, { status }, "Sekjen")).toBe(false);
    expect(canAct({ ...none, sekjen: true }, { status: "Menunggu Sekjen" }, "Koord Bidang")).toBe(false);
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
