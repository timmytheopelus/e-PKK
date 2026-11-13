// Laporan perwakilan per seksi untuk satu event: siapa ketua yang hadir/terdaftar, siapa yang diwakili, seksi mana yang kosong.
import { BASE_BPK, T } from "./policy";
import { listUntil, resolveLinks } from "./airtable";
import { T_HADIR } from "./absen";

export type Dasar = "daftar" | "hadir";
export type JabRow = { bidang: string; seksi: string; peran: string };
export type Orang = { umat: string; nama: string; jab: JabRow[] };
export type StatusSeksi = "ketua" | "diwakili" | "kosong";
export type KetuaRow = { nama: string; status: "hadir" | "diwakili" | "tidak" };
export type AnggotaRow = { nama: string; peran: string; hadir: boolean };
export type SeksiRow = { bidang: string; seksi: string; ketua: KetuaRow[]; perwakilan: string[]; anggota: number; status: StatusSeksi; daftar: AnggotaRow[] };

const KETUA = /^(ketua|pimpinan)$/i;

/** Murni: hitung status tiap seksi. `hadir` = id umat yang terdaftar/hadir. */
export function hitungSeksi(orang: Orang[], hadir: Set<string>): SeksiRow[] {
  const per = new Map<string, { bidang: string; seksi: string; ketua: Orang[]; lain: Orang[]; peran: Map<string, string> }>();
  for (const o of orang) {
    for (const j of o.jab) {
      if (!j.seksi) continue;
      const k = j.bidang + "\u0000" + j.seksi;
      const g = per.get(k) || { bidang: j.bidang, seksi: j.seksi, ketua: [], lain: [], peran: new Map<string, string>() };
      if (!g.peran.has(o.umat) || KETUA.test(j.peran)) g.peran.set(o.umat, j.peran || "Anggota");
      const dst = KETUA.test(j.peran) ? g.ketua : g.lain;
      if (!dst.some((x) => x.umat === o.umat)) dst.push(o);
      per.set(k, g);
    }
  }
  const out: SeksiRow[] = [];
  for (const g of per.values()) {
    const ketuaIds = new Set(g.ketua.map((x) => x.umat));
    const wakil = g.lain.filter((x) => !ketuaIds.has(x.umat) && hadir.has(x.umat)).map((x) => x.nama);
    const anyKetua = g.ketua.some((x) => hadir.has(x.umat));
    const ketua: KetuaRow[] = g.ketua.map((x) => ({ nama: x.nama, status: hadir.has(x.umat) ? "hadir" : wakil.length ? "diwakili" : "tidak" }));
    const status: StatusSeksi = anyKetua ? "ketua" : wakil.length ? "diwakili" : "kosong";
    out.push({ bidang: g.bidang, seksi: g.seksi, ketua, perwakilan: wakil, anggota: ketuaIds.size + g.lain.filter((x) => !ketuaIds.has(x.umat)).length, status,
      daftar: [...g.ketua, ...g.lain.filter((x) => !ketuaIds.has(x.umat))].map((x) => ({ nama: x.nama, peran: g.peran.get(x.umat) || "Anggota", hadir: hadir.has(x.umat) })) });
  }
  return out.sort((a, b) => a.bidang.localeCompare(b.bidang, "id") || a.seksi.localeCompare(b.seksi, "id"));
}

const sel = (v: any) => String(typeof v === "object" && v ? v.name ?? "" : v ?? "").trim();
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const PGR = { umat: "fldfYrY68cNtbaXtN", nama: "fldHK8r2o5q60IDXW", jabatan: "fldwW6zQoxhbTWLDv", periode: "fldHngi5Klnm5bUmM" };
const JAB = { bidang: "fldCCi0hV9yTL091P", seksi: "fldAAyRg1kko5YgrK", peran: "fldI8J3VXZDyjWa3f" };
const PD = { event: "flduf15moMpZSklGL", umat: "fldqvA9dTUmWLfRr2", st: "fldNGGEcwHqIsQPct" };
const KH = { event: "fldrIFO5fehaqaS2u", pend: "fldTuFsmLgiZoHXEf", status: "fldudT9j1X2vkQCqD" };
const EVF = { nama: "fld0d9tIyi4nyTZsM", tgl: "fldoIkx9wLMaKOa38" };

let pengurusCache: { at: number; v: Promise<Orang[]> } | null = null;
export function pengurusAktif(): Promise<Orang[]> {
  if (pengurusCache && Date.now() - pengurusCache.at < 300_000) return pengurusCache.v;
  const v = muatPengurus();
  pengurusCache = { at: Date.now(), v };
  v.catch(() => { pengurusCache = null; });
  return v;
}
async function muatPengurus(): Promise<Orang[]> {
  const [jab, pg] = await Promise.all([
    listUntil(BASE_BPK, T.jabatan, { fieldIds: [JAB.bidang, JAB.seksi, JAB.peran], want: Infinity, maxPages: 10 }),
    listUntil(BASE_BPK, T.pengurus, { fieldIds: [PGR.umat, PGR.nama, PGR.jabatan, PGR.periode], want: Infinity, maxPages: 30 }),
  ]);
  const master = new Map<string, JabRow>(jab.records.map((r) => [r.id, { bidang: sel(r.fields[JAB.bidang]), seksi: sel(r.fields[JAB.seksi]), peran: sel(r.fields[JAB.peran]) }]));
  // Periode adalah tautan: REST hanya memberi kode record, jadi namanya diterjemahkan dulu (salinan khusus agar kolom lain tidak ikut berubah).
  const per = await resolveLinks(BASE_BPK, T.pengurus, pg.records.map((r) => ({ id: r.id, fields: { [PGR.periode]: r.fields[PGR.periode] } })) as any);
  const periodeOf = new Map<string, string>(per.map((r) => [r.id, ((r.fields[PGR.periode] as any[]) || []).map((x) => x?.name ?? "").join(" ")]));
  const by = new Map<string, Orang>();
  for (const r of pg.records) {
    const p = periodeOf.get(r.id) || "";
    if (p && !/(^|\s)2026/.test(p)) continue; // "2023-2026" bukan periode berjalan
    const umat = ((r.fields[PGR.umat] as any[]) || [])[0]; const uid = typeof umat === "string" ? umat : umat?.id;
    if (!uid) continue;
    const nama = String(((r.fields[PGR.nama] as any[]) || [])[0] || "").replace(/\s+/g, " ").trim();
    const jabs = ((r.fields[PGR.jabatan] as any[]) || []).map((j) => master.get(typeof j === "string" ? j : j?.id)).filter(Boolean) as JabRow[];
    const o: Orang = by.get(uid) || { umat: uid, nama, jab: [] };
    o.jab.push(...jabs); by.set(uid, o);
  }
  return [...by.values()];
}

export async function laporanSeksi(eventId: string, dasar: Dasar, ev: { nama: string; tgl: string }) {
  const formula = `FIND("${esc(ev.nama)}", ARRAYJOIN({Event}))`;
  const [orang, pd, kh] = await Promise.all([
    pengurusAktif(),
    listUntil(BASE_BPK, T.pendaftaran, { fieldIds: [PD.event, PD.umat, PD.st], want: Infinity, maxPages: 20, formula }),
    dasar === "hadir" ? listUntil(BASE_BPK, T_HADIR, { fieldIds: [KH.event, KH.pend, KH.status], want: Infinity, maxPages: 20, formula }) : Promise.resolve({ records: [] as any[] }),
  ]);
  const aktif = pd.records.filter((r) => ((r.fields[PD.event] as string[]) || []).includes(eventId) && !/^(batal|dobel)/i.test(sel(r.fields[PD.st])));
  let ids: Set<string>;
  if (dasar === "daftar") ids = new Set(aktif.flatMap((r) => (r.fields[PD.umat] as string[]) || []));
  else {
    const hadirPend = new Set(kh.records.filter((r) => ((r.fields[KH.event] as string[]) || []).includes(eventId) && /hadir/i.test(sel(r.fields[KH.status]))).flatMap((r) => (r.fields[KH.pend] as string[]) || []));
    ids = new Set(aktif.filter((r) => hadirPend.has(r.id)).flatMap((r) => (r.fields[PD.umat] as string[]) || []));
  }
  const rows = hitungSeksi(orang, ids);
  return { dasar, jumlah: ids.size, seksi: rows, ringkas: { ketua: rows.filter((r) => r.status === "ketua").length, diwakili: rows.filter((r) => r.status === "diwakili").length, kosong: rows.filter((r) => r.status === "kosong").length } };
}

/** Nama dan tanggal event (untuk filter rumus dan penentuan dasar bawaan). */
export async function infoEvent(id: string) {
  const { getRecord } = await import("./airtable");
  const e = await getRecord(BASE_BPK, T.events, id);
  return { nama: String(e.fields[EVF.nama] || ""), tgl: String(e.fields[EVF.tgl] || "").slice(0, 10) };
}
