import { describe, it, expect, vi, beforeEach } from "vitest";
import { diffEvent, logEventChange, WATCH } from "@/lib/event-log";
import { handleCall } from "@/lib/proxy";
import { BASE_BPK, T, EV_OLEH } from "@/lib/policy";

const W = ["fldA", "fldB"];
describe("diffEvent", () => {
  it("hanya field yang berubah", () => {
    expect(diffEvent({ fldA: "x", fldB: "y" }, { fldA: "x", fldB: "z" }, W)).toEqual([{ field: "fldB", lama: "y", baru: "z" }]);
  });
  it("mengabaikan field di luar watch", () => {
    expect(diffEvent({ fldC: "1" }, { fldC: "2" }, W)).toEqual([]);
  });
  it("kosong sama dengan tidak ada; waktu ISO sama dianggap sama", () => {
    expect(diffEvent({ fldA: "" }, {}, W)).toEqual([]);
    expect(diffEvent({ fldA: "2026-11-20T02:00:00.000Z" }, { fldA: "2026-11-20T09:00:00+07:00" }, W)).toEqual([]);
  });
  it("hanya field yang dikirim pada 'after' yang dibandingkan", () => {
    expect(diffEvent({ fldA: "x", fldB: "y" }, { fldA: "x2" }, W)).toEqual([{ field: "fldA", lama: "x", baru: "x2" }]);
  });
});

describe("logEventChange", () => {
  beforeEach(() => { process.env.AIRTABLE_TOKEN = "x"; });
  it("tidak melempar bila penulisan gagal", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(logEventChange("recAAAAAAAAAAAAAA", "a@x.com", [{ field: WATCH[0], lama: "a", baru: "b" }])).resolves.toBeUndefined();
  });
  it("menulis satu baris per perubahan", async () => {
    const posts: any[] = [];
    vi.stubGlobal("fetch", async (_u: any, i: any) => { posts.push(JSON.parse(i.body)); return new Response(JSON.stringify({ records: [] }), { status: 200 }); });
    await logEventChange("recAAAAAAAAAAAAAA", "a@x.com", [{ field: WATCH[0], lama: "a", baru: "b" }, { field: WATCH[1], lama: "c", baru: "d" }], "Retret");
    expect(posts[0].records.length).toBe(2);
    expect(posts[0].records[0].fields.fld1ZEkxFexR1hpzV).toBe("a@x.com");
  });
});

describe("proxy: update event menulis riwayat, kegagalan log tidak menggagalkan update", () => {
  const REC = "recAAAAAAAAAAAAAA";
  const acc: any = { email: "pembuat@x.com", nama: "P", status: "Disetujui", level: "View", tabs: ["Kalender"] };
  const run = async (failLog: boolean) => {
    const seen: any[] = [];
    process.env.AIRTABLE_TOKEN = "x";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async (u: any, i: any) => {
      const url = String(u), m = i?.method || "GET"; seen.push([url, m, i?.body]);
      if (m === "GET") return new Response(JSON.stringify({ id: REC, fields: { [EV_OLEH]: "pembuat@x.com", fld0d9tIyi4nyTZsM: "Lama", fldY0qw1v0a4fK9Sp: "Aula" } }), { status: 200 });
      if (url.includes("tbl61LZu0kBVjKQzc") && failLog) return new Response("{}", { status: 500 });
      return new Response(JSON.stringify({ records: [{ id: REC, fields: {} }] }), { status: 200 });
    });
    const out: any = await handleCall("update_records_for_table", { baseId: BASE_BPK, tableId: T.events, records: [{ id: REC, fields: { fld0d9tIyi4nyTZsM: "Baru", fldY0qw1v0a4fK9Sp: "Aula" } }] }, acc);
    return { out, seen };
  };
  it("mencatat hanya field yang berubah", async () => {
    const { seen } = await run(false);
    const log = seen.find((c) => c[0].includes("tbl61LZu0kBVjKQzc") && c[1] === "POST");
    const recs = JSON.parse(log[2]).records;
    expect(recs.length).toBe(1);
    expect(recs[0].fields.fldV1Z69OgVXYmkbQ).toBe("Nama");
  });
  it("update tetap berhasil walau log gagal", async () => {
    const { out } = await run(true);
    expect(out.records.length).toBe(1);
  });
});
