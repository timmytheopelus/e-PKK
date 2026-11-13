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
        <div class="fil"><input type="text" id="proNama" maxlength="200" placeholder="Nama program" aria-label="Nama program"></div>
        <div class="fil"><textarea id="proDetail" rows="3" maxlength="5000" placeholder="Detail program" aria-label="Detail program" style="width:100%"></textarea></div>
        <div class="fil">
          <select id="proMulaiMode" aria-label="Bentuk perkiraan mulai"><option value="bln">Bulan dan tahun</option><option value="tgl">Tanggal lengkap</option></select>
          <input type="month" id="proMulaiBln" aria-label="Bulan mulai"><input type="date" id="proMulaiTgl" aria-label="Tanggal mulai" hidden>
        </div>
        <div id="proPengajuBox" class="fil" hidden></div>
        <h4>Seksi terlibat</h4>
        <div id="proSeksi" class="epk-picklist"></div>
        <h4>Anggaran</h4>
        <div class="fil"><select id="proAgMode" aria-label="Bentuk anggaran"><option value="Total">Total saja</option><option value="Rincian">Rincian pemasukan dan pengeluaran</option></select></div>
        <div id="proTotalBox" class="fil"><input type="number" id="proTotal" min="0" step="1" placeholder="Total anggaran (Rp)" aria-label="Total anggaran"></div>
        <div id="proRincianBox" hidden><div id="proRincian"></div><button type="button" class="btn" id="proTambah">Tambah baris</button></div>
        <div class="epk-row"><button type="submit" class="epk-btn">Ajukan program</button></div>
        <p id="proFormMsg" class="epk-msg"></p>
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
