// Skrip menu Keuangan (laporan keuangan BPK, hanya baca). Hanya dikirim ke pengguna yang punya tab Keuangan.
// Data berasal dari tabel Mutasi di base Bendahara (diinput bendahara). Hak baca ditegakkan di server (/api/airtable -> policy.ts).
// Tampilan: halaman Ringkasan (kartu bisa diklik) + tab Transaksi, Per Bulan, Per Bidang, Per Rekening.
import { BASE_BEN, KEU, T } from "@/lib/policy";

const CFG = { base: BASE_BEN, mutasi: T.mutasi, K: KEU };

export const KEUANGAN_JS = String.raw`
(function () {
  var C = __CFG__;
  var K = C.K;
  var BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  var BLNF = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var MASUK = "Transaksi Masuk", KELUAR = "Transaksi Keluar", AWAL = "Saldo Awal";
  var JLABEL = {}; JLABEL[MASUK] = "Uang masuk"; JLABEL[KELUAR] = "Uang keluar"; JLABEL[AWAL] = "Saldo awal";
  var VIEWS = [["ringkasan", "Ringkasan"], ["transaksi", "Transaksi"], ["bulan", "Per Bulan"], ["bidang", "Per Bidang"], ["rekening", "Per Rekening"]];
  var items = [], loaded = false, loading = false, loadedAt = null, shown = 50;
  var view = "ringkasan", grp = "bidang";
  var filt = { tahun: "", bulan: "", rek: "", bidang: "", account: "", jenis: "", q: "" };
  var root = null, headBox = null, tabBox = null, bodyBox = null;

  function api(tool, input) {
    return fetch("/api/airtable", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool: tool, input: input }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || ("HTTP " + r.status)); return j; }); });
  }
  function listAll(fields, sort) {
    var out = [];
    function page(cursor) {
      var input = { baseId: C.base, tableId: C.mutasi, fieldIds: fields, pageSize: 500 };
      if (sort) input.sort = sort;
      if (cursor) input.cursor = cursor;
      return api("list_records_for_table", input).then(function (j) {
        (j.records || []).forEach(function (r) { out.push(r); });
        if (j.nextCursor && out.length < 20000) return page(j.nextCursor);
        return out;
      });
    }
    return page(null);
  }
  function v(x) { return x && typeof x === "object" && !Array.isArray(x) && "name" in x ? x.name : x; }
  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function txt(x) { x = v(x); return x == null || typeof x === "object" ? "" : clean(x); }
  function names(x) {
    if (!Array.isArray(x)) return txt(x);
    return x.map(function (e) { return clean(e && typeof e === "object" ? e.name : e); }).filter(Boolean).join(", ");
  }
  // Nama bidang/kategori di Airtable diawali nomor urut ("5-Doa - FORKOM 1"); untuk tampilan nomornya dibuang.
  function nice(s) { return clean(s).replace(/^\d+\s*-\s*/, "") || clean(s); }
  function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function rp(n) { var r = Math.round(num(n)); return (r < 0 ? "−" : "") + "Rp " + Math.abs(r).toLocaleString("id-ID"); }
  function compact(n) {
    var a = Math.abs(n), s = n < 0 ? "−" : "";
    function f(x) { return (Math.round(x * 10) / 10).toString().replace(".", ","); }
    if (a >= 1e9) return s + f(a / 1e9) + " M";
    if (a >= 1e6) return s + f(a / 1e6) + " jt";
    if (a >= 1e3) return s + f(a / 1e3) + " rb";
    return s + String(Math.round(a));
  }
  function tgl(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? Number(m[3]) + " " + BLN[Number(m[2]) - 1] + " " + m[1] : "-"; }
  function bulanLabel(key) { var m = /^(\d{4})-(\d{2})$/.exec(key); return m ? BLNF[Number(m[2]) - 1] + " " + m[1] : key; }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (x && !s[x]) { s[x] = 1; o.push(x); } }); return o; }
  function signed(t) { return t.jenis === KELUAR ? -t.nominal : t.nominal; }

  // Pos yang hanya memindahkan uang (bukan pendapatan atau biaya): saldo awal, pembukaan rekening, transfer antar rekening,
  // penyesuaian, dan transaksi pengurus lama. Tidak dihitung di "uang masuk/keluar", tetapi tetap dihitung di saldo.
  var NETRAL = { 1: 1, 2: 1, 3: 1, 4: 1, 27: 1, 43: 1, 57: 1, 73: 1, 79: 1, 80: 1 };
  // Donasi umum (janji iman pengurus dan donatur luar): menutup defisit kegiatan, jadi dipisah dari "hasil kegiatan".
  var DONASI = { 12: 1, 83: 1 };
  function accNo(s) { var m = /^\s*(\d+)\s*-/.exec(s || ""); return m ? Number(m[1]) : 0; }
  function mapTx(r) {
    var f = r.cellValuesByFieldId || {};
    var acc = names(f[K.account]), no = accNo(acc);
    return { netral: !!NETRAL[no], donasi: !!DONASI[no], id: r.id, jenis: txt(f[K.jenis]), tgl: String(f[K.tgl] || "").slice(0, 10), nominal: num(f[K.nominal]), ket: txt(f[K.ket]),
      account: acc, rekening: names(f[K.rekening]), bidang: names(f[K.bidang]), event: names(f[K.event]), penerima: txt(f[K.penerima]), hapus: !!f[K.hapus] };
  }

  function load(force) {
    if (loading || (loaded && !force)) return Promise.resolve();
    loading = true;
    root.textContent = "";
    root.appendChild(EPK.el("p", { class: "hint", text: "Memuat laporan keuangan…" }));
    var fields = Object.keys(K).map(function (k) { return K[k]; });
    return listAll(fields, [{ fieldId: K.tgl, direction: "desc" }]).then(function (res) {
      // Transaksi yang dicentang "Hapus" oleh bendahara dianggap batal dan tidak dihitung.
      items = res.map(mapTx).filter(function (t) { return !t.hapus; });
      loaded = true; loading = false; loadedAt = new Date(); shown = 50;
      var ys = years();
      if (filt.tahun && ys.indexOf(filt.tahun) < 0) filt.tahun = "";
      if (!filt.tahun && ys.length) filt.tahun = ys[0];
      draw();
    }, function (e) {
      loading = false; root.textContent = "";
      root.appendChild(EPK.el("p", { class: "epk-msg bad", text: "Laporan keuangan belum bisa dimuat: " + e.message }));
      root.appendChild(EPK.el("button", { type: "button", class: "btn", text: "Coba lagi", onclick: function () { load(true); } }));
    });
  }
  function years() { return uniq(items.map(function (t) { return t.tgl.slice(0, 4); })).filter(function (y) { return /^\d{4}$/.test(y); }).sort().reverse(); }

  function css() {
    if (document.getElementById("keuCss")) return;
    var st = document.createElement("style"); st.id = "keuCss";
    st.textContent = ".keu-top{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;margin:2px 0 6px}.keu-top h2{margin:0}"
      + ".keu-per{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.keu-per select,.keu-f select,.keu-f input{font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:8px;min-width:0;background:var(--surface);color:var(--fg)}"
      + ".keu-note{color:var(--muted);font-size:13px;margin:2px 0 10px}"
      + ".keu-tabs{display:flex;gap:2px;overflow-x:auto;border-bottom:1px solid var(--line);margin:8px 0 14px;-webkit-overflow-scrolling:touch}"
      + ".keu-tab{font:inherit;background:none;border:0;border-bottom:3px solid transparent;color:var(--muted);padding:10px 14px;cursor:pointer;white-space:nowrap}.keu-tab:hover{color:var(--fg)}.keu-tab[aria-selected=true]{color:var(--fg);font-weight:600;border-bottom-color:var(--accent)}"
      + ".keu-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}"
      + ".keu-card{font:inherit;color:inherit;text-align:left;display:flex;flex-direction:column;gap:3px;border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:var(--surface);cursor:pointer}.keu-card:hover,.keu-card:focus-visible{border-color:var(--accent)}"
      + ".keu-card .l{color:var(--muted);font-size:14px}.keu-card .n{font-size:24px;font-weight:700;overflow-wrap:anywhere;line-height:1.2}.keu-card .s{color:var(--muted);font-size:13px;min-height:2.6em}.keu-card .go{color:var(--accent);font-size:13px;margin-top:4px}"
      + ".keu-in{color:#1d6b2f}.keu-out{color:#9b1c1c}.keu-neg{color:#9b1c1c}"
      + ".keu-panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:14px}.keu-panel{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:var(--surface)}"
      + ".keu-panel h3{margin:0 0 2px;font-size:16px}.keu-panel .keu-note{margin-bottom:8px}.keu-more{font:inherit;background:none;border:0;color:var(--accent);cursor:pointer;padding:6px 0 0;font-size:13px}"
      + ".keu-chart{width:100%;height:auto;display:block}.keu-leg{display:flex;gap:14px;font-size:13px;color:var(--muted);margin:4px 0}.keu-leg i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px}"
      // Kotak tabel bisa digeser (atas-bawah dan kiri-kanan); header menempel di atas dan baris Total di bawah selagi digeser.
      + ".keu-tw{overflow:auto;max-height:70vh;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:10px;margin:8px 0;background:var(--surface)}"
      + ".keu-tw table{min-width:560px;width:100%;border-collapse:separate;border-spacing:0}"
      + ".keu-tw th,.keu-tw td{border-bottom:1px solid var(--line)}"
      + ".keu-tw thead th{position:sticky;top:0;z-index:2;background:var(--accent-soft);color:var(--fg);font-size:15px;font-weight:700;text-transform:none;letter-spacing:0;border-bottom:2px solid var(--accent)}"
      + ".keu-tw tbody tr:nth-child(even) td{background:var(--bg)}"
      + ".keu-tw tfoot td{position:sticky;bottom:0;z-index:1;background:var(--accent-soft);font-weight:700;border-top:2px solid var(--accent);border-bottom:0}"
      + ".keu-tw td.r,.keu-tw th.r{text-align:right;white-space:nowrap}.keu-tw tr.clk{cursor:pointer}.keu-tw tr.clk:hover td{background:var(--accent-soft)}"
      + ".keu-f{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 8px}.keu-f .grow{flex:1 1 220px}"
      + ".keu-chip{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px;border:1px solid var(--line);white-space:nowrap}.keu-chip.in{background:#e4f5e7;color:#1d6b2f;border-color:#b9e0c1}.keu-chip.out{background:#fde8e8;color:#9b1c1c;border-color:#f3c0c0}.keu-chip.aw{background:#e6eefb;color:#1f4f99;border-color:#bfd1f0}"
      + ".keu-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:0 0 8px}.keu-seg button{font:inherit;background:var(--surface);color:var(--fg);border:0;padding:7px 14px;cursor:pointer}.keu-seg button[aria-pressed=true]{background:var(--accent);color:var(--surface)}"
      + ".keu-bars{display:grid;gap:9px}.keu-brow{display:grid;gap:3px;cursor:pointer}.keu-brow .t{display:flex;justify-content:space-between;gap:10px;font-size:14px}.keu-brow .tr{height:9px;border-radius:5px;background:var(--bg);overflow:hidden}.keu-brow .tr i{display:block;height:100%;background:#c62828;border-radius:5px}"
      + ".keu-empty{color:var(--muted);padding:18px 4px;text-align:center}"
      + ".keu-dl{display:grid;grid-template-columns:140px 1fr;gap:8px 12px;margin:0}.keu-dl dt{color:var(--muted)}.keu-dl dd{margin:0;overflow-wrap:anywhere}@media(max-width:560px){.keu-dl{grid-template-columns:1fr}.keu-dl dt{margin-top:6px}}";
    document.head.appendChild(st);
  }

  function sel(opts, val, blank, label) {
    var o = [["", blank]].concat(opts.map(function (x) { return Array.isArray(x) ? x : [x, x]; }));
    var s = EPK.el("select", { "aria-label": label || blank }, o.map(function (x) { return EPK.el("option", { value: x[0], text: x[1] }); })); s.value = val || ""; return s;
  }
  function table(heads, rows, rightFrom, foot, onRow) {
    function cell(tag, c, i) { var e = EPK.el(tag, { class: i >= rightFrom ? "r" : "", text: c && typeof c === "object" ? c.t : String(c) }); if (c && typeof c === "object" && c.cls) e.className += " " + c.cls; return e; }
    function row(tag, r, h) {
      var tr = EPK.el("tr", {}, r.map(function (c, i) { return cell(tag, c, i); }));
      if (h) { tr.className = "clk"; tr.tabIndex = 0; tr.addEventListener("click", h); tr.addEventListener("keydown", function (e) { if (e.key === "Enter") h(); }); }
      return tr;
    }
    var body = rows.length ? rows.map(function (r, i) { return row("td", r.cells || r, onRow && r.go ? function () { r.go(); } : null); }) : [EPK.el("tr", {}, [EPK.el("td", { colspan: String(heads.length), class: "keu-empty", text: "Belum ada data untuk pilihan ini." })])];
    var parts = [EPK.el("thead", {}, [row("th", heads)]), EPK.el("tbody", {}, body)];
    if (foot && rows.length) parts.push(EPK.el("tfoot", {}, [row("td", foot)]));
    return EPK.el("div", { class: "keu-tw" }, [EPK.el("table", {}, parts)]);
  }
  function signCell(n) { return { t: rp(n), cls: n < 0 ? "keu-neg" : "" }; }
  function chip(jenis) { return EPK.el("span", { class: "keu-chip " + (jenis === MASUK ? "in" : jenis === KELUAR ? "out" : "aw"), text: JLABEL[jenis] || jenis || "-" }); }

  function inPeriod(t) { return (!filt.tahun || t.tgl.slice(0, 4) === filt.tahun) && (!filt.bulan || t.tgl.slice(5, 7) === filt.bulan); }
  function periodLabel() { return (filt.bulan ? BLNF[Number(filt.bulan) - 1] + " " : "") + (filt.tahun || "semua tahun"); }
  function periodItems() { return items.filter(inPeriod); }
  function filtered() {
    var q = filt.q.toLowerCase();
    return items.filter(function (t) {
      return inPeriod(t) && (!filt.rek || t.rekening === filt.rek) && (!filt.bidang || t.bidang === filt.bidang) && (!filt.account || t.account === filt.account) && (!filt.jenis || t.jenis === filt.jenis)
        && (!q || [t.ket, t.penerima, t.account, t.bidang, t.event].join(" ").toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : 0; });
  }
  // all=true: ikut menghitung perpindahan uang (dipakai untuk saldo rekening). Bawaan: tanpa perpindahan uang.
  function totals(arr, all) {
    var o = { masuk: 0, keluar: 0, awal: 0, netMasuk: 0, netKeluar: 0, donasi: 0 };
    arr.forEach(function (t) {
      var skip = t.netral && !all;
      if (t.jenis === MASUK) { if (skip) o.netMasuk += t.nominal; else { o.masuk += t.nominal; if (t.donasi) o.donasi += t.nominal; } }
      else if (t.jenis === KELUAR) { if (skip) o.netKeluar += t.nominal; else o.keluar += t.nominal; }
      else if (t.jenis === AWAL) { o.awal += t.nominal; if (!all) o.netMasuk += t.nominal; }
    });
    o.selisih = o.masuk - o.keluar; return o;
  }
  function group(arr, key, empty, all) {
    var m = {};
    arr.forEach(function (t) {
      var k = t[key] || empty; var g = m[k] = m[k] || { nama: k, masuk: 0, keluar: 0, awal: 0, n: 0 }; g.n++;
      var skip = t.netral && !all;
      if (t.jenis === MASUK) { if (!skip) g.masuk += t.nominal; } else if (t.jenis === KELUAR) { if (!skip) g.keluar += t.nominal; } else if (t.jenis === AWAL) g.awal += t.nominal;
    });
    return Object.keys(m).map(function (k) { return m[k]; });
  }
  // Arus per bulan dari seluruh data: uang masuk, uang keluar, dan saldo di akhir bulan (berjalan).
  function monthly() {
    var m = {};
    items.forEach(function (t) { var k = t.tgl.slice(0, 7); if (!/^\d{4}-\d{2}$/.test(k)) return; var g = m[k] = m[k] || { key: k, masuk: 0, keluar: 0, delta: 0 }; if (!t.netral) { if (t.jenis === MASUK) g.masuk += t.nominal; else if (t.jenis === KELUAR) g.keluar += t.nominal; } g.delta += signed(t); });
    var keys = Object.keys(m).sort(), run = 0;
    return keys.map(function (k) { run += m[k].delta; m[k].saldo = run; return m[k]; });
  }
  function saldoNow() { return items.reduce(function (a, t) { return a + signed(t); }, 0); }

  var NS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, kids) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function chart(rows, h) {
    var W = 640, H = h || 230, L = 52, R = 8, T = 12, B = 30, pw = W - L - R, ph = H - T - B;
    var max = 0; rows.forEach(function (r) { max = Math.max(max, r.masuk, r.keluar); });
    if (max <= 0) max = 1;
    var nice10 = Math.pow(10, Math.floor(Math.log(max) / Math.LN10)); var top = Math.ceil(max / nice10) * nice10;
    var g = [];
    [0, 0.5, 1].forEach(function (f) {
      var y = T + ph - ph * f;
      g.push(s("line", { x1: L, x2: W - R, y1: y, y2: y, stroke: "currentColor", "stroke-opacity": f === 0 ? "0.5" : "0.15" }));
      var tx = s("text", { x: L - 6, y: y + 4, "text-anchor": "end", "font-size": "11", fill: "currentColor", "fill-opacity": "0.7" }); tx.textContent = compact(top * f); g.push(tx);
    });
    var step = pw / Math.max(rows.length, 1), bw = Math.min(24, step / 2.6);
    rows.forEach(function (r, i) {
      var cx = L + step * i + step / 2;
      [[r.masuk, "#2e7d32", -bw - 1, "Uang masuk"], [r.keluar, "#c62828", 1, "Uang keluar"]].forEach(function (b) {
        var hh = ph * b[0] / top, t = s("title"); t.textContent = bulanLabel(r.key) + " · " + b[3] + ": " + rp(b[0]);
        g.push(s("rect", { x: cx + b[2], y: T + ph - hh, width: bw, height: Math.max(hh, 0), rx: "2", fill: b[1] }, [t]));
      });
      var lb = s("text", { x: cx, y: H - 10, "text-anchor": "middle", "font-size": "11", fill: "currentColor", "fill-opacity": "0.8" }); lb.textContent = BLN[Number(r.key.slice(5, 7)) - 1] + (r.key.slice(5, 7) === "01" || i === 0 ? " " + r.key.slice(2, 4) : ""); g.push(lb);
    });
    return s("svg", { viewBox: "0 0 " + W + " " + H, class: "keu-chart", role: "img", "aria-label": "Grafik uang masuk dan uang keluar per bulan. Angka lengkapnya ada di tab Per Bulan." }, g);
  }
  function legend() { return EPK.el("div", { class: "keu-leg" }, [EPK.el("span", {}, [EPK.el("i", { style: "background:#2e7d32" }), "Uang masuk"]), EPK.el("span", {}, [EPK.el("i", { style: "background:#c62828" }), "Uang keluar"])]); }

  function csvText(arr) {
    function q(x) { var t = String(x == null ? "" : x); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; }
    var lines = [["Tanggal", "Jenis", "Jumlah (+ masuk / - keluar)", "Keterangan", "Penerima", "Bidang", "Kategori", "Kegiatan", "Rekening"].map(q).join(",")];
    arr.forEach(function (t) { lines.push([q(t.tgl), q(JLABEL[t.jenis] || t.jenis), String(signed(t)), q(t.ket), q(t.penerima), q(nice(t.bidang)), q(nice(t.account)), q(nice(t.event)), q(t.rekening)].join(",")); });
    return "﻿" + lines.join("\r\n");
  }
  window.EPK_KEU_CSV = function () { return csvText(filtered()); };
  function download() {
    var blob = new Blob([csvText(periodItems().sort(function (a, b) { return a.tgl < b.tgl ? 1 : -1; }))], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "laporan-keuangan-bpk-" + (filt.tahun || "semua") + (filt.bulan ? "-" + filt.bulan : "") + ".csv";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function printReport() {
    var arr = periodItems().sort(function (a, b) { return a.tgl < b.tgl ? 1 : -1; }), tt = totals(arr);
    function tbl(heads, rows, rf) {
      return "<table><thead><tr>" + heads.map(function (h, i) { return "<th" + (i >= rf ? ' class="r"' : "") + ">" + esc(h) + "</th>"; }).join("") + "</tr></thead><tbody>"
        + rows.map(function (r) { return "<tr>" + r.map(function (c, i) { return "<td" + (i >= rf ? ' class="r"' : "") + ">" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
    }
    var mon = monthly().filter(function (r) { return (!filt.tahun || r.key.slice(0, 4) === filt.tahun) && (!filt.bulan || r.key.slice(5, 7) === filt.bulan); });
    var html = '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Keuangan BPK ' + esc(periodLabel()) + '</title><style>'
      + "body{font:13px/1.45 system-ui,sans-serif;margin:24px;color:#111}h1{font-size:20px;margin:0}h2{font-size:15px;margin:20px 0 6px}p{margin:2px 0;color:#444}"
      + "table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:4px 7px;text-align:left;vertical-align:top}th{background:#eee}.r{text-align:right;white-space:nowrap}"
      + ".k{display:flex;gap:10px;margin:12px 0}.k div{flex:1;border:1px solid #bbb;padding:8px 10px}.k b{display:block;font-size:16px}@media print{h2{break-after:avoid}tr{break-inside:avoid}}"
      + "</style></head><body><h1>Laporan Keuangan BPK Keuskupan Bandung</h1><p>Periode: " + esc(periodLabel()) + "</p>"
      + "<p>Dicetak " + esc(new Date().toLocaleString("id-ID")) + ". Sumber: catatan bendahara di Airtable.</p>"
      + '<div class="k"><div>Saldo kas saat ini<b>' + esc(rp(saldoNow())) + "</b></div><div>Uang masuk<b>" + esc(rp(tt.masuk)) + "</b></div><div>Uang keluar<b>" + esc(rp(tt.keluar)) + "</b></div><div>Selisih<b>" + esc(rp(tt.selisih)) + "</b></div></div>"
      + "<h2>Per bulan</h2>" + tbl(["Bulan", "Uang masuk", "Uang keluar", "Selisih", "Saldo akhir bulan"], mon.map(function (r) { return [bulanLabel(r.key), rp(r.masuk), rp(r.keluar), rp(r.masuk - r.keluar), rp(r.saldo)]; }), 1)
      + "<h2>Per bidang</h2>" + tbl(["Bidang", "Uang masuk", "Uang keluar", "Selisih"], group(arr, "bidang", "(Tanpa bidang)").sort(function (a, b) { return b.keluar - a.keluar; }).map(function (g) { return [nice(g.nama), rp(g.masuk), rp(g.keluar), rp(g.masuk - g.keluar)]; }), 1)
      + "<h2>Semua transaksi (" + arr.length + ")</h2>" + tbl(["Tanggal", "Jenis", "Keterangan", "Bidang", "Jumlah"], arr.map(function (t) { return [tgl(t.tgl), JLABEL[t.jenis] || t.jenis, t.ket + (t.penerima ? " (" + t.penerima + ")" : ""), nice(t.bidang), rp(signed(t))]; }), 4)
      + "</body></html>";
    var w = window.open("", "_blank");
    if (!w) { alert("Pop-up diblokir browser. Izinkan pop-up untuk situs ini lalu coba lagi."); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 400);
  }

  // ---- navigasi ----
  function go(v2, preset) {
    view = v2; shown = 50;
    if (preset) Object.keys(preset).forEach(function (k) { filt[k] = preset[k]; });
    drawTabs(); drawBody(); if (root && root.scrollIntoView) { try { root.scrollIntoView({ block: "start" }); } catch (e) {} }
  }
  function clear() { return { rek: "", bidang: "", account: "", jenis: "", q: "" }; }
  function withClear(o) { var c = clear(); Object.keys(o || {}).forEach(function (k) { c[k] = o[k]; }); return c; }

  // ---- halaman ----
  function card(label, value, sub, cls, to, preset) {
    return EPK.el("button", { type: "button", class: "keu-card", onclick: function () { go(to, preset); }, "aria-label": label + ": " + value + ". Lihat rincian." }, [
      EPK.el("span", { class: "l", text: label }), EPK.el("span", { class: "n" + (cls ? " " + cls : ""), text: value }), EPK.el("span", { class: "s", text: sub }), EPK.el("span", { class: "go", text: "Lihat rincian ›" })]);
  }
  function vRingkasan() {
    var arr = periodItems(), tt = totals(arr), saldo = saldoNow(), p = periodLabel();
    var box = EPK.el("div");
    if (!items.length) { box.appendChild(EPK.el("p", { class: "keu-empty", text: "Belum ada catatan keuangan." })); return box; }
    box.appendChild(EPK.el("div", { class: "keu-cards" }, [
      card("Saldo kas saat ini", rp(saldo), "Uang yang ada sekarang di semua rekening.", saldo < 0 ? "keu-neg" : "", "rekening"),
      card("Uang masuk", rp(tt.masuk), "Pemasukan sebenarnya, " + p + ".", "keu-in", "transaksi", withClear({ jenis: MASUK })),
      card("Uang keluar", rp(tt.keluar), "Pengeluaran sebenarnya, " + p + ".", "keu-out", "transaksi", withClear({ jenis: KELUAR })),
      card("Selisih", rp(tt.selisih), tt.selisih === 0 ? "Uang masuk dan keluar sama besar, " + p + "." : tt.selisih > 0 ? "Uang masuk lebih besar dari uang keluar, " + p + "." : "Uang keluar lebih besar dari uang masuk, " + p + ".", tt.selisih < 0 ? "keu-neg" : "", "bulan")]));
    var hasil = tt.selisih - tt.donasi;
    box.appendChild(EPK.el("p", { class: "keu-note", text: "Tidak dihitung sebagai uang masuk/keluar: perpindahan uang antar rekening, saldo awal, penyesuaian, dan transaksi pengurus lama (masuk " + rp(tt.netMasuk) + ", keluar " + rp(tt.netKeluar) + "); semuanya tetap ada di saldo kas." }));
    if (tt.donasi) box.appendChild(EPK.el("p", { class: "keu-note", text: "Hasil kegiatan sebelum donasi pengurus (janji iman) dan donatur luar sebesar " + rp(tt.donasi) + ": " + rp(hasil) + (hasil < 0 ? " (defisit)" : hasil > 0 ? " (surplus)" : "") + ". Angka ini yang paling mendekati laporan Surplus & Defisit dari bendahara." }));

    var last6 = monthly().slice(-6);
    var pn = EPK.el("div", { class: "keu-panel" }, [EPK.el("h3", { text: "Uang masuk dan keluar tiap bulan" }), EPK.el("p", { class: "keu-note", text: "6 bulan terakhir yang ada catatannya." })]);
    if (last6.length) { pn.appendChild(chart(last6, 210)); pn.appendChild(legend()); } else pn.appendChild(EPK.el("p", { class: "keu-empty", text: "Belum ada transaksi bertanggal." }));
    pn.appendChild(EPK.el("button", { type: "button", class: "keu-more", text: "Lihat semua bulan ›", onclick: function () { go("bulan"); } }));

    var top = group(arr.filter(function (t) { return t.jenis === KELUAR; }), "bidang", "(Tanpa bidang)").sort(function (a, b) { return b.keluar - a.keluar; }).slice(0, 5);
    var mx = top.length ? top[0].keluar || 1 : 1;
    var pb = EPK.el("div", { class: "keu-panel" }, [EPK.el("h3", { text: "Uang paling banyak dipakai oleh" }), EPK.el("p", { class: "keu-note", text: "5 bidang dengan uang keluar terbesar, " + p + "." })]);
    if (top.length) {
      pb.appendChild(EPK.el("div", { class: "keu-bars" }, top.map(function (g) {
        return EPK.el("div", { class: "keu-brow", tabindex: "0", role: "button", onclick: function () { go("transaksi", withClear({ jenis: KELUAR, bidang: g.nama === "(Tanpa bidang)" ? "" : g.nama })); }, onkeydown: function (e) { if (e.key === "Enter") go("transaksi", withClear({ jenis: KELUAR, bidang: g.nama === "(Tanpa bidang)" ? "" : g.nama })); } }, [
          EPK.el("div", { class: "t" }, [EPK.el("span", { text: nice(g.nama) }), EPK.el("b", { text: rp(g.keluar) })]),
          EPK.el("div", { class: "tr" }, [EPK.el("i", { style: "width:" + Math.max(3, Math.round(100 * g.keluar / mx)) + "%" })])]);
      })));
    } else pb.appendChild(EPK.el("p", { class: "keu-empty", text: "Tidak ada uang keluar pada periode ini." }));
    pb.appendChild(EPK.el("button", { type: "button", class: "keu-more", text: "Lihat semua bidang ›", onclick: function () { go("bidang"); } }));
    box.appendChild(EPK.el("div", { class: "keu-panels" }, [pn, pb]));
    return box;
  }

  function detailTx(t) {
    var rows = [["Tanggal", tgl(t.tgl)], ["Jumlah", rp(signed(t))], ["Keterangan", t.ket], ["Diterima oleh", t.penerima], ["Bidang", nice(t.bidang)], ["Kategori", nice(t.account)], ["Kegiatan", nice(t.event)], ["Rekening", t.rekening]];
    var dl = EPK.el("dl", { class: "keu-dl" });
    dl.appendChild(EPK.el("dt", { text: "Jenis" })); dl.appendChild(EPK.el("dd", {}, [chip(t.jenis)]));
    rows.forEach(function (r) { dl.appendChild(EPK.el("dt", { text: r[0] })); dl.appendChild(EPK.el("dd", { text: r[1] || "-" })); });
    EPK.modal("Detail transaksi", dl);
  }
  function vTransaksi() {
    var box = EPK.el("div");
    var jns = sel([[MASUK, "Uang masuk"], [KELUAR, "Uang keluar"], [AWAL, "Saldo awal"]], filt.jenis, "Semua jenis", "Jenis transaksi");
    var rek = sel(uniq(items.map(function (t) { return t.rekening; })).sort(), filt.rek, "Semua rekening", "Rekening");
    var bid = sel(uniq(items.map(function (t) { return t.bidang; })).sort(function (a, b) { return nice(a).localeCompare(nice(b), "id"); }).map(function (b) { return [b, nice(b)]; }), filt.bidang, "Semua bidang", "Bidang");
    var q = EPK.el("input", { type: "search", class: "grow", placeholder: "Cari keterangan atau nama penerima", autocomplete: "off", "aria-label": "Cari transaksi" }); q.value = filt.q;
    var acc = EPK.el("p", { class: "keu-note" }), tb = EPK.el("div");
    function again() {
      var arr = filtered(), tt = totals(arr, !!(filt.account || filt.rek)), sl = arr.slice(0, shown);
      acc.textContent = arr.length + " transaksi pada " + periodLabel() + " · uang masuk " + rp(tt.masuk) + " · uang keluar " + rp(tt.keluar) + (filt.account ? " · kategori: " + nice(filt.account) : "") + ". Klik baris untuk melihat detailnya.";
      tb.textContent = "";
      tb.appendChild(table(["Tanggal", "Keterangan", "Bidang", "Rekening", "Jenis", "Jumlah"], sl.map(function (t) {
        var c = { cells: [tgl(t.tgl), t.ket + (t.penerima ? " (" + t.penerima + ")" : ""), nice(t.bidang) || "-", t.rekening || "-", { t: JLABEL[t.jenis] || t.jenis || "-" }, { t: (t.jenis === KELUAR ? "−" : t.jenis === MASUK ? "+" : "") + rp(t.nominal).replace("−", ""), cls: t.jenis === KELUAR ? "keu-out" : t.jenis === MASUK ? "keu-in" : "" }], go: function () { detailTx(t); } };
        return c;
      }), 5, null, true));
      if (arr.length > shown) tb.appendChild(EPK.el("button", { type: "button", class: "btn", text: "Tampilkan 50 lagi (" + (arr.length - shown) + " tersisa)", onclick: function () { shown += 50; again(); } }));
    }
    function bind(el, k) { el.addEventListener("change", function () { filt[k] = el.value; shown = 50; again(); }); }
    bind(jns, "jenis"); bind(rek, "rek"); bind(bid, "bidang");
    q.addEventListener("input", function () { filt.q = q.value.trim(); shown = 50; again(); });
    box.appendChild(EPK.el("div", { class: "keu-f" }, [jns, rek, bid, q, (filt.jenis || filt.rek || filt.bidang || filt.account || filt.q) ? EPK.el("button", { type: "button", class: "btn", text: "Hapus filter", onclick: function () { go("transaksi", clear()); } }) : null]));
    box.appendChild(acc); box.appendChild(tb); again();
    return box;
  }

  function vBulan() {
    var rows = monthly().filter(function (r) { return !filt.tahun || r.key.slice(0, 4) === filt.tahun; });
    var box = EPK.el("div");
    box.appendChild(EPK.el("p", { class: "keu-note", text: "Uang masuk dan keluar sebenarnya (tanpa perpindahan antar rekening), serta saldo kas di akhir tiap bulan" + (filt.tahun ? " tahun " + filt.tahun : "") + ". Klik baris untuk melihat transaksinya." }));
    if (!rows.length) { box.appendChild(EPK.el("p", { class: "keu-empty", text: "Belum ada transaksi bertanggal." })); return box; }
    box.appendChild(EPK.el("div", { class: "keu-panel" }, [chart(rows.slice(-12), 240), legend()]));
    box.appendChild(table(["Bulan", "Uang masuk", "Uang keluar", "Selisih", "Saldo akhir bulan"], rows.slice().reverse().map(function (r) {
      return { cells: [bulanLabel(r.key), rp(r.masuk), rp(r.keluar), signCell(r.masuk - r.keluar), signCell(r.saldo)], go: function () { go("transaksi", withClear({ tahun: r.key.slice(0, 4), bulan: r.key.slice(5, 7) })); } };
    }), 1, null, true));
    return box;
  }

  function vBidang() {
    var arr = periodItems().filter(function (t) { return t.jenis !== AWAL; }), tt = totals(arr);
    var key = grp, empty = key === "bidang" ? "(Tanpa bidang)" : "(Tanpa kategori)";
    var gs = group(arr, key, empty).sort(function (a, b) { return b.keluar - a.keluar || b.masuk - a.masuk; });
    var box = EPK.el("div");
    var seg = EPK.el("div", { class: "keu-seg", role: "group", "aria-label": "Kelompokkan berdasarkan" }, [["bidang", "Menurut bidang"], ["account", "Menurut kategori"]].map(function (o) {
      return EPK.el("button", { type: "button", "aria-pressed": grp === o[0] ? "true" : "false", text: o[1], onclick: function () { grp = o[0]; drawBody(); } });
    }));
    box.appendChild(seg);
    box.appendChild(EPK.el("p", { class: "keu-note", text: (key === "bidang" ? "Uang masuk dan keluar tiap bidang/seksi" : "Uang masuk dan keluar menurut jenis kegiatan atau sumbernya (kategori)") + ", " + periodLabel() + ". Klik baris untuk melihat transaksinya." }));
    box.appendChild(table([key === "bidang" ? "Bidang" : "Kategori", "Uang masuk", "Uang keluar", "Selisih"], gs.map(function (g) {
      return { cells: [nice(g.nama), rp(g.masuk), rp(g.keluar), signCell(g.masuk - g.keluar)], go: function () { var p = withClear({}); if (g.nama !== empty) p[key] = g.nama; go("transaksi", p); } };
    }), 1, ["Total", rp(tt.masuk), rp(tt.keluar), signCell(tt.selisih)], true));
    return box;
  }

  function vRekening() {
    var rek = group(items, "rekening", "(Tanpa rekening)", true).sort(function (a, b) { return (b.awal + b.masuk - b.keluar) - (a.awal + a.masuk - a.keluar); });
    var box = EPK.el("div");
    box.appendChild(EPK.el("p", { class: "keu-note", text: "Saldo dihitung dari seluruh catatan sejak awal, jadi tidak berubah menurut pilihan periode. Klik baris untuk melihat transaksinya." }));
    box.appendChild(table(["Rekening", "Saldo awal", "Total uang masuk", "Total uang keluar", "Saldo sekarang"], rek.map(function (g) {
      return { cells: [g.nama, rp(g.awal), rp(g.masuk), rp(g.keluar), signCell(g.awal + g.masuk - g.keluar)], go: function () { go("transaksi", withClear({ rek: g.nama === "(Tanpa rekening)" ? "" : g.nama, tahun: "", bulan: "" })); } };
    }), 1, ["Total", rp(rek.reduce(function (a, g) { return a + g.awal; }, 0)), rp(rek.reduce(function (a, g) { return a + g.masuk; }, 0)), rp(rek.reduce(function (a, g) { return a + g.keluar; }, 0)), signCell(saldoNow())], true));
    return box;
  }

  // ---- kerangka ----
  function drawHead() {
    headBox.textContent = "";
    var ys = years();
    var tahun = sel(ys, filt.tahun, "Semua tahun", "Tahun"), bulan = sel(BLNF.map(function (n, i) { return [(i < 9 ? "0" : "") + (i + 1), n]; }), filt.bulan, "Semua bulan", "Bulan");
    tahun.addEventListener("change", function () { filt.tahun = tahun.value; shown = 50; drawBody(); });
    bulan.addEventListener("change", function () { filt.bulan = bulan.value; shown = 50; drawBody(); });
    headBox.appendChild(EPK.el("div", { class: "keu-top" }, [
      EPK.el("h2", { text: "Laporan Keuangan BPK Keuskupan Bandung" }),
      EPK.el("div", { class: "keu-per" }, [EPK.el("span", { class: "keu-note", style: "margin:0", text: "Periode:" }), tahun, bulan,
        EPK.el("button", { type: "button", class: "btn", text: "↻ Muat ulang", onclick: function () { load(true); } }),
        EPK.el("button", { type: "button", class: "btn", text: "Unduh Excel", title: "File .csv, bisa dibuka di Excel", onclick: download }),
        EPK.el("button", { type: "button", class: "btn", text: "Cetak / PDF", onclick: printReport })])]));
    headBox.appendChild(EPK.el("p", { class: "keu-note", text: "Dicatat oleh bendahara; halaman ini hanya untuk dilihat." + (loadedAt ? " Data per " + loadedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + "." : "") }));
  }
  function drawTabs() {
    tabBox.textContent = "";
    VIEWS.forEach(function (x) {
      tabBox.appendChild(EPK.el("button", { type: "button", role: "tab", class: "keu-tab", "aria-selected": view === x[0] ? "true" : "false", text: x[1], onclick: function () { go(x[0]); } }));
    });
  }
  function drawBody() {
    drawHead();
    bodyBox.textContent = "";
    bodyBox.appendChild(view === "transaksi" ? vTransaksi() : view === "bulan" ? vBulan() : view === "bidang" ? vBidang() : view === "rekening" ? vRekening() : vRingkasan());
  }
  function draw() {
    if (!root) return;
    css(); root.textContent = "";
    headBox = EPK.el("div"); tabBox = EPK.el("div", { class: "keu-tabs", role: "tablist", "aria-label": "Bagian laporan keuangan" }); bodyBox = EPK.el("div");
    root.appendChild(headBox); root.appendChild(tabBox); root.appendChild(bodyBox);
    drawTabs(); drawBody();
  }

  window.EPK_KEU_OPEN = function () {
    root = document.getElementById("keuRoot"); if (!root) return;
    if (!loaded) load(false); else draw();
  };
})();
`.replace("__CFG__", JSON.stringify(CFG));
