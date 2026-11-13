import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { renderDashboard } from "@/ui/render";

const acc: any = { email: "a@b.c", nama: "A", status: "Disetujui", level: "View", tabs: ["Dashboard", "Pewarta", "Pengurus", "PD", "Luar kota", "Umat", "KEP", "Event", "Inventaris", "Keuangan"] };
const doc = new JSDOM(renderDashboard(acc)).window.document;
const HTML = renderDashboard(acc);
const tab = (id: string) => doc.getElementById("tab-" + id)!;

describe("menu Pewarta: dashboard pendek + tab Laporan", () => {
  const t = tab("pewarta");
  it("punya baris tab laporan pwRptTabs dengan enam laporan, Daftar paling depan", () => {
    const bar = t.querySelector("#pwRptTabs")!;
    expect(bar).toBeTruthy();
    const labels = Array.from(bar.querySelectorAll("button")).map((b: any) => b.textContent!.trim());
    expect(labels.slice(0, 6)).toEqual(["Daftar", "Per PD", "Per modul", "Pastor & suster", "Permohonan & tema", "Kuesioner"]);
  });
  it("saat awal hanya Daftar yang tampil", () => {
    const ids = ["Daftar", "Pd", "Modul", "Pastor", "Lk", "Kui", "Ring"];
    const shown = ids.filter((i) => !(t.querySelector("#pwSec" + i) as HTMLElement).hidden);
    expect(shown).toEqual(["Daftar"]);
  });
  it("dashboard pendek: paling banyak 4 kartu angka", () => {
    expect(t.querySelectorAll("#pwTiles .tile").length).toBeLessThanOrEqual(4);
  });
  it("filter dilipat dalam satu tombol Filter", () => {
    expect(t.querySelector("#pwFilterBtn")).toBeTruthy();
    expect((t.querySelector("#pwFilterBox") as HTMLElement).hidden).toBe(true);
  });
  it("Per modul berbentuk satu tabel gulir, bukan tumpukan kartu", () => {
    expect(t.querySelector("#pwSecModul .tw table #pwModulBody")).toBeTruthy();
    expect(t.querySelector("#pwModulBox")).toBeNull();
  });
  it("tabel Pewarta ada di dalam .tw", () => {
    const loose = Array.from(t.querySelectorAll("table")).filter((x: any) => !x.closest(".tw"));
    expect(loose.length).toBe(0);
  });
});

const hid = (t: Element, id: string) => (t.querySelector("#" + id) as HTMLElement).hidden;

describe("menu Pengurus", () => {
  it("Bagan terbuka dulu dalam model Pohon (lebar) di semua lebar layar", () => {
    expect(HTML).not.toMatch(/innerWidth <= 860 \? "v" : "t"/);
    expect(HTML).toMatch(/return "t";\s*\}\)\(\);/);
    expect(tab("pengurus").querySelector('#viewChips [data-v="bagan"]')!.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("menu Pewarta luar kota", () => {
  const t = tab("luar");
  it("tab laporan: tabel pewarta dulu, lainnya tersembunyi", () => {
    expect(t.querySelector("#luRptTabs")).toBeTruthy();
    expect(hid(t, "luSecDaftar")).toBe(false);
    expect(hid(t, "luSecTop")).toBe(true);
    expect(hid(t, "luSecTamu")).toBe(true);
  });
  it("filter dilipat dalam satu tombol", () => {
    expect(t.querySelector("#luFilterBtn")).toBeTruthy();
    expect(hid(t, "luFilterBox")).toBe(true);
  });
});

describe("menu PD", () => {
  const t = tab("pd");
  it("tab laporan: tabel PD dulu, peta dan dekanat tersembunyi", () => {
    expect(t.querySelector("#pdRptTabs")).toBeTruthy();
    expect(hid(t, "pdSecDaftar")).toBe(false);
    expect(hid(t, "pdSecPeta")).toBe(true);
  });
  it("filter dilipat dalam satu tombol", () => {
    expect(t.querySelector("#pdFilterBtn")).toBeTruthy();
    expect(hid(t, "pdFilterBox")).toBe(true);
  });
});

describe("menu Umat", () => {
  it("kontrol filter tampil paling banyak dua (cari + PD)", () => {
    const t = tab("umat");
    expect(t.querySelectorAll(".sel2 input, .sel2 select").length).toBeLessThanOrEqual(2);
  });
});

describe("menu KEP", () => {
  it("beranda KEP memuat tabel kegiatan; grafik pindah ke tampilan Grafik", () => {
    expect(HTML).toContain("function kpTabelKeg(");
    expect(HTML).toMatch(/\["lap", "Grafik"\]/);
    expect(HTML).toContain('KP.v === "lap"');
  });
});

describe("menu Beranda", () => {
  const t = tab("beranda");
  it("bagian atas pendek (dash-short) dan laporan di tab berRptTabs", () => {
    expect(t.querySelector(".dash-short #dashAgenda")).toBeTruthy();
    expect(t.querySelector("#berRptTabs")).toBeTruthy();
    expect(hid(t, "berSecTren")).toBe(false);
    expect(hid(t, "berSecLk")).toBe(true);
    expect(hid(t, "berSecTema")).toBe(true);
  });
  it("kartu angka dilipat: empat pertama saja, sisanya lewat tombol", () => {
    expect(t.querySelector("#dashTiles.collapsed")).toBeTruthy();
    expect(t.querySelector("#dashTilesMore")).toBeTruthy();
    expect(HTML).toContain("#dashTiles.collapsed .tile:nth-child(n+5) { display: none; }");
  });
  it("panel laporan tidak ada di dalam dash-short", () => {
    expect(t.querySelector(".dash-short #dashTren, .dash-short #dashLk, .dash-short #dashTemaTop")).toBeNull();
  });
  it("dash-short tidak memotong isi: daftar di dalamnya bergulir sendiri", () => {
    expect(HTML).toContain(".dash-short .lst { max-height: 36vh; overflow-y: auto; }");
    expect(HTML).not.toMatch(/\.dash-short \{[^}]*overflow: hidden/);
  });
});

describe("menu Event", () => {
  it("daftar event berbentuk tabel gulir (.tw), bukan kartu", () => {
    const t = tab("event");
    expect(t.querySelector(".tw table #evBody")).toBeTruthy();
    expect(t.querySelector("#evList")).toBeNull();
  });
  it("grafik pendaftar per event dilipat dalam details", () => {
    expect(HTML).toContain('<details class="evgraf"><summary class="btn">Grafik pendaftar per event</summary>');
  });
});

describe("menu Program Kerja (tab proker)", () => {
  const acc2: any = { ...acc, tabs: [...acc.tabs, "Program Kerja"] };
  const d2 = new JSDOM(renderDashboard(acc2)).window.document;
  const t = d2.getElementById("tab-proker")!;
  it("tab proker dan baris tab proRptTabs ada", () => {
    expect(d2.getElementById("tabbtn-proker")).toBeTruthy();
    expect(t).toBeTruthy();
    expect(t.querySelector("#proRptTabs")).toBeTruthy();
  });
  it("saat awal hanya Daftar yang tampil", () => {
    expect((t.querySelector("#proSecDaftar") as HTMLElement).hidden).toBe(false);
    expect((t.querySelector("#proSecAjukan") as HTMLElement).hidden).toBe(true);
  });
  it("kontrol filter tampil paling banyak dua; sisanya dilipat", () => {
    const vis = Array.from(t.querySelectorAll("#proSecDaftar input, #proSecDaftar select, #proSecDaftar button")).filter((x: any) => !x.closest("[hidden]"));
    expect(vis.length).toBeLessThanOrEqual(2);
    expect((t.querySelector("#proFilterBox") as HTMLElement).hidden).toBe(true);
  });
  it("semua tabel di dalam .tw dan tabel Daftar paling atas (sebelum formulir)", () => {
    expect(Array.from(t.querySelectorAll("table")).filter((x: any) => !x.closest(".tw")).length).toBe(0);
    const tbl = t.querySelector("#proTbl")!, form = t.querySelector("#proForm")!;
    expect(tbl.compareDocumentPosition(form) & 4).toBeTruthy(); // formulir sesudah tabel
  });
  it("formulir tidak punya isian seksi pengaju", () => {
    const form = t.querySelector("#proForm")!;
    expect(form.querySelector("[name=seksiPengaju], #proSeksiPengaju")).toBeNull();
  });
  it("tab proker hanya terdaftar di __ME__.tabs untuk akun yang punya akses", () => {
    const re = /"tabs":\[[^\]]*"proker"/;
    expect(renderDashboard(acc)).not.toMatch(re);
    expect(renderDashboard(acc2)).toMatch(re);
  });
});

describe("link absensi di detail Event", () => {
  it("tombol meminta token ke server, tidak membuatnya di browser", () => {
    const html = require("node:fs").readFileSync("docs/prototipe-artifact.html", "utf8");
    expect(html).toContain("data-absen=");
    expect(html).toContain('aksi: "link"');
    expect(html).not.toContain("AUTH_SECRET");
  });
});

describe("link absensi: handler di tab Event", () => {
  it("klik [data-absen] ditangani oleh listener tab-event (bukan tab lain)", () => {
    const html = require("node:fs").readFileSync("docs/prototipe-artifact.html", "utf8");
    const a = html.indexOf('getElementById("tab-event").addEventListener("click"');
    const b = html.indexOf('getElementById("tab-event").addEventListener("keydown"');
    const seg = html.slice(a, b);
    expect(seg).toContain('closest("[data-absen]")');
    expect(seg).toContain('aksi: "link"');
    const kep = html.slice(html.indexOf('getElementById("tab-kep").addEventListener("click"'));
    expect(kep.slice(0, 2500)).not.toContain("data-absen");
  });
});

describe("laporan perwakilan per seksi di detail Event", () => {
  it("tombol, pemuat dan handler ada di tab Event", () => {
    const html = require("node:fs").readFileSync("docs/prototipe-artifact.html", "utf8");
    expect(html).toContain("Laporan perwakilan per seksi");
    expect(html).toContain("function skLoad(");
    const a = html.indexOf('getElementById("tab-event").addEventListener("click"');
    const b = html.indexOf('getElementById("tab-event").addEventListener("keydown"');
    expect(html.slice(a, b)).toContain('closest("[data-seksi]")');
    expect(html).toContain('"/api/event-seksi"');
  });
});

describe("laporan per seksi: baris bisa diklik dan memuat siapa saja", () => {
  it("klik baris membuka daftar anggota; filter status menyaring seksi", async () => {
    const { JSDOM } = await import("jsdom");
    const html = require("node:fs").readFileSync("docs/prototipe-artifact.html", "utf8");
    const m = html.match(/var SK = [\s\S]*?\/\* end skDraw \*\//);
    expect(m).toBeTruthy();
    const w: any = new JSDOM('<body><div id="evSeksi"></div></body>', { runScripts: "outside-only" }).window;
    w.eval('function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")} function tile(n,l){return "<b>"+n+" "+l+"</b>"}' + m[0] + ";window.SK=SK;window.skDraw=skDraw;");
    w.SK.eid = "recAAAAAAAAAAAAAA"; w.SK.f = "";
    w.SK.data = { dasar: "daftar", ringkas: { ketua: 1, diwakili: 0, kosong: 1 }, seksi: [
      { bidang: "Inreach", seksi: "Sekretariat", status: "ketua", anggota: 2, perwakilan: [], ketua: [{ nama: "Ani", status: "hadir" }], daftar: [{ nama: "Ani", peran: "Ketua", hadir: true }, { nama: "Budi", peran: "Anggota", hadir: false }] },
      { bidang: "Inreach", seksi: "Litbang", status: "kosong", anggota: 1, perwakilan: [], ketua: [{ nama: "Eka", status: "tidak" }], daftar: [{ nama: "Eka", peran: "Ketua", hadir: false }] },
    ] };
    w.skDraw("recAAAAAAAAAAAAAA");
    const d = w.document;
    const rows = d.querySelectorAll("#evSeksi tr[data-prow]");
    expect(rows.length).toBe(2);
    const det = rows[0].nextElementSibling;
    expect(det.hidden).toBe(true);
    expect(det.textContent).toContain("Budi");
    expect(det.textContent).toContain("Anggota");
    w.SK.f = "kosong"; w.skDraw("recAAAAAAAAAAAAAA");
    expect(d.querySelector('#evSeksi button.tile[data-skf="kosong"]').classList.contains("on")).toBe(true);
    expect(d.querySelector('#evSeksi button.tile[data-skf="kosong"]').textContent).toContain("Seksi yang tidak hadir");
    expect(d.querySelector("#evSeksi .count").textContent).toContain("Litbang");
    expect(d.querySelector("#evSeksi .count").textContent).not.toContain("Sekretariat");
    expect(d.querySelectorAll("#evSeksi tr[data-prow]").length).toBe(1);
    expect(d.querySelector("#evSeksi tr[data-prow]").textContent).toContain("Litbang");
  });
  it("handler klik tab Event menangani filter status", () => {
    const html = require("node:fs").readFileSync("docs/prototipe-artifact.html", "utf8");
    expect(html).toContain('closest("[data-skf]")');
  });
});

describe("event live dan tombol Buka", () => {
  const html = require("node:fs").readFileSync("docs/prototipe-artifact.html", "utf8");
  it("event hari ini ditandai Live dengan angka hadir; event lain tidak", async () => {
    const { JSDOM } = await import("jsdom");
    const ek = html.match(/function evKind\([\s\S]*?\/\* end evKind \*\//)[0];
    const lv = html.match(/var LV = [\s\S]*?\/\* end evLive \*\//)[0];
    const w: any = new JSDOM('<body><div id="r"></div></body>', { runScripts: "outside-only" }).window;
    w.eval('function esc(s){return String(s).replace(/&/g,"&amp;")} var TODAY="2026-11-14"; var D={evx:[' +
      '{id:"recA",nama:"261114-Rapat Tim Kerja",tgl:"2026-11-14",st:"Aktif",reg:"Open",jenis:"Non Rutin",kel:"BPK"},' +
      '{id:"recB",nama:"261121-Misa",tgl:"2026-11-21",st:"Aktif",reg:"Open",jenis:"Non Rutin",kel:"BPK"}]};' + ek + lv + ";window.liveToday=liveToday;window.livePanel=livePanel;window.liveApply=liveApply;");
    const today = w.liveToday({});
    expect(today.map((e: any) => e.id)).toEqual(["recA"]);
    const d = w.document;
    d.getElementById("r").innerHTML = w.livePanel(today) + '<span data-live-b="recA">● Live</span>';
    expect(d.getElementById("r").textContent).toContain("Sedang berlangsung hari ini");
    expect(d.getElementById("r").textContent).not.toContain("Misa");
    w.liveApply(d.getElementById("r"), { recA: { hadir: 6, daftar: 38 } });
    expect(d.querySelector("[data-live-n=recA]").textContent).toBe("6");
    expect(d.querySelector("[data-live-t=recA]").textContent).toBe("hadir dari 38 terdaftar");
    expect(d.querySelector("[data-live-b=recA]").textContent).toBe("● Live · 6 hadir / 38");
    expect(w.livePanel([])).toBe("");
  });
  it("popup kegiatan punya tombol Buka yang membawa ke detail event", () => {
    expect(html).toContain('id="evOpen"');
    expect(html).toContain('navOk("event")');
    expect(html).toMatch(/getElementById\("evOpen"\)\.addEventListener\("click"[\s\S]{0,200}nav\("evt:" \+ id\)/);
    expect(html).toContain("tidak memakai pendaftaran");
  });
});

describe("link absensi di mode Lihat sebagai", () => {
  it("tombol dinonaktifkan dengan keterangan, bukan menampilkan galat", () => {
    const html = require("node:fs").readFileSync("docs/prototipe-artifact.html", "utf8");
    expect(html).toContain('window.__ME__.viewAs);\n  h += \'<p><button type="button" class="chip" data-absen="');
    expect(html).toContain("Tidak tersedia di mode Lihat sebagai");
  });
});

describe("hapus pendaftar event (Admin/Superadmin)", () => {
  const html = require("node:fs").readFileSync("docs/prototipe-artifact.html", "utf8");
  it("tombol Hapus hanya untuk Admin/Superadmin di akun asli; klik memanggil API batal setelah konfirmasi", () => {
    expect(html).toContain('(me.level === "Admin" || me.level === "Superadmin") && !me.viewAs');
    const a = html.indexOf('getElementById("tab-event").addEventListener("click"');
    const b = html.indexOf('getElementById("tab-event").addEventListener("keydown"');
    const h = html.slice(a, b);
    expect(h).toContain('closest("[data-pdel]")');
    expect(h).toContain("window.confirm(");
    expect(h).toContain('"/api/event-pendaftar"');
    expect(h).toContain('aksi: "batal"');
  });
});

describe("daftar PD diurutkan menurut dekanat lalu nama", () => {
  it("dekanat A-Z, nama A-Z di dalam dekanat, tanpa dekanat di akhir; data asli tidak diubah", async () => {
    const { JSDOM } = await import("jsdom");
    const html = require("node:fs").readFileSync("docs/prototipe-artifact.html", "utf8");
    const m = html.match(/function pdSort\([\s\S]*?\/\* end pdSort \*\//);
    expect(m).toBeTruthy();
    const w: any = new JSDOM("<body></body>", { runScripts: "outside-only" }).window;
    w.eval('function cmpId(a,b){return a.localeCompare(b,"id")}' + m[0] + ";window.pdSort=pdSort;");
    const src = [
      { nama: "PDPKK St. Odilia", dekanat: "Dekanat Priangan 2" },
      { nama: "BPKPKK Bandung", dekanat: "" },
      { nama: "PDPKK Fire Youth", dekanat: "Dekanat Kepemudaan" },
      { nama: "KomPKK Creative Ministry", dekanat: "Dekanat Kepemudaan" },
      { nama: "KomPKK Catholic Family", dekanat: "Dekanat Bandung Selatan" },
      { nama: "Komunitas Soli Deo", dekanat: "Dekanat Bandung Timur" },
      { nama: "PDPKK Bunda Tujuh", dekanat: "Dekanat Bandung Barat" },
    ];
    const out = w.pdSort(src).map((p: any) => p.nama);
    expect(out).toEqual(["PDPKK Bunda Tujuh", "KomPKK Catholic Family", "Komunitas Soli Deo", "KomPKK Creative Ministry", "PDPKK Fire Youth", "PDPKK St. Odilia", "BPKPKK Bandung"]);
    expect(src[0].nama).toBe("PDPKK St. Odilia");
    expect(html).toContain("list = pdSort(list);");
  });
});
