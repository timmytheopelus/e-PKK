// Klien Airtable REST (server saja). Token tidak pernah dikirim ke browser.
import { HttpError } from "./policy";

const API = "https://api.airtable.com";
export type Rec = { id: string; createdTime?: string; fields: Record<string, any> };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function at(path: string, init: RequestInit = {}, tries = 4): Promise<any> {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new HttpError(500, "AIRTABLE_TOKEN belum diatur di server.", "upstream_error");
  for (let i = 0; i < tries; i++) {
    const r = await fetch(API + path, {
      ...init,
      cache: "no-store",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(init.headers as any) },
    });
    if (r.status === 429 && i < tries - 1) { await sleep(1200 * (i + 1)); continue; }
    if (!r.ok) {
      const txt = await r.text();
      let msg = txt.slice(0, 300);
      try { const j = JSON.parse(txt); msg = j?.error?.message || j?.error?.type || msg; } catch {}
      throw new HttpError(r.status >= 500 || r.status === 429 ? 502 : 400, "Airtable: " + msg, r.status >= 500 || r.status === 429 ? "upstream_error" : "tool_error");
    }
    return r.json();
  }
}

export async function listPage(base: string, table: string, o: { fieldIds?: string[]; pageSize?: number; offset?: string; sort?: { fieldId: string; direction?: string }[]; formula?: string }) {
  const p = new URLSearchParams();
  p.set("returnFieldsByFieldId", "true");
  p.set("pageSize", String(Math.min(o.pageSize || 100, 100)));
  if (o.offset) p.set("offset", o.offset);
  (o.fieldIds || []).forEach((f) => p.append("fields[]", f));
  (o.sort || []).forEach((s, i) => { p.set(`sort[${i}][field]`, s.fieldId); p.set(`sort[${i}][direction]`, s.direction === "desc" ? "desc" : "asc"); });
  if (o.formula) p.set("filterByFormula", o.formula);
  const j = await at(`/v0/${base}/${table}?${p.toString()}`);
  return { records: (j.records || []) as Rec[], offset: j.offset as string | undefined };
}

export async function listUntil(base: string, table: string, o: { fieldIds?: string[]; want: number; offset?: string; sort?: any; formula?: string; maxPages?: number }) {
  const out: Rec[] = [];
  let offset = o.offset, pages = 0;
  do {
    const pg = await listPage(base, table, { fieldIds: o.fieldIds, offset, sort: o.sort, formula: o.formula, pageSize: 100 });
    out.push(...pg.records);
    offset = pg.offset;
    pages++;
  } while (offset && out.length < o.want && pages < (o.maxPages || 60));
  return { records: out, offset };
}

/* ---------- skema (untuk menerjemahkan relasi ID -> nama) ---------- */
type TableSchema = { id: string; primaryFieldId: string; fields: Record<string, any> };
const schemaCache = new Map<string, { at: number; v: Record<string, TableSchema> }>();
export async function getSchema(base: string, fresh = false): Promise<Record<string, TableSchema>> {
  const c = schemaCache.get(base);
  if (!fresh && c && Date.now() - c.at < 3600_000) return c.v;
  const j = await at(`/v0/meta/bases/${base}/tables`);
  const v: Record<string, TableSchema> = {};
  for (const t of j.tables || []) {
    const fields: Record<string, any> = {};
    for (const f of t.fields || []) fields[f.id] = f;
    v[t.id] = { id: t.id, primaryFieldId: t.primaryFieldId, fields };
  }
  schemaCache.set(base, { at: Date.now(), v });
  return v;
}

const nameCache = new Map<string, { at: number; v: Promise<Map<string, string>> }>();
async function nameMap(base: string, table: string, primary: string) {
  const key = base + table;
  const c = nameCache.get(key);
  if (c && Date.now() - c.at < 300_000) return c.v;
  const v = (async () => {
    const m = new Map<string, string>();
    const { records } = await listUntil(base, table, { fieldIds: [primary], want: Infinity, maxPages: 200 });
    for (const r of records) { const x = r.fields[primary]; m.set(r.id, typeof x === "string" ? x : x == null ? "" : String(x)); }
    return m;
  })();
  nameCache.set(key, { at: Date.now(), v });
  v.catch(() => nameCache.delete(key));
  return v;
}

/** Ganti nilai relasi (array ID) menjadi [{id, name}] seperti format konektor Airtable. */
export async function resolveLinks(base: string, table: string, records: Rec[]) {
  if (!records.length) return records;
  const sch = (await getSchema(base))[table];
  if (!sch) return records;
  const todo: { fid: string; linked: string }[] = [];
  const present = new Set<string>();
  records.forEach((r) => Object.keys(r.fields).forEach((k) => present.add(k)));
  for (const fid of present) {
    const f = sch.fields[fid];
    if (!f) continue;
    if (f.type === "multipleRecordLinks" && f.options?.linkedTableId) todo.push({ fid, linked: f.options.linkedTableId });
    else if (f.type === "multipleLookupValues" && f.options?.result?.type === "multipleRecordLinks" && f.options.result.options?.linkedTableId)
      todo.push({ fid, linked: f.options.result.options.linkedTableId });
  }
  if (!todo.length) return records;
  const all = await getSchema(base);
  const maps = new Map<string, Map<string, string>>();
  for (const t of todo) {
    if (maps.has(t.linked)) continue;
    const ls = all[t.linked];
    if (ls) maps.set(t.linked, await nameMap(base, t.linked, ls.primaryFieldId));
  }
  for (const r of records) {
    for (const t of todo) {
      const v = r.fields[t.fid], m = maps.get(t.linked);
      if (!Array.isArray(v) || !m) continue;
      r.fields[t.fid] = v.map((x: any) => (typeof x === "string" ? { id: x, name: m.get(x) ?? "" } : x));
    }
  }
  return records;
}

export function clearCaches() { nameCache.clear(); }
