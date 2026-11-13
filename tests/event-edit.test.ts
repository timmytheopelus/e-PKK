import { describe, it, expect, vi, beforeEach } from "vitest";

const sekre = new Set<string>(["sekre@x.com"]);
vi.mock("@/lib/event-edit", async (orig) => {
  const m: any = await orig();
  return { ...m, sekretariatEmails: async () => sekre };
});
import { canEditEvent } from "@/lib/event-edit";
import { handleCall } from "@/lib/proxy";
import { BASE_BPK, T, EV_OLEH } from "@/lib/policy";

const A = (level: string, email = "u@x.com") => ({ email, level });

describe("canEditEvent", () => {
  it("Admin dan Superadmin boleh", () => {
    expect(canEditEvent(A("Admin"), "lain@x.com", false)).toBe(true);
    expect(canEditEvent(A("Superadmin"), undefined, false)).toBe(true);
  });
  it("View bukan pembuat bukan sekretariat: tidak boleh", () => {
    expect(canEditEvent(A("View"), "lain@x.com", false)).toBe(false);
  });
  it("pembuat boleh walau huruf besar-kecil beda", () => {
    expect(canEditEvent(A("View", "Budi@X.com"), "budi@x.COM", false)).toBe(true);
  });
  it("Kesekretariatan boleh", () => {
    expect(canEditEvent(A("View"), undefined, true)).toBe(true);
  });
  it("pembuat kosong dan View: tidak boleh", () => {
    expect(canEditEvent(A("View"), undefined, false)).toBe(false);
    expect(canEditEvent(A("View"), "", false)).toBe(false);
  });
});

describe("proxy: update event", () => {
  const calls: any[] = [];
  const REC = "recAAAAAAAAAAAAAA";
  let creator = "pembuat@x.com";
  beforeEach(() => {
    calls.length = 0; creator = "pembuat@x.com";
    process.env.AIRTABLE_TOKEN = "x";
    vi.stubGlobal("fetch", async (u: any, init: any) => {
      calls.push([String(u), init?.method || "GET", init?.body]);
      if ((init?.method || "GET") === "GET") return new Response(JSON.stringify({ id: REC, fields: { [EV_OLEH]: creator } }), { status: 200 });
      return new Response(JSON.stringify({ records: [{ id: REC, fields: {} }] }), { status: 200 });
    });
  });
  const upd = (acc: any) => handleCall("update_records_for_table", { baseId: BASE_BPK, tableId: T.events, records: [{ id: REC, fields: { fld0d9tIyi4nyTZsM: "Baru" } }] }, acc);
  const acc = (o: any) => ({ email: "u@x.com", nama: "U", status: "Disetujui", level: "View", tabs: ["Kalender"], ...o });

  it("View non-pembuat mendapat 403 dan tidak menulis", async () => {
    await expect(upd(acc({}))).rejects.toMatchObject({ status: 403 });
    expect(calls.some((c) => c[1] === "PATCH")).toBe(false);
  });
  it("pembuat (level View) boleh", async () => {
    await upd(acc({ email: "Pembuat@x.com" }));
    expect(calls.some((c) => c[1] === "PATCH")).toBe(true);
  });
  it("anggota Kesekretariatan boleh", async () => {
    await upd(acc({ email: "sekre@x.com" }));
    expect(calls.some((c) => c[1] === "PATCH")).toBe(true);
  });
  it("Admin boleh pada event tanpa pembuat", async () => {
    creator = "";
    await upd(acc({ level: "Admin", tabs: ["Kalender", "Administrasi"] }));
    expect(calls.some((c) => c[1] === "PATCH")).toBe(true);
  });
  it("tanpa tab Kalender/Event ditolak walau pembuat", async () => {
    await expect(upd(acc({ email: "pembuat@x.com", tabs: ["Dashboard"] }))).rejects.toMatchObject({ status: 403 });
  });
  it("field Dibuat oleh tidak boleh diubah dari browser", async () => {
    await expect(handleCall("update_records_for_table", { baseId: BASE_BPK, tableId: T.events, records: [{ id: REC, fields: { [EV_OLEH]: "saya@x.com" } }] }, acc({ level: "Admin", tabs: ["Kalender"] }))).rejects.toMatchObject({ status: 403 });
  });
  it("pembuatan event mengisi Dibuat oleh dengan email akun (server)", async () => {
    await handleCall("create_records_for_table", { baseId: BASE_BPK, tableId: T.events, records: [{ fields: { fld0d9tIyi4nyTZsM: "X" } }] }, acc({ level: "Edit", email: "Asli@x.com" }));
    const post = calls.find((c) => c[1] === "POST");
    expect(JSON.parse(post[2]).records[0].fields[EV_OLEH]).toBe("asli@x.com");
  });
});

it("GET rekaman tunggal tidak memakai fields[] (Airtable menolaknya: parameter validation failed)", async () => {
  vi.resetModules();
  process.env.AIRTABLE_TOKEN = "x";
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (u: any) => { urls.push(String(u)); return new Response(JSON.stringify({ id: "recAAAAAAAAAAAAAA", fields: {} }), { status: 200 }); });
  const { getRecord } = await import("../src/lib/airtable");
  await getRecord("appIGR8Duhj3Vsz48", "tblbAIILkeRIwn3kl", "recAAAAAAAAAAAAAA");
  expect(urls[0]).toContain("returnFieldsByFieldId=true");
  expect(urls[0]).not.toMatch(/fields(%5B|\[)/i);
});
