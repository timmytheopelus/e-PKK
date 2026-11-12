// Skrip menu Keuangan (laporan keuangan BPK, hanya baca). Hanya dikirim ke pengguna yang punya tab Keuangan.
// Data berasal dari tabel Mutasi di base Bendahara (diinput bendahara). Hak baca ditegakkan di server (/api/airtable -> policy.ts).
import { BASE_BEN, KEU, T } from "@/lib/policy";

const CFG = { base: BASE_BEN, mutasi: T.mutasi, K: KEU };

export const KEUANGAN_JS = String.raw`
(function () {
  var C = __CFG__;
  var K = C.K;
  var BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  var BLNF = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var MASUK = "Transaksi Masuk", KELUAR = "Transaksi Keluar", AWAL = "Saldo Awal";
  var items = [], loaded = false, loading = false, loadedAt = null, shown = 100;
  var filt = { tahun: "", bulan: "", rek: "", bidang: "", jenis: "", q: "" };
  var root = null, bodyBox = null, cntBox = null;

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

  function mapTx(r) {
    var f = r.cellValuesByFieldId || {};
    return { id: r.id, jenis: txt(f[K.jenis]), tgl: String(f[K.tgl] || "").slice(0, 10), nominal: num(f[K.nominal]), ket: txt(f[K.ket]),
      account: names(f[K.account]), rekening: names(f[K.rekening]), bidang: names(f[K.bidang]), event: names(f[K.event]), penerima: txt(f[K.penerima]), hapus: !!f[K.hapus] };
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
      loaded = true; loading = false; loadedAt = new Date(); shown = 100;
      var ys = uniq(items.map(function (t) { return t.tgl.slice(0, 4); })).filter(function (y) { return /^\d{4}$/.test(y); }).sort();
      if (filt.tahun && ys.indexOf(filt.tahun) < 0) filt.tahun = "";
      if (!filt.tahun && ys.length) filt.tahun = ys[ys.length - 1];
      draw();
    }, function (e) {
      loading = false; root.textContent = "";
      root.appendChild(EPK.el("p", { class: "epk-msg bad", text: "Gagal memuat laporan keuangan: " + e.message }));
      root.appendChild(EPK.el("button", { type: "button", class: "btn", text: "Coba lagi", onclick: function () { load(true); } }));
    });
  }

  function css() {
    if (document.getElementById("keuCss")) return;
    var st = document.createElement("style"); st.id = "keuCss";
    st.textContent = ".keu-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.keu-bar .grow{flex:1 1 200px}.keu-bar select,.keu-bar input{font:inherit;padding:7px 9px;border:1px solid var(--line);border-radius:8px;min-width:0;background:var(--surface);color:var(--fg)}"
      + ".keu-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}.keu-stat{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface)}.keu-n{font-size:21px;font-weight:700;overflow-wrap:anywhere}.keu-l{color:var(--muted);font-size:13px}.keu-s{color:var(--muted);font-size:12px}"
      + ".keu-in{color:#1d6b2f}.keu-out{color:#9b1c1c}.keu-neg{color:#9b1c1c}"
      + ".keu-tw{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin:8px 0}.keu-tw table{min-width:640px;width:100%}.keu-tw td.r,.keu-tw th.r{text-align:right;white-space:nowrap}.keu-tw tfoot td{font-weight:700;border-top:2px solid var(--line)}"
      + ".keu-h{margin:22px 0 4px;font-size:17px}.keu-chart{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:10px;background:var(--surface)}.keu-leg{display:flex;gap:14px;font-size:13px;color:var(--muted);margin:6px 0}.keu-leg i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px}"
      + ".keu-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:0 16px}";
    document.head.appendChild(st);
  }

  function sel(opts, val, blank) {
    var o = [["", blank]].concat(opts.map(function (x) { return Array.isArray(x) ? x : [x, x]; }));
    var s = EPK.el("select", {}, o.map(function (x) { return EPK.el("option", { value: x[0], text: x[1] }); })); s.value = val || ""; return s;
  }
  function stat(label, value, sub, cls) {
    return EPK.el("div", { class: "keu-stat" }, [EPK.el("div", { class: "keu-n" + (cls ? " " + cls : ""), text: value }), EPK.el("div", { class: "keu-l", text: label }), sub ? EPK.el("div", { class: "keu-s", text: sub }) : null]);
  }
  function table(heads, rows, rightFrom, foot) {
    function cell(tag, c, i) { return EPK.el(tag, { class: i >= rightFrom ? "r" : "", text: c && typeof c === "object" ? c.t : String(c) }, []); }
    function row(tag, r) {
      return EPK.el("tr", {}, r.map(function (c, i) { var e = cell(tag, c, i); if (c && typeof c === "object" && c.cls) e.className += " " + c.cls; return e; }));
    }
    var body = rows.length ? rows.map(function (r) { return row("td", r); }) : [EPK.el("tr", {}, [EPK.el("td", { colspan: String(heads.length), text: "Tidak ada data pada filter ini." })])];
    var parts = [EPK.el("thead", {}, [row("th", heads)]), EPK.el("tbody", {}, body)];
    if (foot && rows.length) parts.push(EPK.el("tfoot", {}, [row("td", foot)]));
    return EPK.el("div", { class: "keu-tw" }, [EPK.el("table", {}, parts)]);
  }
  function signCell(n) { return { t: rp(n), cls: n < 0 ? "keu-neg" : "" }; }

  function inPeriod(t) { return (!filt.tahun || t.tgl.slice(0, 4) === filt.tahun) && (!filt.bulan || t.tgl.slice(5, 7) === filt.bulan); }
  function filtered() {
    var q = filt.q.toLowerCase();
    return items.filter(function (t) {
      return inPeriod(t) && (!filt.rek || t.rekening === filt.rek) && (!filt.bidang || t.bidang === filt.bidang) && (!filt.jenis || t.jenis === filt.jenis)
        && (!q || [t.ket, t.penerima, t.account, t.bidang, t.event].join(" ").toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : 0; });
  }
  function totals(arr) {
    var o = { masuk: 0, keluar: 0, awal: 0 };
    arr.forEach(function (t) { if (t.jenis === MASUK) o.masuk += t.nominal; else if (t.jenis === KELUAR) o.keluar += t.nominal; else if (t.jenis === AWAL) o.awal += t.nominal; });
    o.selisih = o.masuk - o.keluar; return o;
  }
  function group(arr, key, empty) {
    var m = {};
    arr.forEach(function (t) { var k = t[key] || empty; var g = m[k] = m[k] || { nama: k, masuk: 0, keluar: 0, awal: 0, n: 0 }; g.n++; if (t.jenis === MASUK) g.masuk += t.nominal; else if (t.jenis === KELUAR) g.keluar += t.nominal; else if (t.jenis === AWAL) g.awal += t.nominal; });
    return Object.keys(m).map(function (k) { return m[k]; });
  }

  // Ringkasan per bulan dari seluruh data (bukan terfilter): arus masuk/keluar dan saldo akhir bulan berjalan.
  function monthly() {
    var m = {};
    items.forEach(function (t) { var k = t.tgl.slice(0, 7); if (!/^\d{4}-\d{2}$/.test(k)) return; var g = m[k] = m[k] || { key: k, masuk: 0, keluar: 0, delta: 0 }; if (t.jenis === MASUK) g.masuk += t.nominal; else if (t.jenis === KELUAR) g.keluar += t.nominal; g.delta += signed(t); });
    var keys = Object.keys(m).sort(), run = 0;
    return keys.map(function (k) { run += m[k].delta; m[k].saldo = run; return m[k]; });
  }

  var NS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, kids) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function chart(rows) {
    var W = 680, H = 250, L = 56, R = 12, T = 14, B = 34, pw = W - L - R, ph = H - T - B;
    var max = 0; rows.forEach(function (r) { max = Math.max(max, r.masuk, r.keluar); });
    if (max <= 0) max = 1;
    var nice = Math.pow(10, Math.floor(Math.log(max) / Math.LN10)); var top = Math.ceil(max / nice) * nice;
    var g = [];
    [0, 0.5, 1].forEach(function (f) {
      var y = T + ph - ph * f;
      g.push(s("line", { x1: L, x2: W - R, y1: y, y2: y, stroke: "currentColor", "stroke-opacity": f === 0 ? "0.5" : "0.15" }));
      var tx = s("text", { x: L - 6, y: y + 4, "text-anchor": "end", "font-size": "11", fill: "currentColor", "fill-opacity": "0.7" }); tx.textContent = compact(top * f); g.push(tx);
    });
    var step = pw / Math.max(rows.length, 1), bw = Math.min(22, step / 2.6);
    rows.forEach(function (r, i) {
      var cx = L + step * i + step / 2;
      [[r.masuk, "#2e7d32", -bw - 1, "Pemasukan"], [r.keluar, "#c62828", 1, "Pengeluaran"]].forEach(function (b) {
        var h = ph * b[0] / top;
        g.push(s("rect", { x: cx + b[2], y: T + ph - h, width: bw, height: Math.max(h, 0), rx: "2", fill: b[1] }, [(function () { var t = s("title"); t.textContent = bulanLabel(r.key) + " · " + b[3] + ": " + rp(b[0]); return t; })()]));
      });
      var lb = s("text", { x: cx, y: H - 12, "text-anchor": "middle", "font-size": "11", fill: "currentColor", "fill-opacity": "0.8" }); lb.textContent = BLN[Number(r.key.slice(5, 7)) - 1] + (r.key.slice(5, 7) === "01" || i === 0 ? " " + r.key.slice(2, 4) : ""); g.push(lb);
    });
    return s("svg", { viewBox: "0 0 " + W + " " + H, class: "keu-chart", role: "img", "aria-label": "Grafik pemasukan dan pengeluaran per bulan, rincian angka ada di tabel di bawahnya." }, g);
  }

  function csvText(arr) {
    function q(x) { var t = String(x == null ? "" : x); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; }
    var lines = [["Tanggal", "Jenis", "Nominal (+masuk / -keluar)", "Keterangan", "Penerima", "Bidang", "Account", "Event", "Rekening"].map(q).join(",")];
    arr.forEach(function (t) { lines.push([q(t.tgl), q(t.jenis), String(signed(t)), q(t.ket), q(t.penerima), q(t.bidang), q(t.account), q(t.event), q(t.rekening)].join(",")); });
    return "﻿" + lines.join("\r\n");
  }
  window.EPK_KEU_CSV = function () { return csvText(filtered()); };
  function periodLabel() { return (filt.bulan ? BLNF[Number(filt.bulan) - 1] + " " : "") + (filt.tahun || "Semua tahun"); }
  function download() {
    var blob = new Blob([csvText(filtered())], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "laporan-keuangan-bpk-" + (filt.tahun || "semua") + (filt.bulan ? "-" + filt.bulan : "") + ".csv";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function printReport() {
    var arr = filtered(), tt = totals(arr), saldo = items.reduce(function (a, t) { return a + signed(t); }, 0);
    function tbl(heads, rows) {
      return "<table><thead><tr>" + heads.map(function (h, i) { return "<th" + (i >= heads.rightFrom ? ' class="r"' : "") + ">" + esc(h) + "</th>"; }).join("") + "</tr></thead><tbody>"
        + rows.map(function (r) { return "<tr>" + r.map(function (c, i) { return "<td" + (i >= heads.rightFrom ? ' class="r"' : "") + ">" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
    }
    var h1 = ["Bulan", "Pemasukan", "Pengeluaran", "Selisih", "Saldo akhir"]; h1.rightFrom = 1;
    var h2 = ["Bidang", "Pemasukan", "Pengeluaran", "Selisih"]; h2.rightFrom = 1;
    var h3 = ["Tanggal", "Jenis", "Keterangan", "Bidang", "Account", "Nominal"]; h3.rightFrom = 5;
    var mon = monthly().filter(function (r) { return (!filt.tahun || r.key.slice(0, 4) === filt.tahun) && (!filt.bulan || r.key.slice(5, 7) === filt.bulan); });
    var html = '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Keuangan BPK ' + esc(periodLabel()) + '</title><style>'
      + "body{font:13px/1.45 system-ui,sans-serif;margin:24px;color:#111}h1{font-size:20px;margin:0}h2{font-size:15px;margin:20px 0 6px}p{margin:2px 0;color:#444}"
      + "table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:4px 7px;text-align:left;vertical-align:top}th{background:#eee}.r{text-align:right;white-space:nowrap}"
      + ".k{display:flex;gap:10px;margin:12px 0}.k div{flex:1;border:1px solid #bbb;padding:8px 10px}.k b{display:block;font-size:16px}@media print{h2{break-after:avoid}tr{break-inside:avoid}}"
      + "</style></head><body><h1>Laporan Keuangan BPK Keuskupan Bandung</h1><p>Periode: " + esc(periodLabel()) + (filt.rek ? " · Rekening: " + esc(filt.rek) : "") + (filt.bidang ? " · Bidang: " + esc(filt.bidang) : "") + (filt.jenis ? " · Jenis: " + esc(filt.jenis) : "") + "</p>"
      + "<p>Dicetak " + esc(new Date().toLocaleString("id-ID")) + ". Sumber: data bendahara di Airtable.</p>"
      + '<div class="k"><div>Saldo saat ini (seluruh periode)<b>' + esc(rp(saldo)) + "</b></div><div>Pemasukan<b>" + esc(rp(tt.masuk)) + "</b></div><div>Pengeluaran<b>" + esc(rp(tt.keluar)) + "</b></div><div>Selisih<b>" + esc(rp(tt.selisih)) + "</b></div></div>"
      + "<h2>Per bulan</h2>" + tbl(h1, mon.map(function (r) { return [bulanLabel(r.key), rp(r.masuk), rp(r.keluar), rp(r.masuk - r.keluar), rp(r.saldo)]; }))
      + "<h2>Per bidang</h2>" + tbl(h2, group(arr, "bidang", "(Tanpa bidang)").sort(function (a, b) { return b.keluar - a.keluar; }).map(function (g) { return [g.nama, rp(g.masuk), rp(g.keluar), rp(g.masuk - g.keluar)]; }))
      + "<h2>Transaksi (" + arr.length + ")</h2>" + tbl(h3, arr.map(function (t) { return [tgl(t.tgl), t.jenis, t.ket + (t.penerima ? " (" + t.penerima + ")" : ""), t.bidang, t.account, rp(signed(t))]; }))
      + "</body></html>";
    var w = window.open("", "_blank");
    if (!w) { alert("Pop-up diblokir browser. Izinkan pop-up untuk situs ini lalu coba lagi."); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 400);
  }

  function renderBody() {
    if (!bodyBox) return;
    var arr = filtered(), tt = totals(arr);
    var saldo = items.reduce(function (a, t) { return a + signed(t); }, 0);
    var last = items.reduce(function (a, t) { return t.tgl > a ? t.tgl : a; }, "");
    var mon = monthly(), cur = mon[mon.length - 1];
    bodyBox.textContent = "";
    cntBox.textContent = arr.length + " transaksi dari " + items.length + " (transaksi yang dihapus bendahara tidak dihitung)";

    bodyBox.appendChild(EPK.el("div", { class: "keu-stats" }, [
      stat("Saldo saat ini (seluruh periode)", rp(saldo), last ? "Transaksi terakhir " + tgl(last) : "", saldo < 0 ? "keu-neg" : ""),
      stat("Pemasukan · " + periodLabel(), rp(tt.masuk), "", "keu-in"),
      stat("Pengeluaran · " + periodLabel(), rp(tt.keluar), "", "keu-out"),
      stat("Selisih · " + periodLabel(), rp(tt.selisih), tt.selisih >= 0 ? "Surplus" : "Defisit", tt.selisih < 0 ? "keu-neg" : "")]));

    // Saldo per rekening (seluruh periode, tidak terpengaruh filter)
    var rek = group(items, "rekening", "(Tanpa rekening)").sort(function (a, b) { return (b.awal + b.masuk - b.keluar) - (a.awal + a.masuk - a.keluar); });
    bodyBox.appendChild(EPK.el("h3", { class: "keu-h", text: "Saldo per rekening (seluruh periode)" }));
    bodyBox.appendChild(table(["Rekening", "Saldo awal", "Pemasukan", "Pengeluaran", "Saldo"], rek.map(function (g) { return [g.nama, rp(g.awal), rp(g.masuk), rp(g.keluar), signCell(g.awal + g.masuk - g.keluar)]; }), 1,
      ["Total", rp(rek.reduce(function (a, g) { return a + g.awal; }, 0)), rp(rek.reduce(function (a, g) { return a + g.masuk; }, 0)), rp(rek.reduce(function (a, g) { return a + g.keluar; }, 0)), signCell(saldo)]));

    // Tren bulanan (12 bulan terakhir yang ada datanya)
    var last12 = mon.slice(-12);
    bodyBox.appendChild(EPK.el("h3", { class: "keu-h", text: "Tren bulanan (12 bulan terakhir)" }));
    if (last12.length) {
      bodyBox.appendChild(chart(last12));
      bodyBox.appendChild(EPK.el("div", { class: "keu-leg" }, [EPK.el("span", {}, [EPK.el("i", { style: "background:#2e7d32" }), "Pemasukan"]), EPK.el("span", {}, [EPK.el("i", { style: "background:#c62828" }), "Pengeluaran"])]));
      bodyBox.appendChild(table(["Bulan", "Pemasukan", "Pengeluaran", "Selisih", "Saldo akhir bulan"], last12.slice().reverse().map(function (r) { return [bulanLabel(r.key), rp(r.masuk), rp(r.keluar), signCell(r.masuk - r.keluar), signCell(r.saldo)]; }), 1));
    } else bodyBox.appendChild(EPK.el("p", { class: "hint", text: "Belum ada transaksi bertanggal." }));

    // Rincian per bidang dan per account untuk periode terpilih
    function det(title, key, empty) {
      var gs = group(arr, key, empty).sort(function (a, b) { return b.keluar - a.keluar || b.masuk - a.masuk; });
      var box = EPK.el("div", {}, [EPK.el("h3", { class: "keu-h", text: title + " · " + periodLabel() })]);
      box.appendChild(table([key === "bidang" ? "Bidang" : "Account", "Pemasukan", "Pengeluaran", "Selisih"], gs.map(function (g) { return [g.nama, rp(g.masuk), rp(g.keluar), signCell(g.masuk - g.keluar)]; }), 1,
        ["Total", rp(tt.masuk), rp(tt.keluar), signCell(tt.selisih)]));
      return box;
    }
    bodyBox.appendChild(EPK.el("div", { class: "keu-cols" }, [det("Per bidang", "bidang", "(Tanpa bidang)"), det("Per account", "account", "(Tanpa account)")]));

    // Daftar transaksi
    bodyBox.appendChild(EPK.el("h3", { class: "keu-h", text: "Daftar transaksi · " + periodLabel() }));
    var slice = arr.slice(0, shown);
    bodyBox.appendChild(table(["Tanggal", "Jenis", "Keterangan", "Bidang", "Account", "Rekening", "Nominal"], slice.map(function (t) {
      return [tgl(t.tgl), t.jenis, t.ket + (t.penerima ? " (" + t.penerima + ")" : ""), t.bidang || "-", t.account || "-", t.rekening || "-", { t: rp(signed(t)), cls: t.jenis === KELUAR ? "keu-out" : "keu-in" }];
    }), 6));
    if (arr.length > shown) bodyBox.appendChild(EPK.el("button", { type: "button", class: "btn", text: "Tampilkan 100 lagi (" + (arr.length - shown) + " tersisa)", onclick: function () { shown += 100; renderBody(); } }));
  }

  function draw() {
    if (!root) return;
    css(); root.textContent = "";
    root.appendChild(EPK.el("h2", { text: "Laporan Keuangan BPK Keuskupan Bandung" }));
    root.appendChild(EPK.el("p", { class: "hint", text: "Data diinput bendahara di Airtable dan hanya bisa dibaca di sini. Diperbarui otomatis tiap beberapa menit; tekan Muat ulang untuk data terbaru." + (loadedAt ? " Dimuat " + loadedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + "." : "") }));

    var years = uniq(items.map(function (t) { return t.tgl.slice(0, 4); })).filter(function (y) { return /^\d{4}$/.test(y); }).sort().reverse();
    var tahun = sel(years, filt.tahun, "Semua tahun"), bulan = sel(BLNF.map(function (n, i) { return [(i < 9 ? "0" : "") + (i + 1), n]; }), filt.bulan, "Semua bulan");
    var rek = sel(uniq(items.map(function (t) { return t.rekening; })).sort(), filt.rek, "Semua rekening");
    var bid = sel(uniq(items.map(function (t) { return t.bidang; })).sort(function (a, b) { return a.localeCompare(b, "id", { numeric: true }); }), filt.bidang, "Semua bidang");
    var jns = sel([MASUK, KELUAR, AWAL], filt.jenis, "Semua jenis");
    var q = EPK.el("input", { type: "search", class: "grow", placeholder: "Cari keterangan, penerima, account", autocomplete: "off", "aria-label": "Cari transaksi" }); q.value = filt.q;
    function bind(el, k) { el.addEventListener("change", function () { filt[k] = el.value; shown = 100; renderBody(); }); }
    bind(tahun, "tahun"); bind(bulan, "bulan"); bind(rek, "rek"); bind(bid, "bidang"); bind(jns, "jenis");
    q.addEventListener("input", function () { filt.q = q.value.trim(); shown = 100; renderBody(); });
    root.appendChild(EPK.el("div", { class: "keu-bar" }, [tahun, bulan, rek, bid, jns, q]));
    root.appendChild(EPK.el("div", { class: "keu-bar" }, [
      EPK.el("button", { type: "button", class: "btn", text: "↻ Muat ulang", onclick: function () { load(true); } }),
      EPK.el("button", { type: "button", class: "btn", text: "Unduh Excel (.csv)", onclick: download }),
      EPK.el("button", { type: "button", class: "btn", text: "Cetak / simpan PDF", onclick: printReport })]));
    cntBox = EPK.el("p", { class: "count" }); root.appendChild(cntBox);
    bodyBox = EPK.el("div"); root.appendChild(bodyBox);
    renderBody();
  }

  window.EPK_KEU_OPEN = function () {
    root = document.getElementById("keuRoot"); if (!root) return;
    if (!loaded) load(false); else draw();
  };
})();
`.replace("__CFG__", JSON.stringify(CFG));
