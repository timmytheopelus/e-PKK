// Notifikasi lonceng (tabel Notifikasi di base BPK). Task 4 menambah daftar/tandai-dibaca.
import { BASE_BPK } from "./policy";
import { at } from "./airtable";
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
