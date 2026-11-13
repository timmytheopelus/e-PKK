import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";

vi.mock("@/auth", () => ({ auth: async () => ({ user: { email: "u@x.com" } }) }));
vi.mock("@/lib/viewas", () => ({ effectiveAccess: async () => ({ real: { status: "Disetujui", tabs: ["Absensi"] } }) }));
import { GET } from "@/app/absen/[token]/route";

const data = { nama: "Rapat Tim Kerja", tgl: "2026-11-14", kep: false, buka: true, peserta: [
  { id: "recA", nama: "Ani Lengkap", pgl: "Ani", wa: "628111", seksi: "Sekretariat", asal: "PD Satu", hadir: true },
  { id: "recB", nama: "Budi Lengkap", pgl: "Bud", wa: "", seksi: "", asal: "PD Dua", hadir: false },
] };

async function buka() {
  const res = await GET(new Request("http://t.test/absen/tok"), { params: Promise.resolve({ token: "tok" }) });
  const html = await res.text();
  const posts: any[] = [];
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://t.test/absen/tok", beforeParse(w: any) {
    w.fetch = async (_u: string, init: any) => { const b = JSON.parse(init.body); posts.push(b); return { ok: true, json: async () => (b.aksi === "daftar" ? data : { ok: true }) }; };
  } });
  await new Promise((r) => setTimeout(r, 20));
  return { w: dom.window as any, posts };
}

describe("halaman absensi", () => {
  it("memisahkan belum/sudah hadir dengan angka, dan menampilkan seksi, PD, panggilan, tombol WA", async () => {
    const { w } = await buka(); const d = w.document;
    expect(d.getElementById("nh").textContent).toBe("1");
    expect(d.getElementById("nb").textContent).toBe("1");
    expect(d.getElementById("lb").textContent).toContain("Budi Lengkap");
    expect(d.getElementById("lh").textContent).toContain("Ani Lengkap");
    expect(d.getElementById("lh").textContent).toContain("Seksi BPK: Sekretariat");
    expect(d.getElementById("lh").textContent).toContain("PD: PD Satu");
    expect(d.getElementById("lb").textContent).toContain("Panggilan: Bud");
    expect(d.querySelector("#lh a.wa").getAttribute("href")).toBe("https://wa.me/628111");
    expect(d.body.textContent).not.toContain("628111");
  });
  it("tap menandai lokal; Simpan baru mengirim perubahan sekaligus", async () => {
    const { w, posts } = await buka(); const d = w.document;
    d.querySelector('#lb .row[data-id="recB"]').click();
    expect(d.getElementById("nh").textContent).toBe("2");
    expect(d.getElementById("sv").hidden).toBe(false);
    expect(posts.filter((p) => p.aksi === "simpan")).toHaveLength(0);
    d.getElementById("svb").click();
    await new Promise((r) => setTimeout(r, 20));
    const s = posts.find((p) => p.aksi === "simpan");
    expect(s.perubahan).toEqual([{ pendaftaran: "recB", hadir: true }]);
    expect(d.getElementById("sv").hidden).toBe(true);
  });
});

describe("go show di halaman absensi", () => {
  async function bukaGs(respons: (b: any) => any) {
    const res = await GET(new Request("http://t.test/absen/tok"), { params: Promise.resolve({ token: "tok" }) });
    const posts: any[] = [];
    const dom = new JSDOM(await res.text(), { runScripts: "dangerously", url: "http://t.test/absen/tok", beforeParse(w: any) {
      w.fetch = async (_u: string, init: any) => { const b = JSON.parse(init.body); posts.push(b); const j = b.aksi === "daftar" ? data : respons(b); return { ok: !j.error, json: async () => (j.error ? { message: j.error } : j) }; };
    } });
    await new Promise((r) => setTimeout(r, 20));
    return { w: dom.window as any, posts };
  }
  it("cari nama lalu tap: dicatat hadir langsung, masuk daftar Sudah hadir, total bertambah", async () => {
    const { w, posts } = await bukaGs((b) => b.aksi === "cari"
      ? { sumber: "pengurus", hasil: [{ id: "recUMAT0000000002", nama: "Cantik Pengurus", info: "Litbang" }] }
      : { baru: false, peserta: { id: "recNEW", nama: "Cantik Pengurus", pgl: "", wa: "", seksi: "Litbang", asal: "", hadir: true } });
    const d = w.document;
    expect(d.getElementById("gsb").hidden).toBe(false);
    d.getElementById("gsb").click();
    d.getElementById("gq").value = "can"; d.getElementById("gq").dispatchEvent(new w.Event("input"));
    await new Promise((r) => setTimeout(r, 300));
    expect(d.getElementById("gr").textContent).toContain("Cantik Pengurus");
    d.querySelector('#gr .row').click();
    await new Promise((r) => setTimeout(r, 20));
    expect(posts.find((p) => p.aksi === "goshow")).toMatchObject({ umat: "recUMAT0000000002" });
    expect(d.getElementById("nt").textContent).toBe("3");
    expect(d.getElementById("lh").textContent).toContain("Cantik Pengurus");
    expect(d.getElementById("sv").hidden).toBe(true); // sudah tersimpan, bukan perubahan tertunda
  });
  it("tambah baru: kirim Nama, WA, Email; kesalahan server ditampilkan", async () => {
    const { w, posts } = await bukaGs(() => ({ error: "Nama ini sudah ada di data umat. Cari dan pilih dari daftar." }));
    const d = w.document;
    d.getElementById("gnb").click();
    d.getElementById("gn").value = "Eko Baru"; d.getElementById("gw").value = "0812345678"; d.getElementById("ge").value = "e@x.com";
    d.getElementById("gadd").click();
    await new Promise((r) => setTimeout(r, 20));
    expect(posts.find((p) => p.aksi === "goshow")).toMatchObject({ baru: { nama: "Eko Baru", wa: "0812345678", email: "e@x.com" } });
    expect(d.getElementById("gm").textContent).toContain("sudah ada di data umat");
  });
});
