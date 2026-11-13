import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { PROKER_JS } from "@/ui/proker-js";
import { GRUP_STATUS } from "@/lib/proker-ringkas";

const P = (nama: string, status: string, total: number) => ({ id: "rec" + nama, nama, detail: "", seksiPengaju: "Forkom 1", bidang: "K", mulai: "2027-01", seksiTerlibat: [], status,
  mode: "Total", totalPemasukan: 0, totalPengeluaran: total, baris: [], keputusan: [], baru: false, aksi: [], seksiAksi: [] });

async function boot(programs: any[], extraHtml = "", bisaSetuju = false) {
  const dom = new JSDOM(`<body><div id="proTiles"></div><p id="proMsg"></p><table><thead><tr><th>Program</th><th>Seksi</th><th>Mulai</th><th>Status</th><th>Anggaran</th><th>Sisa</th></tr></thead><tbody id="proBody"></tbody></table><section id="proDashCard" hidden><div id="proDashBody"></div></section>${extraHtml}</body>`, { runScripts: "outside-only", url: "https://e.test/" });
  const w: any = dom.window;
  w.__ME__ = { viewAs: false };
  w.fetch = vi.fn(async (_u: string, init: any) => {
    const b = JSON.parse(init.body);
    if (b.aksi === "daftar") return { ok: true, status: 200, json: async () => ({ programs, bisaSetuju }) };
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
  w.EPK.modal = (title: string, box: any) => { const m = w.document.createElement("div"); m.id = "modal"; m.appendChild(w.document.createTextNode(title)); m.appendChild(box); w.document.body.appendChild(m); };
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

describe("kartu Menunggu tindakan saya", () => {
  const kartu = (w: any) => w.document.querySelector("#proTiles .tile.tunggu");
  it("tidak muncul bagi akun selain Sekjen / Koordinator BPK", async () => {
    const w = await boot(DATA); w.EPK_PROKER_OPEN(); await wait();
    expect(kartu(w)).toBeNull();
    expect(w.document.getElementById("proTiles").textContent).not.toContain("Menunggu tindakan saya");
  });
  it("muncul berwarna bagi Sekjen / Koordinator BPK dengan jumlah program yang perlu tindakan", async () => {
    const w = await boot([{ ...P("D", "Menunggu Sekjen", 50), aksi: ["Sekjen"] }, P("A", "Selesai", 1)], "", true); w.EPK_PROKER_OPEN(); await wait();
    expect(kartu(w).textContent).toContain("Menunggu tindakan saya");
    expect(digits(kartu(w).textContent)).toBe("1");
    expect(kartu(w).className).not.toContain("nol");
  });
  it("tanpa antrean, kartu tampil netral (nol)", async () => {
    const w = await boot([P("A", "Selesai", 1)], "", true); w.EPK_PROKER_OPEN(); await wait();
    expect(kartu(w).className).toContain("nol");
  });
});

describe("status lama ditampilkan sebagai Menunggu Sekjen", () => {
  it("Menunggu Koord Bidang dan Menunggu Kolaborasi tampil sebagai Menunggu Sekjen dan tetap terhitung menunggu", async () => {
    const w = await boot([P("L1", "Menunggu Koord Bidang", 10), P("L2", "Menunggu Kolaborasi", 20)]); w.EPK_PROKER_OPEN(); await wait();
    const r = rows(w); expect(r.length).toBe(2);
    r.forEach((x: string) => { expect(x).toContain("Menunggu Sekjen"); expect(x).not.toContain("Koord Bidang"); expect(x).not.toContain("Kolaborasi"); });
    expect(digits(tile(w, "menunggu").textContent)).toBe("2" + "30");
  });
});

describe("popup detail program: realisasi anggaran", () => {
  const R = { ...P("Retret", "Disetujui", 700000), terpakai: 200000, sisa: 500000, realisasi: [{ tanggal: "2026-11-01", nominal: 200000, keterangan: "DP tempat", penerima: "Gereja" }] };
  it("menampilkan terpakai, sisa, dan catatan realisasi", async () => {
    const w = await boot([R]); w.EPK_PROKER_OPEN(); await wait();
    click(w, w.document.querySelector("#proBody tr")); await wait();
    const t = w.document.querySelector("#modal").textContent;
    expect(t).toContain("Realisasi anggaran");
    expect(digits(t)).toContain("200000"); expect(digits(t)).toContain("500000");
    expect(t).toContain("DP tempat"); expect(t).toContain("Gereja");
  });
  it("belum ada realisasi: tulisan Belum ada realisasi", async () => {
    const w = await boot([{ ...R, terpakai: 0, sisa: 700000, realisasi: [] }]); w.EPK_PROKER_OPEN(); await wait();
    click(w, w.document.querySelector("#proBody tr")); await wait();
    expect(w.document.querySelector("#modal").textContent).toContain("Belum ada realisasi");
  });
  it("program yang belum disetujui tidak menampilkan bagian realisasi", async () => {
    const w = await boot([{ ...R, status: "Menunggu Sekjen", terpakai: 0, sisa: 0, realisasi: [] }]); w.EPK_PROKER_OPEN(); await wait();
    click(w, w.document.querySelector("#proBody tr")); await wait();
    expect(w.document.querySelector("#modal").textContent).not.toContain("Realisasi anggaran");
  });
});

describe("daftar & tile: sisa anggaran langsung terlihat", () => {
  const M = (nama: string, status: string, total: number, sisa: number | null) => ({ ...P(nama, status, total), terpakai: sisa == null ? null : total - sisa, sisa, milik: sisa != null, realisasi: [] });
  it("kolom Sisa di tiap baris; '-' bila bukan milik seksi atau belum disetujui", async () => {
    const w = await boot([M("A", "Disetujui", 1000000, 400000), M("B", "Disetujui", 500000, null), M("C", "Menunggu Sekjen", 300000, null)]); w.EPK_PROKER_OPEN(); await wait();
    const r = rows(w);
    expect(digits(r[0])).toContain("400000");
    expect(r[1].endsWith("-")).toBe(true); expect(r[2].endsWith("-")).toBe(true);
  });
  it("tile Disetujui dan berjalan menampilkan jumlah sisa hanya dari program yang sisanya diketahui", async () => {
    const w = await boot([M("A", "Disetujui", 1000000, 400000), M("B", "Berjalan", 500000, 100000), M("C", "Disetujui", 900000, null)]); w.EPK_PROKER_OPEN(); await wait();
    const t = tile(w, "berjalan").textContent;
    expect(digits(t)).toContain("500000"); // sisa 400000 + 100000
    expect(t).toContain("sisa");
  });
  it("popup tanpa bagian realisasi bila sisa tidak diketahui", async () => {
    const w = await boot([M("B", "Disetujui", 500000, null)]); w.EPK_PROKER_OPEN(); await wait();
    click(w, w.document.querySelector("#proBody tr")); await wait();
    expect(w.document.querySelector("#modal").textContent).not.toContain("Realisasi anggaran");
  });
});
