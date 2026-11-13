import { describe, it, expect, vi, beforeEach } from "vitest";
import { T_PROGRAM, T_ANGGARAN, T_SETUJU, PK, ST } from "../src/lib/proker-schema";

// Airtable palsu di memori: tabel -> baris. Mendukung list (+ filter {Program ID}="rec…"), create, update.
let db: Record<string, any[]>;
let seq: number;
const calls: { method: string; table: string; body?: any }[] = [];
const emptyPeran = { koordBidang: [], koordSeksi: [], sekjen: false, bendahara: false, pimpinan: false };
let peran: any, rows: any[], notifs: any[];

vi.mock("../src/lib/proker-roles", () => ({
  peranOf: async () => peran,
  rowsOf: async () => rows,
  semuaSeksi: async () => new Set(["Forkom 1", "Forkom 2", "Sekolah", "Pimpinan Kesekretariatan"]),
  emailsWhere: async () => ["koord@x.com"],
}));
vi.mock("../src/lib/notif", () => ({ buatNotif: async (to: string[], pesan: string, tautan: string) => { notifs.push({ to, pesan, tautan }); } }));

function fakeFetch() {
  vi.stubGlobal("fetch", async (u: any, init: any = {}) => {
    const url = new URL(String(u));
    const parts = url.pathname.split("/"); // /v0/base/table[/rec]
    const table = parts[3], rec = parts[4];
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, table, body });
    const ok = (j: any) => new Response(JSON.stringify(j), { status: 200 });
    if (method === "GET" && !rec) {
      let list = db[table] || [];
      const f = url.searchParams.get("filterByFormula");
      const m = f && /"(rec[A-Za-z0-9]+)"/.exec(f);
      if (m) list = list.filter((r) => Object.values(r.fields).includes(m[1]));
      return ok({ records: list });
    }
    if (method === "GET") return ok((db[table] || []).find((r) => r.id === rec));
    if (method === "POST") {
      const out = body.records.map((r: any) => ({ id: "rec" + String(++seq).padStart(14, "0"), fields: r.fields }));
      db[table] = [...(db[table] || []), ...out];
      return ok({ records: out });
    }
    if (method === "PATCH") {
      const r = (db[table] || []).find((x) => x.id === rec);
      Object.assign(r.fields, body.fields);
      return ok(r);
    }
    return new Response("{}", { status: 404 });
  });
}

const acc: any = { email: "ketua@x.com", nama: "Ketua", status: "Disetujui", level: "Edit", tabs: ["Program Kerja"], jabatan: "" };
const baru = { nama: "Retret", detail: "Detail", mulai: "2027-03", seksiTerlibat: [] as string[], anggaran: { mode: "Total" as const, total: 1000 } };

beforeEach(() => {
  vi.resetModules();
  process.env.AIRTABLE_TOKEN = "x";
  db = {}; seq = 0; calls.length = 0; notifs = [];
  peran = { ...emptyPeran };
  rows = [{ bidang: "Kesekretariatan", seksi: "Forkom 1", peran: "Ketua" }];
  fakeFetch();
});

const seed = (over: any = {}) => {
  db[T_PROGRAM] = [{ id: "recPPPPPPPPPPPPPP", fields: {
    [PK.nama]: "Retret", [PK.seksiPengaju]: "Forkom 1", [PK.bidang]: "Kesekretariatan", [PK.seksiTerlibat]: "Forkom 1",
    [PK.status]: "Menunggu Koord Bidang", [PK.dibuatOleh]: "ketua@x.com", [PK.modeAnggaran]: "Total", [PK.totalAnggaran]: 500,
    [PK.waktuDibuat]: new Date().toISOString(), ...over } }];
};

describe("ajukanProgram", () => {
  it("ditolak tanpa tab Program Kerja", async () => {
    const { ajukanProgram } = await import("../src/lib/proker");
    await expect(ajukanProgram({ ...acc, tabs: [] }, baru)).rejects.toMatchObject({ status: 403 });
  });
  it("ditolak saat viewAs", async () => {
    const { ajukanProgram } = await import("../src/lib/proker");
    await expect(ajukanProgram({ ...acc, viewAs: "t@x.com" }, baru)).rejects.toMatchObject({ status: 403 });
  });
  it("seksi pengaju selalu seksi milik akun; input palsu diabaikan/ditolak", async () => {
    const { ajukanProgram } = await import("../src/lib/proker");
    await expect(ajukanProgram(acc, { ...baru, seksiPengaju: "Sekolah" } as any)).rejects.toMatchObject({ status: 403 });
    const { id } = await ajukanProgram(acc, baru);
    const rec = db[T_PROGRAM].find((r) => r.id === id);
    expect(rec.fields[PK.seksiPengaju]).toBe("Forkom 1");
    expect(rec.fields[PK.bidang]).toBe("Kesekretariatan");
    expect(rec.fields[PK.seksiTerlibat]).toBe("Forkom 1");
    expect(rec.fields[PK.status]).toBe("Menunggu Koord Bidang");
    expect(notifs.length).toBe(1);
  });
  it("Anggota biasa tidak boleh mengajukan", async () => {
    rows = [{ bidang: "Kesekretariatan", seksi: "Forkom 1", peran: "Anggota" }];
    const { ajukanProgram } = await import("../src/lib/proker");
    await expect(ajukanProgram(acc, baru)).rejects.toMatchObject({ status: 403 });
  });
  it("total rincian dihitung server; nominal negatif ditolak 400", async () => {
    const { ajukanProgram } = await import("../src/lib/proker");
    const bad = { ...baru, anggaran: { mode: "Rincian" as const, baris: [{ keterangan: "x", jenis: "Pengeluaran" as const, nominal: -5 }] } };
    await expect(ajukanProgram(acc, bad)).rejects.toMatchObject({ status: 400 });
    const ok = { ...baru, anggaran: { mode: "Rincian" as const, baris: [
      { keterangan: "Sewa", jenis: "Pengeluaran" as const, nominal: 700 },
      { keterangan: "Konsumsi", jenis: "Pengeluaran" as const, nominal: 300 },
      { keterangan: "Donasi", jenis: "Pemasukan" as const, nominal: 200 }] } };
    const { id } = await ajukanProgram(acc, { ...ok, totalAnggaran: 1 } as any);
    expect(db[T_PROGRAM].find((r) => r.id === id).fields[PK.totalAnggaran]).toBe(1000);
    expect(db[T_ANGGARAN].length).toBe(3);
  });
  it("seksi terlibat tak dikenal ditolak 400", async () => {
    const { ajukanProgram } = await import("../src/lib/proker");
    await expect(ajukanProgram(acc, { ...baru, seksiTerlibat: ["Seksi Hantu"] })).rejects.toMatchObject({ status: 400 });
  });
});

describe("putuskan", () => {
  it("oleh bukan Koord Bidang ditolak 403", async () => {
    seed();
    const { putuskan } = await import("../src/lib/proker");
    await expect(putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Koord Bidang", keputusan: "Setuju" })).rejects.toMatchObject({ status: 403 });
  });
  it("Sekjen sebelum Koord Bidang ditolak 409", async () => {
    seed();
    peran = { ...emptyPeran, sekjen: true };
    const { putuskan } = await import("../src/lib/proker");
    await expect(putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Sekjen", keputusan: "Setuju" })).rejects.toMatchObject({ status: 409 });
  });
  it("Koord Bidang setuju -> Menunggu Sekjen, dicatat dan menotifikasi", async () => {
    seed();
    peran = { ...emptyPeran, koordBidang: ["Kesekretariatan"] };
    const { putuskan } = await import("../src/lib/proker");
    expect(await putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Koord Bidang", keputusan: "Setuju" })).toEqual({ status: "Menunggu Sekjen" });
    expect(db[T_PROGRAM][0].fields[PK.status]).toBe("Menunggu Sekjen");
    expect(db[T_SETUJU][0].fields[ST.oleh]).toBe("ketua@x.com");
    expect(notifs.length).toBeGreaterThan(0);
  });
  it("keputusan ganda pada tahap yang sama ditolak 409", async () => {
    seed({ [PK.status]: "Menunggu Koord Bidang" });
    peran = { ...emptyPeran, koordBidang: ["Kesekretariatan"] };
    db[T_SETUJU] = [{ id: "recSSSSSSSSSSSSSS", fields: { [ST.programId]: "recPPPPPPPPPPPPPP", [ST.tahap]: "Koord Bidang", [ST.keputusan]: "Setuju" } }];
    const { putuskan } = await import("../src/lib/proker");
    await expect(putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Koord Bidang", keputusan: "Setuju" })).rejects.toMatchObject({ status: 409 });
  });
  it("Tolak -> Ditolak; viewAs ditolak", async () => {
    seed();
    peran = { ...emptyPeran, koordBidang: ["Kesekretariatan"] };
    const { putuskan } = await import("../src/lib/proker");
    await expect(putuskan({ ...acc, viewAs: "t@x.com" }, { programId: "recPPPPPPPPPPPPPP", tahap: "Koord Bidang", keputusan: "Setuju" })).rejects.toMatchObject({ status: 403 });
    expect((await putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Koord Bidang", keputusan: "Tolak" })).status).toBe("Ditolak");
  });
  it("kolaborasi: koordinator seksi lain menyetujui lalu lanjut Sekjen", async () => {
    seed({ [PK.seksiTerlibat]: "Forkom 1\nForkom 2", [PK.status]: "Menunggu Kolaborasi" });
    db[T_SETUJU] = [{ id: "recSSSSSSSSSSSSSS", fields: { [ST.programId]: "recPPPPPPPPPPPPPP", [ST.tahap]: "Koord Bidang", [ST.keputusan]: "Setuju" } }];
    peran = { ...emptyPeran, koordSeksi: ["Forkom 2"] };
    const { putuskan } = await import("../src/lib/proker");
    await expect(putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Kolaborasi", seksi: "Sekolah", keputusan: "Setuju" })).rejects.toMatchObject({ status: 403 });
    expect((await putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Kolaborasi", seksi: "Forkom 2", keputusan: "Setuju" })).status).toBe("Menunggu Sekjen");
  });
});

describe("daftarProgram", () => {
  it("Koordinator Seksi hanya melihat bidang/seksinya; aksi dan total terisi", async () => {
    seed();
    db[T_PROGRAM].push({ id: "recQQQQQQQQQQQQQQ", fields: { [PK.nama]: "Lain", [PK.seksiPengaju]: "Sekolah", [PK.bidang]: "Inreach (El Shaddai)", [PK.seksiTerlibat]: "Sekolah", [PK.status]: "Draft", [PK.dibuatOleh]: "z@x.com", [PK.modeAnggaran]: "Total", [PK.totalAnggaran]: 1 } });
    peran = { ...emptyPeran, koordSeksi: ["Forkom 1"] };
    const { daftarProgram } = await import("../src/lib/proker");
    const list = await daftarProgram(acc);
    expect(list.map((p: any) => p.nama)).toEqual(["Retret"]);
    expect(list[0].totalPengeluaran).toBe(500);
    expect(list[0].baru).toBe(true);
    expect(list[0].aksi).toEqual([]);
  });
  it("Sekjen melihat semua dan aksi Sekjen muncul saat Menunggu Sekjen", async () => {
    seed({ [PK.status]: "Menunggu Sekjen" });
    peran = { ...emptyPeran, sekjen: true };
    rows = [];
    const { daftarProgram } = await import("../src/lib/proker");
    const list = await daftarProgram(acc);
    expect(list[0].aksi).toEqual(["Sekjen"]);
  });
});

describe("infoProgram", () => {
  it("memberi seksi milik akun dan daftar seksi; ditolak tanpa tab", async () => {
    const { infoProgram } = await import("../src/lib/proker");
    const r = await infoProgram(acc);
    expect(r.seksiSaya).toEqual(["Forkom 1"]);
    expect(r.semuaSeksi).toContain("Sekolah");
    await expect(infoProgram({ ...acc, tabs: [] })).rejects.toMatchObject({ status: 403 });
  });
});
