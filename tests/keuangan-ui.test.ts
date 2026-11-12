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
const stats = (w: any) => [...w.document.querySelectorAll(".keu-n")].map((e: any) => e.textContent.replace(/\s+/g, " "));
const digits = (s: string) => s.replace(/[^\d]/g, "");

describe("laporan keuangan", () => {
  it("default tahun terbaru: saldo seluruh periode, pemasukan/pengeluaran tahun 2026, transaksi dihapus diabaikan", async () => {
    const w = await boot();
    const s = stats(w);
    expect(digits(s[0])).toBe("1610000"); // 1.000.000 + 500.000 - 200.000 + 300.000 + 10.000
    expect(digits(s[1])).toBe("800000");
    expect(digits(s[2])).toBe("200000");
    expect(digits(s[3])).toBe("600000");
    expect(w.document.body.textContent).not.toContain("Salah input");
    expect(w.document.body.textContent).not.toContain("Tahun lalu"); // beda tahun, terfilter
  });
  it("filter bulan mempersempit angka periode tetapi saldo tetap seluruh periode", async () => {
    const w = await boot();
    const bulan = w.document.querySelectorAll(".keu-bar select")[1];
    bulan.value = "11"; bulan.dispatchEvent(new w.Event("change"));
    const s = stats(w);
    expect(digits(s[0])).toBe("1610000");
    expect(digits(s[1])).toBe("300000");
    expect(s[2]).toBe("Rp 0");
  });
  it("rincian per bidang dan account, nama account dirapikan", async () => {
    const w = await boot();
    const t = w.document.body.textContent;
    expect(t).toContain("5-Doa");
    expect(t).toContain("1-Operasional");
    expect(t).toContain("32-Pendaftaran (event)");
  });
  it("CSV: header, tanda minus untuk keluar, dan sel teks tidak bisa jadi rumus", async () => {
    const w = await boot();
    const csv: string = w.EPK_KEU_CSV();
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Nominal (+masuk / -keluar)");
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
    expect(w.document.body.textContent).toContain("Gagal memuat laporan keuangan");
  });
});
