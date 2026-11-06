// Daftar pengguna yang disetujui, disimpan di tabel "Pengguna Dashboard" (Airtable).
import { Access, ALL_TABS, BASE_BPK, T } from "./policy";
import { at, listPage } from "./airtable";

export const AF = { email: "fldXCAPjc4bPkTbSq", nama: "fldR7uM68NdmjWJdK", status: "fldRiPREBGEFPsyjW", level: "fldvlRQXDZJdIIcw8", tabs: "fldgMD37Bgpg1ZdW6", jabatan: "fldKD8CpWcra5yaTR", login: "fldhehrsHwvACGhiu" };

const cache = new Map<string, { at: number; v: Access | null; id?: string }>();
const norm = (e: string) => e.trim().toLowerCase();
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

async function fetchUser(email: string) {
  const { records } = await listPage(BASE_BPK, T.pengguna, {
    fieldIds: Object.values(AF), pageSize: 5,
    formula: `LOWER({Email})="${esc(norm(email))}"`,
  });
  const r = records[0];
  if (!r) return { v: null as Access | null };
  const f = r.fields;
  const tabs = ((f[AF.tabs] as string[]) || []).filter((t) => ALL_TABS.includes(t));
  return { id: r.id, v: { email: norm(email), nama: f[AF.nama] || "", status: f[AF.status] || "Menunggu", level: f[AF.level] || "View", tabs } as Access };
}

/** Akses pengguna (cache 30 detik, jadi pencabutan hak berlaku cepat). */
export async function getAccess(email: string): Promise<Access | null> {
  const k = norm(email), c = cache.get(k);
  if (c && Date.now() - c.at < 30_000) return c.v;
  const { v, id } = await fetchUser(k);
  cache.set(k, { at: Date.now(), v, id });
  return v;
}

/** Dipanggil saat login Google: catat login, atau buat baris "Menunggu" untuk email baru. */
export async function registerLogin(email: string, name: string) {
  const { id, v } = await fetchUser(email);
  const now = new Date().toISOString();
  if (!id) {
    await at(`/v0/${BASE_BPK}/${T.pengguna}`, { method: "POST", body: JSON.stringify({ records: [{ fields: { [AF.email]: norm(email), [AF.nama]: name || "", [AF.status]: "Menunggu", [AF.level]: "View", [AF.login]: now } }] }) });
  } else {
    await at(`/v0/${BASE_BPK}/${T.pengguna}`, { method: "PATCH", body: JSON.stringify({ records: [{ id, fields: { [AF.login]: now, ...(v && !v.nama && name ? { [AF.nama]: name } : {}) } }] }) });
  }
  cache.delete(norm(email));
}
