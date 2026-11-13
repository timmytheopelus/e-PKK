// Riwayat perubahan event (nama, tanggal, jam, lokasi, status) untuk Overall View. Kegagalan log tidak boleh menggagalkan update.
import { BASE_BPK } from "./policy";
import { at } from "./airtable";

export const T_RIWAYAT = "tbl61LZu0kBVjKQzc";
const RW = { ringkasan: "fldm4T3vYT65EW3hs", event: "flducSfpZxQktRWID", nama: "fldOsrCeeOrlJbs4O", field: "fldV1Z69OgVXYmkbQ", lama: "flddwgQRmwtIMW79l", baru: "fldPW6sNUmkhASq8F", oleh: "fld1ZEkxFexR1hpzV", waktu: "fld62n0vhBtmEwXyR" };
/** Field Event BPK yang dipantau dan labelnya. */
export const WATCH_LABEL: Record<string, string> = {
  fld0d9tIyi4nyTZsM: "Nama", fldoIkx9wLMaKOa38: "Tanggal", fldMO46zH4SDzIypy: "Jam mulai", fld4i5iQ6zTY8UTSm: "Jam selesai", fldY0qw1v0a4fK9Sp: "Lokasi", fldG7mLTlU3TDeXoF: "Status", fldvJxqvazI3GQGha: "Buka registrasi", fldI1RKkKVaua8DH0: "Tutup registrasi",
};
export const WATCH = Object.keys(WATCH_LABEL);

const norm = (v: unknown): string => {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(norm).join(", ");
  if (typeof v === "object") return norm((v as any).name ?? "");
  const s = String(v).trim();
  if (/^\d{4}-\d\d-\d\dT/.test(s)) { const d = new Date(s); if (!isNaN(+d)) return d.toISOString(); }
  return s;
};

/** Bandingkan hanya field di `watch` yang ada pada `after` (field yang tidak dikirim dianggap tidak berubah). */
export function diffEvent(before: Record<string, unknown>, after: Record<string, unknown>, watch: string[]) {
  const out: { field: string; lama: string; baru: string }[] = [];
  for (const f of watch) {
    if (!(f in after)) continue;
    const a = norm(before[f]), b = norm(after[f]);
    if (a !== b) out.push({ field: f, lama: a, baru: b });
  }
  return out;
}

export async function logEventChange(eventId: string, by: string, changes: ReturnType<typeof diffEvent>, nama = ""): Promise<void> {
  if (!changes.length) return;
  try {
    const waktu = new Date().toISOString();
    const records = changes.map((c) => {
      const label = WATCH_LABEL[c.field] || c.field;
      return { fields: { [RW.ringkasan]: (nama || eventId) + ": " + label, [RW.event]: eventId, [RW.nama]: nama, [RW.field]: label, [RW.lama]: c.lama, [RW.baru]: c.baru, [RW.oleh]: by, [RW.waktu]: waktu } };
    });
    for (let i = 0; i < records.length; i += 10) await at(`/v0/${BASE_BPK}/${T_RIWAYAT}`, { method: "POST", body: JSON.stringify({ records: records.slice(i, i + 10) }) }, 1);
  } catch (e) {
    console.error("riwayat event gagal ditulis", e);
  }
}
