// Mengubah prototipe (docs/prototipe-artifact.html) menjadi modul UI untuk website.
// - Konektor claude.ai diganti jembatan ke /api/airtable (server yang memeriksa izin).
// - Tab dan tombol tulis disesuaikan dengan hak akses pengguna (window.__ME__).
import { readFileSync, writeFileSync } from "node:fs";

let h = readFileSync(new URL("../docs/prototipe-artifact.html", import.meta.url), "utf8");
function swap(a, b) { if (!h.includes(a)) throw new Error("pola tidak ditemukan: " + a.slice(0, 60)); h = h.replace(a, b); }

swap("<title>Pengurus BPKPKK Bandung</title>", "<title>BPKPKK Bandung</title>");
swap('<meta name="claude:viewport-fit-sides" content="cover">', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
swap("  <header>", '  <header>\n    <div id="me" class="meta"></div>');
swap('function showTab(name) {\n  if (TABS.indexOf(name) < 0) name = "beranda";',
  'function showTab(name) {\n  if (TABS.indexOf(name) < 0) name = "beranda";\n  if (window.__ME__ && window.__ME__.tabs.indexOf(name) < 0) name = window.__ME__.tabs[0] || "beranda";');
swap("renderLink();\nrender();\nrefreshViews();\nshowTab(", "applyMe();\nrenderLink();\nrender();\nrefreshViews();\nshowTab(");

// bagian RAW (daftar pengurus) dipisah supaya bisa dikosongkan untuk pengguna tanpa tab Pengurus
const i = h.indexOf("var RAW = [") + "var RAW = [".length;
const j = h.indexOf("\n];", i);
const head = h.slice(0, i), raw = h.slice(i, j), tail = h.slice(j);
const split = head.lastIndexOf("<script>");
const pre = head.slice(0, split), main = head.slice(split);

const shim = `<style>
.meta { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; justify-content: flex-end; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
.meta a { color: var(--accent); }
body.ro [data-act="edit"], body.ro [data-pw="edit"], body.ro [data-go^="koor"], body.ro #addBtn, body.ro #dayAdd { display: none !important; }
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
function applyMe() {
  var me = window.__ME__; if (!me) return;
  ["beranda", "pengurus", "pewarta", "luar", "pd", "umat", "kalender"].forEach(function (t) {
    var b = document.getElementById("tabbtn-" + t); if (b && me.tabs.indexOf(t) < 0) b.hidden = true;
  });
  if (me.level !== "Edit") document.body.classList.add("ro");
  var el = document.getElementById("me");
  if (el) el.innerHTML = '<span></span><span>' + (me.level === "Edit" ? "Akses edit" : "Hanya lihat") + '</span><a href="/keluar">Keluar</a>';
  if (el) el.firstChild.textContent = me.nama || me.email;
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
