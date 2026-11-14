import { describe, it, expect, vi, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { T_NOTIF, NT } from "../src/lib/proker-schema";
import { renderDashboard } from "../src/ui/render";

let rows: any[];
beforeEach(() => {
  vi.resetModules();
  process.env.AIRTABLE_TOKEN = "x";
  rows = [
    { id: "recAAAAAAAAAAAAAA", fields: { [NT.pesan]: "Untuk saya", [NT.penerima]: "me@x.com", [NT.tautan]: "proker:recP", [NT.dibaca]: false, [NT.waktu]: "2026-11-13T01:00:00.000Z" } },
    { id: "recBBBBBBBBBBBBBB", fields: { [NT.pesan]: "Untuk orang lain", [NT.penerima]: "lain@x.com", [NT.tautan]: "", [NT.waktu]: "2026-11-13T02:00:00.000Z" } },
  ];
  vi.stubGlobal("fetch", async (u: any, init: any = {}) => {
    const url = new URL(String(u));
    const method = init.method || "GET";
    if (method === "GET") {
      const f = url.searchParams.get("filterByFormula") || "";
      const m = /"([^"]+)"/.exec(f);
      return new Response(JSON.stringify({ records: m ? rows.filter((r) => r.fields[NT.penerima] === m[1]) : rows }), { status: 200 });
    }
    if (method === "PATCH") {
      for (const r of JSON.parse(init.body).records) Object.assign(rows.find((x) => x.id === r.id).fields, r.fields);
      return new Response("{}", { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });
});
const acc: any = { email: "Me@x.com", nama: "Me", status: "Disetujui", level: "View", tabs: [] };

describe("notif", () => {
  it("daftarNotif hanya mengembalikan milik akun", async () => {
    const { daftarNotif } = await import("../src/lib/notif");
    const l = await daftarNotif(acc);
    expect(l.map((n: any) => n.pesan)).toEqual(["Untuk saya"]);
    expect(l[0]).toMatchObject({ id: "recAAAAAAAAAAAAAA", dibaca: false, tautan: "proker:recP" });
  });
  it("tandaiDibaca id milik orang lain -> 403 dan tidak mengubah apa pun", async () => {
    const { tandaiDibaca } = await import("../src/lib/notif");
    await expect(tandaiDibaca(acc, ["recAAAAAAAAAAAAAA", "recBBBBBBBBBBBBBB"])).rejects.toMatchObject({ status: 403 });
    expect(rows[0].fields[NT.dibaca]).toBe(false);
  });
  it("tandaiDibaca milik sendiri menandai dibaca", async () => {
    const { tandaiDibaca } = await import("../src/lib/notif");
    await tandaiDibaca(acc, ["recAAAAAAAAAAAAAA"]);
    expect(rows[0].fields[NT.dibaca]).toBe(true);
  });
  it("tandaiDibaca menolak id yang bukan record id", async () => {
    const { tandaiDibaca } = await import("../src/lib/notif");
    await expect(tandaiDibaca(acc, ["bukan-id"])).rejects.toMatchObject({ status: 400 });
  });
  it("buatNotif tidak melempar saat Airtable 500", async () => {
    vi.stubGlobal("fetch", async () => new Response("boom", { status: 500 }));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { buatNotif } = await import("../src/lib/notif");
    await expect(buatNotif(["a@x.com"], "p", "t")).resolves.toBeUndefined();
    err.mockRestore();
  });
});

describe("lonceng di header", () => {
  // Jalankan skrip header (EPK + applyMe) di JSDOM dengan akun level View.
  function boot(me: any) {
    const html = renderDashboard({ email: "v@x.com", nama: "V", status: "Disetujui", level: me.level, tabs: [] } as any);
    const scripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g)).map((m) => m[1]);
    const shim = scripts.find((s) => s.includes("function applyMe"))!;
    const dom = new JSDOM('<body><div id="me"></div></body>', { runScripts: "outside-only", url: "https://e.test/" });
    const w: any = dom.window;
    w.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) }));
    w.eval(shim); // skrip header mengisi __ME__ sendiri; timpa sesudahnya
    w.__ME__ = { email: "v@x.com", nama: "V", tabs: [], tabNames: [], jabatan: "", ...me };
    w.eval("applyMe()");
    return w.document;
  }
  it("tampil untuk akun level View", () => {
    expect(boot({ level: "View" }).getElementById("epkBell")).toBeTruthy();
  });
  it("tidak tampil saat Lihat sebagai", () => {
    expect(boot({ level: "View", viewAs: "x@y.z" }).getElementById("epkBell")).toBeNull();
  });
  it("ada tautan Download app Android di dekat profil", () => {
    const a = boot({ level: "View" }).querySelector("#me a.epk-apk") as any;
    expect(a.textContent).toContain("Download app Android");
    expect(a.getAttribute("href")).toBe("/e-PKK-BPKPKK-Bandung.apk");
    expect(a.hasAttribute("download")).toBe(true);
  });
});
