// Menerjemahkan panggilan gaya konektor (list/update/create) menjadi REST Airtable, dengan pemeriksaan izin.
import { Access, EV_OLEH, HttpError, INV, JAB, KEU, REK, T, TABLES, checkRead, checkWrite } from "./policy";
import { canEditEvent, sekretariatEmails } from "./event-edit";
import { WATCH, diffEvent, logEventChange } from "./event-log";
import { notifyOwner } from "./mail";
import { at, clearCaches, getSchema, listPage, listUntil, resolveLinks, Rec } from "./airtable";
import { evalFilter } from "./filters";

const REC = /^rec[A-Za-z0-9]{14}$/;
const FLD = /^fld[A-Za-z0-9]{14}$/;
const cache = new Map<string, { at: number; v: any }>();
const TTL = 60_000;

const toOut = (r: Rec) => ({ id: r.id, createdTime: r.createdTime, cellValuesByFieldId: r.fields });

export function clearProxyCache() { cache.clear(); }

export async function handleCall(tool: string, input: any, acc: Access) {
  const spec = TABLES[input?.tableId];
  if (!spec || spec.base !== input?.baseId) throw new HttpError(403, "Tabel ini tidak tersedia.");
  const { baseId: base, tableId: table } = input;
  if (tool === "list_records_for_table") {
    checkRead(spec, table, input, acc);
    return list(base, table, input);
  }
  if (tool === "get_select_order") {
    if (table !== T.jabatan) throw new HttpError(400, "Perintah tidak dikenal.");
    checkRead(spec, table, {}, acc);
    const sch = (await getSchema(base))[table];
    const names = (id: string): string[] => ((sch?.fields[id] as any)?.options?.choices || []).map((c: any) => String(c.name));
    return { bidang: names(JAB.bidang), seksi: names(JAB.seksi), peran: names(JAB.peran) };
  }
  if (tool === "get_select_options") {
    if (table !== T.inventaris) throw new HttpError(400, "Perintah tidak dikenal.");
    checkRead(spec, table, { fieldIds: [INV.lokasi, INV.status] }, acc);
    return selectNames(base, table, true);
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
    const evBefore = new Map<string, Record<string, any>>();
    if (kind === "update" && spec.update?.record === "event-owner") {
      let sek: boolean | null = null;
      for (const r of records) {
        const cur = await at(`/v0/${base}/${table}/${r.id}?returnFieldsByFieldId=true&` + [EV_OLEH, ...WATCH].map((f) => "fields%5B%5D=" + f).join("&"));
        evBefore.set(r.id, cur?.fields || {});
        const creator = String(cur?.fields?.[EV_OLEH] || "");
        if (canEditEvent(acc, creator, false)) continue;
        if (sek === null) sek = (await sekretariatEmails()).has((acc.email || "").trim().toLowerCase());
        if (!canEditEvent(acc, creator, sek)) throw new HttpError(403, "Hanya Admin, anggota Kesekretariatan, atau pembuat event yang boleh mengubah event ini.");
      }
    }
    if (kind === "create" && table === T.events) for (const r of records) r.fields[EV_OLEH] = (acc.email || "").trim().toLowerCase();
    // Lokasi baru: Airtable membuat opsi select baru lewat typecast. Dibatasi ketat agar field lain tidak ikut membuat opsi.
    let typecast = false, newLokasi = "";
    if (input.newLokasi !== undefined) {
      if (table !== T.inventaris) throw new HttpError(400, "Lokasi baru hanya untuk Inventaris.");
      newLokasi = String(input.newLokasi).replace(/\s+/g, " ").trim();
      if (newLokasi.length < 2 || newLokasi.length > 40 || /[\u0000-\u001f,]/.test(newLokasi)) throw new HttpError(400, "Nama lokasi 2 sampai 40 karakter, tanpa koma.");
      const cur = await selectNames(base, table, true);
      if (cur.lokasi.some((n) => n.toLowerCase() === newLokasi.toLowerCase())) throw new HttpError(409, "Lokasi \"" + newLokasi + "\" sudah ada. Pilih dari daftar.");
      for (const r of records) {
        if (r.fields[INV.lokasi] !== newLokasi) throw new HttpError(400, "Lokasi pada data tidak sesuai dengan lokasi baru.");
        if (r.fields[INV.status] != null && !cur.status.includes(r.fields[INV.status])) throw new HttpError(400, "Status barang tidak dikenal.");
      }
      typecast = true;
    }
    console.log(JSON.stringify({ audit: kind, who: acc.email, table, ids: records.map((r: any) => r.id).filter(Boolean), fields: Object.keys(records[0].fields) }));
    const out: Rec[] = [];
    for (let i = 0; i < records.length; i += 10) {
      const chunk = records.slice(i, i + 10).map((r: any) => (kind === "update" ? { id: r.id, fields: r.fields } : { fields: r.fields }));
      const j = await at(`/v0/${base}/${table}`, { method: kind === "update" ? "PATCH" : "POST", body: JSON.stringify({ records: chunk, typecast, returnFieldsByFieldId: true }) });
      out.push(...(j.records || []));
    }
    cache.clear(); clearCaches();
    if (kind === "update" && table === T.events) {
      for (const r of records) await logEventChange(r.id, (acc.email || "").trim().toLowerCase(), diffEvent(evBefore.get(r.id) || {}, r.fields, WATCH), String(r.fields[WATCH[0]] ?? evBefore.get(r.id)?.[WATCH[0]] ?? ""));
    }
    if (newLokasi) {
      console.log(JSON.stringify({ audit: "lokasi-baru", who: acc.email, lokasi: newLokasi }));
      const emailed = await notifyOwner('[e-PKK] Opsi Lokasi baru di Airtable: "' + newLokasi + '"',
        'Opsi baru "' + newLokasi + '" ditambahkan ke field Lokasi (select) di tabel Inventaris, base BPK Bandung.\nOleh: ' + (acc.nama || acc.email) + " <" + acc.email + ">\nLewat: menu Inventaris e-PKK.\nTidak ada tabel atau field baru.");
      return { records: out.map(toOut), newLokasi, emailed };
    }
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
function filterFieldIds(f: any, out = new Set<string>()): Set<string> {
  if (f && typeof f === "object") (f.operands || []).forEach((o: any) => { if (typeof o === "string" && FLD.test(o) && f.operator !== "and" && f.operator !== "or") { if (o === (f.operands || [])[0]) out.add(o); } else filterFieldIds(o, out); });
  return out;
}
function shapeLookups(records: Rec[], lk: Map<string, string>, extra: string[] = []) {
  if (!lk.size) { if (extra.length) for (const r of records) extra.forEach((e) => delete r.fields[e]); return records; }
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
  const need = [...filterFieldIds(input.filters)].filter((x) => !li.rest.includes(x));
  const rest = [...li.rest, ...need];
  const extraAll = [...(li.extra || []), ...need];
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
  records = shapeLookups(records, li.lk, extraAll);
  if (table === T.mutasi) await labelRekening(base, records);
  const v = { records: records.map(toOut), nextCursor: next, metadata: { totalRecordCount: records.length } };
  if (cache.size > 60) cache.clear();
  cache.set(key, { at: Date.now(), v });
  return v;
}

async function selectNames(base: string, table: string, fresh: boolean) {
  const sch = (await getSchema(base, fresh))[table];
  const names = (id: string): string[] => ((sch?.fields[id] as any)?.options?.choices || []).map((c: any) => String(c.name));
  return { lokasi: names(INV.lokasi), status: names(INV.status) };
}

/** Nama relasi Rekening di Mutasi adalah nomor rekening bank (field utama). Diganti "Nama (Bank)" supaya nomor tidak sampai ke browser. */
let rekCache: { at: number; v: Promise<Map<string, string>> } | null = null;
async function rekeningLabels(base: string) {
  if (rekCache && Date.now() - rekCache.at < 300_000) return rekCache.v;
  const v = (async () => {
    const m = new Map<string, string>();
    const { records } = await listUntil(base, T.rekeningKeu, { fieldIds: [REK.nama, REK.bank], want: Infinity, maxPages: 10 });
    for (const r of records) {
      const nama = String(r.fields[REK.nama] ?? "").trim(), b = r.fields[REK.bank];
      const bank = String(typeof b === "object" && b ? b.name ?? "" : b ?? "").trim();
      m.set(r.id, nama && bank && !nama.toLowerCase().includes(bank.toLowerCase()) ? nama + " (" + bank + ")" : nama || bank || "Rekening");
    }
    return m;
  })();
  rekCache = { at: Date.now(), v };
  v.catch(() => { rekCache = null; });
  return v;
}
async function labelRekening(base: string, records: Rec[]) {
  if (!records.some((r) => Array.isArray(r.fields[KEU.rekening]))) return;
  const m = await rekeningLabels(base);
  for (const r of records) {
    const v = r.fields[KEU.rekening];
    if (Array.isArray(v)) r.fields[KEU.rekening] = v.map((x: any) => ({ id: x?.id ?? x, name: m.get(x?.id ?? x) ?? "Rekening" }));
  }
}
export function clearRekeningCache() { rekCache = null; }
