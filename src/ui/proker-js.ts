// Skrip menu Program Kerja. Hanya dikirim ke pengguna yang punya tab Program Kerja.
// Semua tindakan lewat /api/proker; hak (siapa boleh menyetujui) ditentukan server dan hanya ditampilkan di sini.
export const PROKER_JS = String.raw`
(function () {
  var items = [], bisaSetuju = false, info = null, loaded = false, filt = { q: "", st: "", grup: "" }, tabsBuilt = false;
  var ST = ["Draft", "Menunggu Sekjen", "Disetujui", "Berjalan", "Selesai", "Ditolak"];
  var BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  function $(id) { return document.getElementById(id); }
  function api(body) {
    return fetch("/api/proker", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || ("HTTP " + r.status)); return j; }); });
  }
  function rp(n) { return "Rp " + Number(n || 0).toLocaleString("id-ID"); }
  function mulai(s) {
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s || ""); if (!m) return s || "-";
    return (m[3] ? Number(m[3]) + " " : "") + BLN[Number(m[2]) - 1] + " " + m[1];
  }
  function msg(t, bad) { var e = $("proMsg"); if (!e) return; e.textContent = t || ""; e.className = "hint" + (bad ? " bad" : ""); }

  var GRUP = {
    selesai: ["Selesai"],
    berjalan: ["Disetujui", "Berjalan"],
    menunggu: ["Menunggu Koord Bidang", "Menunggu Kolaborasi", "Menunggu Sekjen"]
  };
  var GRUP_LBL = { selesai: "Selesai", berjalan: "Disetujui dan berjalan", menunggu: "Menunggu persetujuan" };
  function tiles() {
    var box = $("proTiles"); if (!box) return;
    box.textContent = "";
    ["selesai", "berjalan", "menunggu"].forEach(function (g) {
      var ls = items.filter(function (p) { return GRUP[g].indexOf(p.status) >= 0; });
      var nilai = ls.reduce(function (s, p) { return s + (Number(p.totalPengeluaran) || 0); }, 0);
      var on = filt.grup === g;
      var t = EPK.el("button", { type: "button", class: "tile go" + (on ? " on" : ""), "data-grup": g, "aria-pressed": on ? "true" : "false", onclick: function () { filt.grup = filt.grup === g ? "" : g; draw(); } },
        [EPK.el("b", { text: String(ls.length) }), EPK.el("span", { text: GRUP_LBL[g] }), EPK.el("small", { text: rp(nilai) })]);
      box.appendChild(t);
    });
    if (!bisaSetuju) return; // hanya Sekjen / Koordinator BPK yang menyetujui program
    var tunggu = items.filter(function (p) { return p.aksi.length; }).length;
    box.appendChild(EPK.el("div", { class: "tile tunggu" + (tunggu ? "" : " nol") }, [EPK.el("b", { text: String(tunggu) }), EPK.el("span", { text: "Menunggu tindakan saya" })]));
  }

  function draw() {
    tiles();
    var body = $("proBody"); if (!body) return;
    var q = filt.q.toLowerCase();
    var rows = items.filter(function (p) {
      return (!filt.st || p.status === filt.st) && (!filt.grup || GRUP[filt.grup].indexOf(p.status) >= 0) && (!q || (p.nama + " " + p.seksiPengaju + " " + p.bidang).toLowerCase().indexOf(q) >= 0);
    });
    body.textContent = "";
    if (!rows.length) { body.appendChild(EPK.el("tr", {}, [EPK.el("td", { colspan: "5", text: loaded ? "Belum ada program." : "Memuat…" })])); return; }
    rows.forEach(function (p) {
      var nama = EPK.el("td", {}, [p.nama]);
      if (p.baru) nama.appendChild(EPK.el("span", { class: "chip", text: "Baru", style: "margin-left:6px" }));
      if (p.aksi.length) nama.appendChild(EPK.el("span", { class: "chip", text: "Perlu tindakan", style: "margin-left:6px" }));
      body.appendChild(EPK.el("tr", { class: "clk", tabindex: "0", onclick: function () { detail(p.id); }, onkeydown: function (e) { if (e.key === "Enter") detail(p.id); } }, [
        nama, EPK.el("td", { text: p.seksiPengaju }), EPK.el("td", { text: mulai(p.mulai) }), EPK.el("td", { text: p.status }),
        EPK.el("td", { class: "num", text: rp(p.totalPengeluaran) })]));
    });
  }

  function keputusan(p, tahap, seksi, setuju, cat) {
    msg("Menyimpan…");
    return api({ aksi: "putuskan", programId: p.id, tahap: tahap, seksi: seksi || undefined, keputusan: setuju ? "Setuju" : "Tolak", catatan: cat.value || "" })
      .then(function () { var m = $("epkModal"); if (m) m.remove(); return load(); })
      .catch(function (e) { msg(e.message, true); var b = $("proDetMsg"); if (b) { b.textContent = e.message; b.className = "epk-msg bad"; } });
  }

  function detail(id) {
    var p = items.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var box = EPK.el("div", {}, []);
    box.appendChild(EPK.el("p", { class: "hint", text: p.seksiPengaju + " · " + p.bidang + " · mulai " + mulai(p.mulai) + " · " + p.status }));
    if (p.detail) box.appendChild(EPK.el("p", { text: p.detail }));
    box.appendChild(EPK.el("p", { text: "Seksi terlibat: " + (p.seksiTerlibat.join(", ") || "-") }));
    box.appendChild(EPK.el("p", { text: p.mode === "Rincian" ? "Anggaran rincian: pemasukan " + rp(p.totalPemasukan) + ", pengeluaran " + rp(p.totalPengeluaran) : "Anggaran total: " + rp(p.totalPengeluaran) }));
    if (p.baris.length) {
      var tb = EPK.el("tbody");
      p.baris.forEach(function (b) { tb.appendChild(EPK.el("tr", {}, [EPK.el("td", { text: b.keterangan }), EPK.el("td", { text: b.jenis }), EPK.el("td", { class: "num", text: rp(b.nominal) })])); });
      box.appendChild(EPK.el("div", { class: "tw tablebox" }, [EPK.el("table", {}, [EPK.el("thead", {}, [EPK.el("tr", {}, [EPK.el("th", { text: "Keterangan" }), EPK.el("th", { text: "Jenis" }), EPK.el("th", { text: "Nominal" })])]), tb])]));
    }
    if (p.keputusan.length) {
      box.appendChild(EPK.el("h4", { text: "Riwayat persetujuan" }));
      p.keputusan.forEach(function (k) { box.appendChild(EPK.el("p", { class: "hint", text: k.tahap + (k.seksi ? " (" + k.seksi + ")" : "") + ": " + k.keputusan + (k.catatan ? " — " + k.catatan : "") })); });
    }
    if (p.aksi.length && !window.__ME__.viewAs) {
      var cat = EPK.el("input", { type: "text", placeholder: "Catatan (opsional)", "aria-label": "Catatan", maxlength: "500" });
      box.appendChild(cat);
      var row = EPK.el("div", { class: "epk-row" });
      row.appendChild(EPK.el("button", { type: "button", class: "epk-btn", text: "Setujui program", onclick: function () { keputusan(p, "Sekjen", "", true, cat); } }));
      row.appendChild(EPK.el("button", { type: "button", class: "epk-btn bad", text: "Tolak program", onclick: function () { keputusan(p, "Sekjen", "", false, cat); } }));
      box.appendChild(row);
      box.appendChild(EPK.el("p", { id: "proDetMsg", class: "epk-msg" }));
    }
    EPK.modal(p.nama, box);
  }

  function load() {
    msg("Memuat…");
    return api({ aksi: "daftar" }).then(function (j) { items = (j.programs || []).map(function (p) { if (p.status === "Menunggu Koord Bidang" || p.status === "Menunggu Kolaborasi") p.status = "Menunggu Sekjen"; return p; }); bisaSetuju = !!j.bisaSetuju; loaded = true; msg(""); draw(); if (window.__PROKER_OPEN) { var id = window.__PROKER_OPEN; window.__PROKER_OPEN = null; detail(id); } })
      .catch(function (e) { loaded = true; msg(e.message, true); draw(); });
  }

  /* ---------- formulir ---------- */
  function pengaju() {
    var sel = $("proPengajuSel"); if (sel) return sel.value;
    return info && info.seksiPilihan.length === 1 ? info.seksiPilihan[0] : "";
  }
  function seksiBoxes() {
    var box = $("proSeksi"); if (!box || !info) return;
    var cur = pengaju(), terpilih = {};
    Array.prototype.forEach.call(box.querySelectorAll("input:checked:not(:disabled)"), function (c) { terpilih[c.value] = 1; });
    box.textContent = "";
    info.semuaSeksi.forEach(function (s) {
      var own = s === cur;
      var cb = EPK.el("input", { type: "checkbox", value: s, disabled: own ? "" : null });
      if (own || terpilih[s]) cb.checked = true;
      box.appendChild(EPK.el("label", { class: "chk" }, [cb, " " + s + (own ? " (seksi pengaju)" : "")]));
    });
  }
  function rincianRow(r) {
    r = r || {};
    var row = EPK.el("div", { class: "pro-row" }, [
      EPK.el("input", { type: "text", class: "ag-ket", placeholder: "Keterangan", "aria-label": "Keterangan", maxlength: "200", value: r.keterangan || "" }),
      EPK.el("select", { class: "ag-jenis", "aria-label": "Jenis" }, [EPK.el("option", { value: "Pengeluaran", text: "Pengeluaran" }), EPK.el("option", { value: "Pemasukan", text: "Pemasukan" })]),
      EPK.el("input", { type: "number", class: "ag-nom", min: "0", step: "1", placeholder: "Nominal (Rp)", "aria-label": "Nominal", value: r.nominal != null ? String(r.nominal) : "" }),
      EPK.el("button", { type: "button", class: "btn", text: "Hapus", onclick: function () { row.remove(); } })]);
    return row;
  }
  var BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  var BLN_PANJANG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var langkah = 1, tahunPilih = 0;
  function bulanLabel(v) { var m = /^(\d{4})-(\d{2})$/.exec(v || ""); return m ? BLN_PANJANG[Number(m[2]) - 1] + " " + m[1] : "-"; }
  function drawPeriode() {
    var f = $("proForm"); if (!f) return;
    var now = new Date(), y0 = now.getFullYear(), m0 = now.getMonth();
    if (!tahunPilih) tahunPilih = y0;
    var ty = $("proTahun"), tb = $("proBulan"), hid = $("proMulaiBln");
    ty.textContent = ""; tb.textContent = "";
    [y0, y0 + 1, y0 + 2].forEach(function (y) {
      ty.appendChild(EPK.el("button", { type: "button", class: "pf-chip" + (y === tahunPilih ? " on" : ""), text: String(y), onclick: function () { tahunPilih = y; hid.value = ""; drawPeriode(); } }));
    });
    BLN.forEach(function (n, i) {
      var v = tahunPilih + "-" + String(i + 1).padStart(2, "0"), lewat = tahunPilih === y0 && i < m0;
      var btn = EPK.el("button", { type: "button", class: "pf-chip" + (hid.value === v ? " on" : ""), text: n, "aria-pressed": hid.value === v ? "true" : "false", onclick: function () { hid.value = v; drawPeriode(); } });
      if (lewat) btn.disabled = true;
      tb.appendChild(btn);
    });
  }
  function anggaranDari(f) {
    if (f.querySelector("#proAgMode").value === "Total") {
      var t = f.querySelector("#proTotal").value;
      if (t === "" || Number(t) < 0) return { err: "Isi total anggaran (0 bila belum ada)." };
      return { a: { mode: "Total", total: Math.round(Number(t)) } };
    }
    var baris = Array.prototype.slice.call(f.querySelectorAll(".pro-row")).map(function (r) {
      return { keterangan: r.querySelector(".ag-ket").value.trim(), jenis: r.querySelector(".ag-jenis").value, nominal: Math.round(Number(r.querySelector(".ag-nom").value)) };
    });
    if (!baris.length || baris.some(function (b) { return !b.keterangan || !(b.nominal >= 0); })) return { err: "Lengkapi keterangan dan nominal tiap baris anggaran." };
    return { a: { mode: "Rincian", baris: baris } };
  }
  function cekLangkah(n) {
    var f = $("proForm");
    if (n === 1) {
      if (!f.querySelector("#proNama").value.trim()) return "Nama program wajib diisi.";
      var ps = $("proPengajuSel"); if (ps && !ps.value) return "Pilih seksi pengaju.";
    }
    if (n === 2 && !f.querySelector("#proMulaiBln").value) return "Pilih perkiraan bulan mulai.";
    if (n === 3) { var r = anggaranDari(f); if (r.err) return r.err; }
    return "";
  }
  function ringkas() {
    var f = $("proForm"), dl = $("proRingkas"); dl.textContent = "";
    var r = anggaranDari(f), a = r.a, terlibat = Array.prototype.slice.call(f.querySelectorAll("#proSeksi input:checked:not(:disabled)")).map(function (c) { return c.value; });
    var total = !a ? 0 : a.mode === "Total" ? a.total : a.baris.filter(function (b) { return b.jenis === "Pengeluaran"; }).reduce(function (s, b) { return s + b.nominal; }, 0);
    [["Program", f.querySelector("#proNama").value.trim()], ["Seksi pengaju", pengaju() || "-"], ["Perkiraan mulai", bulanLabel(f.querySelector("#proMulaiBln").value)],
     ["Seksi terlibat", terlibat.length ? terlibat.join(", ") : "Hanya seksi pengaju"], ["Anggaran", rp(total) + (a && a.mode === "Rincian" ? " (rincian " + a.baris.length + " baris)" : "")]].forEach(function (x) {
      dl.appendChild(EPK.el("dt", { text: x[0] })); dl.appendChild(EPK.el("dd", { text: x[1] }));
    });
  }
  function tampilLangkah(n) {
    var f = $("proForm"); langkah = n;
    Array.prototype.forEach.call(f.querySelectorAll(".pf-step"), function (s) { s.hidden = Number(s.dataset.step) !== n; });
    Array.prototype.forEach.call(f.querySelectorAll("#pfSteps li"), function (li) { var k = Number(li.dataset.s); li.className = k === n ? "on" : k < n ? "done" : ""; });
    $("pfBack").hidden = n === 1; $("pfNext").hidden = n === 4; $("pfSubmit").hidden = n !== 4;
    if (n === 4) ringkas();
    var o = $("proFormMsg"); o.textContent = ""; o.className = "epk-msg";
  }
  function lanjut() {
    var err = cekLangkah(langkah), o = $("proFormMsg");
    if (err) { o.textContent = err; o.className = "epk-msg bad"; return; }
    tampilLangkah(Math.min(4, langkah + 1));
  }
  function submit(ev) {
    ev.preventDefault();
    var f = $("proForm"), out = $("proFormMsg");
    function bad(t) { out.textContent = t; out.className = "epk-msg bad"; }
    for (var i = 1; i <= 3; i++) { var err = cekLangkah(i); if (err) { tampilLangkah(i); return bad(err); } }
    var pilihSel = $("proPengajuSel");
    var terlibat = Array.prototype.slice.call(f.querySelectorAll("#proSeksi input:checked:not(:disabled)")).map(function (c) { return c.value; });
    out.textContent = "Mengirim…"; out.className = "epk-msg";
    $("pfSubmit").disabled = true;
    api({ aksi: "ajukan", nama: f.querySelector("#proNama").value.trim(), detail: f.querySelector("#proDetail").value, seksiPengaju: pilihSel ? pilihSel.value : undefined, mulai: f.querySelector("#proMulaiBln").value, seksiTerlibat: terlibat, anggaran: anggaranDari(f).a })
      .then(function () {
        f.reset(); f.querySelector("#proMulaiBln").value = ""; $("proRincian").textContent = ""; $("proRincian").appendChild(rincianRow()); toggles(); drawPeriode(); seksiBoxes(); tampilLangkah(1);
        out.textContent = "Program diajukan dan menunggu persetujuan Sekretaris Jenderal / Koordinator BPK."; out.className = "epk-msg"; return load();
      })
      .then(function () { if (window.__PROKER_TABS) window.__PROKER_TABS("daftar"); })
      .catch(function (e) { bad(e.message); })
      .then(function () { $("pfSubmit").disabled = false; });
  }
  function rpLive() {
    var f = $("proForm"); if (!f) return;
    var t = f.querySelector("#proTotal").value; $("proTotalRp").textContent = t === "" ? "" : rp(t);
    var r = anggaranDari(f); var a = r.a;
    $("proRincianRp").textContent = a && a.mode === "Rincian" ? "Pengeluaran " + rp(a.baris.filter(function (b) { return b.jenis === "Pengeluaran"; }).reduce(function (s, b) { return s + b.nominal; }, 0)) + " · Pemasukan " + rp(a.baris.filter(function (b) { return b.jenis === "Pemasukan"; }).reduce(function (s, b) { return s + b.nominal; }, 0)) : "";
  }
  function toggles() {
    var f = $("proForm"); if (!f) return;
    var tot = f.querySelector("#proAgMode").value === "Total";
    f.querySelector("#proTotalBox").hidden = !tot; f.querySelector("#proRincianBox").hidden = tot;
    Array.prototype.forEach.call(f.querySelectorAll("#proAgSeg .pf-segb"), function (b) { b.classList.toggle("on", (b.dataset.m === "Total") === tot); });
    rpLive();
  }
  function initForm() {
    var f = $("proForm"); if (!f || f.dataset.ready) return; f.dataset.ready = "1";
    f.addEventListener("submit", submit);
    f.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target && e.target.tagName === "INPUT" && langkah < 4) { e.preventDefault(); lanjut(); } });
    f.addEventListener("input", rpLive);
    $("pfNext").addEventListener("click", lanjut);
    $("pfBack").addEventListener("click", function () { tampilLangkah(Math.max(1, langkah - 1)); });
    Array.prototype.forEach.call(f.querySelectorAll("#proAgSeg .pf-segb"), function (b) { b.addEventListener("click", function () { f.querySelector("#proAgMode").value = b.dataset.m; toggles(); }); });
    $("proSeksiQ").addEventListener("input", function () {
      var q = this.value.toLowerCase().trim();
      Array.prototype.forEach.call($("proSeksi").querySelectorAll("label"), function (l) { l.hidden = !!q && l.textContent.toLowerCase().indexOf(q) < 0; });
    });
    f.querySelector("#proTambah").addEventListener("click", function () { $("proRincian").appendChild(rincianRow()); });
    $("proRincian").appendChild(rincianRow());
    drawPeriode(); toggles(); tampilLangkah(1);
    api({ aksi: "info" }).then(function (j) {
      info = j;
      if (j.bisaPilih && j.seksiPilihan.length) {
        var sel = EPK.el("select", { id: "proPengajuSel", "aria-label": "Seksi pengaju" }, [EPK.el("option", { value: "", text: "Pilih seksi pengaju" })]);
        j.seksiPilihan.forEach(function (x) { sel.appendChild(EPK.el("option", { value: x, text: x })); });
        sel.addEventListener("change", seksiBoxes);
        var wrap = $("proPengajuBox"); wrap.textContent = ""; wrap.appendChild(sel); wrap.hidden = false;
      }
      seksiBoxes();
      if (!j.seksiPilihan.length) { $("proFormMsg").textContent = "Hanya Ketua/Wakil seksi, Koordinator, atau Superadmin yang dapat mengajukan program."; $("proFormMsg").className = "epk-msg bad"; $("pfNext").disabled = true; }
    }).catch(function (e) { $("proFormMsg").textContent = e.message; $("proFormMsg").className = "epk-msg bad"; });
  }

  function buildTabs() {
    if (tabsBuilt || typeof reportTabs !== "function") return; tabsBuilt = true;
    var tabs = [{ id: "daftar", label: "Daftar", sectionId: "proSecDaftar" }];
    if (!window.__ME__.viewAs) tabs.push({ id: "ajukan", label: "Ajukan program", sectionId: "proSecAjukan" });
    reportTabs($("proRptTabs"), tabs, { storeKey: "" });
    $("proRptTabs").addEventListener("click", function (e) { if (e.target && /Ajukan/.test(e.target.textContent)) initForm(); });
    var q = $("proQ"), st = $("proSt");
    q.addEventListener("input", function () { filt.q = q.value; draw(); });
    ST.forEach(function (s) { st.appendChild(EPK.el("option", { value: s, text: s })); });
    st.addEventListener("change", function () { filt.st = st.value; draw(); });
    $("proFilterBtn").addEventListener("click", function () { var bx = $("proFilterBox"); bx.hidden = !bx.hidden; this.setAttribute("aria-expanded", bx.hidden ? "false" : "true"); });
  }

  /* Kartu ringkasan di dashboard utama (Pimpinan, Sekjen, Bendahara). Server menjawab 403 untuk peran lain: kartu disembunyikan. */
  window.EPK_PROKER_DASH = function () {
    var card = $("proDashCard"), body = $("proDashBody"); if (!card || !body) return;
    return api({ aksi: "ringkasan" }).then(function (j) {
      body.textContent = "";
      var b = j.berjalan || { n: 0, nilai: 0 };
      body.appendChild(EPK.el("p", { text: b.n + " program disetujui/berjalan, total " + rp(b.nilai) }));
      body.appendChild(EPK.el("p", { class: "hint", text: (j.menungguSekjen || 0) + " menunggu Sekjen" }));
      card.hidden = false;
    }).catch(function () { card.hidden = true; });
  };
  window.prokerOpen = function (id) { var p = items.filter(function (x) { return x.id === id; })[0]; if (p) detail(id); else window.__PROKER_OPEN = id; };
  window.EPK_PROKER_OPEN = function () { buildTabs(); load(); };
})();
`;
