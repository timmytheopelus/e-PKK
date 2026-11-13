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
  seksiBidang: async () => new Map([["Forkom 1", "Kesekretariatan"], ["Forkom 2", "Kesekretariatan"], ["Sekolah", "Inreach (El Shaddai)"]]),
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
    expect(rec.fields[PK.status]).toBe("Menunggu Sekjen");
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

describe("putuskan (alur baru: cukup Sekjen / Koordinator BPK)", () => {
  it("akun yang bukan Sekjen/Koordinator BPK ditolak 403, termasuk Koord Bidang", async () => {
    seed();
    peran = { ...emptyPeran, koordBidang: ["Kesekretariatan"], koordSeksi: ["Forkom 1"] };
    const { putuskan } = await import("../src/lib/proker");
    await expect(putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Sekjen", keputusan: "Setuju" })).rejects.toMatchObject({ status: 403 });
  });
  it("tahap lama (Koord Bidang / Kolaborasi) tidak dikenal 400", async () => {
    seed();
    peran = { ...emptyPeran, sekjen: true };
    const { putuskan } = await import("../src/lib/proker");
    await expect(putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Koord Bidang", keputusan: "Setuju" })).rejects.toMatchObject({ status: 400 });
    await expect(putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Kolaborasi", seksi: "Forkom 2", keputusan: "Setuju" })).rejects.toMatchObject({ status: 400 });
  });
  it("Sekjen setuju langsung -> Disetujui, dicatat dan menotifikasi", async () => {
    seed({ [PK.status]: "Menunggu Sekjen" });
    peran = { ...emptyPeran, sekjen: true };
    const { putuskan } = await import("../src/lib/proker");
    expect(await putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Sekjen", keputusan: "Setuju" })).toEqual({ status: "Disetujui" });
    expect(db[T_PROGRAM][0].fields[PK.status]).toBe("Disetujui");
    expect(db[T_SETUJU][0].fields[ST.oleh]).toBe("ketua@x.com");
    expect(notifs.length).toBeGreaterThan(0);
  });
  it("program lama berstatus Menunggu Koord Bidang / Kolaborasi tetap bisa disetujui Sekjen", async () => {
    for (const st of ["Menunggu Koord Bidang", "Menunggu Kolaborasi"]) {
      seed({ [PK.status]: st }); db[T_SETUJU] = [];
      peran = { ...emptyPeran, sekjen: true };
      const { putuskan } = await import("../src/lib/proker");
      expect((await putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Sekjen", keputusan: "Setuju" })).status).toBe("Disetujui");
    }
  });
  it("keputusan ganda ditolak 409", async () => {
    seed({ [PK.status]: "Menunggu Sekjen" });
    peran = { ...emptyPeran, sekjen: true };
    db[T_SETUJU] = [{ id: "recSSSSSSSSSSSSSS", fields: { [ST.programId]: "recPPPPPPPPPPPPPP", [ST.tahap]: "Sekjen", [ST.keputusan]: "Setuju" } }];
    const { putuskan } = await import("../src/lib/proker");
    await expect(putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Sekjen", keputusan: "Setuju" })).rejects.toMatchObject({ status: 409 });
  });
  it("program yang sudah Disetujui tidak bisa diputuskan lagi (409)", async () => {
    seed({ [PK.status]: "Disetujui" });
    peran = { ...emptyPeran, sekjen: true };
    const { putuskan } = await import("../src/lib/proker");
    await expect(putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Sekjen", keputusan: "Setuju" })).rejects.toMatchObject({ status: 409 });
  });
  it("Tolak -> Ditolak; viewAs ditolak", async () => {
    seed({ [PK.status]: "Menunggu Sekjen" });
    peran = { ...emptyPeran, sekjen: true };
    const { putuskan } = await import("../src/lib/proker");
    await expect(putuskan({ ...acc, viewAs: "t@x.com" }, { programId: "recPPPPPPPPPPPPPP", tahap: "Sekjen", keputusan: "Setuju" })).rejects.toMatchObject({ status: 403 });
    expect((await putuskan(acc, { programId: "recPPPPPPPPPPPPPP", tahap: "Sekjen", keputusan: "Tolak" })).status).toBe("Ditolak");
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

describe("Superadmin dan grup koordinator boleh mengajukan", () => {
  it("Superadmin tanpa jabatan seksi memilih seksi pengaju; bidang diambil dari master", async () => {
    rows = [];
    const { ajukanProgram } = await import("../src/lib/proker");
    const su = { ...acc, level: "Superadmin" };
    await expect(ajukanProgram(su, baru)).rejects.toMatchObject({ status: 400 }); // belum memilih seksi
    await expect(ajukanProgram(su, { ...baru, seksiPengaju: "Seksi Hantu" })).rejects.toMatchObject({ status: 403 });
    const { id } = await ajukanProgram(su, { ...baru, seksiPengaju: "Sekolah", anggaran: { mode: "Total", total: 5 } });
    const f = db[T_PROGRAM].find((r) => r.id === id).fields;
    expect(f[PK.seksiPengaju]).toBe("Sekolah");
    expect(f[PK.bidang]).toBe("Inreach (El Shaddai)");
    expect(f[PK.seksiTerlibat]).toBe("Sekolah");
  });
  it("grup koordinator (pimpinan) boleh memilih seksi mana pun", async () => {
    rows = []; peran = { ...emptyPeran, pimpinan: true };
    const { ajukanProgram } = await import("../src/lib/proker");
    const { id } = await ajukanProgram(acc, { ...baru, seksiPengaju: "Forkom 2" });
    expect(db[T_PROGRAM].find((r) => r.id === id).fields[PK.seksiPengaju]).toBe("Forkom 2");
  });
  it("Koordinator Bidang hanya untuk seksi di bidangnya", async () => {
    rows = []; peran = { ...emptyPeran, koordBidang: ["Kesekretariatan"] };
    const { ajukanProgram } = await import("../src/lib/proker");
    await expect(ajukanProgram(acc, { ...baru, seksiPengaju: "Sekolah" })).rejects.toMatchObject({ status: 403 });
    await expect(ajukanProgram(acc, { ...baru, seksiPengaju: "Forkom 1" })).resolves.toHaveProperty("id");
  });
  it("info memberi pilihan seksi pengaju untuk Superadmin", async () => {
    rows = [];
    const { infoProgram } = await import("../src/lib/proker");
    const r: any = await infoProgram({ ...acc, level: "Superadmin" });
    expect(r.bisaPilih).toBe(true);
    expect(r.seksiPilihan).toEqual(expect.arrayContaining(["Forkom 1", "Sekolah"]));
  });
});

describe("daftarProgram cakupan", () => {
  const prog = (id: string, seksi: string, bidang: string, terlibat = seksi) => ({ id, fields: {
    [PK.nama]: id, [PK.seksiPengaju]: seksi, [PK.bidang]: bidang, [PK.seksiTerlibat]: terlibat,
    [PK.status]: "Menunggu Koord Bidang", [PK.dibuatOleh]: "lain@x.com", [PK.modeAnggaran]: "Total", [PK.totalAnggaran]: 100,
    [PK.waktuDibuat]: new Date().toISOString() } });
  const seedAll = () => { db[T_PROGRAM] = [
    prog("recAAAAAAAAAAAAAA", "Forkom 1", "Kesekretariatan"),
    prog("recBBBBBBBBBBBBBB", "Forkom 2", "Kesekretariatan"),
    prog("recCCCCCCCCCCCCCC", "Forkom 2", "Kesekretariatan", "Forkom 2\nForkom 1"),
    prog("recDDDDDDDDDDDDDD", "Sekolah", "Inreach (El Shaddai)"),
  ]; };
  const ids = (l: any[]) => l.map((p) => p.id).sort();
  it("anggota seksi tidak melihat program seksi lain di bidang yang sama, tetapi melihat yang melibatkan seksinya", async () => {
    seedAll(); rows = [{ bidang: "Kesekretariatan", seksi: "Forkom 1", peran: "Anggota" }];
    const { daftarProgram } = await import("../src/lib/proker");
    expect(ids(await daftarProgram(acc))).toEqual(["recAAAAAAAAAAAAAA", "recCCCCCCCCCCCCCC"]);
  });
  it("Koordinator Bidang melihat semua program bidangnya saja", async () => {
    seedAll(); peran = { ...emptyPeran, koordBidang: ["Kesekretariatan"] }; rows = [{ bidang: "Kesekretariatan", seksi: "", peran: "Ketua" }];
    const { daftarProgram } = await import("../src/lib/proker");
    expect(ids(await daftarProgram(acc))).toEqual(["recAAAAAAAAAAAAAA", "recBBBBBBBBBBBBBB", "recCCCCCCCCCCCCCC"]);
  });
  it("akun tanpa jabatan mendapat daftar kosong", async () => {
    seedAll(); rows = [];
    const { daftarProgram } = await import("../src/lib/proker");
    expect(await daftarProgram(acc)).toEqual([]);
  });
  it("pimpinan melihat semua", async () => {
    seedAll(); peran = { ...emptyPeran, pimpinan: true }; rows = [];
    const { daftarProgram } = await import("../src/lib/proker");
    expect((await daftarProgram(acc)).length).toBe(4);
  });
});

describe("ringkasanProgram", () => {
  const p = (id: string, status: string, bidang: string, total: number) => ({ id, fields: {
    [PK.nama]: id, [PK.seksiPengaju]: "X", [PK.bidang]: bidang, [PK.seksiTerlibat]: "X", [PK.status]: status, [PK.dibuatOleh]: "z@x.com",
    [PK.modeAnggaran]: "Total", [PK.totalAnggaran]: total, [PK.waktuDibuat]: new Date().toISOString() } });
  const seedR = () => { db[T_PROGRAM] = [p("recAAAAAAAAAAAAAA", "Disetujui", "Kesekretariatan", 200), p("recBBBBBBBBBBBBBB", "Berjalan", "Inreach (El Shaddai)", 300), p("recCCCCCCCCCCCCCC", "Menunggu Sekjen", "Kesekretariatan", 50)]; };
  it("ditolak 403 untuk Koordinator Seksi biasa", async () => {
    seedR(); peran = { ...emptyPeran, koordSeksi: ["Forkom 1"] };
    const { ringkasanProgram } = await import("../src/lib/proker");
    await expect(ringkasanProgram(acc)).rejects.toMatchObject({ status: 403 });
  });
  it.each(["sekjen", "pimpinan", "bendahara"])("%s mendapat angka lintas bidang", async (k) => {
    seedR(); peran = { ...emptyPeran, [k]: true }; rows = [];
    const { ringkasanProgram } = await import("../src/lib/proker");
    expect(await ringkasanProgram(acc)).toMatchObject({ berjalan: { n: 2, nilai: 500 }, menunggu: { n: 1, nilai: 50 }, selesai: { n: 0, nilai: 0 }, menungguSekjen: 1 });
  });
});
