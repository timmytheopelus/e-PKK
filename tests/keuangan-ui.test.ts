import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { KEUANGAN_JS } from "@/ui/keuangan-js";
import { KEU } from "@/lib/policy";

let n = 0;
const tx = (jenis: string, tgl: string, nominal: number, ket: string, o: { rek?: string; bidang?: string; account?: string; hapus?: boolean } = {}) => ({
  id: "rec" + ++n,
  cellValuesByFieldId: {
    [KEU.jenis]: { name: jenis }, [KEU.tgl]: tgl, [KEU.nominal]: nominal, [KEU.ket]: ket,
    ...(o.rek ? { [KEU.rekening]: [{ id: "r", name: o.rek }] } : {}),
    ...(o.bidang ? { [KEU.bidang]: [{ id: "b", name: o.bidang }] } : {}),
    ...(o.account ? { [KEU.account]: [{ id: "a", name: o.account }] } : {}),
    ...(o.hapus ? { [KEU.hapus]: true } : {}),
  },
});
const DATA = [
  tx("Saldo Awal", "2026-01-15", 1000000, "Saldo awal", { rek: "Utama (BCA)" }),
  tx("Transaksi Masuk", "2026-10-05", 500000, "FPtM", { rek: "Utama (BCA)", bidang: "5-Doa", account: "32-Pendaftaran\n  (event)" }),
  tx("Transaksi Keluar", "2026-10-06", 200000, "Konsumsi", { rek: "Utama (BCA)", bidang: "1-Operasional", account: "7-Konsumsi" }),
  tx("Transaksi Masuk", "2026-11-11", 300000, "Janji iman", { rek: "Utama (BCA)", bidang: "5-Doa", account: "12-Donasi" }),
  tx("Transaksi Keluar", "2026-11-12", 999999, "Salah input", { rek: "Utama (BCA)", bidang: "1-Operasional", hapus: true }),
  tx("Transaksi Masuk", "2025-12-31", 10000, "Tahun lalu", { rek: "Lama" }),
];

async function boot() {
  const dom = new JSDOM('<body><div id="keuRoot"></div></body>', { runScripts: "outside-only", url: "https://e.test/" });
  const w: any = dom.window;
  w.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ records: DATA }) }));
  w.EPK = {
    el(tag: string, props: any = {}, kids: any[] = []) {
      const e = w.document.createElement(tag);
      Object.keys(props).forEach((k) => { if (k === "text") e.textContent = props[k]; else if (k === "class") e.className = props[k]; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), props[k]); else if (props[k] != null) e.setAttribute(k, props[k]); });
      kids.forEach((c: any) => { if (c != null) e.appendChild(typeof c === "string" ? w.document.createTextNode(c) : c); });
      return e;
    },
  };
  w.eval(KEUANGAN_JS);
  w.EPK_KEU_OPEN();
  await new Promise((r) => setTimeout(r, 30));
  return w;
}
const cards = (w: any) => [...w.document.querySelectorAll(".keu-card")].map((e: any) => ({ label: e.querySelector(".l").textContent, value: e.querySelector(".n").textContent }));
const digits = (s: string) => s.replace(/[^\d]/g, "");
const tab = (w: any, name: string) => [...w.document.querySelectorAll(".keu-tab")].find((b: any) => b.textContent === name) as any;
const click = (w: any, el: any) => el.dispatchEvent(new w.Event("click", { bubbles: true }));

describe("laporan keuangan: halaman depan", () => {
  it("hanya Ringkasan: 4 kartu berbahasa awam, default tahun terbaru, transaksi dihapus diabaikan", async () => {
    const w = await boot();
    const c = cards(w);
    expect(c.map((x: any) => x.label)).toEqual(["Saldo kas saat ini", "Uang masuk", "Uang keluar", "Selisih"]);
    expect(digits(c[0].value)).toBe("1610000"); // 1.000.000 + 500.000 - 200.000 + 300.000 + 10.000
    expect(digits(c[1].value)).toBe("800000");
    expect(digits(c[2].value)).toBe("200000");
    expect(digits(c[3].value)).toBe("600000");
    expect(w.document.querySelector("table")).toBeNull(); // tabel rinci tidak muncul di halaman depan
    expect(w.document.body.textContent).not.toContain("Salah input");
    expect([...w.document.querySelectorAll(".keu-tab")].map((b: any) => b.textContent)).toEqual(["Ringkasan", "Transaksi", "Per Bulan", "Per Bidang", "Per Rekening", "Anggaran"]);
  });
  it("nomor urut di depan nama bidang dibuang untuk tampilan", async () => {
    const w = await boot();
    const t = w.document.querySelector(".keu-panels").textContent;
    expect(t).toContain("Operasional");
    expect(t).not.toContain("1-Operasional");
  });
  it("memilih bulan mempersempit kartu periode, saldo kas tetap seluruh periode", async () => {
    const w = await boot();
    const bulan = w.document.querySelectorAll(".keu-per select")[1];
    bulan.value = "11"; bulan.dispatchEvent(new w.Event("change"));
    const c = cards(w);
    expect(digits(c[0].value)).toBe("1610000");
    expect(digits(c[1].value)).toBe("300000");
    expect(c[2].value).toBe("Rp 0");
  });
});

describe("laporan keuangan: klik kartu membuka rincian", () => {
  it("kartu Uang keluar membuka tab Transaksi hanya berisi uang keluar", async () => {
    const w = await boot();
    click(w, w.document.querySelectorAll(".keu-card")[2]);
    expect(tab(w, "Transaksi").getAttribute("aria-selected")).toBe("true");
    const rows = [...w.document.querySelectorAll("tbody tr")].map((r: any) => r.textContent);
    expect(rows.length).toBe(1);
    expect(rows[0]).toContain("Konsumsi");
    expect(rows[0]).toContain("Uang keluar");
  });
  it("kartu Saldo kas membuka Per Rekening dengan saldo tiap rekening", async () => {
    const w = await boot();
    click(w, w.document.querySelectorAll(".keu-card")[0]);
    const t = w.document.querySelector("table").textContent;
    expect(t).toContain("Utama (BCA)");
    expect(t).toContain("Lama");
    expect(digits(w.document.querySelector("tfoot").textContent)).toContain("1610000");
  });
  it("baris transaksi bisa diklik untuk melihat detail lengkap", async () => {
    const w = await boot();
    let titleShown = "";
    w.EPK.modal = (t: string, body: any) => { titleShown = t + "|" + body.textContent; return {}; };
    click(w, tab(w, "Transaksi"));
    const row = [...w.document.querySelectorAll("tbody tr")].find((r: any) => r.textContent.includes("Konsumsi"));
    click(w, row);
    expect(titleShown).toContain("Detail transaksi");
    expect(titleShown).toContain("Konsumsi");
    expect(titleShown).toContain("Bidang");
  });
  it("Per Bidang: bisa ganti ke kategori dan nama kategori dirapikan", async () => {
    const w = await boot();
    click(w, tab(w, "Per Bidang"));
    expect(w.document.querySelector("table").textContent).toContain("Doa");
    click(w, w.document.querySelectorAll(".keu-seg button")[1]);
    expect(w.document.querySelector("table").textContent).toContain("Pendaftaran (event)");
  });
  it("Per Bulan: baris bulan memfilter Transaksi ke bulan itu", async () => {
    const w = await boot();
    click(w, tab(w, "Per Bulan"));
    const row = [...w.document.querySelectorAll("tbody tr")].find((r: any) => r.textContent.includes("November 2026"));
    click(w, row);
    const rows = [...w.document.querySelectorAll("tbody tr")].map((r: any) => r.textContent);
    expect(rows.length).toBe(1);
    expect(rows[0]).toContain("Janji iman");
  });
});

describe("laporan keuangan: tampilan tabel", () => {
  it("header tabel menempel, huruf tebal dan lebih besar, baris selang-seling", async () => {
    const w = await boot();
    click(w, tab(w, "Per Bulan"));
    const css: string = w.document.getElementById("keuCss").textContent;
    expect(css).toMatch(/\.keu-tw thead th\{position:sticky;top:0;[^}]*font-size:15px;font-weight:700/);
    expect(css).toContain(".keu-tw tbody tr:nth-child(even) td{background:var(--bg)}");
    expect(css).toMatch(/\.keu-tw\{overflow:auto;max-height:70vh/); // header menempel relatif terhadap kotak tabel
    expect(w.document.querySelector(".keu-tw thead th")).toBeTruthy();
  });
});

describe("laporan keuangan: ekspor dan galat", () => {
  it("CSV: header berbahasa Indonesia, minus untuk uang keluar, transaksi dihapus tidak ikut", async () => {
    const w = await boot();
    const csv: string = w.EPK_KEU_CSV();
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Jumlah (+ masuk / - keluar)");
    expect(csv).toContain(",-200000,");
    expect(csv).not.toContain("Salah input");
  });
  it("gagal memuat menampilkan pesan dan tombol coba lagi", async () => {
    const dom = new JSDOM('<body><div id="keuRoot"></div></body>', { runScripts: "outside-only", url: "https://e.test/" });
    const w: any = dom.window;
    w.fetch = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ message: "Anda tidak punya izin membaca data ini." }) }));
    w.EPK = { el: (t: string, p: any = {}, k: any[] = []) => { const e = w.document.createElement(t); if (p.text) e.textContent = p.text; if (p.class) e.className = p.class; k.forEach((c: any) => c && e.appendChild(c)); return e; } };
    w.eval(KEUANGAN_JS); w.EPK_KEU_OPEN();
    await new Promise((r) => setTimeout(r, 30));
    expect(w.document.body.textContent).toContain("belum bisa dimuat");
    expect(w.document.body.textContent).toContain("Coba lagi");
  });
});
