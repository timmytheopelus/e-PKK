import { it, expect, vi, beforeEach, describe } from "vitest";
import { T_PROGRAM, T_ANGGARAN, T_REALISASI, PK, AG, RZ } from "../src/lib/proker-schema";
import { KEU, BASE_BEN } from "../src/lib/policy";

const PID = "recPROGRAM0000001";
let db: Record<string, any[]> = {};
let posts: { path: string; body: any }[] = [];
let gagalRealisasi = false;
let peran: any = {};
let boleh = true;

vi.mock("../src/lib/airtable", () => ({
  listUntil: async (_b: string, t: string) => ({ records: db[t] || [] }),
  at: async (path: string, init: any = {}) => {
    if (init.method === "POST") {
      const body = JSON.parse(init.body);
      posts.push({ path, body });
      if (path.includes(T_REALISASI)) {
        if (gagalRealisasi) throw Object.assign(new Error("Airtable: boom"), { status: 502 });
        db[T_REALISASI].push({ id: "recREAL" + db[T_REALISASI].length, fields: body.records[0].fields });
        return { records: [{ id: "recREAL" + db[T_REALISASI].length }] };
      }
      return { records: [{ id: "recMUTASI0000001" }] };
    }
    const id = path.split("/").pop()!.split("?")[0];
    const r = db[T_PROGRAM].find((x) => x.id === id);
    if (!r) throw Object.assign(new Error("Airtable: NOT_FOUND"), { status: 400 });
    return r;
  },
}));
vi.mock("../src/lib/proker-roles", () => ({ peranOf: async () => peran }));
vi.mock("../src/lib/keuangan-akses", () => ({
  keuanganBoleh: async () => boleh,
  pastikanKeuangan: async () => { if (!boleh) throw Object.assign(new Error("Menu Keuangan hanya untuk"), { status: 403 }); },
}));

const acc: any = { email: "bend@x.org", level: "Edit", tabs: ["Keuangan"], jabatan: "Bendahara" };
const input = { programId: PID, tanggal: "2026-11-20", nominal: 300000, keterangan: "Sewa tempat", penerima: "Gereja", account: "recACCOUNT0000001", rekening: "recREKENING000001" };
const prog = (status = "Disetujui", mode = "Rincian", total = 0) => ({ id: PID, fields: { [PK.nama]: "Retret", [PK.seksiPengaju]: "Forkom 1", [PK.status]: status, [PK.modeAnggaran]: mode, [PK.totalAnggaran]: total } });

beforeEach(async () => {
  vi.resetModules();
  posts = []; gagalRealisasi = false; boleh = true;
  peran = { bendahara: true, sekjen: false, pimpinan: false, koordBidang: [], koordSeksi: [] };
  db = {
    [T_PROGRAM]: [prog()],
    [T_ANGGARAN]: [
      { id: "a1", fields: { [AG.programId]: PID, [AG.jenis]: "Pengeluaran", [AG.nominal]: 500000, [AG.keterangan]: "Tempat" } },
      { id: "a2", fields: { [AG.programId]: PID, [AG.jenis]: "Pengeluaran", [AG.nominal]: 200000, [AG.keterangan]: "Konsumsi" } },
      { id: "a3", fields: { [AG.programId]: PID, [AG.jenis]: "Pemasukan", [AG.nominal]: 900000, [AG.keterangan]: "Donasi" } },
    ],
    [T_REALISASI]: [],
  };
});

describe("hitungSisa", () => {
  it("menjumlahkan realisasi dan menghitung sisa", async () => {
    const { hitungSisa } = await import("../src/lib/realisasi");
    expect(hitungSisa(700000, [])).toEqual({ terpakai: 0, sisa: 700000 });
    expect(hitungSisa(700000, [100000, 250000])).toEqual({ terpakai: 350000, sisa: 350000 });
    expect(hitungSisa(100000, [150000])).toEqual({ terpakai: 150000, sisa: -50000 });
  });
});

describe("daftarAnggaran", () => {
  it("hanya program Disetujui/Berjalan; anggaran = pengeluaran saja (pemasukan tidak dihitung)", async () => {
    db[T_PROGRAM].push({ ...prog("Draft"), id: "recDRAFT000000001" }, { ...prog("Berjalan"), id: "recJALAN000000001" }, { ...prog("Ditolak"), id: "recTOLAK000000001" });
    db[T_REALISASI].push({ id: "r1", fields: { [RZ.programId]: PID, [RZ.nominal]: 200000, [RZ.tanggal]: "2026-11-01", [RZ.keterangan]: "DP", [RZ.penerima]: "X" } });
    const { daftarAnggaran } = await import("../src/lib/realisasi");
    const r = await daftarAnggaran(acc);
    expect(r.programs.map((p) => p.id).sort()).toEqual(["recJALAN000000001", PID].sort());
    const p = r.programs.find((x) => x.id === PID)!;
    expect(p).toMatchObject({ anggaran: 700000, terpakai: 200000, sisa: 500000 });
    expect(p.baris.length).toBe(3);
    expect(p.realisasi).toEqual([{ tanggal: "2026-11-01", nominal: 200000, keterangan: "DP", penerima: "X" }]);
    expect(r.bisaCatat).toBe(true);
  });
  it("mode Total memakai total anggaran", async () => {
    db[T_PROGRAM] = [prog("Disetujui", "Total", 1000000)];
    const { daftarAnggaran } = await import("../src/lib/realisasi");
    expect((await daftarAnggaran(acc)).programs[0].anggaran).toBe(1000000);
  });
  it("ditolak 403 bila bukan peran Keuangan; bisaCatat false untuk Sekjen", async () => {
    const { daftarAnggaran } = await import("../src/lib/realisasi");
    peran.bendahara = false; peran.sekjen = true;
    expect((await daftarAnggaran(acc)).bisaCatat).toBe(false);
    boleh = false;
    await expect(daftarAnggaran(acc)).rejects.toMatchObject({ status: 403 });
  });
});

describe("catatRealisasi", () => {
  it("menulis Mutasi dulu (Transaksi Keluar, ket berawalan [Proker: nama]) lalu Realisasi berisi id Mutasi", async () => {
    const { catatRealisasi } = await import("../src/lib/realisasi");
    const r = await catatRealisasi(acc, input);
    expect(r.sisa).toBe(400000);
    expect(posts.map((p) => p.path.includes(BASE_BEN))).toEqual([true, false]);
    const m = posts[0].body.records[0].fields;
    expect(m[KEU.jenis]).toBe("Transaksi Keluar");
    expect(m[KEU.nominal]).toBe(300000);
    expect(m[KEU.ket]).toBe("[Proker: Retret] Sewa tempat");
    expect(m[KEU.account]).toEqual(["recACCOUNT0000001"]);
    expect(m[KEU.rekening]).toEqual(["recREKENING000001"]);
    const z = posts[1].body.records[0].fields;
    expect(z[RZ.programId]).toBe(PID); expect(z[RZ.mutasiId]).toBe("recMUTASI0000001"); expect(z[RZ.oleh]).toBe("bend@x.org");
  });
  it("403 untuk non-Bendahara dan mode Lihat sebagai; Superadmin boleh", async () => {
    const { catatRealisasi } = await import("../src/lib/realisasi");
    peran.bendahara = false;
    await expect(catatRealisasi(acc, input)).rejects.toMatchObject({ status: 403 });
    peran.bendahara = true;
    await expect(catatRealisasi({ ...acc, viewAs: "x@y.org" }, input)).rejects.toMatchObject({ status: 403 });
    peran.bendahara = false;
    await expect(catatRealisasi({ ...acc, level: "Superadmin" }, input)).resolves.toBeTruthy();
  });
  it("400 untuk nominal 0, negatif, pecahan, bukan angka; tanggal buruk; keterangan kosong", async () => {
    const { catatRealisasi } = await import("../src/lib/realisasi");
    for (const nominal of [0, -5, 1.5, "100", NaN]) await expect(catatRealisasi(acc, { ...input, nominal: nominal as any })).rejects.toMatchObject({ status: 400 });
    await expect(catatRealisasi(acc, { ...input, tanggal: "20-11-2026" })).rejects.toMatchObject({ status: 400 });
    await expect(catatRealisasi(acc, { ...input, keterangan: "  " })).rejects.toMatchObject({ status: 400 });
    expect(posts.length).toBe(0);
  });
  it("409 untuk status selain Disetujui/Berjalan", async () => {
    const { catatRealisasi } = await import("../src/lib/realisasi");
    for (const s of ["Draft", "Menunggu Sekjen", "Ditolak", "Selesai"]) {
      db[T_PROGRAM] = [prog(s)];
      await expect(catatRealisasi(acc, input)).rejects.toMatchObject({ status: 409 });
    }
    expect(posts.length).toBe(0);
  });
  it("409 bila nominal melebihi sisa; pas sama dengan sisa boleh", async () => {
    const { catatRealisasi } = await import("../src/lib/realisasi");
    await expect(catatRealisasi(acc, { ...input, nominal: 700001 })).rejects.toMatchObject({ status: 409 });
    expect(posts.length).toBe(0);
    await expect(catatRealisasi(acc, { ...input, nominal: 700000 })).resolves.toMatchObject({ sisa: 0 });
  });
  it("dua realisasi bersamaan yang melebihi sisa: yang kedua ditolak", async () => {
    const { catatRealisasi } = await import("../src/lib/realisasi");
    const hasil = await Promise.allSettled([catatRealisasi(acc, { ...input, nominal: 500000 }), catatRealisasi(acc, { ...input, nominal: 500000 })]);
    expect(hasil.map((h) => h.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(posts.filter((p) => p.path.includes(BASE_BEN)).length).toBe(1);
  });
  it("Realisasi gagal setelah Mutasi sukses: 502 menyebut id Mutasi, tidak ada penghapusan", async () => {
    const { catatRealisasi } = await import("../src/lib/realisasi");
    gagalRealisasi = true;
    await expect(catatRealisasi(acc, input)).rejects.toMatchObject({ status: 502, message: expect.stringContaining("recMUTASI0000001") });
    expect(posts.filter((p) => (p as any).method === "DELETE").length).toBe(0);
  });
});
