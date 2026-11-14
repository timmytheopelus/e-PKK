// Program Kerja: ajukan, putuskan (persetujuan bertahap), daftar. Semua aturan ditegakkan di server.
import { Access, BASE_BPK, HttpError } from "./policy";
import { at, listUntil } from "./airtable";
import { T_PROGRAM, T_ANGGARAN, T_SETUJU, T_REALISASI, PK, AG, ST, RZ, JENIS } from "./proker-schema";
import { hitungSisa } from "./realisasi";
import { peranOf, rowsOf, semuaSeksi, seksiBidang, emailsWhere } from "./proker-roles";
import { canAct, nextStatus, type Keputusan, type Tahap } from "./proker-flow";
import { buatNotif } from "./notif";
import { hitungRingkas, type Ringkas } from "./proker-ringkas";

const REC = /^rec[A-Za-z0-9]{14}$/;
const TAHAP: Tahap[] = ["Sekjen"];
const norm = (s: string) => s.trim().toLowerCase();
const sel = (v: any) => String(typeof v === "object" && v ? v.name ?? "" : v ?? "");
const lines = (s: any) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

export type AnggaranInput =
  | { mode: "Total"; total: number }
  | { mode: "Rincian"; baris: { keterangan: string; jenis: "Pemasukan" | "Pengeluaran"; nominal: number }[] };
export type AjukanInput = { nama: string; detail?: string; mulai: string; seksiTerlibat?: string[]; seksiPengaju?: string; anggaran: AnggaranInput };

function guard(acc: Access) {
  if (acc.viewAs) throw new HttpError(403, "Mode 'Lihat sebagai' hanya untuk melihat.");
  if (acc.level !== "Superadmin" && !acc.tabs.includes("Program Kerja")) throw new HttpError(403, "Tidak punya akses ke menu Program Kerja.");
}
const rupiah = (n: any, label: string) => {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 1e12) throw new HttpError(400, `${label} harus bilangan bulat tidak negatif.`);
  return n;
};

type Pengaju = { seksi: string; bidang: string };
/** Seksi yang boleh dipakai akun sebagai pengaju: milik sendiri (Ketua/Wakil) + yang diizinkan peran istimewa. */
async function seksiPengajuBoleh(acc: Access): Promise<{ boleh: Pengaju[]; bisaPilih: boolean }> {
  const [rows, peran] = await Promise.all([rowsOf(acc.email), peranOf(acc)]);
  const milik: Pengaju[] = rows.filter((r) => (r.peran === "Ketua" || r.peran === "Wakil") && r.seksi).map((r) => ({ seksi: r.seksi, bidang: r.bidang }));
  const semua = acc.level === "Superadmin" || peran.pimpinan;
  if (!semua && !peran.koordBidang.length) return { boleh: milik, bisaPilih: false };
  const peta = await seksiBidang();
  const boleh = new Map<string, Pengaju>(milik.map((m) => [m.seksi, m]));
  for (const [seksi, bidang] of peta) {
    if (semua || peran.koordBidang.some((b) => norm(b) === norm(bidang))) boleh.set(seksi, { seksi, bidang });
  }
  return { boleh: [...boleh.values()].sort((a, b) => a.seksi.localeCompare(b.seksi, "id")), bisaPilih: true };
}
async function tentukanPengaju(acc: Access, diminta?: string): Promise<Pengaju> {
  const { boleh } = await seksiPengajuBoleh(acc);
  if (!boleh.length) throw new HttpError(403, "Hanya Ketua/Wakil seksi, Koordinator, atau Superadmin yang dapat mengajukan program.");
  if (diminta !== undefined) {
    const f = boleh.find((r) => norm(r.seksi) === norm(String(diminta)));
    if (!f) throw new HttpError(403, "Anda tidak boleh mengajukan atas nama seksi tersebut.");
    return f;
  }
  if (boleh.length > 1) throw new HttpError(400, "Pilih seksi pengaju.");
  return boleh[0];
}

export async function ajukanProgram(acc: Access, input: AjukanInput): Promise<{ id: string }> {
  guard(acc);
  const nama = String(input?.nama || "").trim();
  if (!nama || nama.length > 200) throw new HttpError(400, "Nama program wajib diisi (maks 200 huruf).");
  const detail = String(input?.detail || "").slice(0, 5000);
  const mulai = String(input?.mulai || "");
  if (!/^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/.test(mulai)) throw new HttpError(400, "Perkiraan mulai harus berformat tanggal (YYYY-MM-DD) atau bulan (YYYY-MM).");

  // Seksi pengaju: seksi tempat akun menjabat sebagai Ketua/Wakil. Superadmin dan grup koordinator (Pimpinan/Koordinator)
  // boleh memilih seksi mana pun; Koordinator Bidang hanya seksi di bidangnya. Input dari browser tidak dipercaya.
  const pilih = await tentukanPengaju(acc, input.seksiPengaju);

  const dikenal = await semuaSeksi();
  const terlibat = [pilih.seksi];
  for (const s of input.seksiTerlibat || []) {
    const nm = String(s).trim();
    if (!dikenal.has(nm)) throw new HttpError(400, `Seksi tidak dikenal: ${nm.slice(0, 60)}.`);
    if (!terlibat.some((x) => norm(x) === norm(nm))) terlibat.push(nm);
  }

  const a: any = input.anggaran;
  let total = 0, baris: { keterangan: string; jenis: string; nominal: number }[] = [];
  if (a?.mode === "Total") total = rupiah(a.total, "Total anggaran");
  else if (a?.mode === "Rincian" && Array.isArray(a.baris) && a.baris.length <= 100) {
    baris = a.baris.map((b: any) => {
      const keterangan = String(b?.keterangan || "").trim();
      if (!keterangan || keterangan.length > 200) throw new HttpError(400, "Keterangan anggaran wajib diisi.");
      if (!(JENIS as readonly string[]).includes(b?.jenis)) throw new HttpError(400, "Jenis anggaran tidak dikenal.");
      return { keterangan, jenis: b.jenis, nominal: rupiah(b.nominal, "Nominal") };
    });
    total = baris.filter((b) => b.jenis === "Pengeluaran").reduce((s, b) => s + b.nominal, 0);
  } else throw new HttpError(400, "Anggaran tidak valid.");

  const j = await at(`/v0/${BASE_BPK}/${T_PROGRAM}`, {
    method: "POST",
    body: JSON.stringify({ records: [{ fields: {
      [PK.nama]: nama, [PK.detail]: detail, [PK.seksiPengaju]: pilih.seksi, [PK.bidang]: pilih.bidang, [PK.mulai]: mulai,
      [PK.seksiTerlibat]: terlibat.join("\n"), [PK.modeAnggaran]: a.mode, [PK.totalAnggaran]: total,
      [PK.status]: "Menunggu Sekjen", [PK.dibuatOleh]: acc.email.trim().toLowerCase(), [PK.waktuDibuat]: new Date().toISOString(),
    } }] }),
  });
  const id: string = j.records[0].id;
  for (let i = 0; i < baris.length; i += 10) {
    await at(`/v0/${BASE_BPK}/${T_ANGGARAN}`, {
      method: "POST",
      body: JSON.stringify({ records: baris.slice(i, i + 10).map((b) => ({ fields: { [AG.keterangan]: b.keterangan, [AG.programId]: id, [AG.jenis]: b.jenis, [AG.nominal]: b.nominal } })) }),
    });
  }
  await buatNotif(await emailsWhere((r) => r.sekjen), `Program baru menunggu persetujuan Anda: ${nama} (${pilih.seksi})`, `proker:${id}`);
  return { id };
}

type Prog = { id: string; nama: string; detail: string; seksiPengaju: string; bidang: string; mulai: string; seksiTerlibat: string[]; status: string; mode: string; total: number; dibuatOleh: string; waktu: string };
const PROG_FIELDS = Object.values(PK);
const toProg = (r: any): Prog => {
  const f = r.fields || {};
  return { id: r.id, nama: String(f[PK.nama] || ""), detail: String(f[PK.detail] || ""), seksiPengaju: String(f[PK.seksiPengaju] || ""), bidang: String(f[PK.bidang] || ""),
    mulai: String(f[PK.mulai] || ""), seksiTerlibat: lines(f[PK.seksiTerlibat]), status: sel(f[PK.status]), mode: sel(f[PK.modeAnggaran]),
    total: Number(f[PK.totalAnggaran] || 0), dibuatOleh: String(f[PK.dibuatOleh] || "").toLowerCase(), waktu: String(f[PK.waktuDibuat] || "") };
};
const keputusanDari = (recs: any[]): Keputusan[] => recs.map((r) => ({ tahap: sel(r.fields[ST.tahap]) as Tahap, seksi: String(r.fields[ST.seksi] || "") || undefined, keputusan: sel(r.fields[ST.keputusan]) as any }))
  .filter((k) => TAHAP.includes(k.tahap) && (k.keputusan === "Setuju" || k.keputusan === "Tolak"));

export async function putuskan(acc: Access, input: { programId: string; tahap: string; seksi?: string; keputusan: string; catatan?: string }): Promise<{ status: string }> {
  guard(acc);
  if (!REC.test(input?.programId || "")) throw new HttpError(400, "id program tidak valid.");
  if (!TAHAP.includes(input.tahap as Tahap)) throw new HttpError(400, "Tahap tidak dikenal.");
  if (input.keputusan !== "Setuju" && input.keputusan !== "Tolak") throw new HttpError(400, "Keputusan tidak dikenal.");
  const tahap = input.tahap as Tahap;
  const rec = await at(`/v0/${BASE_BPK}/${T_PROGRAM}/${input.programId}?returnFieldsByFieldId=true`);
  const p = toProg(rec);
  const peran = await peranOf(acc);
  // Peran dicek dulu (403), baru urutan/duplikat (409).
  if (!peran.sekjen) throw new HttpError(403, "Hanya Sekretaris Jenderal atau Koordinator BPK yang boleh menyetujui program.");
  if (!canAct(peran, p, tahap)) throw new HttpError(409, "Program ini sudah diputuskan atau tidak lagi menunggu persetujuan. Muat ulang halaman.");
  const lama = await at(`/v0/${BASE_BPK}/${T_SETUJU}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(`{Program ID}="${p.id}"`)}`);
  const ada = (lama.records || []).filter((r: any) => r.fields[ST.programId] === p.id);
  const dobel = ada.some((r: any) => sel(r.fields[ST.tahap]) === tahap && ["Setuju", "Tolak"].includes(sel(r.fields[ST.keputusan])));
  if (dobel) throw new HttpError(409, "Keputusan untuk tahap ini sudah dicatat.");

  const seksi = "";
  await at(`/v0/${BASE_BPK}/${T_SETUJU}`, {
    method: "POST",
    body: JSON.stringify({ records: [{ fields: {
      [ST.ringkasan]: `${input.keputusan} · ${tahap}${seksi ? " " + seksi : ""} · ${p.nama}`.slice(0, 200), [ST.programId]: p.id, [ST.tahap]: tahap,
      ...(seksi ? { [ST.seksi]: seksi } : {}), [ST.keputusan]: input.keputusan, [ST.oleh]: acc.email.trim().toLowerCase(),
      [ST.waktu]: new Date().toISOString(), [ST.catatan]: String(input.catatan || "").slice(0, 2000),
    } }] }),
  });
  const status = nextStatus(p, [...keputusanDari(ada), { tahap, seksi: seksi || undefined, keputusan: input.keputusan as any }]);
  await at(`/v0/${BASE_BPK}/${T_PROGRAM}/${p.id}`, { method: "PATCH", body: JSON.stringify({ fields: { [PK.status]: status } }) });
  await beritahu(p, status, input.keputusan);
  return { status };
}

async function beritahu(p: Prog, status: string, keputusan: string) {
  const tautan = `proker:${p.id}`;
  const pengaju = p.dibuatOleh ? [p.dibuatOleh] : [];
  if (status === "Ditolak") return buatNotif(pengaju, `Program "${p.nama}" ditolak oleh Sekjen / Koordinator BPK.`, tautan);
  await buatNotif(pengaju, `Program "${p.nama}" ${keputusan === "Setuju" ? "disetujui" : "diputuskan"} oleh Sekjen / Koordinator BPK → ${status}.`, tautan);
  if (status === "Disetujui") {
    await buatNotif(await emailsWhere((r) => r.pimpinan), `Program "${p.nama}" (${p.seksiPengaju}) disetujui untuk dilaksanakan.`, tautan);
  }
}

export type CakupanCtx = { semua: boolean; bidangKoord: Set<string>; seksiSaya: Set<string>; email: string };
/** Program yang boleh dilihat akun: semua (Pimpinan/Sekjen), bidang yang dikoordinir, seksi sendiri (pengaju atau terlibat), atau buatan sendiri. */
export function dalamCakupan(p: { bidang: string; seksiPengaju: string; seksiTerlibat: string[]; dibuatOleh: string }, ctx: CakupanCtx): boolean {
  if (ctx.semua) return true;
  if (p.dibuatOleh === ctx.email) return true;
  if (ctx.bidangKoord.has(norm(p.bidang))) return true;
  return [p.seksiPengaju, ...p.seksiTerlibat].some((s) => ctx.seksiSaya.has(norm(s)));
}

export async function daftarProgram(acc: Access) { return muatProgram(acc, true); }

/** Semua program (saring=false) atau hanya yang dalam cakupan akun (saring=true). */
async function muatProgram(acc: Access, saring: boolean) {
  if (acc.level !== "Superadmin" && !acc.tabs.includes("Program Kerja")) throw new HttpError(403, "Tidak punya akses ke menu Program Kerja.");
  const [peran, rows] = await Promise.all([peranOf(acc), rowsOf(acc.email)]);
  const [pr, ag, st, rz] = await Promise.all([
    listUntil(BASE_BPK, T_PROGRAM, { fieldIds: PROG_FIELDS, want: Infinity, maxPages: 20 }),
    listUntil(BASE_BPK, T_ANGGARAN, { fieldIds: Object.values(AG), want: Infinity, maxPages: 50 }),
    listUntil(BASE_BPK, T_SETUJU, { fieldIds: Object.values(ST), want: Infinity, maxPages: 50 }),
    listUntil(BASE_BPK, T_REALISASI, { fieldIds: Object.values(RZ), want: Infinity, maxPages: 50 }),
  ]);
  const ctx: CakupanCtx = {
    semua: peran.sekjen || peran.pimpinan || acc.level === "Superadmin",
    bidangKoord: new Set(peran.koordBidang.map(norm)),
    seksiSaya: new Set(rows.map((r) => norm(r.seksi)).filter(Boolean)),
    email: acc.email.trim().toLowerCase(),
  };
  const out = [];
  for (const rec of pr.records) {
    const p = toProg(rec);
    if (saring && !dalamCakupan(p, ctx)) continue;
    const baris = ag.records.filter((r) => r.fields[AG.programId] === p.id);
    const sum = (j: string) => baris.filter((r) => sel(r.fields[AG.jenis]) === j).reduce((s, r) => s + Number(r.fields[AG.nominal] || 0), 0);
    const aksi: Tahap[] = [];
    if (canAct(peran, p, "Sekjen")) aksi.push("Sekjen");
    const kep = st.records.filter((r) => r.fields[ST.programId] === p.id).map((r) => ({ tahap: sel(r.fields[ST.tahap]), seksi: String(r.fields[ST.seksi] || ""), keputusan: sel(r.fields[ST.keputusan]), oleh: String(r.fields[ST.oleh] || ""), catatan: String(r.fields[ST.catatan] || "") }));
    const real = rz.records.filter((r) => r.fields[RZ.programId] === p.id)
      .map((r) => ({ tanggal: String(r.fields[RZ.tanggal] || ""), nominal: Number(r.fields[RZ.nominal] || 0), keterangan: String(r.fields[RZ.keterangan] || ""), penerima: String(r.fields[RZ.penerima] || "") }))
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const anggaranKeluar = p.mode === "Rincian" ? sum("Pengeluaran") : p.total;
    // Sisa dan realisasi hanya untuk anggaran milik seksi pengaju (atau pembuat, koordinator bidangnya, dan peran penuh); seksi yang hanya terlibat tidak melihatnya.
    const milik = ctx.semua || p.dibuatOleh === ctx.email || ctx.bidangKoord.has(norm(p.bidang)) || ctx.seksiSaya.has(norm(p.seksiPengaju));
    out.push({
      ...(milik ? hitungSisa(anggaranKeluar, real.map((r) => r.nominal)) : { terpakai: null as number | null, sisa: null as number | null }), realisasi: milik ? real : [], milik,
      id: p.id, nama: p.nama, detail: p.detail, seksiPengaju: p.seksiPengaju, bidang: p.bidang, mulai: p.mulai, seksiTerlibat: p.seksiTerlibat, status: p.status,
      mode: p.mode, totalPemasukan: p.mode === "Rincian" ? sum("Pemasukan") : 0, totalPengeluaran: p.mode === "Rincian" ? sum("Pengeluaran") : p.total,
      baris: baris.map((r) => ({ keterangan: String(r.fields[AG.keterangan] || ""), jenis: sel(r.fields[AG.jenis]), nominal: Number(r.fields[AG.nominal] || 0) })),
      keputusan: kep, baru: !!p.waktu && Date.now() - Date.parse(p.waktu) <= 14 * 86400_000, aksi, seksiAksi: [] as string[],
    });
  }
  return out;
}

/** Angka ringkasan seluruh program untuk dashboard Pimpinan, Sekjen, dan Bendahara. */
export async function ringkasanProgram(acc: Access): Promise<Ringkas & { menungguSekjen: number }> {
  const peran = await peranOf(acc);
  if (!(peran.sekjen || peran.pimpinan || peran.bendahara || acc.level === "Superadmin")) throw new HttpError(403, "Tidak punya akses ke ringkasan program.");
  const semua = await muatProgram({ ...acc, tabs: [...acc.tabs, "Program Kerja"] }, false);
  return { ...hitungRingkas(semua), menungguSekjen: semua.filter((p) => p.status === "Menunggu Sekjen").length };
}

/** Isian formulir: seksi yang boleh dipilih sebagai pengaju (seksiPilihan), apakah perlu memilih, dan semua seksi untuk dicentang sebagai terlibat. */
export async function infoProgram(acc: Access) {
  guard(acc);
  const { boleh, bisaPilih } = await seksiPengajuBoleh(acc);
  return {
    seksiSaya: [...new Set(boleh.map((r) => r.seksi))].slice(0, bisaPilih ? 0 : 50), seksiPilihan: boleh.map((r) => r.seksi),
    bisaPilih: bisaPilih || boleh.length > 1, semuaSeksi: [...(await semuaSeksi())].sort((a, b) => a.localeCompare(b, "id")),
  };
}
