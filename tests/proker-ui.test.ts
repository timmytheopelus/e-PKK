import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { PROKER_JS } from "@/ui/proker-js";
import { GRUP_STATUS } from "@/lib/proker-ringkas";

const P = (nama: string, status: string, total: number) => ({ id: "rec" + nama, nama, detail: "", seksiPengaju: "Forkom 1", bidang: "K", mulai: "2027-01", seksiTerlibat: [], status,
  mode: "Total", totalPemasukan: 0, totalPengeluaran: total, baris: [], keputusan: [], baru: false, aksi: [], seksiAksi: [] });

async function boot(programs: any[], extraHtml = "") {
  const dom = new JSDOM(`<body><div id="proTiles"></div><p id="proMsg"></p><table><tbody id="proBody"></tbody></table><section id="proDashCard" hidden><div id="proDashBody"></div></section>${extraHtml}</body>`, { runScripts: "outside-only", url: "https://e.test/" });
  const w: any = dom.window;
  w.__ME__ = { viewAs: false };
  w.fetch = vi.fn(async (_u: string, init: any) => {
    const b = JSON.parse(init.body);
    if (b.aksi === "daftar") return { ok: true, status: 200, json: async () => ({ programs }) };
    return (w.__RESP__ || { ok: true, status: 200, json: async () => ({}) });
  });
  w.EPK = {
    el(tag: string, props: any = {}, kids: any[] = []) {
      const e = w.document.createElement(tag);
      Object.keys(props).forEach((k) => { if (k === "text") e.textContent = props[k]; else if (k === "class") e.className = props[k]; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), props[k]); else if (props[k] != null) e.setAttribute(k, props[k]); });
      kids.forEach((c: any) => { if (c != null) e.appendChild(typeof c === "string" ? w.document.createTextNode(c) : c); });
      return e;
    },
  };
  w.eval(PROKER_JS);
  return w;
}
const wait = () => new Promise((r) => setTimeout(r, 30));
const rows = (w: any) => [...w.document.querySelectorAll("#proBody tr")].map((r: any) => r.textContent);
const tile = (w: any, g: string) => w.document.querySelector(`#proTiles [data-grup="${g}"]`);
const click = (w: any, el: any) => el.dispatchEvent(new w.Event("click", { bubbles: true }));
const digits = (s: string) => s.replace(/[^\d]/g, "");

const DATA = [P("A", "Selesai", 100), P("B", "Disetujui", 200), P("C", "Berjalan", 300), P("D", "Menunggu Sekjen", 50), P("E", "Draft", 999)];

describe("menu Program Kerja: tiga angka", () => {
  it("menampilkan jumlah dan rupiah tiap kelompok", async () => {
    const w = await boot(DATA); w.EPK_PROKER_OPEN(); await wait();
    expect(tile(w, "selesai").textContent).toContain("Selesai");
    expect(digits(tile(w, "selesai").textContent)).toBe("1" + "100");
    expect(digits(tile(w, "berjalan").textContent)).toBe("2" + "500");
    expect(digits(tile(w, "menunggu").textContent)).toBe("1" + "50");
  });
  it("klik angka memfilter tabel, klik lagi melepas", async () => {
    const w = await boot(DATA); w.EPK_PROKER_OPEN(); await wait();
    expect(rows(w).length).toBe(5);
    click(w, tile(w, "berjalan"));
    expect(rows(w).length).toBe(2);
    expect(tile(w, "berjalan").getAttribute("aria-pressed")).toBe("true");
    click(w, tile(w, "berjalan"));
    expect(rows(w).length).toBe(5);
  });
  it("daftar kosong: angka nol dan pesan", async () => {
    const w = await boot([]); w.EPK_PROKER_OPEN(); await wait();
    expect(tile(w, "selesai").textContent).toContain("Rp 0");
    expect(rows(w)[0]).toContain("Belum ada program.");
  });
  it("kelompok status di skrip sama dengan modul server", () => {
    for (const s of Object.values(GRUP_STATUS).flat()) expect(PROKER_JS).toContain(`"${s}"`);
  });
});

describe("kartu ringkasan dashboard", () => {
  it("menampilkan jumlah, nilai, dan yang menunggu Sekjen", async () => {
    const w = await boot([]);
    w.__RESP__ = { ok: true, status: 200, json: async () => ({ selesai: { n: 1, nilai: 100 }, berjalan: { n: 2, nilai: 500 }, menunggu: { n: 2, nilai: 75 }, menungguSekjen: 1 }) };
    await w.EPK_PROKER_DASH();
    const c = w.document.getElementById("proDashCard");
    expect(c.hidden).toBe(false);
    expect(c.textContent).toContain("2 program");
    expect(c.textContent).toContain("Rp 500");
    expect(c.textContent).toContain("1 menunggu Sekjen");
  });
  it("disembunyikan saat server menolak (403)", async () => {
    const w = await boot([]);
    w.document.getElementById("proDashCard").hidden = false;
    w.__RESP__ = { ok: false, status: 403, json: async () => ({ message: "Tidak punya akses" }) };
    await w.EPK_PROKER_DASH();
    expect(w.document.getElementById("proDashCard").hidden).toBe(true);
  });
});
