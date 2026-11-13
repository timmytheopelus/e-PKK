// Absensi kehadiran event lewat link publik bertanda tangan (HMAC). Memakai tabel KehadiranEvent yang sudah ada.
import crypto from "node:crypto";
import { Access, BASE_BPK, HttpError, T } from "./policy";
import { at, getRecord, listUntil } from "./airtable";

export const T_HADIR = "tblQgU4DawCAXIRdi";
const KH = { event: "fldrIFO5fehaqaS2u", pend: "fldTuFsmLgiZoHXEf", status: "fldudT9j1X2vkQCqD" };
const PD = { event: "flduf15moMpZSklGL", nama: "fld9ucFxEU0cUSHWw", pd: "fldvpJTg8KbPblIBu", st: "fldNGGEcwHqIsQPct" };
const EVF = { nama: "fld0d9tIyi4nyTZsM", tgl: "fldoIkx9wLMaKOa38" };
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

async function muat(token: string) {
  const id = bacaToken(token);
  if (!id) throw new HttpError(404, "Link absensi tidak valid.");
  const ev = await getRecord(BASE_BPK, T.events, id).catch(() => null);
  if (!ev) throw new HttpError(404, "Event tidak ditemukan.");
  const nama = String(ev.fields[EVF.nama] || ""), tgl = String(ev.fields[EVF.tgl] || "").slice(0, 10);
  const formula = `FIND("${esc(nama)}", ARRAYJOIN({Event}))`;
  const [pd, kh] = await Promise.all([
    listUntil(BASE_BPK, T.pendaftaran, { fieldIds: [PD.event, PD.nama, PD.pd, PD.st], want: Infinity, maxPages: 20, formula }),
    listUntil(BASE_BPK, T_HADIR, { fieldIds: [KH.event, KH.pend], want: Infinity, maxPages: 20, formula }),
  ]);
  const hadir = new Map<string, string>(); // id pendaftaran -> id baris kehadiran
  for (const r of kh.records) {
    if (!((r.fields[KH.event] as string[]) || []).includes(id)) continue;
    for (const p of (r.fields[KH.pend] as string[]) || []) hadir.set(p, r.id);
  }
  const peserta = pd.records
    .filter((r) => ((r.fields[PD.event] as string[]) || []).includes(id) && !/^(batal|dobel)/i.test(sel(r.fields[PD.st])) && one(r.fields[PD.nama]))
    .map((r) => ({ id: r.id, nama: one(r.fields[PD.nama]), pd: one(r.fields[PD.pd]), hadir: hadir.has(r.id) }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  return { id, nama, tgl, buka: dalamJendela(tgl), peserta, hadir };
}

/** Data untuk halaman absensi: hanya nama (tanpa WA/email). */
export async function infoAbsen(token: string) {
  const m = await muat(token);
  return { nama: m.nama.replace(/^\d{6}-/, ""), tgl: m.tgl, buka: m.buka, peserta: m.peserta };
}

/** Tandai hadir (membuat baris KehadiranEvent) atau batalkan tanda (menghapus baris itu). Idempoten. */
export async function tandaiHadir(token: string, pendaftaran: string, hadir: boolean) {
  const m = await muat(token);
  if (!m.buka) throw new HttpError(403, `Absensi hanya dibuka ${JENDELA_HARI} hari sebelum sampai sesudah tanggal acara.`);
  if (!m.peserta.some((p) => p.id === pendaftaran)) throw new HttpError(400, "Peserta tidak terdaftar di event ini.");
  const ada = m.hadir.get(pendaftaran);
  if (hadir && !ada) {
    await at(`/v0/${BASE_BPK}/${T_HADIR}`, { method: "POST", body: JSON.stringify({ records: [{ fields: { [KH.event]: [m.id], [KH.pend]: [pendaftaran], [KH.status]: "Hadir" } }] }) });
  } else if (!hadir && ada) {
    await at(`/v0/${BASE_BPK}/${T_HADIR}/${ada}`, { method: "DELETE" });
  }
  return { ok: true, hadir };
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
