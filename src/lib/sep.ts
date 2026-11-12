// Kegiatan SEP/KEP: buat kegiatan, pendaftaran publik, Excel, approval peserta, status selesai.
import crypto from "node:crypto";
import * as XLSX from "xlsx";
import { Access, BASE_BPK, HttpError, T } from "./policy";
import { at, listPage } from "./airtable";
import { clearProxyCache } from "./proxy";

const TK = { judul: "fldYqmy7odEnwqbrh", event: "fldxM5KAH4txJsC4s", paroki: "fldfHUZK6u2zkI7Yu", token: "flddxcs0pEaEZlXL1", status: "fldidtKcy6zhf1owX", oleh: "fldfMsKP2X4j6WGXM", selesaiOleh: "fld83uibtfzWzpN0G" };
const PS = { nama: "fld4aXu6UhTUyu2a8", keg: "fldJjgxA4mESGeOYG", lahir: "fldVwYghE0cSodecK", alamat: "fldBap2tEPX9R4LtD", paroki: "fldTj9n5kTQiquymW", jk: "fldU3sCQfDmubXeBZ", email: "fld99riZwzntgnERq", wa: "fldZIpZfjPf5JDkuo", status: "fld4dVr7hIV4xqAg7", sumber: "fldnQxpE9QVt0o9JH", oleh: "fldA6WcgCfLVd9Y5O" };
const EV = { nama: "fld0d9tIyi4nyTZsM", tgl: "fldoIkx9wLMaKOa38", kel: "fldhgv2WlvqytF6zA", lokasi: "fldY0qw1v0a4fK9Sp", jenis: "fldrYLgd8LCDjwmLZ" };
const REC = /^rec[A-Za-z0-9]{14}$/;
const EMAIL = /^[^@\s,;"<>]+@[^@\s,;"<>]+\.[^@\s,;"<>]+$/;

export type Peran = "tim" | "pic" | "view";
export const peranOf = (a: Access): Peran => (a.level === "Superadmin" || a.sepPeran === "Tim SEP BPK" ? "tim" : a.sepPeran === "PIC SEP Paroki" ? "pic" : "view");

function mustWrite(a: Access): Peran {
  if (a.viewAs) throw new HttpError(403, "Mode Lihat sebagai hanya pratinjau.");
  if (!a.tabs.includes("KEP")) throw new HttpError(403, "Tidak punya akses menu KEP.");
  const p = peranOf(a);
  if (p === "view") throw new HttpError(403, "Peran Anda hanya boleh melihat. Hubungi Tim SEP BPK.");
  return p;
}

async function getKeg(id: string) {
  if (!REC.test(id)) throw new HttpError(400, "Kegiatan tidak valid.");
  const j = await at(`/v0/${BASE_BPK}/${T.sepKegiatan}/${id}?returnFieldsByFieldId=true`);
  return j as { id: string; fields: Record<string, any> };
}
function scope(a: Access, p: Peran, keg: { fields: Record<string, any> }) {
  if (p === "tim") return;
  const ids: string[] = keg.fields[TK.paroki] || [];
  if (!ids.some((x) => (a.sepParoki || []).includes(x))) throw new HttpError(403, "Kegiatan ini bukan milik paroki Anda.");
}

const clean = (v: any, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
function normWa(v: any) { let d = String(v ?? "").replace(/[^\d+]/g, "").replace(/^\+/, ""); if (d.startsWith("0")) d = "62" + d.slice(1); return d; }
function isoDate(v: any): string {
  if (v instanceof Date && !isNaN(+v)) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (!m) { const n = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s); if (n) m = [s, n[3], n[2], n[1]] as any; }
  if (!m) return "";
  const y = +m[1], mo = +m[2], d = +m[3], dt = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1900 || dt.getUTCMonth() !== mo - 1 || dt > new Date()) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
/** Validasi satu pendaftar; kembalikan fields Airtable atau pesan kesalahan. */
export function validatePendaftar(r: any): { fields?: Record<string, any>; error?: string } {
  const nama = clean(r.nama, 120), lahir = isoDate(r.lahir), alamat = clean(r.alamat, 300), paroki = clean(r.paroki, 100);
  const jk = /^p(ria|\b)|^l/i.test(String(r.jk || "")) ? "Pria" : /^w|^p(erempuan)?$/i.test(String(r.jk || "")) ? "Wanita" : "";
  const email = clean(r.email, 120).toLowerCase(), wa = normWa(r.wa);
  if (nama.length < 2) return { error: "Nama wajib diisi." };
  if (!lahir) return { error: "Tanggal lahir tidak valid (format YYYY-MM-DD)." };
  if (!alamat) return { error: "Alamat wajib diisi." };
  if (!paroki) return { error: "Paroki domisili wajib diisi." };
  if (!jk) return { error: "Jenis kelamin harus Pria atau Wanita." };
  if (!EMAIL.test(email)) return { error: "Email tidak valid." };
  if (wa.length < 8 || wa.length > 15) return { error: "Nomor WhatsApp tidak valid." };
  return { fields: { [PS.nama]: nama, [PS.lahir]: lahir, [PS.alamat]: alamat, [PS.paroki]: paroki, [PS.jk]: jk, [PS.email]: email, [PS.wa]: wa } };
}

async function createPendaftar(kegId: string, rows: Record<string, any>[], sumber: "Form" | "Excel") {
  for (let i = 0; i < rows.length; i += 10) {
    const chunk = rows.slice(i, i + 10).map((f) => ({ fields: { ...f, [PS.keg]: [kegId], [PS.status]: "Menunggu", [PS.sumber]: sumber } }));
    await at(`/v0/${BASE_BPK}/${T.pendaftarSep}`, { method: "POST", body: JSON.stringify({ records: chunk, typecast: false }) });
  }
  clearProxyCache();
}

export async function sepCall(action: string, i: any, a: Access) {
  const p = mustWrite(a);
  if (action === "create") {
    const nama = clean(i?.nama, 120), jenis = i?.jenis === "KEP Exe" ? "KEP Exe" : "KEP", lokasi = clean(i?.lokasi, 200), tgl = isoDate(i?.tgl);
    if (nama.length < 3) throw new HttpError(400, "Nama kegiatan wajib diisi.");
    if (!tgl) throw new HttpError(400, "Tanggal mulai tidak valid.");
    let paroki: string[] = [];
    if (jenis === "KEP") {
      const pid = String(i?.parokiId || ""); if (!REC.test(pid)) throw new HttpError(400, "Pilih paroki penyelenggara.");
      if (p === "pic" && !(a.sepParoki || []).includes(pid)) throw new HttpError(403, "Anda hanya boleh membuat KEP untuk paroki Anda.");
      paroki = [pid];
    } else if (p === "pic") throw new HttpError(403, "KEP non paroki hanya oleh Tim SEP BPK.");
    const pref = tgl.slice(2, 4) + tgl.slice(5, 7) + tgl.slice(8, 10) + "-";
    const ev = await at(`/v0/${BASE_BPK}/${T.events}`, { method: "POST", body: JSON.stringify({ typecast: true, records: [{ fields: { [EV.nama]: pref + nama, [EV.tgl]: tgl, [EV.kel]: jenis, [EV.jenis]: "Non Rutin", ...(lokasi ? { [EV.lokasi]: lokasi } : {}) } }] }) });
    const token = crypto.randomBytes(9).toString("base64url");
    const kg = await at(`/v0/${BASE_BPK}/${T.sepKegiatan}`, { method: "POST", body: JSON.stringify({ records: [{ fields: { [TK.judul]: nama, [TK.event]: [ev.records[0].id], ...(paroki.length ? { [TK.paroki]: paroki } : {}), [TK.token]: token, [TK.status]: "Berjalan", [TK.oleh]: a.email } }] }) });
    clearProxyCache();
    console.log(JSON.stringify({ audit: "sep.create", who: a.email, kegiatan: kg.records[0].id }));
    return { id: kg.records[0].id, eventId: ev.records[0].id, token };
  }
  if (action === "finish") {
    if (p !== "tim") throw new HttpError(403, "Hanya Tim SEP BPK yang boleh menyelesaikan kegiatan.");
    const k = await getKeg(String(i?.id));
    const st = k.fields[TK.status]; if (st === "Selesai") throw new HttpError(400, "Kegiatan sudah selesai dan tidak bisa diubah lagi.");
    await at(`/v0/${BASE_BPK}/${T.sepKegiatan}`, { method: "PATCH", body: JSON.stringify({ records: [{ id: k.id, fields: { [TK.status]: "Selesai", [TK.selesaiOleh]: a.email } }] }) });
    clearProxyCache(); console.log(JSON.stringify({ audit: "sep.finish", who: a.email, kegiatan: k.id }));
    return { ok: true };
  }
  if (action === "decide") {
    const ids: string[] = Array.isArray(i?.ids) ? i.ids : [], dec = i?.decision === "Ditolak" ? "Ditolak" : i?.decision === "Disetujui" ? "Disetujui" : "";
    if (!dec || !ids.length || ids.length > 100 || !ids.every((x) => REC.test(x))) throw new HttpError(400, "Pilihan tidak valid.");
    for (const id of ids) {
      const r = await at(`/v0/${BASE_BPK}/${T.pendaftarSep}/${id}?returnFieldsByFieldId=true`);
      const kid = (r.fields[PS.keg] || [])[0]; if (!kid) throw new HttpError(400, "Pendaftar tanpa kegiatan.");
      scope(a, p, await getKeg(kid));
      if (r.fields[PS.status] && r.fields[PS.status] !== "Menunggu") throw new HttpError(400, "Sebagian pendaftar sudah diputuskan.");
    }
    for (let k = 0; k < ids.length; k += 10) await at(`/v0/${BASE_BPK}/${T.pendaftarSep}`, { method: "PATCH", body: JSON.stringify({ records: ids.slice(k, k + 10).map((id) => ({ id, fields: { [PS.status]: dec, [PS.oleh]: a.email } })) }) });
    clearProxyCache(); console.log(JSON.stringify({ audit: "sep.decide", who: a.email, dec, n: ids.length }));
    return { ok: true, n: ids.length };
  }
  if (action === "import") {
    const k = await getKeg(String(i?.kegiatanId)); scope(a, p, k);
    if (k.fields[TK.status] === "Selesai") throw new HttpError(400, "Kegiatan sudah selesai.");
    const buf = Buffer.from(String(i?.b64 || ""), "base64");
    if (!buf.length || buf.length > 3_000_000) throw new HttpError(400, "File kosong atau terlalu besar (maks 3 MB).");
    let rows: any[][];
    try { const wb = XLSX.read(buf, { type: "buffer", cellDates: true }); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" }) as any[][]; } catch { throw new HttpError(400, "File Excel tidak bisa dibaca. Pakai template dari sistem."); }
    const head = (rows[0] || []).map((h) => String(h).toLowerCase());
    const col = (re: RegExp) => head.findIndex((h) => re.test(h));
    const C = { nama: col(/nama/), lahir: col(/lahir/), alamat: col(/alamat/), paroki: col(/paroki/), jk: col(/kelamin/), email: col(/email/), wa: col(/whatsapp|wa\b/) };
    if (Object.values(C).some((x) => x < 0)) throw new HttpError(400, "Kolom tidak lengkap. Pakai template dari sistem.");
    const ok: Record<string, any>[] = [], errors: { baris: number; pesan: string }[] = [];
    rows.slice(1, 501).forEach((r, n) => {
      if (r.every((c) => String(c).trim() === "")) return;
      const v = validatePendaftar({ nama: r[C.nama], lahir: r[C.lahir], alamat: r[C.alamat], paroki: r[C.paroki], jk: r[C.jk], email: r[C.email], wa: r[C.wa] });
      if (v.fields) ok.push(v.fields); else errors.push({ baris: n + 2, pesan: v.error! });
    });
    if (ok.length) await createPendaftar(k.id, ok, "Excel");
    console.log(JSON.stringify({ audit: "sep.import", who: a.email, kegiatan: k.id, ok: ok.length, gagal: errors.length }));
    return { masuk: ok.length, errors: errors.slice(0, 30), totalError: errors.length };
  }
  throw new HttpError(400, "Perintah tidak dikenal.");
}

export function templateXlsx(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([["Nama Lengkap", "Tanggal Lahir (YYYY-MM-DD)", "Alamat", "Paroki Domisili di Bandung", "Jenis Kelamin (Pria/Wanita)", "Email", "No WhatsApp"], ["Contoh: Maria Susanti", "1985-04-23", "Jl. Contoh No. 1, Bandung", "Paroki Cicadas", "Wanita", "maria@contoh.com", "081234567890"]]);
  ws["!cols"] = [{ wch: 26 }, { wch: 26 }, { wch: 34 }, { wch: 26 }, { wch: 26 }, { wch: 26 }, { wch: 18 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Peserta");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// ---- Publik (tanpa login) ----
export async function kegByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(token)) return null;
  const { records } = await listPage(BASE_BPK, T.sepKegiatan, { fieldIds: [TK.judul, TK.status, TK.token], pageSize: 1, formula: `{Token}="${token}"` });
  const r = records[0]; if (!r || r.fields[TK.token] !== token) return null;
  return { id: r.id, judul: String(r.fields[TK.judul] || ""), selesai: r.fields[TK.status] === "Selesai" };
}
const hits = new Map<string, number[]>();
export function rateOk(ip: string) {
  const now = Date.now(), l = (hits.get(ip) || []).filter((t) => now - t < 3_600_000);
  if (l.length >= 20) { hits.set(ip, l); return false; } l.push(now); hits.set(ip, l); return true;
}
export async function submitPublic(token: string, body: any, ip: string) {
  if (body?.website) return { ok: true }; // honeypot
  if (!rateOk(ip)) throw new HttpError(429, "Terlalu banyak percobaan. Coba lagi nanti.");
  const k = await kegByToken(token); if (!k) throw new HttpError(404, "Link pendaftaran tidak valid.");
  if (k.selesai) throw new HttpError(400, "Pendaftaran untuk kegiatan ini sudah ditutup.");
  const v = validatePendaftar(body); if (!v.fields) throw new HttpError(400, v.error!);
  await createPendaftar(k.id, [v.fields], "Form");
  return { ok: true };
}
