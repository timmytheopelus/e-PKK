// Program Kerja: ajukan, putuskan (persetujuan bertahap), daftar. Semua aturan ditegakkan di server.
import { Access, BASE_BPK, HttpError } from "./policy";
import { at, listUntil } from "./airtable";
import { T_PROGRAM, T_ANGGARAN, T_SETUJU, PK, AG, ST, JENIS } from "./proker-schema";
import { peranOf, rowsOf, semuaSeksi, emailsWhere } from "./proker-roles";
import { canAct, nextStatus, seksiKolaborasi, type Keputusan, type Tahap } from "./proker-flow";
import { buatNotif } from "./notif";

const REC = /^rec[A-Za-z0-9]{14}$/;
const TAHAP: Tahap[] = ["Koord Bidang", "Kolaborasi", "Sekjen"];
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

export async function ajukanProgram(acc: Access, input: AjukanInput): Promise<{ id: string }> {
  guard(acc);
  const nama = String(input?.nama || "").trim();
  if (!nama || nama.length > 200) throw new HttpError(400, "Nama program wajib diisi (maks 200 huruf).");
  const detail = String(input?.detail || "").slice(0, 5000);
  const mulai = String(input?.mulai || "");
  if (!/^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/.test(mulai)) throw new HttpError(400, "Perkiraan mulai harus berformat tanggal (YYYY-MM-DD) atau bulan (YYYY-MM).");

  // Seksi pengaju: hanya seksi tempat akun menjabat sebagai Ketua/Wakil; input dari browser tidak dipercaya.
  const milik = (await rowsOf(acc.email)).filter((r) => (r.peran === "Ketua" || r.peran === "Wakil") && r.seksi);
  if (!milik.length) throw new HttpError(403, "Hanya Ketua/Wakil seksi yang dapat mengajukan program.");
  let pilih = milik[0];
  if (input.seksiPengaju !== undefined) {
    const f = milik.find((r) => norm(r.seksi) === norm(String(input.seksiPengaju)));
    if (!f) throw new HttpError(403, "Anda hanya dapat mengajukan atas nama seksi Anda sendiri.");
    pilih = f;
  } else if (new Set(milik.map((r) => r.seksi)).size > 1) throw new HttpError(400, "Pilih seksi pengaju.");

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
      [PK.status]: "Menunggu Koord Bidang", [PK.dibuatOleh]: acc.email.trim().toLowerCase(), [PK.waktuDibuat]: new Date().toISOString(),
    } }] }),
  });
  const id: string = j.records[0].id;
  for (let i = 0; i < baris.length; i += 10) {
    await at(`/v0/${BASE_BPK}/${T_ANGGARAN}`, {
      method: "POST",
      body: JSON.stringify({ records: baris.slice(i, i + 10).map((b) => ({ fields: { [AG.keterangan]: b.keterangan, [AG.programId]: id, [AG.jenis]: b.jenis, [AG.nominal]: b.nominal } })) }),
    });
  }
  const kb = await emailsWhere((p) => p.koordBidang.some((x) => norm(x) === norm(pilih.bidang)));
  await buatNotif(kb, `Program baru menunggu persetujuan Anda: ${nama} (${pilih.seksi})`, `proker:${id}`);
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

const STATUS_TAHAP: Record<Tahap, string> = { "Koord Bidang": "Menunggu Koord Bidang", Kolaborasi: "Menunggu Kolaborasi", Sekjen: "Menunggu Sekjen" };

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
  if (!canAct(peran, { ...p, status: STATUS_TAHAP[tahap] }, tahap, input.seksi)) throw new HttpError(403, "Anda tidak berwenang pada tahap ini untuk program ini.");
  if (p.status !== STATUS_TAHAP[tahap]) throw new HttpError(409, "Program ini belum/tidak lagi pada tahap tersebut. Muat ulang halaman.");
  const lama = await at(`/v0/${BASE_BPK}/${T_SETUJU}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(`{Program ID}="${p.id}"`)}`);
  const ada = (lama.records || []).filter((r: any) => r.fields[ST.programId] === p.id);
  const dobel = ada.some((r: any) => sel(r.fields[ST.tahap]) === tahap && (tahap !== "Kolaborasi" || norm(String(r.fields[ST.seksi] || "")) === norm(input.seksi || "")) && ["Setuju", "Tolak"].includes(sel(r.fields[ST.keputusan])));
  if (dobel) throw new HttpError(409, "Keputusan untuk tahap ini sudah dicatat.");

  const seksi = tahap === "Kolaborasi" ? String(input.seksi) : "";
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
  await beritahu(p, status, input.keputusan, tahap);
  return { status };
}

async function beritahu(p: Prog, status: string, keputusan: string, tahap: Tahap) {
  const tautan = `proker:${p.id}`;
  const pengaju = p.dibuatOleh ? [p.dibuatOleh] : [];
  if (status === "Ditolak") return buatNotif(pengaju, `Program "${p.nama}" ditolak pada tahap ${tahap}.`, tautan);
  await buatNotif(pengaju, `Program "${p.nama}": ${tahap} ${keputusan === "Setuju" ? "menyetujui" : "memutuskan"} → ${status}.`, tautan);
  if (status === "Menunggu Kolaborasi") {
    for (const s of seksiKolaborasi(p)) {
      const em = await emailsWhere((r) => r.koordSeksi.some((x) => norm(x) === norm(s)));
      await buatNotif(em, `Ajakan kolaborasi: "${p.nama}" dari ${p.seksiPengaju} memerlukan persetujuan seksi ${s}.`, tautan);
    }
  } else if (status === "Menunggu Sekjen") {
    await buatNotif(await emailsWhere((r) => r.sekjen), `Program "${p.nama}" menunggu persetujuan pelaksanaan Sekjen.`, tautan);
  } else if (status === "Disetujui") {
    await buatNotif(await emailsWhere((r) => r.pimpinan), `Program "${p.nama}" (${p.seksiPengaju}) disetujui untuk dilaksanakan.`, tautan);
  }
}

export async function daftarProgram(acc: Access) {
  if (acc.level !== "Superadmin" && !acc.tabs.includes("Program Kerja")) throw new HttpError(403, "Tidak punya akses ke menu Program Kerja.");
  const [peran, rows] = await Promise.all([peranOf(acc), rowsOf(acc.email)]);
  const [pr, ag, st] = await Promise.all([
    listUntil(BASE_BPK, T_PROGRAM, { fieldIds: PROG_FIELDS, want: Infinity, maxPages: 20 }),
    listUntil(BASE_BPK, T_ANGGARAN, { fieldIds: Object.values(AG), want: Infinity, maxPages: 50 }),
    listUntil(BASE_BPK, T_SETUJU, { fieldIds: Object.values(ST), want: Infinity, maxPages: 50 }),
  ]);
  const semua = peran.sekjen || peran.pimpinan;
  const bidangSaya = new Set(rows.map((r) => norm(r.bidang)).filter(Boolean));
  const seksiSaya = new Set(rows.map((r) => norm(r.seksi)).filter(Boolean));
  const me = acc.email.trim().toLowerCase();
  const out = [];
  for (const rec of pr.records) {
    const p = toProg(rec);
    if (!semua && !(p.dibuatOleh === me || bidangSaya.has(norm(p.bidang)) || [p.seksiPengaju, ...p.seksiTerlibat].some((s) => seksiSaya.has(norm(s))))) continue;
    const baris = ag.records.filter((r) => r.fields[AG.programId] === p.id);
    const sum = (j: string) => baris.filter((r) => sel(r.fields[AG.jenis]) === j).reduce((s, r) => s + Number(r.fields[AG.nominal] || 0), 0);
    const aksi: Tahap[] = [];
    if (canAct(peran, p, "Koord Bidang")) aksi.push("Koord Bidang");
    const seksiAksi = seksiKolaborasi(p).filter((s) => canAct(peran, p, "Kolaborasi", s));
    if (seksiAksi.length) aksi.push("Kolaborasi");
    if (canAct(peran, p, "Sekjen")) aksi.push("Sekjen");
    const kep = st.records.filter((r) => r.fields[ST.programId] === p.id).map((r) => ({ tahap: sel(r.fields[ST.tahap]), seksi: String(r.fields[ST.seksi] || ""), keputusan: sel(r.fields[ST.keputusan]), oleh: String(r.fields[ST.oleh] || ""), catatan: String(r.fields[ST.catatan] || "") }));
    out.push({
      id: p.id, nama: p.nama, detail: p.detail, seksiPengaju: p.seksiPengaju, bidang: p.bidang, mulai: p.mulai, seksiTerlibat: p.seksiTerlibat, status: p.status,
      mode: p.mode, totalPemasukan: p.mode === "Rincian" ? sum("Pemasukan") : 0, totalPengeluaran: p.mode === "Rincian" ? sum("Pengeluaran") : p.total,
      baris: baris.map((r) => ({ keterangan: String(r.fields[AG.keterangan] || ""), jenis: sel(r.fields[AG.jenis]), nominal: Number(r.fields[AG.nominal] || 0) })),
      keputusan: kep, baru: !!p.waktu && Date.now() - Date.parse(p.waktu) <= 14 * 86400_000, aksi, seksiAksi,
    });
  }
  return out;
}

/** Isian formulir: seksi tempat akun boleh mengajukan, dan semua seksi yang dikenal (untuk dicentang sebagai terlibat). */
export async function infoProgram(acc: Access) {
  guard(acc);
  const rows = (await rowsOf(acc.email)).filter((r) => (r.peran === "Ketua" || r.peran === "Wakil") && r.seksi);
  return { seksiSaya: [...new Set(rows.map((r) => r.seksi))], semuaSeksi: [...(await semuaSeksi())].sort((a, b) => a.localeCompare(b, "id")) };
}
