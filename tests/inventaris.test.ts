import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleCall } from "@/lib/proxy";
import { HttpError, INV, T, BASE_BPK } from "@/lib/policy";

const ed: any = { email: "a@b.c", nama: "A", status: "Disetujui", level: "Edit", tabs: ["Inventaris"] };
let calls: { url: string; method: string; body: any }[] = [];

beforeEach(() => {
  calls = [];
  process.env.AIRTABLE_TOKEN = "t";
  delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: any = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init.method || "GET", body });
    if (url.includes("/meta/bases/")) {
      return new Response(JSON.stringify({ tables: [{ id: T.inventaris, primaryFieldId: "fldx", fields: [
        { id: INV.lokasi, type: "singleSelect", options: { choices: [{ name: "Aula Bawah" }, { name: "R. Band" }] } },
        { id: INV.status, type: "singleSelect", options: { choices: [{ name: "Rusak" }, { name: "Bisa Dipinjam" }] } }] }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ records: [{ id: "recAAAAAAAAAAAAAA", fields: {} }] }), { status: 200 });
  }));
});

const create = (extra: any, fields: any, acc = ed) =>
  handleCall("create_records_for_table", { baseId: BASE_BPK, tableId: T.inventaris, records: [{ fields }], ...extra }, acc);
const writes = () => calls.filter((c) => c.method === "POST");

describe("lokasi baru", () => {
  it("opsi dipakai lewat typecast hanya saat newLokasi, dan dilaporkan", async () => {
    const r: any = await create({ newLokasi: "Gudang Atas" }, { [INV.nama]: "Kursi", [INV.lokasi]: "Gudang Atas", [INV.status]: "Rusak" });
    expect(writes()[0].body.typecast).toBe(true);
    expect(r.newLokasi).toBe("Gudang Atas");
    expect(r.emailed).toBe(false); // SMTP belum diatur di tes
  });
  it("tanpa newLokasi typecast tetap false", async () => {
    await create({}, { [INV.nama]: "Kursi", [INV.lokasi]: "R. Band" });
    expect(writes()[0].body.typecast).toBe(false);
  });
  it("lokasi yang sudah ada (tanpa peduli huruf besar) ditolak", async () => {
    await expect(create({ newLokasi: "aula bawah" }, { [INV.nama]: "x", [INV.lokasi]: "aula bawah" })).rejects.toMatchObject({ status: 409 });
    expect(writes().length).toBe(0);
  });
  it("status tak dikenal tidak boleh ikut membuat opsi", async () => {
    await expect(create({ newLokasi: "Gudang Atas" }, { [INV.nama]: "x", [INV.lokasi]: "Gudang Atas", [INV.status]: "Status Baru" })).rejects.toBeInstanceOf(HttpError);
    expect(writes().length).toBe(0);
  });
  it("nama lokasi tidak valid atau tidak sama dengan data ditolak", async () => {
    await expect(create({ newLokasi: "a" }, { [INV.lokasi]: "a" })).rejects.toMatchObject({ status: 400 });
    await expect(create({ newLokasi: "A,B" }, { [INV.lokasi]: "A,B" })).rejects.toMatchObject({ status: 400 });
    await expect(create({ newLokasi: "Gudang Atas" }, { [INV.lokasi]: "Lain" })).rejects.toMatchObject({ status: 400 });
  });
  it("level View ditolak", async () => {
    await expect(create({ newLokasi: "Gudang Atas" }, { [INV.lokasi]: "Gudang Atas" }, { ...ed, level: "View" })).rejects.toMatchObject({ status: 403 });
  });
  it("get_select_options mengembalikan daftar dari skema", async () => {
    const r: any = await handleCall("get_select_options", { baseId: BASE_BPK, tableId: T.inventaris }, ed);
    expect(r.lokasi).toEqual(["Aula Bawah", "R. Band"]);
    expect(r.status).toContain("Rusak");
  });
});
