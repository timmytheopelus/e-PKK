import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: any[] = [];
let namaEvent = "261114-Rapat Pleno 3";
let kelEvent: any = undefined;
let umatCari: any[] = [];
let sudahAda: any[] = [];
vi.mock("@/lib/seksi-hadir", () => ({
  pengurusAktif: async () => [
    { umat: "recUMAT0000000001", nama: "Budi Terdaftar", jab: [{ bidang: "Inreach", seksi: "Sekretariat", peran: "Anggota" }] },
    { umat: "recUMAT0000000002", nama: "Cantik Pengurus", jab: [{ bidang: "Inreach", seksi: "Litbang", peran: "Ketua" }] },
  ],
}));
vi.mock("@/lib/airtable", () => ({
  resolveLinks: async (_b: string, _t: string, r: any[]) => r,
  at: vi.fn(async (path: string, init: any) => {
    calls.push({ path, init });
    if (init?.method === "POST") return { records: [{ id: "recBARU0000000001" }] };
    return {};
  }),
  getRecord: vi.fn(async (_b: string, t: string, id: string) =>
    t === "tblwRNtXSVzgzVXuk"
      ? { id, fields: { fldIpQTSkFB9sU0lo: "Cantik Pengurus", fld469PYR80nAUNIF: "Cantik", fldzY1Z2QvIIEkYXR: "0812000111", fldrHJ6q3HZvApccl: ["recPD00000000001"] } }
      : { id, fields: { fld0d9tIyi4nyTZsM: namaEvent, fldoIkx9wLMaKOa38: new Date().toISOString().slice(0, 10), fldhgv2WlvqytF6zA: kelEvent } }),
  listPage: vi.fn(async (_b: string, _t: string, o: any) => ({ records: /LOWER\(\{fldIpQTSkFB9sU0lo\}\)="/.test(o.formula || "") ? sudahAda : umatCari })),
  listUntil: vi.fn(async (_b: string, table: string) => table === "tblQgU4DawCAXIRdi"
    ? { records: [] }
    : { records: [{ id: "recPEND00000000B1", fields: { flduf15moMpZSklGL: ["recEVENT00000000A"], fldqvA9dTUmWLfRr2: ["recUMAT0000000001"], fld9ucFxEU0cUSHWw: ["Budi Terdaftar"], fldNGGEcwHqIsQPct: { name: "Daftar" } } }] }),
}));
import { buatToken, cariGoShow, tambahGoShow } from "@/lib/absen";

const T = () => buatToken("recEVENT00000000A");
beforeEach(() => { process.env.AUTH_SECRET = "rahasia"; calls.length = 0; namaEvent = "261114-Rapat Pleno 3"; kelEvent = undefined; umatCari = []; sudahAda = []; });

describe("cariGoShow", () => {
  it("rapat BPK: sama seperti acara lain, mencari di seluruh umat (bukan hanya pengurus); yang sudah terdaftar tidak muncul", async () => {
    umatCari = [
      { id: "recUMAT0000000009", fields: { fldIpQTSkFB9sU0lo: "Dodi Umat", fldOovF470MdN2fMg: ["PD Dua"] } },
      { id: "recUMAT0000000001", fields: { fldIpQTSkFB9sU0lo: "Budi Terdaftar" } },
    ];
    const r = await cariGoShow(T(), "do");
    expect(r.sumber).toBe("umat");
    expect(r.hasil).toEqual([{ id: "recUMAT0000000009", nama: "Dodi Umat", info: "PD Dua" }]);
    expect((await cariGoShow(T(), "d")).hasil).toEqual([]); // terlalu pendek
  });
  it("pencarian umat juga mencocokkan nama panggilan", async () => {
    namaEvent = "261121-Misa Awal Tahun"; umatCari = [];
    await cariGoShow(T(), "dodi");
    const f = (await import("@/lib/airtable") as any).listPage.mock.calls.at(-1)[2].formula;
    expect(f).toContain("fldIpQTSkFB9sU0lo"); expect(f).toContain("fld469PYR80nAUNIF");
  });
  it("acara lain: mencari di seluruh umat (Team Umat), tidak menampilkan yang sudah terdaftar", async () => {
    namaEvent = "261121-Misa Awal Tahun";
    umatCari = [
      { id: "recUMAT0000000009", fields: { fldIpQTSkFB9sU0lo: "Dodi Umat", fld469PYR80nAUNIF: "Dodi", fldOovF470MdN2fMg: ["PD Satu"] } },
      { id: "recUMAT0000000001", fields: { fldIpQTSkFB9sU0lo: "Budi Terdaftar" } },
    ];
    const r = await cariGoShow(T(), "do");
    expect(r.sumber).toBe("umat");
    expect(r.hasil).toEqual([{ id: "recUMAT0000000009", nama: "Dodi Umat", info: "PD Satu" }]);
  });
});

describe("tambahGoShow", () => {
  it("pilih dari daftar: membuat pendaftaran (Daftar, PD diisi) lalu kehadiran Hadir", async () => {
    const r = await tambahGoShow(T(), { umat: "recUMAT0000000002" });
    expect(r.peserta).toMatchObject({ id: "recBARU0000000001", nama: "Cantik Pengurus", hadir: true, seksi: "Litbang" });
    const pend = JSON.parse(calls[0].init.body).records[0].fields;
    expect(pend).toMatchObject({ flduf15moMpZSklGL: ["recEVENT00000000A"], fldqvA9dTUmWLfRr2: ["recUMAT0000000002"], fldMBf67dQxv51kY1: ["recPD00000000001"], fldNGGEcwHqIsQPct: "Daftar" });
    expect(JSON.parse(calls[1].init.body).records[0].fields).toMatchObject({ fldudT9j1X2vkQCqD: "Hadir", fldTuFsmLgiZoHXEf: ["recBARU0000000001"] });
  });
  it("orang baru: Nama, WA, Email disimpan ke Team Umat, lalu didaftarkan dan hadir", async () => {
    const r = await tambahGoShow(T(), { baru: { nama: "  Eko   Baru ", wa: "0812 3456 789", email: "eko@x.com" } });
    expect(r.baru).toBe(true);
    const umat = JSON.parse(calls[0].init.body).records[0].fields;
    expect(calls[0].path).toContain("tblwRNtXSVzgzVXuk");
    expect(umat).toEqual({ fldIpQTSkFB9sU0lo: "Eko Baru", fldzY1Z2QvIIEkYXR: "0812 3456 789", fldAaQ3zmiLBhp4z9: "eko@x.com" });
    expect(calls.length).toBe(3);
  });
  it("orang baru: nama kosong, email salah, WA ngawur, atau nama sudah ada di data ditolak", async () => {
    await expect(tambahGoShow(T(), { baru: { nama: " " } })).rejects.toMatchObject({ status: 400 });
    await expect(tambahGoShow(T(), { baru: { nama: "Eko", email: "bukan-email" } })).rejects.toMatchObject({ status: 400 });
    await expect(tambahGoShow(T(), { baru: { nama: "Eko", wa: "123" } })).rejects.toMatchObject({ status: 400 });
    sudahAda = [{ id: "recUMAT0000000077", fields: {} }];
    await expect(tambahGoShow(T(), { baru: { nama: "Eko Lama" } })).rejects.toMatchObject({ status: 409 });
    expect(calls).toHaveLength(0);
  });
  it("yang sudah terdaftar tidak didaftarkan ulang, hanya ditandai hadir", async () => {
    const r = await tambahGoShow(T(), { umat: "recUMAT0000000001" });
    expect(r.peserta.id).toBe("recPEND00000000B1");
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toContain("tblQgU4DawCAXIRdi");
  });
});
