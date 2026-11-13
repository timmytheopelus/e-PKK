// Anggaran program yang disetujui dan realisasinya (menu Keuangan). Baca: peran Keuangan. Tulis: Bendahara/Superadmin.
// Tiap realisasi menulis satu baris Mutasi (base Bendahara, "Transaksi Keluar") lalu satu baris Realisasi Program (base BPK).
import { Access, BASE_BPK, BASE_BEN, HttpError, KEU, T } from "./policy";
import { at, listUntil } from "./airtable";
import { T_PROGRAM, T_ANGGARAN, T_REALISASI, PK, AG, RZ } from "./proker-schema";
import { peranOf } from "./proker-roles";
import { pastikanKeuangan } from "./keuangan-akses";

const STATUS_BOLEH = ["Disetujui", "Berjalan"];
const sel = (v: any) => String(typeof v === "object" && v ? v.name ?? "" : v ?? "").trim();

export function hitungSisa(anggaran: number, realisasi: number[]): { terpakai: number; sisa: number } {
  const terpakai = realisasi.reduce((s, n) => s + n, 0);
  return { terpakai, sisa: anggaran - terpakai };
}

type Baris = { keterangan: string; nominal: number };
type Realisasi = { tanggal: string; nominal: number; keterangan: string; penerima: string };

/** Anggaran pengeluaran: jumlah baris Pengeluaran (mode Rincian) atau total (mode lain). Pemasukan tidak dihitung. */
function anggaranPengeluaran(p: any, baris: any[]): number {
  if (sel(p.fields[PK.modeAnggaran]) === "Rincian") return baris.filter((r) => sel(r.fields[AG.jenis]) === "Pengeluaran").reduce((s, r) => s + Number(r.fields[AG.nominal] || 0), 0);
  return Number(p.fields[PK.totalAnggaran] || 0);
}

const bolehCatat = async (acc: Pick<Access, "email" | "level" | "jabatan">) => acc.level === "Superadmin" || (await peranOf(acc)).bendahara;

export async function daftarAnggaran(acc: Access) {
  await pastikanKeuangan(acc);
  const [pr, ag, rz] = await Promise.all([
    listUntil(BASE_BPK, T_PROGRAM, { fieldIds: Object.values(PK), want: Infinity, maxPages: 20 }),
    listUntil(BASE_BPK, T_ANGGARAN, { fieldIds: Object.values(AG), want: Infinity, maxPages: 50 }),
    listUntil(BASE_BPK, T_REALISASI, { fieldIds: Object.values(RZ), want: Infinity, maxPages: 50 }),
  ]);
  const programs = pr.records.filter((p) => STATUS_BOLEH.includes(sel(p.fields[PK.status]))).map((p) => {
    const baris = ag.records.filter((r) => r.fields[AG.programId] === p.id);
    const real = rz.records.filter((r) => r.fields[RZ.programId] === p.id);
    const anggaran = anggaranPengeluaran(p, baris);
    return {
      id: p.id, nama: String(p.fields[PK.nama] || ""), seksi: String(p.fields[PK.seksiPengaju] || ""), status: sel(p.fields[PK.status]), anggaran,
      ...hitungSisa(anggaran, real.map((r) => Number(r.fields[RZ.nominal] || 0))),
      baris: baris.map((r): Baris & { jenis: string } => ({ keterangan: String(r.fields[AG.keterangan] || ""), jenis: sel(r.fields[AG.jenis]), nominal: Number(r.fields[AG.nominal] || 0) })),
      realisasi: real.map((r): Realisasi => ({ tanggal: String(r.fields[RZ.tanggal] || ""), nominal: Number(r.fields[RZ.nominal] || 0), keterangan: String(r.fields[RZ.keterangan] || ""), penerima: String(r.fields[RZ.penerima] || "") }))
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    };
  }).sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  return { programs, bisaCatat: await bolehCatat(acc) };
}

export type CatatInput = { programId: string; tanggal: string; nominal: number; keterangan: string; penerima?: string; account: string; rekening: string };

// Antrean per program: mencegah dua catatan bersamaan melewati batas sisa dalam satu instance server.
const antrean = new Map<string, Promise<unknown>>();
function serial<T>(kunci: string, fn: () => Promise<T>): Promise<T> {
  const prev = antrean.get(kunci) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  antrean.set(kunci, next);
  next.finally(() => { if (antrean.get(kunci) === next) antrean.delete(kunci); }).catch(() => {});
  return next;
}

const REC = /^rec[A-Za-z0-9]{14}$/;

export async function catatRealisasi(acc: Access, input: CatatInput): Promise<{ id: string; sisa: number }> {
  if (acc.viewAs) throw new HttpError(403, "Mode 'Lihat sebagai' hanya untuk melihat.");
  if (!(await bolehCatat(acc))) throw new HttpError(403, "Hanya Bendahara yang dapat mencatat realisasi.");
  const nominal = input?.nominal;
  if (typeof nominal !== "number" || !Number.isInteger(nominal) || nominal <= 0 || nominal > 1e12) throw new HttpError(400, "Nominal harus bilangan bulat lebih dari 0.");
  const tanggal = String(input?.tanggal || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || Number.isNaN(Date.parse(tanggal))) throw new HttpError(400, "Tanggal tidak valid.");
  const keterangan = String(input?.keterangan || "").trim();
  if (!keterangan || keterangan.length > 200) throw new HttpError(400, "Keterangan wajib diisi (maks 200 huruf).");
  const penerima = String(input?.penerima || "").trim().slice(0, 100);
  if (!REC.test(String(input?.programId)) || !REC.test(String(input?.account)) || !REC.test(String(input?.rekening))) throw new HttpError(400, "Program, Account, dan Rekening wajib dipilih.");

  return serial(input.programId, async () => {
    const p = await at(`/v0/${BASE_BPK}/${T_PROGRAM}/${input.programId}?returnFieldsByFieldId=true`);
    if (!STATUS_BOLEH.includes(sel(p.fields[PK.status]))) throw new HttpError(409, "Realisasi hanya untuk program yang sudah Disetujui atau Berjalan.");
    const [ag, rz] = await Promise.all([
      listUntil(BASE_BPK, T_ANGGARAN, { fieldIds: Object.values(AG), want: Infinity, maxPages: 50 }),
      listUntil(BASE_BPK, T_REALISASI, { fieldIds: Object.values(RZ), want: Infinity, maxPages: 50 }),
    ]);
    const anggaran = anggaranPengeluaran(p, ag.records.filter((r) => r.fields[AG.programId] === p.id));
    const { sisa } = hitungSisa(anggaran, rz.records.filter((r) => r.fields[RZ.programId] === p.id).map((r) => Number(r.fields[RZ.nominal] || 0)));
    if (nominal > sisa) throw new HttpError(409, `Nominal melebihi sisa anggaran (sisa Rp ${Math.max(sisa, 0).toLocaleString("id-ID")}).`);

    const nama = String(p.fields[PK.nama] || "");
    const m = await at(`/v0/${BASE_BEN}/${T.mutasi}`, {
      method: "POST",
      body: JSON.stringify({ records: [{ fields: {
        [KEU.jenis]: "Transaksi Keluar", [KEU.tgl]: tanggal, [KEU.nominal]: nominal, [KEU.ket]: `[Proker: ${nama}] ${keterangan}`,
        [KEU.account]: [input.account], [KEU.rekening]: [input.rekening], ...(penerima ? { [KEU.penerima]: penerima } : {}),
      } }] }),
    });
    const mutasiId: string = m.records[0].id;
    try {
      const z = await at(`/v0/${BASE_BPK}/${T_REALISASI}`, {
        method: "POST",
        body: JSON.stringify({ records: [{ fields: {
          [RZ.programId]: input.programId, [RZ.tanggal]: tanggal, [RZ.nominal]: nominal, [RZ.keterangan]: keterangan, [RZ.penerima]: penerima,
          [RZ.mutasiId]: mutasiId, [RZ.oleh]: acc.email.trim().toLowerCase(),
        } }] }),
      });
      return { id: z.records[0].id as string, sisa: sisa - nominal };
    } catch (e: any) {
      console.error("realisasi: tulis Realisasi gagal setelah Mutasi", mutasiId, e);
      throw new HttpError(502, `Pengeluaran sudah tercatat di Mutasi (${mutasiId}) tetapi catatan realisasi program gagal disimpan. Jangan ulangi; hubungi admin.`);
    }
  });
}
