// Menerjemahkan panggilan gaya konektor (list/update/create) menjadi REST Airtable, dengan pemeriksaan izin.
import { Access, HttpError, T, TABLES, checkRead, checkWrite } from "./policy";
import { at, clearCaches, getSchema, listPage, listUntil, resolveLinks, Rec } from "./airtable";
import { evalFilter } from "./filters";

const REC = /^rec[A-Za-z0-9]{14}$/;
const FLD = /^fld[A-Za-z0-9]{14}$/;
const cache = new Map<string, { at: number; v: any }>();
const TTL = 60_000;

const toOut = (r: Rec) => ({ id: r.id, createdTime: r.createdTime, cellValuesByFieldId: r.fields });

export async function handleCall(tool: string, input: any, acc: Access) {
  const spec = TABLES[input?.tableId];
  if (!spec || spec.base !== input?.baseId) throw new HttpError(403, "Tabel ini tidak tersedia.");
  const { baseId: base, tableId: table } = input;
  if (tool === "list_records_for_table") {
    checkRead(spec, table, input, acc);
    return list(base, table, input);
  }
  if (tool === "update_records_for_table" || tool === "create_records_for_table") {
    const kind = tool === "update_records_for_table" ? "update" : "create";
    const records = input.records;
    if (!Array.isArray(records) || !records.length || records.length > 50) throw new HttpError(400, "records tidak valid");
    for (const r of records) {
      if (kind === "update" && !REC.test(r.id || "")) throw new HttpError(400, "id rekaman tidak valid");
      if (!r.fields || typeof r.fields !== "object") throw new HttpError(400, "fields tidak valid");
    }
    checkWrite(spec, kind, records, acc);
    console.log(JSON.stringify({ audit: kind, who: acc.email, table, ids: records.map((r: any) => r.id).filter(Boolean), fields: Object.keys(records[0].fields) }));
    const out: Rec[] = [];
    for (let i = 0; i < records.length; i += 10) {
      const chunk = records.slice(i, i + 10).map((r: any) => (kind === "update" ? { id: r.id, fields: r.fields } : { fields: r.fields }));
      const j = await at(`/v0/${base}/${table}`, { method: kind === "update" ? "PATCH" : "POST", body: JSON.stringify({ records: chunk, typecast: false, returnFieldsByFieldId: true }) });
      out.push(...(j.records || []));
    }
    cache.clear(); clearCaches();
    return { records: out.map(toOut) };
  }
  throw new HttpError(400, "Perintah tidak dikenal.");
}


/** Konektor claude.ai memberi lookup berupa {linkedRecordIds, valuesByLinkedRecordId}; REST hanya memberi teksnya.
 *  Prototipe butuh ID umat dari kolom Nama/WA di tabel Pengurus BPK, jadi bentuk itu dibangun ulang di sini. */
async function lookupInfo(base: string, table: string, fieldIds: string[]) {
  if (table !== T.pengurus) return { rest: fieldIds, lk: new Map<string, string>() };
  const sch = (await getSchema(base))[table];
  const lk = new Map<string, string>();
  for (const f of fieldIds) {
    const d: any = sch?.fields[f];
    if (d?.type === "multipleLookupValues" && d.options?.recordLinkFieldId) lk.set(f, d.options.recordLinkFieldId);
  }
  const extra = [...new Set(lk.values())].filter((x) => !fieldIds.includes(x));
  return { rest: [...fieldIds, ...extra], lk, extra };
}
function shapeLookups(records: Rec[], lk: Map<string, string>, extra: string[] = []) {
  if (!lk.size) return records;
  for (const r of records) {
    for (const [fid, linkFid] of lk) {
      const links = r.fields[linkFid], vals = r.fields[fid];
      if (!Array.isArray(links) || !Array.isArray(vals)) continue;
      const ids = links.map((x: any) => (typeof x === "string" ? x : x?.id)).filter(Boolean);
      const by: Record<string, any[]> = {};
      ids.forEach((id: string, i: number) => { by[id] = vals[i] === undefined ? [] : [vals[i]]; });
      r.fields[fid] = { linkedRecordIds: ids, valuesByLinkedRecordId: by };
    }
    extra.forEach((e) => delete r.fields[e]);
  }
  return records;
}

async function list(base: string, table: string, input: any) {
  const fieldIds = input.fieldIds;
  if (!Array.isArray(fieldIds) || !fieldIds.length || fieldIds.length > 80 || !fieldIds.every((f: any) => FLD.test(f))) throw new HttpError(400, "fieldIds wajib diisi");
  const pageSize = Math.max(1, Math.min(Number(input.pageSize) || 100, 500));
  const key = JSON.stringify([base, table, fieldIds, input.filters, input.sort, input.recordIds, pageSize, input.cursor]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v;

  const li = await lookupInfo(base, table, fieldIds);
  const rest = li.rest;
  let records: Rec[], next: string | undefined;
  if (Array.isArray(input.recordIds) && input.recordIds.length) {
    const ids: string[] = input.recordIds;
    if (ids.length > 50 || !ids.every((i) => REC.test(i))) throw new HttpError(400, "recordIds tidak valid");
    const formula = "OR(" + ids.map((i) => `RECORD_ID()='${i}'`).join(",") + ")";
    records = (await listUntil(base, table, { fieldIds: rest, want: ids.length, formula })).records;
    records = await resolveLinks(base, table, records);
  } else if (input.filters) {
    const all = await listUntil(base, table, { fieldIds: rest, want: Infinity, sort: input.sort, maxPages: 200 });
    const res = await resolveLinks(base, table, all.records);
    const kept = res.filter((r) => evalFilter(input.filters, r.fields));
    const start = input.cursor ? Number(input.cursor) || 0 : 0;
    records = kept.slice(start, start + pageSize);
    next = start + pageSize < kept.length ? String(start + pageSize) : undefined;
  } else {
    const r = await listUntil(base, table, { fieldIds: rest, want: pageSize, offset: input.cursor, sort: input.sort });
    records = await resolveLinks(base, table, r.records);
    next = r.offset;
  }
  records = shapeLookups(records, li.lk, li.extra);
  const v = { records: records.map(toOut), nextCursor: next, metadata: { totalRecordCount: records.length } };
  if (cache.size > 60) cache.clear();
  cache.set(key, { at: Date.now(), v });
  return v;
}
