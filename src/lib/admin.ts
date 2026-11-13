// Pengelolaan pengguna (khusus Superadmin). Tabel "Pengguna Dashboard" tidak pernah dihapus barisnya dari sini.
import { ALL_TABS, BASE_BPK, HttpError, T } from "./policy";
import { at, listPage, listUntil, resolveLinks } from "./airtable";
import { AF, invalidateAccess, jabatanOf } from "./access";
import { appUrl } from "./mail";
import { welcomeWa } from "./mail-template";
import { waDigits } from "./absen";

export type Actor = { level: string; tabs: string[] };
const SUPER: Actor = { level: "Superadmin", tabs: ALL_TABS };
const UF = { nama: "fldIpQTSkFB9sU0lo", pgl: "fld469PYR80nAUNIF", email: "fldAaQ3zmiLBhp4z9", wa: "fldzY1Z2QvIIEkYXR", pd: "fldrHJ6q3HZvApccl", jab: "fldT3yUTrEgCuOwbm" };

const LEVELS = ["View", "Edit", "Admin", "Superadmin"], STATUS = ["Menunggu", "Disetujui", "Ditolak"];
const EMAIL = /^[^@\s,;"<>]+@[^@\s,;"<>]+\.[^@\s,;"<>]+$/;
const tableUrl = `/v0/${BASE_BPK}/${T.pengguna}`;

const toUser = (r: any) => ({
  id: r.id, email: r.fields[AF.email] || "", nama: r.fields[AF.nama] || "", status: r.fields[AF.status] || "Menunggu",
  level: r.fields[AF.level] || "View", tabs: r.fields[AF.tabs] || [], jabatan: jabatanOf(r.fields), login: r.fields[AF.login] || "",
});

async function all() {
  const out: any[] = []; let offset: string | undefined;
  do {
    const pg = await listPage(BASE_BPK, T.pengguna, { fieldIds: Object.values(AF), pageSize: 100, offset });
    out.push(...pg.records.map(toUser)); offset = pg.offset;
  } while (offset);
  return out;
}

function clean(i: any, partial: boolean) {
  const f: Record<string, any> = {};
  const str = (v: any, max: number) => String(v ?? "").trim().slice(0, max);
  if (!partial || i.nama !== undefined) f[AF.nama] = str(i.nama, 120);
  if (!partial || i.jabatan !== undefined) f[AF.jabatan] = str(i.jabatan, 120);
  if (!partial || i.level !== undefined) { if (!LEVELS.includes(i.level)) throw new HttpError(400, "Level tidak valid."); f[AF.level] = i.level; }
  if (!partial || i.status !== undefined) { if (!STATUS.includes(i.status)) throw new HttpError(400, "Status tidak valid."); f[AF.status] = i.status; }
  if (!partial || i.tabs !== undefined) {
    if (!Array.isArray(i.tabs) || !i.tabs.every((t: any) => ALL_TABS.includes(t))) throw new HttpError(400, "Tab tidak valid.");
    f[AF.tabs] = [...new Set(i.tabs)];
  }
  return f;
}

const maskEmail = (e: string) => { const [a, d] = e.split("@"); return a.slice(0, 2) + "***@" + d; };
let umatCache: { at: number; v: any[] } | null = null;
async function umatList() {
  if (umatCache && Date.now() - umatCache.at < 120_000) return umatCache.v;
  const r = await listUntil(BASE_BPK, T.umat, { fieldIds: Object.values(UF), want: Infinity, maxPages: 200 });
  const recs = await resolveLinks(BASE_BPK, T.umat, r.records);
  const v = recs.map((x) => {
    const f = x.fields, em = String(f[UF.email] || "").trim().toLowerCase();
    const jab = f[UF.jab]; 
    return { id: x.id, nama: String(f[UF.nama] || "").replace(/\s+/g, " ").trim(), pgl: String(f[UF.pgl] || "").trim(), pd: (Array.isArray(f[UF.pd]) ? f[UF.pd] : []).map((p: any) => String(p.name || "").replace(/\s+/g, " ").trim()).filter(Boolean).join(", "),
      jab: (Array.isArray(jab) ? jab.join(", ") : String(jab || "")).trim(), email: em, wa: waDigits(f[UF.wa]) };
  }).filter((u) => u.nama);
  umatCache = { at: Date.now(), v };
  return v;
}

const mustSuper = (a: Actor) => { if (a.level !== "Superadmin") throw new HttpError(403, "Khusus Superadmin."); };

export async function adminCall(action: string, i: any, selfEmail: string, actor: Actor = SUPER) {
  if (action === "umat") {
    const users = await all();
    const used = new Set(users.map((u) => String(u.email).toLowerCase()));
    const qq = String(i?.q || "").trim().toLowerCase();
    if (qq) return { hits: qq.length < 3 ? [] : (await umatList()).filter((u) => u.email && u.email.includes(qq)).map((u) => u.id) };
    return { umat: (await umatList()).map((u) => ({ id: u.id, nama: u.nama, pgl: u.pgl, pd: u.pd, jab: u.jab, hasEmail: !!u.email, mail: u.email ? maskEmail(u.email) : "", terdaftar: !!u.email && used.has(u.email) })) };
  }
  if (action === "add") {
    const um = (await umatList()).find((u) => u.id === String(i?.umatId || ""));
    if (!um) throw new HttpError(400, "Umat tidak ditemukan.");
    const level = String(i?.level || "");
    if (actor.level === "Admin" ? level !== "View" : !["View", "Edit"].includes(level)) throw new HttpError(403, actor.level === "Admin" ? "Admin hanya boleh memberi hak View." : "Level harus View atau Edit.");
    const tabs: string[] = Array.isArray(i?.tabs) ? i.tabs : [];
    if (!tabs.length || !tabs.every((t) => ALL_TABS.includes(t))) throw new HttpError(400, "Pilih minimal satu menu yang valid.");
    if (actor.level !== "Superadmin" && !tabs.every((t) => actor.tabs.includes(t))) throw new HttpError(403, "Anda hanya bisa memberi menu yang Anda miliki.");
    const email = String(i?.email || um.email || "").trim().toLowerCase();
    if (!EMAIL.test(email)) throw new HttpError(400, "Email tidak valid. Isi email Google pengguna ini.");
    const cur = await all();
    if (cur.some((u) => String(u.email).toLowerCase() === email)) throw new HttpError(400, "Email ini sudah terdaftar sebagai pengguna.");
    const fields = { [AF.email]: email, [AF.nama]: um.nama, [AF.status]: "Disetujui", [AF.level]: level, [AF.tabs]: [...new Set(tabs)], [AF.umat]: [um.id] };
    const j = await at(tableUrl, { method: "POST", body: JSON.stringify({ records: [{ fields }], typecast: true }) });
    if (um.email !== email) { await at(`/v0/${BASE_BPK}/${T.umat}`, { method: "PATCH", body: JSON.stringify({ records: [{ id: um.id, fields: { [UF.email]: email } }] }) }); umatCache = null; }
    invalidateAccess(); console.log("ADMIN add", selfEmail, email, level, tabs.join(","));
    // Sambutan dikirim lewat WhatsApp oleh admin sendiri (tombol di layar); nomor hanya dipakai untuk tautan wa.me.
    const pesan = welcomeWa({ nama: um.nama, email, level, tabs, url: appUrl() || "https://e-pkk-one.vercel.app" });
    return { user: toUser(j.records[0]), wa: um.wa || "", pesan };
  }
  mustSuper(actor);
  if (action === "list") return { users: await all() };
  if (action === "create") {
    const email = String(i?.email || "").trim().toLowerCase();
    if (!EMAIL.test(email)) throw new HttpError(400, "Email tidak valid.");
    if ((await all()).some((u) => String(u.email).toLowerCase() === email)) throw new HttpError(400, "Email ini sudah terdaftar.");
    const fields = { ...clean({ status: "Disetujui", ...i }, false), [AF.email]: email };
    const j = await at(tableUrl, { method: "POST", body: JSON.stringify({ records: [{ fields }], typecast: true }) });
    invalidateAccess(); console.log("ADMIN create", selfEmail, email);
    return { user: toUser(j.records[0]) };
  }
  if (action === "update") {
    const id = String(i?.id || "");
    if (!/^rec[A-Za-z0-9]{14}$/.test(id)) throw new HttpError(400, "id tidak valid.");
    const cur = (await all()).find((u) => u.id === id);
    if (!cur) throw new HttpError(404, "Pengguna tidak ditemukan.");
    const fields = clean(i, true);
    if (String(cur.email).toLowerCase() === selfEmail && ((fields[AF.level] && fields[AF.level] !== "Superadmin") || (fields[AF.status] && fields[AF.status] !== "Disetujui")))
      throw new HttpError(400, "Anda tidak bisa menurunkan atau menonaktifkan akun Anda sendiri.");
    const j = await at(tableUrl, { method: "PATCH", body: JSON.stringify({ records: [{ id, fields }], typecast: true }) });
    invalidateAccess(); console.log("ADMIN update", selfEmail, cur.email, Object.keys(fields).join(","));
    return { user: toUser(j.records[0]) };
  }
  throw new HttpError(400, "Perintah tidak dikenal.");
}
