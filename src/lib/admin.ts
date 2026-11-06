// Pengelolaan pengguna (khusus Superadmin). Tabel "Pengguna Dashboard" tidak pernah dihapus barisnya dari sini.
import { ALL_TABS, BASE_BPK, HttpError, T } from "./policy";
import { at, listPage } from "./airtable";
import { AF, invalidateAccess } from "./access";

const LEVELS = ["View", "Edit", "Superadmin"], STATUS = ["Menunggu", "Disetujui", "Ditolak"];
const EMAIL = /^[^@\s,;"<>]+@[^@\s,;"<>]+\.[^@\s,;"<>]+$/;
const tableUrl = `/v0/${BASE_BPK}/${T.pengguna}`;

const toUser = (r: any) => ({
  id: r.id, email: r.fields[AF.email] || "", nama: r.fields[AF.nama] || "", status: r.fields[AF.status] || "Menunggu",
  level: r.fields[AF.level] || "View", tabs: r.fields[AF.tabs] || [], jabatan: r.fields[AF.jabatan] || "", login: r.fields[AF.login] || "",
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

export async function adminCall(action: string, i: any, selfEmail: string) {
  if (action === "list") return { users: await all() };
  if (action === "create") {
    const email = String(i?.email || "").trim().toLowerCase();
    if (!EMAIL.test(email)) throw new HttpError(400, "Email tidak valid.");
    if ((await all()).some((u) => String(u.email).toLowerCase() === email)) throw new HttpError(400, "Email ini sudah terdaftar.");
    const fields = { ...clean({ status: "Disetujui", ...i }, false), [AF.email]: email };
    const j = await at(tableUrl, { method: "POST", body: JSON.stringify({ records: [{ fields }] }) });
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
    const j = await at(tableUrl, { method: "PATCH", body: JSON.stringify({ records: [{ id, fields }] }) });
    invalidateAccess(); console.log("ADMIN update", selfEmail, cur.email, Object.keys(fields).join(","));
    return { user: toUser(j.records[0]) };
  }
  throw new HttpError(400, "Perintah tidak dikenal.");
}
