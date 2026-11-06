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
