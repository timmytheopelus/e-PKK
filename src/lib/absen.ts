// Absensi kehadiran event lewat link publik bertanda tangan (HMAC). Memakai tabel KehadiranEvent yang sudah ada.
import crypto from "node:crypto";
import { Access, BASE_BPK, HttpError, T } from "./policy";
import { at, getRecord, listUntil, resolveLinks } from "./airtable";
import { pengurusAktif } from "./seksi-hadir";

export const T_HADIR = "tblQgU4DawCAXIRdi";
const KH = { event: "fldrIFO5fehaqaS2u", pend: "fldTuFsmLgiZoHXEf", status: "fldudT9j1X2vkQCqD" };
const PD = { event: "flduf15moMpZSklGL", umat: "fldqvA9dTUmWLfRr2", nama: "fld9ucFxEU0cUSHWw", pgl: "fldCzgcTVAfS1nLcJ", wa: "fldxPeYahFmDfKvlL", kom: "fldMBf67dQxv51kY1", paroki: "fldVTemkzylTU5V8X", st: "fldNGGEcwHqIsQPct" };
const EVF = { nama: "fld0d9tIyi4nyTZsM", tgl: "fldoIkx9wLMaKOa38", kel: "fldhgv2WlvqytF6zA" };
const REC = /^rec[A-Za-z0-9]{14}$/;
/** Link absensi dibuka mulai 7 hari sebelum sampai 7 hari sesudah tanggal acara. */
export const JENDELA_HARI = 7;

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new HttpError(500, "AUTH_SECRET belum diatur di server.", "upstream_error");
  return s;
};
const mac = (id: string) => crypto.createHmac("sha256", secret()).update("absen:" + id).digest("base64url").slice(0, 22);

export function buatToken(eventId: string): string {
  if (!REC.test(eventId)) throw new HttpError(400, "Event tidak valid.");
  return eventId + "." + mac(eventId);
}
/** Mengembalikan id event bila token sah, selain itu null. */
export function bacaToken(token: string): string | null {
  const [id, sig] = String(token || "").split(".");
  if (!id || !sig || !REC.test(id)) return null;
  const a = Buffer.from(mac(id)), b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? id : null;
}

export function dalamJendela(tgl: string, now = new Date()): boolean {
  const d = Date.parse(tgl.slice(0, 10) + "T00:00:00Z");
  if (isNaN(d)) return false;
  const hari = Math.abs(Date.parse(now.toISOString().slice(0, 10) + "T00:00:00Z") - d) / 86_400_000;
  return hari <= JENDELA_HARI;
}

const esc = (s: string) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const one = (v: any) => String(Array.isArray(v) ? v[0] ?? "" : v ?? "").replace(/\s+/g, " ").trim();
const sel = (v: any) => String(typeof v === "object" && v ? v.name ?? "" : v ?? "");

/** Nomor WA ke format wa.me (62...). Kosong bila tidak masuk akal. */
export function waDigits(v: any): string {
  let d = String(Array.isArray(v) ? v[0] ?? "" : v ?? "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1); else if (d.startsWith("8")) d = "62" + d;
  return /^62\d{8,13}$/.test(d) ? d : "";
}

async function muat(token: string) {
  const id = bacaToken(token);
  if (!id) throw new HttpError(404, "Link absensi tidak valid.");
  const ev = await getRecord(BASE_BPK, T.events, id).catch(() => null);
  if (!ev) throw new HttpError(404, "Event tidak ditemukan.");
  const nama = String(ev.fields[EVF.nama] || ""), tgl = String(ev.fields[EVF.tgl] || "").slice(0, 10), kel = sel(ev.fields[EVF.kel]);
  const kep = /^KEP/i.test(kel);
  const formula = `FIND("${esc(nama)}", ARRAYJOIN({Event}))`;
  const [pd, kh, orang] = await Promise.all([
    listUntil(BASE_BPK, T.pendaftaran, { fieldIds: [PD.event, PD.umat, PD.nama, PD.pgl, PD.wa, PD.kom, PD.paroki, PD.st], want: Infinity, maxPages: 20, formula }),
    listUntil(BASE_BPK, T_HADIR, { fieldIds: [KH.event, KH.pend], want: Infinity, maxPages: 20, formula }),
    pengurusAktif().catch(() => []),
  ]);
  const hadir = new Map<string, string>(); // id pendaftaran -> id baris kehadiran
  for (const r of kh.records) {
    if (!((r.fields[KH.event] as string[]) || []).includes(id)) continue;
    for (const p of (r.fields[KH.pend] as string[]) || []) hadir.set(p, r.id);
  }
  const aktif = pd.records.filter((r) => ((r.fields[PD.event] as string[]) || []).includes(id) && !/^(batal|dobel)/i.test(sel(r.fields[PD.st])) && one(r.fields[PD.nama]));
  const namaPd = new Map<string, string>();
  const sub = aktif.map((r) => ({ id: r.id, fields: { [PD.kom]: r.fields[PD.kom] } as Record<string, any> })).filter((r) => r.fields[PD.kom]);
  if (!kep && sub.length) { try { (await resolveLinks(BASE_BPK, T.pendaftaran, sub)).forEach((r) => namaPd.set(r.id, one((r.fields[PD.kom] as any[])?.[0]?.name))); } catch {} }
  const seksiOf = new Map<string, string>(orang.map((o) => [o.umat, [...new Set(o.jab.map((j) => j.seksi).filter(Boolean))].join(", ")]));
  const peserta = aktif
    .map((r) => {
      const uid = ((r.fields[PD.umat] as string[]) || [])[0] || "";
      return { id: r.id, nama: one(r.fields[PD.nama]), pgl: one(r.fields[PD.pgl]), wa: waDigits(r.fields[PD.wa]), seksi: seksiOf.get(uid) || "", asal: kep ? one(r.fields[PD.paroki]) : namaPd.get(r.id) || "", hadir: hadir.has(r.id) };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  return { id, nama, tgl, kep, buka: dalamJendela(tgl), peserta, hadir };
}

/** Data untuk halaman absensi. Nomor WA hanya dipakai membentuk tombol; tidak ditampilkan sebagai teks. */
export async function infoAbsen(token: string) {
  const m = await muat(token);
  return { nama: m.nama.replace(/^\d{6}-/, ""), tgl: m.tgl, kep: m.kep, buka: m.buka, peserta: m.peserta };
}

/** Simpan sekumpulan perubahan kehadiran sekaligus (membuat / menghapus baris KehadiranEvent). Idempoten. */
export async function simpanHadir(token: string, perubahan: { pendaftaran: string; hadir: boolean }[]) {
  const m = await muat(token);
  if (!m.buka) throw new HttpError(403, `Absensi hanya dibuka ${JENDELA_HARI} hari sebelum sampai sesudah tanggal acara.`);
  if (!Array.isArray(perubahan) || perubahan.length > 500) throw new HttpError(400, "Data tidak valid.");
  const ids = new Set(m.peserta.map((p) => p.id));
  const tambah: string[] = [], hapus: string[] = [];
  for (const c of perubahan) {
    if (!ids.has(c?.pendaftaran)) throw new HttpError(400, "Peserta tidak terdaftar di event ini.");
    const ada = m.hadir.get(c.pendaftaran);
    if (c.hadir === true && !ada) tambah.push(c.pendaftaran);
    else if (c.hadir !== true && ada) hapus.push(ada);
  }
  for (let i = 0; i < tambah.length; i += 10)
    await at(`/v0/${BASE_BPK}/${T_HADIR}`, { method: "POST", body: JSON.stringify({ records: tambah.slice(i, i + 10).map((p) => ({ fields: { [KH.event]: [m.id], [KH.pend]: [p], [KH.status]: "Hadir" } })) }) });
  for (let i = 0; i < hapus.length; i += 10)
    await at(`/v0/${BASE_BPK}/${T_HADIR}?` + hapus.slice(i, i + 10).map((r) => "records[]=" + r).join("&"), { method: "DELETE" });
  return { ok: true, ditambah: tambah.length, dihapus: hapus.length };
}

/** Hanya akun yang disetujui dan punya menu Absensi (bukan mode Lihat sebagai) yang boleh mencatat kehadiran. */
export function bolehAbsen(acc: Pick<Access, "status" | "tabs" | "viewAs"> | null | undefined): boolean {
  return !!acc && acc.status === "Disetujui" && !acc.viewAs && acc.tabs.includes("Absensi");
}

/** Acara dalam jendela absensi (belum batal), untuk halaman daftar /absen. */
export async function acaraAbsensi(now = new Date()) {
  const { listPage } = await import("./airtable");
  const F = { st: "fldG7mLTlU3TDeXoF" };
  const { records } = await listPage(BASE_BPK, T.events, { fieldIds: [EVF.nama, EVF.tgl, F.st], pageSize: 100, formula: `ABS(DATETIME_DIFF({${EVF.tgl}}, TODAY(), 'days'))<=${JENDELA_HARI}`, sort: [{ fieldId: EVF.tgl }] });
  return records
    .map((r) => ({ id: r.id, nama: String(r.fields[EVF.nama] || "").replace(/^\d{6}-/, ""), tgl: String(r.fields[EVF.tgl] || "").slice(0, 10), st: sel(r.fields[F.st]) }))
    .filter((e) => e.nama && e.tgl && !/batal/i.test(e.st) && dalamJendela(e.tgl, now))
    .map((e) => ({ ...e, token: buatToken(e.id) }));
}
