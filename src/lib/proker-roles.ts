// Peran Program Kerja dibaca dari jabatan Pengurus (periode 2026) akun yang login.
import { Access, BASE_BPK, T } from "./policy";
import { listUntil } from "./airtable";
import { AF } from "./access";
import { canApprove } from "./approval";

export type Peran = { koordBidang: string[]; koordSeksi: string[]; sekjen: boolean; bendahara: boolean; pimpinan: boolean };
export type JabRow = { bidang: string; seksi: string; peran: string };

const JAB = { bidang: "fldCCi0hV9yTL091P", seksi: "fldAAyRg1kko5YgrK", peran: "fldI8J3VXZDyjWa3f" };
const PGR = { umat: "fldHK8r2o5q60IDXW", jabatan: "fldwW6zQoxhbTWLDv", periode: "fldHngi5Klnm5bUmM" };

const sel = (v: any) => String(typeof v === "object" && v ? v.name ?? "" : v ?? "").trim();
const uniq = (a: string[]) => [...new Set(a)];

/** Turunkan peran dari baris jabatan master. Ketua seksi "Pimpinan <Bidang>" = Koordinator Bidang; Ketua seksi lain = Koordinator Seksi. */
export function peranFromRows(rows: JabRow[], sekjen: boolean): Peran {
  const koordBidang: string[] = [], koordSeksi: string[] = [];
  let pimpinan = false, bendahara = false;
  for (const r of rows) {
    if (r.peran === "Pimpinan" || r.peran === "Penasihat") pimpinan = true;
    if (/bendahara/i.test(r.seksi)) bendahara = true;
    if (r.peran !== "Ketua") continue;
    if (/^pimpinan\s+/i.test(r.seksi)) koordBidang.push(r.bidang);
    else koordSeksi.push(r.seksi);
  }
  return { koordBidang: uniq(koordBidang), koordSeksi: uniq(koordSeksi), sekjen, bendahara, pimpinan };
}

const cache = new Map<string, { at: number; v: Promise<Peran> }>();

/** Peran akun, cache 5 menit. Superadmin/Sekjen: sekjen=true. */
export function peranOf(acc: Pick<Access, "email" | "level" | "jabatan">): Promise<Peran> {
  const key = (acc.email || "").trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 300_000) return hit.v;
  const v = (async () => {
    const sekjen = canApprove(acc);
    const us = await listUntil(BASE_BPK, T.pengguna, { fieldIds: [AF.email, AF.umat], want: Infinity, maxPages: 10 });
    const me = us.records.find((r) => String(r.fields[AF.email] || "").trim().toLowerCase() === key);
    const umat = new Set<string>(((me?.fields[AF.umat] as any[]) || []).map((u) => (typeof u === "string" ? u : u?.id)));
    if (!umat.size) return peranFromRows([], sekjen);
    const jab = await listUntil(BASE_BPK, T.jabatan, { fieldIds: [JAB.bidang, JAB.seksi, JAB.peran], want: Infinity, maxPages: 10 });
    const master = new Map<string, JabRow>(jab.records.map((r) => [r.id, { bidang: sel(r.fields[JAB.bidang]), seksi: sel(r.fields[JAB.seksi]), peran: sel(r.fields[JAB.peran]) }]));
    const pg = await listUntil(BASE_BPK, T.pengurus, { fieldIds: [PGR.umat, PGR.jabatan, PGR.periode], want: Infinity, maxPages: 30 });
    const rows: JabRow[] = [];
    for (const r of pg.records) {
      const ptxt = sel(r.fields[PGR.periode]);
      if (ptxt && !ptxt.includes("2026")) continue;
      const us2: any[] = r.fields[PGR.umat] || [];
      if (!us2.some((u) => umat.has(typeof u === "string" ? u : u?.id))) continue;
      for (const j of (r.fields[PGR.jabatan] as any[]) || []) {
        const m = master.get(typeof j === "string" ? j : j?.id);
        if (m) rows.push(m);
      }
    }
    return peranFromRows(rows, sekjen);
  })();
  cache.set(key, { at: Date.now(), v });
  v.catch(() => cache.delete(key));
  return v;
}
export function clearPeranCache() { cache.clear(); }
