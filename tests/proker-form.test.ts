import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { renderDashboard } from "@/ui/render";
import { PROKER_JS } from "@/ui/proker-js";

const acc: any = { email: "a@a.c", nama: "A", status: "Disetujui", level: "Superadmin", tabs: ["Dashboard", "Program Kerja"] };
const FORM = new JSDOM(renderDashboard(acc)).window.document.getElementById("proForm")!.outerHTML;

async function boot() {
  const dom = new JSDOM(`<body><div id="proTiles"></div><p id="proMsg"></p><div id="proRptTabs"></div><input id="proQ"><select id="proSt"></select><button id="proFilterBtn"></button><div id="proFilterBox" hidden></div><table><tbody id="proBody"></tbody></table>${FORM}</body>`, { runScripts: "outside-only", pretendToBeVisual: true });
  const w: any = dom.window;
  w.__ME__ = { viewAs: false };
  const sent: any[] = [];
  w.fetch = vi.fn(async (_u: string, init: any) => {
    const b = JSON.parse(init.body); sent.push(b);
    if (b.aksi === "info") return { ok: true, status: 200, json: async () => ({ seksiSaya: ["Forkom 1"], seksiPilihan: ["Forkom 1"], bisaPilih: false, semuaSeksi: ["Forkom 1", "Forkom 2", "Sekolah"] }) };
    if (b.aksi === "daftar") return { ok: true, status: 200, json: async () => ({ programs: [] }) };
    return { ok: true, status: 200, json: async () => ({ id: "recX" }) };
  });
  w.EPK = { el(tag: string, props: any = {}, kids: any[] = []) {
    const e = w.document.createElement(tag);
    Object.keys(props).forEach((k) => { if (k === "text") e.textContent = props[k]; else if (k === "class") e.className = props[k]; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), props[k]); else if (props[k] != null) e.setAttribute(k, props[k]); });
    kids.forEach((c: any) => { if (c != null) e.appendChild(typeof c === "string" ? w.document.createTextNode(c) : c); });
    return e;
  } };
  w.reportTabs = () => {};
  w.eval(PROKER_JS);
  w.EPK_PROKER_OPEN();
  return { w, sent };
}
const wait = () => new Promise((r) => setTimeout(r, 30));
const click = (w: any, el: any) => el.dispatchEvent(new w.Event("click", { bubbles: true }));
const msg = (w: any) => w.document.getElementById("proFormMsg").textContent;
const step = (w: any) => [...w.document.querySelectorAll(".pf-step")].findIndex((s: any) => !s.hidden) + 1;

async function mulai() {
  const { w, sent } = await boot();
  // initForm dipanggil saat tab Ajukan diklik
  const tab = w.document.createElement("button"); tab.textContent = "Ajukan program";
  w.document.getElementById("proRptTabs")!.appendChild(tab);
  tab.dispatchEvent(new w.Event("click", { bubbles: true }));
  await wait();
  return { w, sent };
}

describe("formulir Ajukan program bertahap", () => {
  it("empat langkah; mulai di langkah 1 dan tidak bisa lanjut tanpa nama", async () => {
    const { w } = await mulai();
    expect(w.document.querySelectorAll("#pfSteps li").length).toBe(4);
    expect(step(w)).toBe(1);
    click(w, w.document.getElementById("pfNext"));
    expect(msg(w)).toContain("Nama program wajib");
    expect(step(w)).toBe(1);
  });
  it("tidak ada isian tanggal lengkap; bulan dipilih dengan tombol dan bulan lampau dinonaktifkan", async () => {
    const { w } = await mulai();
    expect(w.document.querySelector("input[type=date], input[type=month]")).toBeNull();
    const now = new Date(); const aktif = [...w.document.querySelectorAll("#proBulan button")];
    expect(aktif.length).toBe(12);
    expect(aktif.filter((b: any) => b.disabled).length).toBe(now.getMonth());
  });
  it("alur lengkap: nama -> bulan -> anggaran -> tinjau -> ajukan mengirim YYYY-MM", async () => {
    const { w, sent } = await mulai();
    const d = w.document;
    (d.getElementById("proNama") as any).value = "Retret 2027";
    click(w, d.getElementById("pfNext")); expect(step(w)).toBe(2);
    click(w, d.getElementById("pfNext")); expect(msg(w)).toContain("bulan mulai");
    click(w, [...d.querySelectorAll("#proTahun button")][1]);
    click(w, d.querySelectorAll("#proBulan button")[5]);
    expect((d.getElementById("proMulaiBln") as any).value).toBe(`${new Date().getFullYear() + 1}-06`);
    click(w, d.getElementById("pfNext")); expect(step(w)).toBe(3);
    click(w, d.getElementById("pfNext")); expect(msg(w)).toContain("total anggaran");
    (d.getElementById("proTotal") as any).value = "75000000"; d.getElementById("proTotal")!.dispatchEvent(new w.Event("input", { bubbles: true }));
    expect(d.getElementById("proTotalRp")!.textContent).toContain("75.000.000");
    click(w, d.getElementById("pfNext")); expect(step(w)).toBe(4);
    expect(d.getElementById("proRingkas")!.textContent).toContain("Retret 2027");
    expect((d.getElementById("pfSubmit") as any).hidden).toBe(false);
    d.getElementById("proForm")!.dispatchEvent(new w.Event("submit", { cancelable: true }));
    await wait();
    const kirim = sent.find((b: any) => b.aksi === "ajukan");
    expect(kirim.mulai).toBe(`${new Date().getFullYear() + 1}-06`);
    expect(kirim.anggaran).toEqual({ mode: "Total", total: 75000000 });
    expect(step(w)).toBe(1);
  });
  it("tombol Kembali dan pilihan Rincian berfungsi", async () => {
    const { w } = await mulai();
    const d = w.document;
    (d.getElementById("proNama") as any).value = "X"; click(w, d.getElementById("pfNext"));
    click(w, d.getElementById("pfBack")); expect(step(w)).toBe(1);
    click(w, d.querySelector('#proAgSeg [data-m="Rincian"]'));
    expect((d.getElementById("proRincianBox") as any).hidden).toBe(false);
    expect((d.getElementById("proTotalBox") as any).hidden).toBe(true);
  });
});
