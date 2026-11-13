import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/proker-roles", () => ({ peranOf: async () => ({ koordBidang: [], koordSeksi: [], sekjen: false, bendahara: true, pimpinan: false }) }));
import { handleCall, clearProxyCache, clearRekeningCache } from "@/lib/proxy";
import { clearCaches } from "@/lib/airtable";
import { BASE_BEN, BASE_BPK, HttpError, KEU, KEU_READ, REK, T, TABLES, checkRead, checkWrite } from "@/lib/policy";
import { renderDashboard } from "@/ui/render";

const viewer: any = { email: "b@b.c", nama: "Bendahara", status: "Disetujui", level: "View", tabs: ["Keuangan"] };
const other: any = { ...viewer, tabs: ["Dashboard", "Inventaris"] };
const spec = TABLES[T.mutasi];

describe("akses Keuangan", () => {
  it("hanya pengguna dengan tab Keuangan yang boleh membaca", () => {
    expect(() => checkRead(spec, T.mutasi, { fieldIds: [KEU.nominal] }, viewer)).not.toThrow();
    expect(() => checkRead(spec, T.mutasi, { fieldIds: [KEU.nominal] }, other)).toThrow(HttpError);
  });
  it("level View pun bisa membaca (laporan), tetapi tidak ada penulisan sama sekali", () => {
    const edit = { ...viewer, level: "Superadmin" };
    expect(() => checkWrite(spec, "update", [{ id: "recAAAAAAAAAAAAAA", fields: { [KEU.nominal]: 1 } }], edit)).toThrow(HttpError);
    expect(() => checkWrite(spec, "create", [{ fields: { [KEU.nominal]: 1 } }], edit)).toThrow(HttpError);
  });
  it("field di luar daftar (lampiran, email pengisi) tidak boleh dibaca; wajib menyebut field", () => {
    expect(() => checkRead(spec, T.mutasi, { fieldIds: ["fldj7RtEd8bkw5XSw"] }, viewer)).toThrow(HttpError); // Attachment
    expect(() => checkRead(spec, T.mutasi, { fieldIds: ["fldenwv8xDcs5Jc0m"] }, viewer)).toThrow(HttpError); // FormSubmittedBy
    expect(() => checkRead(spec, T.mutasi, {}, viewer)).toThrow(HttpError);
    expect(KEU_READ).toContain(KEU.hapus);
  });
  it("tabel Rekening (nomor rekening) tidak bisa dibaca dari dashboard", async () => {
    await expect(handleCall("list_records_for_table", { baseId: BASE_BEN, tableId: T.rekeningKeu, fieldIds: [REK.nomor] }, viewer)).rejects.toMatchObject({ status: 403 });
  });
  it("base harus cocok dengan tabel", async () => {
    await expect(handleCall("list_records_for_table", { baseId: BASE_BPK, tableId: T.mutasi, fieldIds: [KEU.nominal] }, viewer)).rejects.toMatchObject({ status: 403 });
  });
  it("render: skrip Keuangan hanya untuk yang punya tab", () => {
    expect(renderDashboard(other)).not.toContain("Laporan Keuangan BPK Keuskupan Bandung");
    const html = renderDashboard(viewer);
    expect(html).toContain("Laporan Keuangan BPK Keuskupan Bandung");
    expect(html).toContain('id="tabbtn-keuangan"');
  });
});

describe("nomor rekening tidak sampai ke browser", () => {
  beforeEach(() => {
    process.env.AIRTABLE_TOKEN = "t"; clearProxyCache(); clearCaches(); clearRekeningCache();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/meta/bases/")) {
        return new Response(JSON.stringify({ tables: [
          { id: T.mutasi, primaryFieldId: "fldwPjPcg48dLZAXf", fields: [{ id: KEU.rekening, type: "multipleRecordLinks", options: { linkedTableId: T.rekeningKeu } }] },
          { id: T.rekeningKeu, primaryFieldId: "fldICJpyKwuUNFsG3", fields: [{ id: "fldICJpyKwuUNFsG3", type: "formula" }] }] }), { status: 200 });
      }
      if (u.includes("/" + T.rekeningKeu)) {
        return new Response(JSON.stringify({ records: [
          { id: "recREK1AAAAAAAAAA", fields: { fldICJpyKwuUNFsG3: "BCA-2330958858", [REK.nama]: "Rekening utama", [REK.bank]: "BCA" } },
          { id: "recREK2AAAAAAAAAA", fields: { fldICJpyKwuUNFsG3: "Kepengurusan lalu-20232026", [REK.nama]: "Kepengurusan lalu", [REK.bank]: "Kepengurusan lalu" } }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ records: [
        { id: "recTX1AAAAAAAAAAA", createdTime: "2026-11-11T00:00:00Z", fields: { [KEU.nominal]: 60000, [KEU.rekening]: ["recREK1AAAAAAAAAA"] } },
        { id: "recTX2AAAAAAAAAAA", createdTime: "2026-11-11T00:00:00Z", fields: { [KEU.nominal]: 5000, [KEU.rekening]: ["recREK2AAAAAAAAAA"] } }] }), { status: 200 });
    }));
  });
  it("nama relasi rekening diganti Nama (Bank)", async () => {
    const out: any = await handleCall("list_records_for_table", { baseId: BASE_BEN, tableId: T.mutasi, fieldIds: [KEU.nominal, KEU.rekening], pageSize: 50 }, viewer);
    const names = out.records.map((r: any) => r.cellValuesByFieldId[KEU.rekening][0].name);
    expect(names).toEqual(["Rekening utama (BCA)", "Kepengurusan lalu"]);
    expect(JSON.stringify(out)).not.toMatch(/2330958858|20232026/);
  });
});
