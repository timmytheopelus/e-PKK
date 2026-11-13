// Mengubah prototipe (docs/prototipe-artifact.html) menjadi modul UI untuk website.
// - Konektor claude.ai diganti jembatan ke /api/airtable (server yang memeriksa izin).
// - Tab dan tombol tulis disesuaikan dengan hak akses pengguna (window.__ME__).
import { readFileSync, writeFileSync } from "node:fs";

let h = readFileSync(new URL("../docs/prototipe-artifact.html", import.meta.url), "utf8");
function swap(a, b) { if (!h.includes(a)) throw new Error("pola tidak ditemukan: " + a.slice(0, 60)); h = h.replace(a, b); }

swap("<title>Pengurus BPKPKK Bandung</title>", "<title>BPKPKK Bandung</title>");
swap('<meta name="claude:viewport-fit-sides" content="cover">', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
swap('  <header class="brand">', '  <div id="me" class="meta"></div>\n  <header class="brand">');
swap('viewport-fit=cover">', 'viewport-fit=cover">\n<link rel="icon" type="image/png" href="/favicon.png">');
swap('function showTab(name) {\n  if (TABS.indexOf(name) < 0) name = "beranda";',
  'function showTab(name) {\n  if (TABS.indexOf(name) < 0) name = "beranda";\n  if (window.__ME__ && window.__ME__.tabs.indexOf(name) < 0) name = window.__ME__.tabs[0] || "beranda";');
swap("renderLink();\nrender();\nrefreshViews();\nshowTab(", "applyMe();\nrenderLink();\nrender();\nrefreshViews();\nshowTab(");

// Menu Inventaris: tombol menu, panel, daftar tab, dan pemicu buka tab (isi diisi oleh src/ui/inventaris-js.ts)
swap('    <button type="button" class="tabbtn" role="tab" id="tabbtn-admin"',
  '    <button type="button" class="tabbtn" role="tab" id="tabbtn-inventaris" aria-controls="tab-inventaris" aria-selected="false" tabindex="-1" data-tab="inventaris">Inventaris</button>\n    <button type="button" class="tabbtn" role="tab" id="tabbtn-admin"');
swap('  <div id="tab-admin" class="tab"',
  '  <div id="tab-inventaris" class="tab" role="tabpanel" aria-labelledby="tabbtn-inventaris" hidden>\n    <div id="invRoot"><p class="hint">Memuat inventaris…</p></div>\n  </div>\n\n  <div id="tab-admin" class="tab"');
swap('"kalender", "event", "kep", "admin"];', '"kalender", "event", "kep", "inventaris", "admin"];');
swap('  if (name === "kalender") calOpen();', '  if (name === "inventaris") { if (window.EPK_INV_OPEN) window.EPK_INV_OPEN(); }\n  else if (name === "kalender") calOpen();');

// Menu Keuangan (laporan keuangan dari base Bendahara; isi diisi oleh src/ui/keuangan-js.ts)
swap('    <button type="button" class="tabbtn" role="tab" id="tabbtn-admin"',
  '    <button type="button" class="tabbtn" role="tab" id="tabbtn-keuangan" aria-controls="tab-keuangan" aria-selected="false" tabindex="-1" data-tab="keuangan">Keuangan</button>\n    <button type="button" class="tabbtn" role="tab" id="tabbtn-admin"');
swap('  <div id="tab-admin" class="tab"',
  '  <div id="tab-keuangan" class="tab" role="tabpanel" aria-labelledby="tabbtn-keuangan" hidden>\n    <div id="keuRoot"><p class="hint">Memuat laporan keuangan…</p></div>\n  </div>\n\n  <div id="tab-admin" class="tab"');
swap('"kep", "inventaris", "admin"];', '"kep", "inventaris", "keuangan", "admin"];');
swap('  if (name === "inventaris") { if (window.EPK_INV_OPEN) window.EPK_INV_OPEN(); }',
  '  if (name === "keuangan") { if (window.EPK_KEU_OPEN) window.EPK_KEU_OPEN(); }\n  else if (name === "inventaris") { if (window.EPK_INV_OPEN) window.EPK_INV_OPEN(); }');

// Menu Program Kerja (pengajuan dan persetujuan; isi diisi oleh src/ui/proker-js.ts)
const PROKER_HTML = `  <div id="tab-proker" class="tab" role="tabpanel" aria-labelledby="tabbtn-proker" hidden>
    <div class="dash-short" id="proTiles"></div>
    <div id="proRptTabs"></div>
    <div id="proSecDaftar">
      <div class="fil">
        <input type="search" id="proQ" placeholder="Cari program atau seksi" autocomplete="off" aria-label="Cari program">
        <button type="button" class="btn" id="proFilterBtn" aria-expanded="false" aria-controls="proFilterBox">Filter</button>
      </div>
      <div id="proFilterBox" hidden>
        <div class="fil"><select id="proSt" aria-label="Status"><option value="">Semua status</option></select></div>
      </div>
      <p class="hint" id="proMsg">Memuat…</p>
      <div class="tw tablebox"><table id="proTbl"><thead><tr><th>Program</th><th>Seksi</th><th>Mulai</th><th>Status</th><th class="num">Anggaran</th></tr></thead><tbody id="proBody"></tbody></table></div>
    </div>
    <div id="proSecAjukan" hidden>
      <form id="proForm" novalidate>
        <ol class="pf-steps" id="pfSteps" aria-label="Langkah pengajuan">
          <li data-s="1"><b>1</b><span>Program</span></li><li data-s="2"><b>2</b><span>Waktu &amp; seksi</span></li><li data-s="3"><b>3</b><span>Anggaran</span></li><li data-s="4"><b>4</b><span>Tinjau</span></li>
        </ol>
        <section class="pf-step" data-step="1">
          <h3>Apa program yang diajukan?</h3>
          <label class="pf-l" for="proNama">Nama program</label>
          <input type="text" id="proNama" maxlength="200" placeholder="Contoh: Retret Pengurus 2027" autocomplete="off">
          <label class="pf-l" for="proDetail">Tujuan dan gambaran singkat</label>
          <textarea id="proDetail" rows="4" maxlength="5000" placeholder="Apa tujuannya, siapa sasarannya, bagaimana pelaksanaannya"></textarea>
          <div id="proPengajuBox" hidden></div>
        </section>
        <section class="pf-step" data-step="2" hidden>
          <h3>Kapan dan siapa yang terlibat?</h3>
          <div class="pf-l">Perkiraan bulan mulai</div>
          <div class="pf-years" id="proTahun" role="group" aria-label="Tahun"></div>
          <div class="pf-months" id="proBulan" role="group" aria-label="Bulan"></div>
          <input type="hidden" id="proMulaiBln">
          <div class="pf-l">Seksi lain yang terlibat <small>(opsional)</small></div>
          <input type="search" id="proSeksiQ" placeholder="Cari seksi" aria-label="Cari seksi" autocomplete="off">
          <div id="proSeksi" class="epk-picklist"></div>
        </section>
        <section class="pf-step" data-step="3" hidden>
          <h3>Berapa anggarannya?</h3>
          <select id="proAgMode" hidden><option value="Total">Total saja</option><option value="Rincian">Rincian</option></select>
          <div class="pf-seg" id="proAgSeg" role="group" aria-label="Bentuk anggaran"><button type="button" class="pf-segb on" data-m="Total">Total saja</button><button type="button" class="pf-segb" data-m="Rincian">Rincian pemasukan dan pengeluaran</button></div>
          <div id="proTotalBox"><label class="pf-l" for="proTotal">Total anggaran (Rp)</label><input type="number" id="proTotal" min="0" step="1" inputmode="numeric" placeholder="0"><p class="pf-rp" id="proTotalRp"></p></div>
          <div id="proRincianBox" hidden><div id="proRincian"></div><button type="button" class="btn" id="proTambah">+ Tambah baris</button><p class="pf-rp" id="proRincianRp"></p></div>
        </section>
        <section class="pf-step" data-step="4" hidden>
          <h3>Tinjau lalu ajukan</h3>
          <dl class="pf-sum" id="proRingkas"></dl>
          <p class="hint">Setelah diajukan, program menunggu persetujuan Sekretaris Jenderal / Koordinator BPK.</p>
        </section>
        <p id="proFormMsg" class="epk-msg" role="status"></p>
        <div class="pf-nav"><button type="button" class="btn" id="pfBack">Kembali</button><button type="button" class="epk-btn" id="pfNext">Lanjut</button><button type="submit" class="epk-btn" id="pfSubmit" hidden>Ajukan program</button></div>
      </form>
    </div>
  </div>

`;
swap('    <button type="button" class="tabbtn" role="tab" id="tabbtn-admin"',
  '    <button type="button" class="tabbtn" role="tab" id="tabbtn-proker" aria-controls="tab-proker" aria-selected="false" tabindex="-1" data-tab="proker">Program Kerja</button>\n    <button type="button" class="tabbtn" role="tab" id="tabbtn-admin"');
swap('  <div id="tab-admin" class="tab"', PROKER_HTML + '  <div id="tab-admin" class="tab"');
swap('"keuangan", "admin"];', '"keuangan", "proker", "admin"];');
swap('  if (name === "keuangan") { if (window.EPK_KEU_OPEN) window.EPK_KEU_OPEN(); }',
  '  if (name === "beranda" && window.EPK_PROKER_DASH) window.EPK_PROKER_DASH();\n  if (name === "proker") { if (window.EPK_PROKER_OPEN) window.EPK_PROKER_OPEN(); }\n  else if (name === "keuangan") { if (window.EPK_KEU_OPEN) window.EPK_KEU_OPEN(); }');

// bagian RAW (daftar pengurus) dipisah supaya bisa dikosongkan untuk pengguna tanpa tab Pengurus
const i = h.indexOf("var RAW = [") + "var RAW = [".length;
const j = h.indexOf("\n];", i);
const head = h.slice(0, i), raw = h.slice(i, j), tail = h.slice(j);
const split = head.lastIndexOf("<script>");
const pre = head.slice(0, split), main = head.slice(split);

const shim = `<style>
[hidden] { display: none !important; }
.meta { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; justify-content: flex-end; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
.meta a { color: var(--accent); }
.epk-wrap { position: relative; display: inline-block; }
.epk-who, .epk-bell { font: inherit; color: var(--fg); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 5px 10px; cursor: pointer; }
.epk-bell { position: relative; }
.epk-badge { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; border-radius: 9px; background: var(--danger); color: #fff; font-size: 11px; line-height: 18px; text-align: center; padding: 0 4px; }
.epk-pop { position: absolute; right: 0; top: calc(100% + 4px); z-index: 50; min-width: 200px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.14); padding: 6px; display: flex; flex-direction: column; text-align: left; }
.epk-pop[hidden] { display: none; }
.epk-pop button, .epk-pop a { font: inherit; color: var(--fg); background: none; border: 0; text-align: left; padding: 8px 10px; border-radius: 6px; cursor: pointer; text-decoration: none; }
.epk-pop button:hover, .epk-pop a:hover { background: var(--accent-soft); }
.epk-bellpop { min-width: 280px; }
.epk-empty { margin: 8px 10px; color: var(--muted); }
.epk-notif { display: block; width: 100%; text-align: left; font: inherit; padding: 8px 10px; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--fg); cursor: pointer; overflow-wrap: anywhere; }
.epk-notif.baru { font-weight: 600; background: var(--surface); }
.epk-scrim { position: fixed; inset: 0; background: rgba(15,25,35,.5); z-index: 100; display: flex; align-items: flex-start; justify-content: center; overflow-y: auto; padding: 4vh 12px; }
.epk-box { background: var(--surface); border-radius: 14px; width: min(760px, 100%); padding: 18px 20px 22px; }
.epk-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.epk-head h2 { margin: 0; font-size: 20px; }
.epk-x { font-size: 24px; line-height: 1; border: 0; background: none; cursor: pointer; color: var(--muted); }
.epk-dl { display: grid; grid-template-columns: 170px 1fr; gap: 8px 12px; margin: 0; }
.epk-dl dt { color: var(--muted); } .epk-dl dd { margin: 0; overflow-wrap: anywhere; }
.epk-sec { margin: 18px 0 8px; font-size: 15px; }
.epk-card { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
.epk-card h4 { margin: 0 0 2px; font-size: 15px; } .epk-card .sub { color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
.epk-row { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin-top: 8px; }
.epk-row label { display: inline-flex; gap: 5px; align-items: center; font-size: 13px; }
.epk-row input[type=text], .epk-row input[type=email], .epk-row select { font: inherit; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; min-width: 0; }
.epk-btn { font: inherit; padding: 7px 14px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: #fff; cursor: pointer; }
.epk-btn.sec { background: #fff; color: var(--accent); } .epk-btn.bad { border-color: var(--danger); background: #fff; color: var(--danger); }
.epk-msg { margin: 8px 0 0; font-size: 13px; color: var(--accent); } .epk-msg.bad { color: var(--danger); }
.epk-lvl { color: var(--muted); }
.epk-asbar { position: sticky; top: 0; z-index: 50; display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: center; background: #8a4b00; color: #fff; padding: 8px 12px; margin: -28px -16px 16px; font-size: 14px; }
.epk-asbar .epk-btn { background: #fff; color: #8a4b00; border-color: #fff; padding: 4px 12px; }
.pf-steps { display: flex; gap: 6px; list-style: none; padding: 0; margin: 0 0 14px; }
.pf-steps li { flex: 1 1 0; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; background: var(--bg); color: var(--muted); font-size: 13px; min-width: 0; }
.pf-steps li b { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--line); color: var(--fg); font-size: 12px; }
.pf-steps li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-steps li.on { background: var(--accent-soft); color: var(--accent); font-weight: 600; } .pf-steps li.on b, .pf-steps li.done b { background: var(--accent); color: #fff; } .pf-steps li.done { color: var(--fg); }
@media (max-width: 560px) { .pf-steps li span { display: none; } .pf-steps li.on span { display: inline; } .pf-steps li { justify-content: center; } .pf-steps li.on { flex: 3 1 0; justify-content: flex-start; } }
.pf-step { display: grid; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; }
.pf-step[hidden] { display: none; }
.pf-step h3 { font-family: var(--font-display); font-size: 1.15rem; margin: 0 0 4px; }
.pf-l { font-size: 13px; font-weight: 600; color: var(--muted); margin-top: 6px; } .pf-l small { font-weight: 400; }
.pf-step input[type=text], .pf-step input[type=number], .pf-step input[type=search], .pf-step textarea, .pf-step select { font: inherit; width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--fg); }
.pf-step input:focus, .pf-step textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; background: var(--surface); }
.pf-years, .pf-months, .pf-seg { display: flex; flex-wrap: wrap; gap: 8px; }
.pf-months { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); } @media (max-width: 560px) { .pf-months { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.pf-chip, .pf-segb { font: inherit; padding: 9px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--fg); cursor: pointer; text-align: center; }
.pf-chip:hover:not(:disabled), .pf-segb:hover { border-color: var(--accent); }
.pf-chip.on, .pf-segb.on { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
.pf-chip:disabled { opacity: .4; cursor: not-allowed; }
.pf-rp { margin: 0; font-size: 13px; color: var(--accent); font-weight: 600; min-height: 1.2em; }
.pf-sum { display: grid; grid-template-columns: minmax(110px, 160px) minmax(0, 1fr); gap: 8px 12px; margin: 0; } .pf-sum dt { color: var(--muted); font-size: 13px; } .pf-sum dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
.pf-nav { display: flex; justify-content: space-between; gap: 8px; margin-top: 12px; } .pf-nav .epk-btn, .pf-nav .btn { min-width: 110px; padding: 10px 18px; } .pf-nav [hidden] { display: none; }
.pro-row { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto; gap: 8px; margin-bottom: 8px; } @media (max-width: 560px) { .pro-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .pro-row .ag-ket { grid-column: 1 / -1; } }
.epk-picklist { display: grid; gap: 4px; max-height: 280px; overflow-y: auto; margin: 6px 0 10px; }
.epk-pickrow { font: inherit; text-align: left; display: grid; gap: 1px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--fg); cursor: pointer; }
.epk-pickrow small { color: var(--muted); }
.epk-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.epk-chip { font: inherit; padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--fg); cursor: pointer; }
.epk-chip.on { background: var(--accent); color: #fff; border-color: var(--accent); }
.epk-savebar { position: sticky; top: 0; z-index: 40; display: flex; gap: 8px; align-items: center; justify-content: flex-end; flex-wrap: wrap; padding: 8px 0; background: var(--bg, var(--surface)); }
.epk-savebar span { margin-right: auto; color: var(--muted); font-size: 13px; }
.epk-pickrow { width: 100%; margin-bottom: 6px; }
.epk-pickrow.epk-on { border-color: #2f855a; background: #e6f4ea; }
.epk-pickrow.epk-off { border-color: #a31621; background: #fdeaea; text-decoration: line-through; }
.epk-pickrow:hover:not(:disabled) { border-color: var(--accent); }
.epk-pickrow:disabled { opacity: .55; cursor: not-allowed; }
.meta { gap: 8px 12px; }
body.ro [data-act="edit"], body.ro [data-pw="edit"], body.ro [data-go^="koor"], body.ro #addBtn, body.ro #dayAdd { display: none !important; }
/* Semua tabel laporan di menu sidebar: kotak bisa digeser, header menempel di atas, baris selang-seling. */
.tablebox, .tw, .inv-tw { overflow: auto; max-height: 70vh; -webkit-overflow-scrolling: touch; }
.tablebox table, .tw table, .inv-tw table { border-collapse: separate; border-spacing: 0; }
.tablebox thead th, .tw thead th, .inv-tw thead th { position: sticky; top: 0; z-index: 2; background: var(--accent-soft); color: var(--fg); font-size: 15px; font-weight: 700; text-transform: none; letter-spacing: 0; border-bottom: 2px solid var(--accent); }
.tw thead th { font-size: 14px; }
:where(.tablebox, .tw, .inv-tw) tbody tr:where(:nth-child(even):not(.grp, .grp2, .det, .inv-g1, .inv-g2)) td { background: var(--bg); }
:where(.tablebox, .tw, .inv-tw) :where(tbody:has(> tr.det)) > tr.clk:where(:nth-child(4n+3)) > td { background: var(--bg); }
</style>
<script>
window.__ME__ = __ME_JSON__;
window.claude = { use: function (n) {
  if (n !== "mcp") return Promise.resolve(null);
  return Promise.resolve({ callTool: function (server, tool, input) {
    return fetch("/api/airtable", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool: tool, input: input }) }).then(function (r) {
      if (r.status === 401) { location.href = "/masuk"; throw { code: "tool_error", message: "Sesi login berakhir." }; }
      return r.json().then(function (j) {
        if (!r.ok) throw { code: j.code || "upstream_error", message: j.message || ("HTTP " + r.status) };
        return { payload: j };
      }, function () { throw { code: "upstream_error", message: "Respons server tidak terbaca." }; });
    }, function () { throw { code: "upstream_error", message: "Tidak ada koneksi ke server." }; });
  } });
} };
var EPK = {
  el: function (tag, props, kids) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) { if (k === "text") e.textContent = props[k]; else if (k === "class") e.className = props[k]; else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), props[k]); else if (props[k] != null) e.setAttribute(k, props[k]); });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  },
  modal: function (title, body) {
    var old = document.getElementById("epkModal"); if (old) old.remove();
    var close = function () { var m = document.getElementById("epkModal"); if (m) m.remove(); };
    var box = EPK.el("div", { class: "epk-box", role: "dialog", "aria-modal": "true", "aria-label": title }, [
      EPK.el("div", { class: "epk-head" }, [EPK.el("h2", { text: title }), EPK.el("button", { type: "button", class: "epk-x", "aria-label": "Tutup", text: "×", onclick: close })]), body]);
    var m = EPK.el("div", { id: "epkModal", class: "epk-scrim", onclick: function (e) { if (e.target === m) close(); } }, [box]);
    document.body.appendChild(m); return { close: close, box: box };
  },
  bellStart: function (menu) {
    function render(items) {
      var n = items.filter(function (x) { return !x.dibaca; }).length, b = document.getElementById("epkBadge");
      if (b) { b.textContent = n > 99 ? "99+" : String(n); b.hidden = !n; }
      menu.textContent = "";
      if (!items.length) { menu.appendChild(EPK.el("p", { class: "epk-empty", text: "Tidak ada notifikasi." })); return; }
      items.forEach(function (x) {
        menu.appendChild(EPK.el("button", { type: "button", class: "epk-notif" + (x.dibaca ? "" : " baru"), text: x.pesan, onclick: function () {
          EPK.menuClose();
          call({ aksi: "baca", ids: [x.id] }).then(load);
          var m = /^proker:(rec[A-Za-z0-9]{14})$/.exec(x.tautan || "");
          if (m) { window.__PROKER_OPEN = m[1]; var tb = document.getElementById("tabbtn-proker"); if (tb) tb.click(); if (window.prokerOpen) window.prokerOpen(m[1]); }
        } }));
      });
    }
    function call(body) {
      return fetch("/api/notif", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
    }
    function load() { return call({ aksi: "daftar" }).then(function (j) { render(j.items || []); }).catch(function () {}); }
    load(); setInterval(load, 60000);
  },
  menuClose: function () { Array.prototype.forEach.call(document.querySelectorAll(".epk-pop"), function (x) { x.hidden = true; }); },
  profile: function () {
    var me = window.__ME__, rows = [["Nama", me.nama || "-"], ["Email", me.email], ["Level", me.level === "Superadmin" ? "Superadmin" : me.level === "Edit" ? "Edit" : me.level === "Admin" ? "Admin" : "Hanya lihat"], ["Jabatan", me.jabatan || "-"],
      ["Tab yang bisa dibuka", me.tabNames.join(", ") || "-"], ["Login terakhir", me.login ? new Date(me.login).toLocaleString("id-ID") : "-"]];
    var dl = EPK.el("dl", { class: "epk-dl" }); rows.forEach(function (r) { dl.appendChild(EPK.el("dt", { text: r[0] })); dl.appendChild(EPK.el("dd", { text: r[1] })); });
    EPK.modal("Profil saya", dl);
  }
};
function applyMe() {
  var me = window.__ME__; if (!me) return;
  ["beranda", "pengurus", "pewarta", "luar", "pd", "umat", "kalender", "event", "kep", "inventaris", "keuangan", "proker", "admin"].forEach(function (t) {
    var b = document.getElementById("tabbtn-" + t); if (b && me.tabs.indexOf(t) < 0) b.hidden = true;
  });
  var kb = document.getElementById("admKelola"); if (kb && me.level !== "Superadmin") kb.hidden = true;
  if (["Edit","Admin","Superadmin"].indexOf(me.level) < 0) document.body.classList.add("ro");
  var el = document.getElementById("me"); if (!el) return;
  var menu = EPK.el("div", { class: "epk-pop", hidden: "" }, [
    EPK.el("button", { type: "button", text: "Profil saya", onclick: function () { EPK.menuClose(); EPK.profile(); } }),
    me.level === "Superadmin" && !me.viewAs ? EPK.el("button", { type: "button", text: "Lihat sebagai…", onclick: function () { EPK.menuClose(); if (window.EPK_LIHATSEBAGAI) window.EPK_LIHATSEBAGAI(); } }) : null,
    me.tabs.indexOf("absensi") >= 0 && !me.viewAs ? EPK.el("a", { href: "/absen", text: "Absensi kehadiran" }) : null,
    EPK.el("a", { href: "/keluar", text: "Keluar" })]);
  var who = EPK.el("button", { type: "button", class: "epk-who", "aria-haspopup": "true", onclick: function (e) { e.stopPropagation(); var h = menu.hidden; EPK.menuClose(); menu.hidden = !h; } },
    [(me.nama || me.email) + " ▾"]);
  el.textContent = "";
  if (!me.viewAs) {
    var bell = EPK.el("button", { type: "button", class: "epk-bell", id: "epkBell", "aria-label": "Notifikasi", onclick: function (e) { e.stopPropagation(); var h = bellMenu.hidden; EPK.menuClose(); bellMenu.hidden = !h; } }, ["🔔", EPK.el("span", { class: "epk-badge", id: "epkBadge", hidden: "" })]);
    var bellMenu = EPK.el("div", { class: "epk-pop epk-bellpop", id: "epkBellMenu", hidden: "" }, [EPK.el("p", { class: "epk-empty", text: "Tidak ada tugas." })]);
    el.appendChild(EPK.el("span", { class: "epk-wrap" }, [bell, bellMenu]));
    EPK.bellStart(bellMenu);
  }
  el.appendChild(EPK.el("span", { class: "epk-wrap" }, [who, menu]));
  el.appendChild(EPK.el("span", { class: "epk-lvl", text: me.level === "Superadmin" ? "Superadmin" : me.level === "Admin" ? "Admin" : me.level === "Edit" ? "Akses edit" : "Hanya lihat" }));
  if (me.viewAs) {
    var bar = EPK.el("div", { class: "epk-asbar", role: "status" }, [
      EPK.el("span", { text: "Mode Lihat sebagai: Anda melihat tampilan " + (me.nama || me.email) + " (" + me.level + "). Pratinjau saja, data tidak bisa diubah." }),
      EPK.el("button", { type: "button", class: "epk-btn", text: "Kembali ke akun saya", onclick: function () {
        fetch("/api/viewas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "" }) }).then(function () { location.href = "/dashboard"; });
      } })]);
    document.body.insertBefore(bar, document.body.firstChild);
  }
  document.addEventListener("click", EPK.menuClose);
  if (window.EPK_ADMIN_BOOT) window.EPK_ADMIN_BOOT();
}
</script>
`;
const out = `// File ini dibuat otomatis oleh scripts/build-ui.mjs. Jangan diedit.
export const PRE = ${JSON.stringify(pre + shim)};
export const MAIN_HEAD = ${JSON.stringify(main + "")};
export const RAW = ${JSON.stringify(raw)};
export const TAIL = ${JSON.stringify(tail)};
`;
writeFileSync(new URL("../src/ui/dashboard-html.ts", import.meta.url), out);
console.log("UI dibuat:", (out.length / 1024).toFixed(0), "KB");
