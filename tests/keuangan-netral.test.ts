import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { KEUANGAN_JS } from "@/ui/keuangan-js";
import { KEU } from "@/lib/policy";

let n = 0;
const tx = (jenis: string, tgl: string, nominal: number, ket: string, account: string, rek = "Utama (BCA)", bidang = "2-Kegiatan") => ({
  id: "rec" + ++n,
  cellValuesByFieldId: {
    [KEU.jenis]: { name: jenis }, [KEU.tgl]: tgl, [KEU.nominal]: nominal, [KEU.ket]: ket,
    [KEU.rekening]: [{ id: "r", name: rek }], [KEU.bidang]: [{ id: "b", name: bidang }], [KEU.account]: [{ id: "a", name: account }],
  },
});
const DATA = [
  tx("Saldo Awal", "2026-01-15", 1000, "Saldo awal", "79-Saldo awal rekening BRI"),
  tx("Transaksi Masuk", "2026-02-01", 500, "Saldo awal dicatat sebagai masuk", "1-Saldo awal rekening utama"),
  tx("Transaksi Keluar", "2026-02-02", 300, "Pindah ke rekening kedua", "4-Mutasi antar rekening"),
  tx("Transaksi Masuk", "2026-02-02", 300, "Terima dari rekening utama", "4-Mutasi antar rekening", "Kedua (BCA)"),
  tx("Transaksi Masuk", "2026-03-01", 700, "Pendaftaran", "32-Pendaftaran (event)"),
  tx("Transaksi Keluar", "2026-03-02", 900, "Konsumsi", "20-Konsumsi (event)"),
  tx("Transaksi Masuk", "2026-03-03", 400, "Janji iman", "12-Donasi pengurus BPK"),
  tx("Transaksi Masuk", "2026-03-04", 200, "Donatur luar", "83-Donasi Extern"),
  tx("Transaksi Keluar", "2026-03-05", 50, "Penyesuaian", "27-Adjustment"),
  tx("Transaksi Masuk", "2026-03-05", 50, "Penyesuaian", "27-Adjustment"),
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
const val = (w: any, label: string) => {
  const c = [...w.document.querySelectorAll(".keu-card")].find((e: any) => e.querySelector(".l").textContent === label) as any;
  return c.querySelector(".n").textContent.replace(/[^\d−-]/g, "");
};
const tab = (w: any, name: string) => [...w.document.querySelectorAll(".keu-tab")].find((b: any) => b.textContent === name) as any;
const click = (w: any, el: any) => el.dispatchEvent(new w.Event("click", { bubbles: true }));

describe("laporan keuangan: perpindahan uang tidak dihitung sebagai uang masuk/keluar", () => {
  it("kartu hanya menghitung pemasukan dan pengeluaran sebenarnya; saldo kas tetap lengkap", async () => {
    const w = await boot();
    expect(val(w, "Uang masuk")).toBe("1300"); // 700 + 400 + 200
    expect(val(w, "Uang keluar")).toBe("900");
    expect(val(w, "Selisih")).toBe("400");
    // saldo: 1000 + 500 - 300 + 300 + 700 - 900 + 400 + 200 - 50 + 50
    expect(val(w, "Saldo kas saat ini")).toBe("1900");
  });
  it("catatan menyebut jumlah yang tidak dihitung dan hasil kegiatan sebelum donasi", async () => {
    const w = await boot();
    const t = w.document.querySelector("#keuRoot").textContent;
    expect(t).toContain("Tidak dihitung sebagai uang masuk/keluar");
    expect(t).toContain("(masuk Rp 1.850, keluar Rp 350)"); // masuk: saldo awal 1000 + 500 + 300 + 50; keluar: 300 + 50
  });
  it("hasil kegiatan = selisih dikurangi donasi pengurus dan donatur luar", async () => {
    const w = await boot();
    const t = w.document.querySelector("#keuRoot").textContent;
    expect(t).toContain("Hasil kegiatan sebelum donasi pengurus (janji iman) dan donatur luar sebesar Rp 600");
    expect(t).toContain("−Rp 200 (defisit)"); // 700 - 900
  });
  it("Per Rekening tetap menghitung perpindahan uang", async () => {
    const w = await boot();
    click(w, tab(w, "Per Rekening"));
    const rows = [...w.document.querySelectorAll("tbody tr")].map((r: any) => [...r.children].map((c: any) => c.textContent));
    const kedua = rows.find((r: any) => r[0] === "Kedua (BCA)");
    expect(kedua[2].replace(/\D/g, "")).toBe("300"); // uang masuk rekening kedua
    expect(rows.find((r: any) => r[0] === "Utama (BCA)")[3].replace(/\D/g, "")).toBe("1250"); // 300 + 900 + 50 keluar
  });
  it("Per Bulan: masuk/keluar tanpa perpindahan, saldo akhir bulan lengkap", async () => {
    const w = await boot();
    click(w, tab(w, "Per Bulan"));
    const rows = [...w.document.querySelectorAll("tbody tr")].map((r: any) => [...r.children].map((c: any) => c.textContent));
    const feb = rows.find((r: any) => r[0].startsWith("Februari"));
    expect(feb![1].replace(/\D/g, "")).toBe("0");
    expect(feb![2].replace(/\D/g, "")).toBe("0");
    expect(feb![4].replace(/[^\d]/g, "")).toBe("1500"); // saldo akhir Feb: 1000 + 500 - 300 + 300
  });
});
