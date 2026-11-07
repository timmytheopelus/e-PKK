import { it, expect, vi } from "vitest";
import { handleCall } from "@/lib/proxy";

it("lookup Nama pengurus membawa ID umat", async () => {
  process.env.AIRTABLE_TOKEN = "x";
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (u: string) => {
    urls.push(u);
    const j = u.includes("/meta/bases/")
      ? { tables: [{ id: "tbluIlEgPdHeodJHK", primaryFieldId: "fldA", fields: [
          { id: "fldHK8r2o5q60IDXW", type: "multipleLookupValues", options: { recordLinkFieldId: "fldfYrY68cNtbaXtN", result: { type: "singleLineText" } } },
          { id: "fldfYrY68cNtbaXtN", type: "multipleRecordLinks", options: { linkedTableId: "tblwRNtXSVzgzVXuk" } } ] },
          { id: "tblwRNtXSVzgzVXuk", primaryFieldId: "fldP", fields: [{ id: "fldP", type: "singleLineText" }] }] }
      : u.includes("tblwRNtXSVzgzVXuk")
        ? { records: [{ id: "recAAAAAAAAAAAAAA", fields: { fldP: "Budi" } }] }
        : { records: [{ id: "recBBBBBBBBBBBBBB", fields: { fldHK8r2o5q60IDXW: ["Budi"], fldfYrY68cNtbaXtN: ["recAAAAAAAAAAAAAA"] } }] };
    return new Response(JSON.stringify(j), { status: 200 });
  });
  const acc: any = { email: "a@b.c", status: "Disetujui", level: "View", tabs: ["Pengurus"], nama: "A" };
  const out: any = await handleCall("list_records_for_table", { baseId: "appIGR8Duhj3Vsz48", tableId: "tbluIlEgPdHeodJHK", fieldIds: ["fldHK8r2o5q60IDXW"], pageSize: 10 }, acc);
  const c = out.records[0].cellValuesByFieldId;
  expect(c.fldHK8r2o5q60IDXW.linkedRecordIds).toEqual(["recAAAAAAAAAAAAAA"]);
  expect(c.fldHK8r2o5q60IDXW.valuesByLinkedRecordId.recAAAAAAAAAAAAAA).toEqual(["Budi"]);
  expect(c.fldfYrY68cNtbaXtN).toBeUndefined();
});

it("filter memakai kolom yang tidak diminta klien", async () => {
  vi.resetModules();
  const { handleCall } = await import("@/lib/proxy");
  process.env.AIRTABLE_TOKEN = "x";
  const reqs: string[] = [];
  vi.stubGlobal("fetch", async (u: string) => {
    reqs.push(u);
    const j = u.includes("/meta/bases/")
      ? { tables: [{ id: "tbluIlEgPdHeodJHK", primaryFieldId: "fldA", fields: [{ id: "fldHngi5Klnm5bUmM", type: "multipleRecordLinks", options: { linkedTableId: "tblPER" } }] },
          { id: "tblPER", primaryFieldId: "fldN", fields: [{ id: "fldN", type: "singleLineText" }] }] }
      : u.includes("tblPER") ? { records: [{ id: "recPPPPPPPPPPPPPP", fields: { fldN: "2026-2031" } }] }
      : { records: [{ id: "recCCCCCCCCCCCCCC", fields: { fldHK8r2o5q60IDXW: ["x"], fldHngi5Klnm5bUmM: ["recPPPPPPPPPPPPPP"] } }] };
    return new Response(JSON.stringify(j), { status: 200 });
  });
  const acc: any = { email: "z@b.c", status: "Disetujui", level: "View", tabs: ["Pengurus"], nama: "A" };
  const out: any = await handleCall("list_records_for_table", { baseId: "appIGR8Duhj3Vsz48", tableId: "tbluIlEgPdHeodJHK", fieldIds: ["fldHK8r2o5q60IDXW"], pageSize: 10, filters: { operands: [{ operator: "contains", operands: ["fldHngi5Klnm5bUmM", "2026-2031"] }] } }, acc);
  expect(out.records.length).toBe(1);
  expect(out.records[0].cellValuesByFieldId.fldHngi5Klnm5bUmM).toBeUndefined();
});

it("urutan opsi Bidang/Seksi/Peran diambil dari skema", async () => {
  vi.resetModules();
  const { handleCall } = await import("@/lib/proxy");
  process.env.AIRTABLE_TOKEN = "x";
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ tables: [{ id: "tblrfilR2eNUOiFMa", primaryFieldId: "fldN", fields: [
    { id: "fldCCi0hV9yTL091P", type: "singleSelect", options: { choices: [{ name: "Pimpinan" }, { name: "Unit Staf" }] } },
    { id: "fldAAyRg1kko5YgrK", type: "singleSelect", options: { choices: [{ name: "Pimpinan Inti" }] } },
    { id: "fldI8J3VXZDyjWa3f", type: "singleSelect", options: { choices: [{ name: "Ketua" }, { name: "Anggota" }] } }] }] }), { status: 200 }));
  const acc: any = { email: "z@b.c", status: "Disetujui", level: "View", tabs: ["Pengurus"], nama: "A" };
  const out: any = await handleCall("get_select_order", { baseId: "appIGR8Duhj3Vsz48", tableId: "tblrfilR2eNUOiFMa" }, acc);
  expect(out.bidang).toEqual(["Pimpinan", "Unit Staf"]);
  expect(out.peran).toEqual(["Ketua", "Anggota"]);
  await expect(handleCall("get_select_order", { baseId: "appIGR8Duhj3Vsz48", tableId: "tblrfilR2eNUOiFMa" }, { ...acc, tabs: ["Pewarta"] })).rejects.toThrow();
});
