import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { KEUANGAN_JS } from "@/ui/keuangan-js";
import { KEU } from "@/lib/policy";

const MUT = [{
  id: "recM1", cellValuesByFieldId: {
    [KEU.jenis]: { name: "Transaksi Keluar" }, [KEU.tgl]: "2026-10-06", [KEU.nominal]: 200000, [KEU.ket]: "Konsumsi",
    [KEU.rekening]: [{ id: "recREKENING000001", name: "Utama (BCA)" }], [KEU.account]: [{ id: "recACCOUNT0000001", name: "7-Konsumsi" }], [KEU.bidang]: [{ id: "recB", name: "1-Operasional" }],
  },
}];
const PROG = { id: "recPROGRAM0000001", nama: "Retret", seksi: "Forkom 1", status: "Disetujui", anggaran: 700000, terpakai: 200000, sisa: 500000,
  baris: [{ keterangan: "Tempat", jenis: "Pengeluaran", nominal: 500000 }, { keterangan: "Donasi", jenis: "Pemasukan", nominal: 900000 }],
  realisasi: [{ tanggal: "2026-11-01", nominal: 200000, keterangan: "DP tempat", penerima: "Gereja" }] };

async function boot(o: { bisaCatat?: boolean; catat?: () => any } = {}) {
  const dom = new JSDOM('<body><div id="keuRoot"></div></body>', { runScripts: "outside-only", url: "https://e.test/" });
  const w: any = dom.window;
  const calls: { url: string; body: any }[] = [];
  w.fetch = vi.fn(async (url: string, init: any) => {
    const body = JSON.parse(init.body); calls.push({ url, body });
    if (url === "/api/realisasi") {
      if (body.aksi === "catat") { const r = o.catat ? o.catat() : { ok: true, j: { id: "recREAL", sisa: 100000 } }; return { ok: r.ok, status: r.ok ? 200 : 409, json: async () => r.j }; }
      return { ok: true, status: 200, json: async () => ({ programs: [PROG], bisaCatat: o.bisaCatat !== false }) };
    }
    return { ok: true, status: 200, json: async () => ({ records: MUT }) };
  });
  w.EPK = {
    el(tag: string, props: any = {}, kids: any[] = []) {
      const e = w.document.createElement(tag);
      Object.keys(props).forEach((k) => {
        if (k === "text") e.textContent = props[k]; else if (k === "class") e.className = props[k];
        else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), props[k]); else e.setAttribute(k, props[k]);
      });
      kids.forEach((c: any) => { if (c != null) e.appendChild(typeof c === "string" ? w.document.createTextNode(c) : c); });
      return e;
    },
  };
  w.eval(KEUANGAN_JS); w.EPK_KEU_OPEN();
  await new Promise((r) => setTimeout(r, 30));
  return { w, calls };
}
const wait = () => new Promise((r) => setTimeout(r, 30));
const click = (w: any, el: any) => el.dispatchEvent(new w.Event("click", { bubbles: true }));
const tab = (w: any, n: string) => [...w.document.querySelectorAll(".keu-tab")].find((b: any) => b.textContent === n) as any;
const digits = (s: string) => s.replace(/[^\d]/g, "");
async function bukaDetail(w: any) { click(w, tab(w, "Anggaran")); await wait(); click(w, [...w.document.querySelectorAll("tr.clk")][0]); }
const f = (w: any, label: string) => w.document.querySelector('[aria-label="' + label + '"]') as any;

describe("tab Anggaran di Keuangan", () => {
  it("ada tab Anggaran; membuka tab memuat program dengan anggaran, terpakai, dan sisa", async () => {
    const { w, calls } = await boot();
    click(w, tab(w, "Anggaran")); await wait();
    expect(calls.some((c) => c.url === "/api/realisasi" && c.body.aksi === "daftar")).toBe(true);
    const row = w.document.querySelector("tr.clk").textContent;
    expect(row).toContain("Retret");
    expect(digits(row)).toContain("700000"); expect(digits(row)).toContain("200000"); expect(digits(row)).toContain("500000");
  });
  it("membuka program menampilkan baris detail anggaran dan riwayat realisasi", async () => {
    const { w } = await boot(); await bukaDetail(w);
    const t = w.document.body.textContent;
    expect(t).toContain("Tempat"); expect(t).toContain("DP tempat"); expect(t).toContain("Gereja");
  });
  it("tombol Catat realisasi hanya bila bisaCatat", async () => {
    const a = await boot({ bisaCatat: true }); await bukaDetail(a.w);
    expect(a.w.document.body.textContent).toContain("Catat realisasi");
    const b = await boot({ bisaCatat: false }); await bukaDetail(b.w);
    expect(b.w.document.body.textContent).not.toContain("Catat realisasi");
  });
  it("formulir menawarkan Account dan Rekening dari data Mutasi", async () => {
    const { w } = await boot(); await bukaDetail(w);
    click(w, [...w.document.querySelectorAll("button")].find((b: any) => b.textContent === "Catat realisasi"));
    expect([...f(w, "Account").options].map((o: any) => o.value)).toContain("recACCOUNT0000001");
    expect([...f(w, "Rekening").options].map((o: any) => o.textContent)).toContain("Utama (BCA)");
  });
  async function isi(w: any, nominal: string) {
    click(w, [...w.document.querySelectorAll("button")].find((b: any) => b.textContent === "Catat realisasi"));
    f(w, "Tanggal").value = "2026-11-20"; f(w, "Nominal (Rp)").value = nominal; f(w, "Keterangan").value = "Sewa"; f(w, "Penerima").value = "Gereja";
    f(w, "Account").value = "recACCOUNT0000001"; f(w, "Rekening").value = "recREKENING000001";
  }
  const simpan = (w: any) => click(w, [...w.document.querySelectorAll("button")].find((b: any) => b.textContent === "Simpan realisasi"));
  it("nominal melebihi sisa ditolak di formulir dan tidak dikirim", async () => {
    const { w, calls } = await boot(); await bukaDetail(w); await isi(w, "500001");
    simpan(w); await wait();
    expect(w.document.body.textContent).toContain("melebihi sisa");
    expect(calls.some((c) => c.body.aksi === "catat")).toBe(false);
  });
  it("simpan valid mengirim catat, memuat ulang daftar dan laporan, menampilkan pesan sukses", async () => {
    const { w, calls } = await boot(); await bukaDetail(w); await isi(w, "Rp 300.000");
    simpan(w); await wait(); await wait();
    const c = calls.find((x) => x.body.aksi === "catat")!;
    expect(c.body).toEqual({ aksi: "catat", programId: "recPROGRAM0000001", tanggal: "2026-11-20", nominal: 300000, keterangan: "Sewa", penerima: "Gereja", account: "recACCOUNT0000001", rekening: "recREKENING000001" });
    expect(calls.filter((x) => x.body.aksi === "daftar").length).toBe(2);
    expect(w.document.body.textContent).toContain("Realisasi tersimpan");
  });
  it("galat dari server (409) ditampilkan dan formulir tetap terbuka", async () => {
    const { w } = await boot({ catat: () => ({ ok: false, j: { message: "Nominal melebihi sisa anggaran (sisa Rp 100)." } }) });
    await bukaDetail(w); await isi(w, "1000"); simpan(w); await wait();
    expect(w.document.body.textContent).toContain("Nominal melebihi sisa anggaran (sisa Rp 100).");
    expect(f(w, "Nominal (Rp)")).not.toBeNull();
  });
});
