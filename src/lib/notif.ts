// Notifikasi lonceng (tabel Notifikasi di base BPK). Task 4 menambah daftar/tandai-dibaca.
import { BASE_BPK, HttpError } from "./policy";
import { at, listPage } from "./airtable";
import { T_NOTIF, NT } from "./proker-schema";

/** Buat notifikasi untuk tiap penerima. Tidak pernah melempar: kegagalan hanya dicatat. */
export async function buatNotif(penerima: string[], pesan: string, tautan: string): Promise<void> {
  try {
    const uniq = [...new Set(penerima.map((e) => (e || "").trim().toLowerCase()).filter(Boolean))];
    const now = new Date().toISOString();
    for (let i = 0; i < uniq.length; i += 10) {
      await at(`/v0/${BASE_BPK}/${T_NOTIF}`, {
        method: "POST",
        body: JSON.stringify({ records: uniq.slice(i, i + 10).map((e) => ({ fields: { [NT.pesan]: pesan.slice(0, 300), [NT.penerima]: e, [NT.tautan]: tautan, [NT.waktu]: now } })) }),
      });
    }
  } catch (e) { console.error("buatNotif", e); }
}

const REC = /^rec[A-Za-z0-9]{14}$/;
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const mine = (acc: { email: string }) => (acc.email || "").trim().toLowerCase();

export type Notif = { id: string; pesan: string; tautan: string; dibaca: boolean; waktu: string };

/** 30 notifikasi terbaru milik akun (tidak pernah milik orang lain). */
export async function daftarNotif(acc: { email: string }): Promise<Notif[]> {
  const me = mine(acc);
  const { records } = await listPage(BASE_BPK, T_NOTIF, {
    fieldIds: Object.values(NT), pageSize: 30, formula: `LOWER({Penerima})="${esc(me)}"`, sort: [{ fieldId: NT.waktu, direction: "desc" }],
  });
  return records.filter((r) => String(r.fields[NT.penerima] || "").trim().toLowerCase() === me).map((r) => ({
    id: r.id, pesan: String(r.fields[NT.pesan] || ""), tautan: String(r.fields[NT.tautan] || ""), dibaca: !!r.fields[NT.dibaca], waktu: String(r.fields[NT.waktu] || ""),
  }));
}

/** Tandai dibaca. Semua id harus milik akun; bila tidak, 403 dan tidak ada yang diubah. */
export async function tandaiDibaca(acc: { email: string }, ids: string[]): Promise<void> {
  if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some((i) => !REC.test(String(i)))) throw new HttpError(400, "id notifikasi tidak valid.");
  const milik = new Set((await daftarNotif(acc)).map((n) => n.id));
  if (ids.some((i) => !milik.has(i))) throw new HttpError(403, "Notifikasi bukan milik Anda.");
  for (let i = 0; i < ids.length; i += 10) {
    await at(`/v0/${BASE_BPK}/${T_NOTIF}`, { method: "PATCH", body: JSON.stringify({ records: ids.slice(i, i + 10).map((id) => ({ id, fields: { [NT.dibaca]: true } })) }) });
  }
}
