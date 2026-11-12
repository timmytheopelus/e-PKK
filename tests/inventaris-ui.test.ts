import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { INVENTARIS_JS } from "@/ui/inventaris-js";
import { INV } from "@/lib/policy";

const item = (id: string, nama: string, lokasi: string | null, tahun: string | null, jumlah: number, harga: number) => ({
  id, cellValuesByFieldId: { [INV.nama]: nama, ...(lokasi ? { [INV.lokasi]: lokasi } : {}), ...(tahun ? { [INV.tahun]: tahun } : {}), [INV.jumlah]: jumlah, [INV.harga]: harga, [INV.total]: jumlah * harga, [INV.status]: "Bisa Dipinjam" },
});

async function boot(level = "Edit") {
  const dom = new JSDOM('<body><div id="invRoot"></div></body>', { runScripts: "outside-only", url: "https://e.test/" });
  const w: any = dom.window;
  const data: any = {
    get_select_options: { lokasi: ["Aula Bawah", "R. Band"], status: ["Bisa Dipinjam", "Rusak"] },
    list_inv: { records: [item("rec1", "Kursi", "R. Band", "2023-05-01", 10, 100000), item("rec2", "Mic", "R. Band", "2021-01-01", 2, 500000), item("rec3", "Meja", "Aula Bawah", "2023-02-02", 4, 250000), item("rec4", "Kabel", null, null, 1, 1000), item("rec5", "Gitar", "R. Band", null, 1, 3000000)] },
    list_log: { records: [] },
  };
  w.fetch = vi.fn(async (_u: string, init: any) => {
    const b = JSON.parse(init.body);
    const out = b.tool === "get_select_options" ? data.get_select_options : b.input.tableId === "tblkbpgHrJ2ZW8WzL" ? data.list_inv : data.list_log;
    return { ok: true, status: 200, json: async () => out };
  });
  w.__ME__ = { level, nama: "T", email: "t@e.c" };
  w.EPK = {
    el(tag: string, props: any = {}, kids: any[] = []) {
      const e = w.document.createElement(tag);
      Object.keys(props).forEach((k) => { if (k === "text") e.textContent = props[k]; else if (k === "class") e.className = props[k]; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), props[k]); else if (props[k] != null) e.setAttribute(k, props[k]); });
      kids.forEach((c: any) => { if (c != null) e.appendChild(typeof c === "string" ? w.document.createTextNode(c) : c); });
      return e;
    },
    modal() { return {}; },
  };
  w.eval(INVENTARIS_JS);
  w.EPK_INV_OPEN();
  await new Promise((r) => setTimeout(r, 30));
  return w;
}

describe("tabel inventaris dikelompokkan lokasi lalu tahun", () => {
  it("urutan: lokasi A-Z, 'Tanpa lokasi' terakhir; tahun menurun, 'Tanpa tahun' terakhir", async () => {
    const w = await boot();
    const g = [...w.document.querySelectorAll("tr.inv-g1, tr.inv-g2")].map((tr: any) => tr.querySelector(".inv-gh > span").textContent.replace(/^[▾▸]/, ""));
    expect(g).toEqual(["Aula Bawah", "Tahun perolehan 2023", "R. Band", "Tahun perolehan 2023", "Tahun perolehan 2021", "Tahun perolehan (Tanpa tahun)", "(Tanpa lokasi)", "Tahun perolehan (Tanpa tahun)"]);
    expect(w.document.querySelectorAll("tr.clk").length).toBe(5);
  });
  it("subtotal per lokasi dan bisa ditutup", async () => {
    const w = await boot();
    const band = [...w.document.querySelectorAll("tr.inv-g1")].find((tr: any) => tr.textContent.includes("R. Band")) as any;
    expect(band.textContent).toContain("3 barang");
    expect(band.textContent).toContain("13 unit");
    band.click();
    expect(w.document.querySelectorAll("tr.clk").length).toBe(2); // sisa Meja dan Kabel
  });
  it("tombol + Lokasi baru ada di form tambah barang untuk level Edit", async () => {
    const w = await boot("Edit");
    const add = [...w.document.querySelectorAll("button")].find((b: any) => b.textContent.includes("Tambah barang")) as any;
    expect(add).toBeTruthy();
  });
  it("level View tidak punya tombol tambah", async () => {
    const w = await boot("View");
    expect([...w.document.querySelectorAll("button")].some((b: any) => b.textContent.includes("Tambah barang"))).toBe(false);
  });
});
