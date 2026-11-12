// Kebijakan akses: tabel mana boleh dibaca/ditulis oleh tab dan level apa.
export const TAB_IDS: Record<string, string> = {
  Dashboard: "beranda",
  Pengurus: "pengurus",
  Pewarta: "pewarta",
  "Pewarta luar kota": "luar",
  PD: "pd",
  Umat: "umat",
  Kalender: "kalender",
  Event: "event",
  KEP: "kep",
  Inventaris: "inventaris",
  Administrasi: "admin",
};
export const ALL_TABS = Object.keys(TAB_IDS);

export const BASE_BPK = "appIGR8Duhj3Vsz48";
export const BASE_SMP = "appK4oGjawCjLHV0w";
export const T = {
  pengurus: "tbluIlEgPdHeodJHK",
  umat: "tblwRNtXSVzgzVXuk",
  events: "tblbAIILkeRIwn3kl",
  pd: "tblNjwoOJEGZeQxkJ",
  smpEvents: "tbll71vbqU6JbmrJq",
  smpKui: "tblIMjnv1ffB4LqK7",
  pengguna: "tbls2nQ3hW5rEIZUk",
  jabatan: "tblrfilR2eNUOiFMa",
  pewartaBpk: "tblCcm2UAWHquZzEk",
  pendaftaran: "tbltiJ1qDJEwfWPLg",
  paroki: "tbl8sfqU6G47orPpn",
  penyelenggaraKep: "tblH4SN6qpNxJFg35",
  sepKegiatan: "tblGuf3UnMnGBqpbR",
  pendaftarSep: "tbllhFlsiFLaZzHkG",
  inventaris: "tblkbpgHrJ2ZW8WzL",
  logPinjam: "tblDjNGHbh9yE4vUS",
};

/** Pewarta BPK (base SMP): field yang boleh diubah dari tab Pewarta (status, kategori, status pengajar, modul, link YouTube). */
export const PWB_EDIT = ["fldIt4yvwOOsFa4XM", "fldpoZIxZJA9n9PzL", "fldFuXMCtrYyht9S0", "fldZPqCG8ohmWHwY4", "fldJGTPgfN00lAdMo"];
const PWB_YT = "fldJGTPgfN00lAdMo";

/** MasterJabatanBPK: kolom pengelompokan (urutan opsi select = urutan tampil di dashboard). */
export const JAB = { bidang: "fldCCi0hV9yTL091P", seksi: "fldAAyRg1kko5YgrK", peran: "fldI8J3VXZDyjWa3f" };

export type Access = { email: string; nama: string; status: string; level: string; tabs: string[]; jabatan?: string; login?: string; viewAs?: string; sepPeran?: string; sepParoki?: string[] };
export const canEdit = (a: Access) => a.level === "Edit" || a.level === "Admin" || a.level === "Superadmin";

type Spec = {
  base: string;
  read: string[]; // tab (nama tampilan) yang boleh membaca
  readFields?: string[]; // bila ada: hanya field ini yang boleh diminta
  update?: { tabs: string[]; fields: string[] };
  create?: { tabs: string[]; fields: string[] };
};

const EF = ["fld0d9tIyi4nyTZsM", "fldoIkx9wLMaKOa38", "fldMO46zH4SDzIypy", "fld4i5iQ6zTY8UTSm", "fldrYLgd8LCDjwmLZ", "fldhgv2WlvqytF6zA", "fldCGnuPOkqzb5jx2", "fldROaJ8rPAZQPTED", "fld4qestIo5EjWAvk", "fldY0qw1v0a4fK9Sp", "fldSNUErmbrKEOCcf", "fldG7mLTlU3TDeXoF", "fldCFtFJH9S16bjl3"];
/** Pendaftaran Events: hanya kolom demografis. Tanpa kontak, riwayat penyakit, kontak darurat, dll. */
export const PEND_READ = ["flduf15moMpZSklGL", "fld9ucFxEU0cUSHWw", "fldMBf67dQxv51kY1", "fldAZzqERt3oFHRRx", "fldylW3JpqB1DJ0Fh", "fldArgqtlZOnnRIvX", "fldmecbafGeLtqCSd", "fldIgnkqdrDPz8gCV", "fldNGGEcwHqIsQPct", "fldqB6h9rzzC5VhKI", "fldCqIqQmVnFXqrOU", "fldcpfpO2QvPGmgd7"];
/** Inventaris BPK: field yang boleh dibaca (termasuk Foto Barang, hanya baca) dan ditulis dari tab Inventaris. */
export const INV = { kode: "fldoCY9qSEXNBMegx", nama: "fld1BFGhqPuYraTQW", pj: "fldd1gRb1sYkG2ITD", tahun: "fldQ2bE16Y0R5nF4K", lokasi: "fldPmKThge9ns76Uv", status: "fldKqnNoXp9p8tbe5", jumlah: "fldQSpa4WFFDNUUSk", harga: "fldJkMiPpeju2JB06", total: "fldaAN3xasXHhumYP", notes: "fldscpFwbj5cDg1mp", foto: "fldxfDpPt6Qc0bGIa", dibuat: "fldcbCVXSCmSLAN7s", log: "fldK7PyRMfH27qvZY", booking: "fld68eSRGzSohJwWJ", petugas: "fldM32Ja2Z3gUeA3E" };
export const INV_READ = Object.values(INV);
/** Edit status barang + data dasar. Tambah barang: semua kolom isian (bukan formula). */
export const INV_UPDATE = [INV.status, INV.lokasi, INV.notes, INV.pj, INV.jumlah];
export const INV_CREATE = [INV.kode, INV.nama, INV.pj, INV.tahun, INV.lokasi, INV.status, INV.jumlah, INV.harga, INV.notes, INV.petugas];
/** Log Peminjaman: tanpa nomor telepon, tombol WhatsApp, dan foto selfie/serah terima. */
export const LOG = { tglAjuan: "fld00uuD6wrq2CkTS", peminjam: "fldAEP70YeYFUvzdI", barang: "fldnfJ9gXIXCZhy9u", namaBarang: "fldAZeTquC34Z1xBs", jumlah: "fld9trtGpRujr6H6r", catatan: "fld8HJK5019YIwFzQ", tglPinjam: "fldyjGdu0annLW0U4", tglKembali: "fldmLPkuTSDsCFj2K", metode: "fldkYOipTayk6X2Z7", keperluan: "fldSnKuZ2LYxahO33", setuju: "fld3rE3bLovKfljQ0", alasanTolak: "fldPj7Rpj4z2XJLef", cancel: "flds1ccMDkZdRrhfz", alasanCancel: "flddGTdfdmZJcAoMH", diambil: "fldVdHMEPYG25ZI6d", kembali: "fldjb64fOm8B92rH6", status: "fldGGhED24A4QWwzz", statusUser: "fldKkdgxU7jQ9qgpZ", bentrok: "fldqPvqSiIrqW7oPl" };
export const LOG_READ = Object.values(LOG);
/** Status peminjaman diubah lewat Persetujuan Sarpras dan Cancel (kolom Status sendiri formula). */
export const LOG_UPDATE = [LOG.setuju, LOG.alasanTolak, LOG.cancel, LOG.alasanCancel];

const PERSON = ["fldIpQTSkFB9sU0lo", "fld469PYR80nAUNIF", "fldzY1Z2QvIIEkYXR", "fldAaQ3zmiLBhp4z9", "fldcQFzBtr9EELTtV"];

export const TABLES: Record<string, Spec> = {
  [T.pengurus]: { base: BASE_BPK, read: ["Pengurus"] },
  [T.jabatan]: { base: BASE_BPK, read: ["Pengurus"] },
  [T.umat]: {
    base: BASE_BPK,
    read: ["Pengurus", "Pewarta", "PD", "Umat", "Dashboard"],
    update: { tabs: ["Pengurus", "Pewarta"], fields: PERSON },
    create: { tabs: ["PD"], fields: [PERSON[0], PERSON[2], "fldrHJ6q3HZvApccl"] },
  },
  [T.events]: { base: BASE_BPK, read: ["Kalender", "Dashboard", "Event", "KEP"], create: { tabs: ["Kalender"], fields: EF } },
  [T.pd]: { base: BASE_BPK, read: ["PD", "Dashboard", "Event", "KEP"], update: { tabs: ["PD"], fields: ["fldagyoKQyhfenB7u"] } },
  [T.smpEvents]: { base: BASE_SMP, read: ["Dashboard", "Pewarta luar kota"] },
  [T.smpKui]: { base: BASE_SMP, read: ["Dashboard"] },
  [T.pendaftaran]: { base: BASE_BPK, read: ["Event", "KEP"], readFields: PEND_READ },
  [T.paroki]: { base: BASE_BPK, read: ["KEP"], readFields: ["fldskPQJ7WQgCVODZ", "fldm9LChbMMxzwAU6", "fldTx78aUdQXrpSMY"] },
  [T.penyelenggaraKep]: { base: BASE_BPK, read: ["KEP"], readFields: ["fldIrpPwvByuQjm1a", "fldQX4RydVh243bI0"] },
  [T.sepKegiatan]: { base: BASE_BPK, read: ["KEP"] },
  // Email, No WhatsApp tidak boleh dibaca browser (hanya lewat tombol/server).
  [T.pendaftarSep]: { base: BASE_BPK, read: ["KEP"], readFields: ["fld4aXu6UhTUyu2a8", "fldJjgxA4mESGeOYG", "fldVwYghE0cSodecK", "fldBap2tEPX9R4LtD", "fldTj9n5kTQiquymW", "fldU3sCQfDmubXeBZ", "fld4dVr7hIV4xqAg7", "fldnQxpE9QVt0o9JH"] },
  [T.inventaris]: { base: BASE_BPK, read: ["Inventaris"], readFields: INV_READ, update: { tabs: ["Inventaris"], fields: INV_UPDATE }, create: { tabs: ["Inventaris"], fields: INV_CREATE } },
  [T.logPinjam]: { base: BASE_BPK, read: ["Inventaris"], readFields: LOG_READ, update: { tabs: ["Inventaris"], fields: LOG_UPDATE } },
  [T.pewartaBpk]: { base: BASE_SMP, read: ["Pewarta", "Pewarta luar kota", "Dashboard"], update: { tabs: ["Pewarta"], fields: PWB_EDIT } },
};

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "tool_error") { super(message); }
}

const any = (acc: Access, tabs: string[]) => tabs.some((t) => acc.tabs.includes(t));

export function checkRead(spec: Spec, tableId: string, input: any, acc: Access) {
  let tabs = spec.read;
  if (tableId === T.umat) {
    const hasIds = Array.isArray(input.recordIds) && input.recordIds.length > 0;
    const hasFilter = !!input.filters;
    if (!hasIds && !hasFilter) tabs = ["Umat"]; // daftar penuh umat hanya untuk tab Umat
    if (hasIds) tabs = ["Pengurus", "Pewarta", "PD", "Umat"];
  }
  if (!any(acc, tabs)) throw new HttpError(403, "Anda tidak punya izin membaca data ini.");
  if (spec.readFields) {
    const ids: string[] = [...(Array.isArray(input.fieldIds) ? input.fieldIds : []), ...(JSON.stringify(input.filters || "").match(/fld[A-Za-z0-9]{14}/g) || [])];
    if (!ids.length || !ids.every((f) => spec.readFields!.includes(f))) throw new HttpError(403, "Field tidak boleh dibaca dari dashboard.");
  }
}

export function checkWrite(spec: Spec, kind: "update" | "create", records: any[], acc: Access) {
  const rule = spec[kind];
  if (!rule) throw new HttpError(403, "Penulisan ke tabel ini tidak diizinkan.");
  if (!canEdit(acc)) throw new HttpError(403, "Level Anda View saja, tidak boleh mengubah data.");
  if (!any(acc, rule.tabs)) throw new HttpError(403, "Anda tidak punya izin mengubah data ini.");
  for (const r of records) {
    for (const k of Object.keys(r.fields || {})) {
      if (!rule.fields.includes(k)) throw new HttpError(403, "Field " + k + " tidak boleh diubah dari dashboard.");
      if (k === PWB_YT) {
        const v = r.fields[k];
        if (v !== null && v !== "" && !(typeof v === "string" && /^https?:\/\/\S{3,500}$/i.test(v))) throw new HttpError(400, "Link YouTube harus berupa URL http(s).");
      }
    }
  }
}
