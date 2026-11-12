// Skrip menu Inventaris (laporan detail + tambah barang + ubah status). Hanya dikirim ke pengguna yang punya tab Inventaris.
// Penegakan hak baca/tulis tetap di server (/api/airtable -> policy.ts); tombol tulis hanya disembunyikan untuk level View.
import { INV, LOG, T, BASE_BPK } from "@/lib/policy";

const CFG = { base: BASE_BPK, inv: T.inventaris, log: T.logPinjam, I: INV, L: LOG };

export const INVENTARIS_JS = String.raw`
(function () {
  var C = __CFG__;
  var I = C.I, L = C.L;
  var STATUS = ["Bisa Dipinjam", "Fix Tidak Bergerak", "Rusak", "Diperbaiki", "Hilang"];
  var LOKASI = ["Aula Bawah", "Dipegang Personal", "Gudang belakang", "Gudang depan", "R. Band", "R. Buku", "R. Liturgi", "R. Makan", "R. Rapat Kecil", "Andry"];
  var SETUJU = ["Disetujui", "Tidak Disetujui", "Ambil Langsung"];
  var items = [], logs = [], loaded = false, loading = false, filt = { q: "", status: "", lokasi: "", logq: "", logst: "" };
  var root = null, canEdit = false;

  function api(tool, input) {
    return fetch("/api/airtable", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool: tool, input: input }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || ("HTTP " + r.status)); return j; }); });
  }
  function listAll(table, fields, sort) {
    var out = [];
    function page(cursor) {
      var input = { baseId: C.base, tableId: table, fieldIds: fields, pageSize: 500 };
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
  function txt(x) {
    if (x == null) return "";
    if (Array.isArray(x)) return x.map(txt).filter(function (s) { return s !== ""; }).join(", ");
    if (typeof x === "object") return x.name != null ? String(x.name) : "";
    return String(x);
  }
  function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function rp(n) { return "Rp " + Math.round(num(n)).toLocaleString("id-ID"); }
  function tgl(x, withTime) {
    if (!x) return "-";
    var d = new Date(x); if (isNaN(d.getTime())) return String(x);
    return withTime ? d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : d.toLocaleDateString("id-ID", { dateStyle: "medium" });
  }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (x && !s[x]) { s[x] = 1; o.push(x); } }); return o; }

  function safeUrl(u) { return typeof u === "string" && /^https:\/\//i.test(u) ? u : ""; }
  function photos(a) {
    return (Array.isArray(a) ? a : []).filter(function (p) { return p && /^image\//.test(p.type || "") && safeUrl(p.url); }).map(function (p) {
      var t = p.thumbnails || {};
      return { small: safeUrl(t.small && t.small.url) || safeUrl(p.url), large: safeUrl(t.large && t.large.url) || safeUrl(p.url), name: p.filename || "" };
    });
  }
  function thumb(x, big) {
    var p = x.fotos && x.fotos[0];
    if (!p) return EPK.el("div", { class: "inv-nofoto", "aria-hidden": "true", text: "Tanpa foto" });
    return EPK.el("img", { class: big ? "inv-foto-big" : "inv-foto", src: big ? p.large : p.small, alt: "Foto " + (x.nama || "barang"), loading: "lazy", referrerpolicy: "no-referrer" });
  }
  function mapItem(r) {
    var f = r.cellValuesByFieldId || {};
    return { id: r.id, kode: txt(f[I.kode]), nama: txt(f[I.nama]), pj: txt(f[I.pj]), tahun: f[I.tahun] || "", lokasi: txt(v(f[I.lokasi])), status: txt(v(f[I.status])),
      jumlah: num(f[I.jumlah]), harga: num(f[I.harga]), total: f[I.total] != null ? num(f[I.total]) : num(f[I.jumlah]) * num(f[I.harga]), notes: txt(f[I.notes]), dibuat: f[I.dibuat] || "",
      booking: txt(f[I.booking]), fotos: photos(f[I.foto]), logIds: (f[I.log] || []).map(function (x) { return x && x.id ? x.id : x; }) };
  }
  function mapLog(r) {
    var f = r.cellValuesByFieldId || {};
    return { id: r.id, ajuan: f[L.tglAjuan] || "", peminjam: txt(f[L.peminjam]), barangIds: (f[L.barang] || []).map(function (x) { return x && x.id ? x.id : x; }), barang: txt(f[L.namaBarang]) || txt(f[L.barang]),
      jumlah: num(f[L.jumlah]), pinjam: f[L.tglPinjam] || "", kembaliRencana: f[L.tglKembali] || "", metode: txt(v(f[L.metode])), keperluan: txt(f[L.keperluan]),
      setuju: txt(v(f[L.setuju])), alasanTolak: txt(f[L.alasanTolak]), cancel: !!f[L.cancel], alasanCancel: txt(f[L.alasanCancel]), diambil: f[L.diambil] || "", kembali: f[L.kembali] || "",
      status: txt(f[L.status]), statusUser: txt(f[L.statusUser]), bentrok: !!f[L.bentrok] };
  }

  function load(force) {
    if (loading || (loaded && !force)) return Promise.resolve();
    loading = true;
    root.textContent = "";
    root.appendChild(EPK.el("p", { class: "hint", text: "Memuat inventaris…" }));
    var fi = Object.keys(I).map(function (k) { return I[k]; });
    var fl = Object.keys(L).map(function (k) { return L[k]; });
    return Promise.all([listAll(C.inv, fi, [{ fieldId: I.nama, direction: "asc" }]), listAll(C.log, fl, [{ fieldId: L.tglAjuan, direction: "desc" }])]).then(function (res) {
      items = res[0].map(mapItem); logs = res[1].map(mapLog); loaded = true; loading = false; draw();
    }, function (e) {
      loading = false; root.textContent = "";
      root.appendChild(EPK.el("p", { class: "epk-msg bad", text: "Gagal memuat inventaris: " + e.message }));
      root.appendChild(EPK.el("button", { type: "button", class: "btn", text: "Coba lagi", onclick: function () { load(true); } }));
    });
  }

  function statusOpts() { return uniq(STATUS.concat(items.map(function (x) { return x.status; }))); }
  function lokasiOpts() { return uniq(LOKASI.concat(items.map(function (x) { return x.lokasi; }))); }
  function sel(opts, val, blank) {
    var o = (blank ? [[ "", blank ]] : []).concat(opts.map(function (x) { return [x, x]; }));
    var s = EPK.el("select", {}, o.map(function (x) { return EPK.el("option", { value: x[0], text: x[1] }); })); s.value = val || ""; return s;
  }
  function stat(label, value, sub) {
    return EPK.el("div", { class: "inv-stat" }, [EPK.el("div", { class: "inv-n", text: value }), EPK.el("div", { class: "inv-l", text: label }), sub ? EPK.el("div", { class: "inv-s", text: sub }) : null]);
  }
  function badge(s) { return EPK.el("span", { class: "inv-badge inv-" + (s === "Bisa Dipinjam" ? "ok" : s === "Rusak" || s === "Hilang" ? "bad" : s === "Diperbaiki" ? "warn" : "mute"), text: s || "-" }); }
  function activeLoan(l) { return !l.cancel && l.setuju !== "Tidak Disetujui" && !l.kembali && (l.setuju === "Disetujui" || l.setuju === "Ambil Langsung" || !!l.diambil); }
  function pending(l) { return !l.cancel && !l.setuju && !l.kembali; }

  function css() {
    if (document.getElementById("invCss")) return;
    var st = document.createElement("style"); st.id = "invCss";
    st.textContent = ".inv-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}"
      + ".inv-stat{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface)}.inv-n{font-size:22px;font-weight:700}.inv-l{color:var(--muted);font-size:13px}.inv-s{color:var(--muted);font-size:12px}"
      + ".inv-tw{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin:10px 0}.inv-tw table{min-width:760px}.inv-tw tr.clk{cursor:pointer}.inv-tw tr.clk:hover td{background:var(--bg)}"
      + ".inv-foto{width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:block}.inv-nofoto{width:48px;height:48px;border-radius:8px;border:1px dashed var(--line);color:var(--muted);font-size:10px;display:flex;align-items:center;justify-content:center;text-align:center}.inv-foto-big{max-width:100%;max-height:340px;object-fit:contain;border-radius:10px;border:1px solid var(--line);display:block;margin:0 auto 6px}.inv-gal{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}.inv-gal img{width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid var(--line);cursor:pointer}"
      + ".inv-badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12.5px;border:1px solid var(--line);white-space:nowrap}.inv-ok{background:#e4f5e7;color:#1d6b2f;border-color:#b9e0c1}.inv-bad{background:#fde8e8;color:#9b1c1c;border-color:#f3c0c0}.inv-warn{background:#fff3dc;color:#8a5a00;border-color:#f0d9a6}.inv-mute{background:var(--bg);color:var(--muted)}"
      + ".inv-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.inv-bar .grow{flex:1 1 220px}.inv-h{margin:22px 0 4px;font-size:17px}.inv-form{display:grid;grid-template-columns:150px 1fr;gap:8px 12px;align-items:center}.inv-form input,.inv-form select,.inv-form textarea{font:inherit;padding:7px 9px;border:1px solid var(--line);border-radius:6px;min-width:0;width:100%;box-sizing:border-box}@media(max-width:560px){.inv-form{grid-template-columns:1fr}}";
    document.head.appendChild(st);
  }

  function stats() {
    var unit = 0, nilai = 0, by = {};
    items.forEach(function (x) { unit += x.jumlah; nilai += x.total; by[x.status || "(belum diisi)"] = (by[x.status || "(belum diisi)"] || 0) + 1; });
    var dipinjam = logs.filter(activeLoan).length, tunggu = logs.filter(pending).length;
    var bawah = Object.keys(by).sort().map(function (k) { return k + ": " + by[k]; }).join(" · ");
    return EPK.el("div", { class: "inv-stats" }, [
      stat("Jenis barang", String(items.length), bawah), stat("Total unit", unit.toLocaleString("id-ID")), stat("Nilai perolehan", rp(nilai)),
      stat("Sedang dipinjam", String(dipinjam)), stat("Menunggu persetujuan", String(tunggu))]);
  }

  function itemTable() {
    var q = filt.q.toLowerCase();
    var rows = items.filter(function (x) {
      return (!filt.status || x.status === filt.status) && (!filt.lokasi || x.lokasi === filt.lokasi) && (!q || [x.kode, x.nama, x.pj, x.lokasi, x.notes].join(" ").toLowerCase().indexOf(q) >= 0);
    });
    var head = EPK.el("tr", {}, ["Foto", "Kode", "Nama barang", "Lokasi", "Status", "Jumlah", "Harga satuan", "Total", "Tahun", "Penanggung jawab"].map(function (h) { return EPK.el("th", { text: h }); }));
    var body = rows.map(function (x) {
      return EPK.el("tr", { class: "clk", tabindex: "0", onclick: function () { detail(x.id); }, onkeydown: function (e) { if (e.key === "Enter") detail(x.id); } }, [
        EPK.el("td", {}, [thumb(x, false)]), EPK.el("td", { text: x.kode || "-" }), EPK.el("td", { class: "nama", text: x.nama || "-" }), EPK.el("td", { text: x.lokasi || "-" }), EPK.el("td", {}, [badge(x.status)]),
        EPK.el("td", { text: String(x.jumlah) }), EPK.el("td", { text: rp(x.harga) }), EPK.el("td", { text: rp(x.total) }), EPK.el("td", { text: x.tahun ? String(x.tahun).slice(0, 4) : "-" }), EPK.el("td", { text: x.pj || "-" })]);
    });
    if (!body.length) body.push(EPK.el("tr", {}, [EPK.el("td", { colspan: "10", text: "Tidak ada barang yang cocok." })]));
    return { count: rows.length, el: EPK.el("div", { class: "inv-tw" }, [EPK.el("table", {}, [EPK.el("thead", {}, [head]), EPK.el("tbody", {}, body)])]) };
  }

  function logTable() {
    var q = filt.logq.toLowerCase();
    var rows = logs.filter(function (l) {
      var s = pending(l) ? "Menunggu" : l.cancel ? "Batal" : l.setuju === "Tidak Disetujui" ? "Ditolak" : l.kembali ? "Selesai" : "Dipinjam";
      l._s = s;
      return (!filt.logst || s === filt.logst) && (!q || [l.peminjam, l.barang, l.keperluan].join(" ").toLowerCase().indexOf(q) >= 0);
    }).slice(0, 300);
    var head = EPK.el("tr", {}, ["Diajukan", "Peminjam", "Barang", "Jml", "Tgl pinjam", "Rencana kembali", "Status", canEdit ? "Aksi" : null].filter(Boolean).map(function (h) { return EPK.el("th", { text: h }); }));
    var body = rows.map(function (l) {
      var cells = [EPK.el("td", { text: tgl(l.ajuan) }), EPK.el("td", { text: l.peminjam || "-" }), EPK.el("td", { text: l.barang || "-" }), EPK.el("td", { text: String(l.jumlah || "") }),
        EPK.el("td", { text: tgl(l.pinjam, true) }), EPK.el("td", { text: tgl(l.kembaliRencana, true) }),
        EPK.el("td", { text: l.statusUser || l.status || l._s })];
      if (canEdit) cells.push(EPK.el("td", {}, [EPK.el("button", { type: "button", class: "btn", text: "Ubah status", onclick: function () { editLog(l.id); } })]));
      return EPK.el("tr", {}, cells);
    });
    if (!body.length) body.push(EPK.el("tr", {}, [EPK.el("td", { colspan: canEdit ? "8" : "7", text: "Belum ada riwayat peminjaman yang cocok." })]));
    return { count: rows.length, el: EPK.el("div", { class: "inv-tw" }, [EPK.el("table", {}, [EPK.el("thead", {}, [head]), EPK.el("tbody", {}, body)])]) };
  }

  function draw() {
    if (!root) return;
    css(); root.textContent = "";
    root.appendChild(EPK.el("h2", { text: "Inventaris BPK Keuskupan Bandung" }));
    root.appendChild(EPK.el("p", { class: "hint", text: "Laporan barang dan riwayat peminjaman dari Airtable. Klik baris barang untuk melihat detail" + (canEdit ? " dan mengubah status." : ".") }));
    root.appendChild(stats());

    var q = EPK.el("input", { type: "search", class: "grow", placeholder: "Cari kode, nama, penanggung jawab", autocomplete: "off", "aria-label": "Cari barang" }); q.value = filt.q;
    var st = sel(statusOpts(), filt.status, "Semua status"), lk = sel(lokasiOpts(), filt.lokasi, "Semua lokasi");
    var tblBox = EPK.el("div"), cnt = EPK.el("p", { class: "count" });
    function redraw() { var t = itemTable(); cnt.textContent = t.count + " dari " + items.length + " barang"; tblBox.textContent = ""; tblBox.appendChild(t.el); }
    q.addEventListener("input", function () { filt.q = q.value.trim(); redraw(); });
    st.addEventListener("change", function () { filt.status = st.value; redraw(); });
    lk.addEventListener("change", function () { filt.lokasi = lk.value; redraw(); });
    var bar = [q, st, lk, EPK.el("button", { type: "button", class: "btn", text: "↻ Muat ulang", onclick: function () { load(true); } })];
    if (canEdit) bar.push(EPK.el("button", { type: "button", class: "btn primary", text: "＋ Tambah barang", onclick: addItem }));
    root.appendChild(EPK.el("h3", { class: "inv-h", text: "Daftar barang" }));
    root.appendChild(EPK.el("div", { class: "inv-bar" }, bar)); root.appendChild(cnt); root.appendChild(tblBox); redraw();

    var lq = EPK.el("input", { type: "search", class: "grow", placeholder: "Cari peminjam, barang, keperluan", autocomplete: "off", "aria-label": "Cari peminjaman" }); lq.value = filt.logq;
    var ls = sel(["Menunggu", "Dipinjam", "Selesai", "Ditolak", "Batal"], filt.logst, "Semua status");
    var lBox = EPK.el("div"), lc = EPK.el("p", { class: "count" });
    function relog() { var t = logTable(); lc.textContent = t.count + " peminjaman (maks. 300 terbaru)"; lBox.textContent = ""; lBox.appendChild(t.el); }
    lq.addEventListener("input", function () { filt.logq = lq.value.trim(); relog(); });
    ls.addEventListener("change", function () { filt.logst = ls.value; relog(); });
    root.appendChild(EPK.el("h3", { class: "inv-h", text: "Riwayat peminjaman" }));
    root.appendChild(EPK.el("div", { class: "inv-bar" }, [lq, ls])); root.appendChild(lc); root.appendChild(lBox); relog();
  }

  function field(label, input) { return [EPK.el("label", { text: label }), input]; }
  function inp(type, val, extra) { var e = EPK.el("input", Object.assign({ type: type }, extra || {})); if (val != null) e.value = val; return e; }
  function msgBox() { var m = EPK.el("p", { class: "epk-msg" }); m.say = function (t, bad) { m.textContent = t; m.className = "epk-msg" + (bad ? " bad" : ""); }; return m; }

  function detail(id) {
    var x = items.filter(function (i) { return i.id === id; })[0]; if (!x) return;
    var rows = [["Kode", x.kode], ["Lokasi", x.lokasi], ["Jumlah", String(x.jumlah)], ["Harga satuan", rp(x.harga)], ["Total perolehan", rp(x.total)], ["Tahun perolehan", x.tahun ? tgl(x.tahun) : "-"],
      ["Penanggung jawab", x.pj], ["Boleh dibooking?", x.booking], ["Catatan", x.notes]];
    var dl = EPK.el("dl", { class: "epk-dl" });
    dl.appendChild(EPK.el("dt", { text: "Status" })); dl.appendChild(EPK.el("dd", {}, [badge(x.status)]));
    rows.forEach(function (r) { dl.appendChild(EPK.el("dt", { text: r[0] })); dl.appendChild(EPK.el("dd", { text: r[1] || "-" })); });
    var box = EPK.el("div", {}, []);
    if (x.fotos.length) {
      var main = thumb(x, true); box.appendChild(main);
      if (x.fotos.length > 1) {
        var gal = EPK.el("div", { class: "inv-gal" });
        x.fotos.forEach(function (p) { gal.appendChild(EPK.el("img", { src: p.small, alt: p.name || "Foto barang", loading: "lazy", referrerpolicy: "no-referrer", onclick: function () { main.src = p.large; } })); });
        box.appendChild(gal);
      }
    }
    box.appendChild(dl);
    if (canEdit) {
      var s = sel(statusOpts(), x.status), lk = sel(lokasiOpts(), x.lokasi, "(tidak diubah)"), nt = EPK.el("textarea", { rows: "3" }); nt.value = x.notes; var m = msgBox();
      var form = EPK.el("div", { class: "inv-form" }, [].concat(field("Status barang", s), field("Pindah lokasi", lk), field("Catatan", nt)));
      var save = EPK.el("button", { type: "button", class: "epk-btn", text: "Simpan perubahan", onclick: function () {
        var f = {}; if (s.value && s.value !== x.status) f[I.status] = s.value; if (lk.value && lk.value !== x.lokasi) f[I.lokasi] = lk.value; if (nt.value !== x.notes) f[I.notes] = nt.value;
        if (!Object.keys(f).length) { m.say("Tidak ada perubahan.", true); return; }
        save.disabled = true; m.say("Menyimpan…");
        api("update_records_for_table", { baseId: C.base, tableId: C.inv, records: [{ id: x.id, fields: f }] }).then(function () {
          if (f[I.status]) x.status = f[I.status]; if (f[I.lokasi]) x.lokasi = f[I.lokasi]; if (I.notes in f) x.notes = f[I.notes];
          m.say("Tersimpan."); draw(); setTimeout(function () { var mm = document.getElementById("epkModal"); if (mm) mm.remove(); }, 700);
        }, function (e) { save.disabled = false; m.say(e.message, true); });
      } });
      box.appendChild(EPK.el("h3", { class: "epk-sec", text: "Ubah status barang" })); box.appendChild(form); box.appendChild(EPK.el("div", { class: "epk-row" }, [save])); box.appendChild(m);
    }
    box.appendChild(EPK.el("h3", { class: "epk-sec", text: "Riwayat peminjaman barang ini" }));
    var mine = logs.filter(function (l) { return l.barangIds.indexOf(x.id) >= 0; });
    if (!mine.length) box.appendChild(EPK.el("p", { class: "sub", text: "Belum pernah dipinjam." }));
    mine.slice(0, 30).forEach(function (l) {
      box.appendChild(EPK.el("div", { class: "epk-card" }, [EPK.el("h4", { text: (l.peminjam || "-") + " · " + (l.jumlah || "") + " unit" }),
        EPK.el("div", { class: "sub", text: tgl(l.pinjam, true) + " → " + (l.kembali ? tgl(l.kembali, true) : "belum kembali (rencana " + tgl(l.kembaliRencana, true) + ")") }),
        EPK.el("div", { class: "sub", text: (l.statusUser || l.status) + (l.keperluan ? " · " + l.keperluan : "") })]));
    });
    EPK.modal(x.nama || "Barang", box);
  }

  function addItem() {
    var kode = inp("text", ""), nama = inp("text", ""), jml = inp("number", "1", { min: "0", step: "1" }), hrg = inp("number", "0", { min: "0", step: "1" }),
      thn = inp("date", ""), pj = inp("text", ""), st = sel(statusOpts(), "Bisa Dipinjam"), lk = sel(lokasiOpts(), "", "(pilih lokasi)"), nt = EPK.el("textarea", { rows: "3" }), m = msgBox();
    var form = EPK.el("div", { class: "inv-form" }, [].concat(field("Kode inventaris", kode), field("Nama barang *", nama), field("Jumlah", jml), field("Harga satuan (Rp)", hrg), field("Tahun perolehan", thn),
      field("Penanggung jawab", pj), field("Lokasi", lk), field("Status", st), field("Catatan", nt)));
    var save = EPK.el("button", { type: "button", class: "epk-btn", text: "Simpan barang baru", onclick: function () {
      if (!nama.value.trim()) { m.say("Nama barang wajib diisi.", true); return; }
      var f = {}; f[I.nama] = nama.value.trim();
      if (kode.value.trim()) f[I.kode] = kode.value.trim();
      if (jml.value !== "") f[I.jumlah] = Number(jml.value);
      if (hrg.value !== "") f[I.harga] = Number(hrg.value);
      if (thn.value) f[I.tahun] = thn.value;
      if (pj.value.trim()) f[I.pj] = pj.value.trim();
      if (lk.value) f[I.lokasi] = lk.value;
      if (st.value) f[I.status] = st.value;
      if (nt.value.trim()) f[I.notes] = nt.value.trim();
      f[I.petugas] = window.__ME__.nama || window.__ME__.email;
      save.disabled = true; m.say("Menyimpan…");
      api("create_records_for_table", { baseId: C.base, tableId: C.inv, records: [{ fields: f }] }).then(function () {
        m.say("Barang ditambahkan."); loaded = false; setTimeout(function () { var mm = document.getElementById("epkModal"); if (mm) mm.remove(); load(true); }, 700);
      }, function (e) { save.disabled = false; m.say(e.message, true); });
    } });
    EPK.modal("Tambah barang inventaris", EPK.el("div", {}, [form, EPK.el("div", { class: "epk-row" }, [save]), m]));
  }

  function editLog(id) {
    var l = logs.filter(function (x) { return x.id === id; })[0]; if (!l) return;
    var s = sel(SETUJU, l.setuju, "(menunggu persetujuan)"), tolak = EPK.el("textarea", { rows: "2" }), cb = inp("checkbox", null), cancelWhy = EPK.el("textarea", { rows: "2" }), m = msgBox();
    tolak.value = l.alasanTolak; cancelWhy.value = l.alasanCancel; cb.checked = l.cancel;
    var form = EPK.el("div", { class: "inv-form" }, [].concat(field("Persetujuan Sarpras", s), field("Alasan penolakan", tolak), field("Batalkan peminjaman", cb), field("Alasan batal", cancelWhy)));
    var warn = EPK.el("p", { class: "sub", text: "Catatan: perubahan ini sama dengan mengubah kolom di Airtable, sehingga otomasi Airtable (mis. notifikasi ke peminjam) bisa ikut berjalan. Status akhir dihitung otomatis oleh Airtable." });
    var save = EPK.el("button", { type: "button", class: "epk-btn", text: "Simpan", onclick: function () {
      var f = {};
      if (s.value !== l.setuju) f[L.setuju] = s.value || null;
      if (tolak.value !== l.alasanTolak) f[L.alasanTolak] = tolak.value;
      if (cb.checked !== l.cancel) f[L.cancel] = cb.checked;
      if (cancelWhy.value !== l.alasanCancel) f[L.alasanCancel] = cancelWhy.value;
      if (!Object.keys(f).length) { m.say("Tidak ada perubahan.", true); return; }
      if (s.value === "Tidak Disetujui" && !tolak.value.trim()) { m.say("Isi alasan penolakan.", true); return; }
      save.disabled = true; m.say("Menyimpan…");
      api("update_records_for_table", { baseId: C.base, tableId: C.log, records: [{ id: l.id, fields: f }] }).then(function () {
        m.say("Tersimpan. Memuat ulang…"); loaded = false; setTimeout(function () { var mm = document.getElementById("epkModal"); if (mm) mm.remove(); load(true); }, 700);
      }, function (e) { save.disabled = false; m.say(e.message, true); });
    } });
    EPK.modal("Ubah status peminjaman", EPK.el("div", {}, [EPK.el("p", { class: "sub", text: (l.peminjam || "-") + " · " + (l.barang || "-") + " · " + (l.statusUser || l.status) }), form, warn, EPK.el("div", { class: "epk-row" }, [save]), m]));
  }

  window.EPK_INV_OPEN = function () {
    root = document.getElementById("invRoot"); if (!root) return;
    canEdit = ["Edit", "Admin", "Superadmin"].indexOf(window.__ME__.level) >= 0;
    if (!loaded) load(false); else draw();
  };
})();
`.replace("__CFG__", JSON.stringify(CFG));
