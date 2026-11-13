import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: any[] = [];
let kehadiran: any[] = [];
vi.mock("@/lib/seksi-hadir", () => ({ pengurusAktif: async () => [{ umat: "recUMAT0000000001", nama: "Budi", jab: [{ bidang: "Inreach", seksi: "Sekretariat", peran: "Anggota" }] }] }));
vi.mock("@/lib/airtable", async () => ({
  resolveLinks: async (_b: string, _t: string, r: any[]) => r,
  at: vi.fn(async (path: string, init: any) => { calls.push({ path, init }); return {}; }),
  getRecord: vi.fn(async () => ({ id: "recEVENT00000000A", fields: { fld0d9tIyi4nyTZsM: "261114-Rapat Pleno 3", fldoIkx9wLMaKOa38: new Date().toISOString().slice(0, 10) } })),
  listUntil: vi.fn(async (_b: string, table: string) => table === "tblQgU4DawCAXIRdi"
    ? { records: kehadiran }
    : { records: [
        { id: "recPEND00000000B1", fields: { flduf15moMpZSklGL: ["recEVENT00000000A"], fldqvA9dTUmWLfRr2: ["recUMAT0000000001"], fld9ucFxEU0cUSHWw: ["Budi"], fldCzgcTVAfS1nLcJ: ["Bud"], fldxPeYahFmDfKvlL: ["08123456789"], fldNGGEcwHqIsQPct: { name: "Confirmed" } } },
        { id: "recPEND00000000B2", fields: { flduf15moMpZSklGL: ["recEVENT00000000A"], fld9ucFxEU0cUSHWw: ["Ani"], fldNGGEcwHqIsQPct: { name: "Batal" } } },
        { id: "recPEND00000000B3", fields: { flduf15moMpZSklGL: ["recLAIN000000000X"], fld9ucFxEU0cUSHWw: ["Cici"] } },
      ] }),
}));
import { buatToken, bacaToken, dalamJendela, infoAbsen, simpanHadir, waDigits } from "@/lib/absen";

beforeEach(() => { process.env.AUTH_SECRET = "rahasia"; calls.length = 0; kehadiran = []; });

describe("token absensi", () => {
  it("token sah dibaca kembali; token diubah ditolak", () => {
    const t = buatToken("recEVENT00000000A");
    expect(bacaToken(t)).toBe("recEVENT00000000A");
    expect(bacaToken(t.replace("recEVENT00000000A", "recEVENT00000000B"))).toBeNull();
    expect(bacaToken("sembarang")).toBeNull();
  });
});
describe("jendela waktu", () => {
  it("±7 hari dari tanggal acara", () => {
    const now = new Date("2026-11-14T03:00:00Z");
    expect(dalamJendela("2026-11-14", now)).toBe(true);
    expect(dalamJendela("2026-11-21", now)).toBe(true);
    expect(dalamJendela("2026-11-22", now)).toBe(false);
    expect(dalamJendela("2026-11-06", now)).toBe(false);
  });
});
describe("infoAbsen dan simpanHadir", () => {
  const T = () => buatToken("recEVENT00000000A");
  it("hanya peserta aktif event ini; WA jadi digit untuk tombol, bukan teks bebas", async () => {
    const r = await infoAbsen(T());
    expect(r.peserta.map((p) => p.nama)).toEqual(["Budi"]);
    expect(r.peserta[0]).toMatchObject({ pgl: "Bud", wa: "628123456789", seksi: "Sekretariat" });
    expect(r.kep).toBe(false);
  });
  it("simpan sekaligus: membuat baris Kehadiran dengan Status Hadir", async () => {
    await simpanHadir(T(), [{ pendaftaran: "recPEND00000000B1", hadir: true }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body).records[0].fields).toEqual({ fldrIFO5fehaqaS2u: ["recEVENT00000000A"], fldTuFsmLgiZoHXEf: ["recPEND00000000B1"], fldudT9j1X2vkQCqD: "Hadir" });
  });
  it("simpan dua kali tidak membuat baris ganda", async () => {
    kehadiran = [{ id: "recKH0000000000001", fields: { fldrIFO5fehaqaS2u: ["recEVENT00000000A"], fldTuFsmLgiZoHXEf: ["recPEND00000000B1"] } }];
    await simpanHadir(T(), [{ pendaftaran: "recPEND00000000B1", hadir: true }]);
    expect(calls).toHaveLength(0);
  });
  it("batal tanda menghapus baris kehadiran itu", async () => {
    kehadiran = [{ id: "recKH0000000000001", fields: { fldrIFO5fehaqaS2u: ["recEVENT00000000A"], fldTuFsmLgiZoHXEf: ["recPEND00000000B1"] } }];
    await simpanHadir(T(), [{ pendaftaran: "recPEND00000000B1", hadir: false }]);
    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].path).toContain("records[]=recKH0000000000001");
  });
  it("peserta event lain atau yang batal ditolak", async () => {
    await expect(simpanHadir(T(), [{ pendaftaran: "recPEND00000000B3", hadir: true }])).rejects.toThrow(/tidak terdaftar/);
    await expect(simpanHadir(T(), [{ pendaftaran: "recPEND00000000B2", hadir: true }])).rejects.toThrow(/tidak terdaftar/);
  });
});
describe("waDigits", () => {
  it("menormalkan ke 62...", () => {
    expect(waDigits("0812-3456-789")).toBe("628123456789");
    expect(waDigits(["+62 812 3456 789"])).toBe("628123456789");
    expect(waDigits("123")).toBe("");
    expect(waDigits(undefined)).toBe("");
  });
});

import { bolehAbsen } from "@/lib/absen";
describe("hak akses Absensi", () => {
  it("butuh status Disetujui, menu Absensi, dan bukan Lihat sebagai", () => {
    expect(bolehAbsen({ status: "Disetujui", tabs: ["Absensi"] })).toBe(true);
    expect(bolehAbsen({ status: "Disetujui", tabs: ["Event"] })).toBe(false);
    expect(bolehAbsen({ status: "Menunggu", tabs: ["Absensi"] })).toBe(false);
    expect(bolehAbsen({ status: "Disetujui", tabs: ["Absensi"], viewAs: "x@x.com" })).toBe(false);
    expect(bolehAbsen(null)).toBe(false);
  });
});
