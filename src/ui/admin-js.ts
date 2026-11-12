// Skrip antarmuka Kelola Pengguna. Hanya dikirim ke browser Superadmin; penegakan hak tetap di /api/admin.
export const ADMIN_JS = String.raw`
(function () {
  var TABN = [["beranda","Dashboard"],["pengurus","Pengurus"],["pewarta","Pewarta"],["luar","Pewarta luar kota"],["pd","PD"],["umat","Umat"],["kalender","Kalender"],["event","Event"],["kep","KEP"],["admin","Administrasi"]];
  var TABLABEL = { Dashboard: 1, Pengurus: 1, Pewarta: 1, "Pewarta luar kota": 1, PD: 1, Umat: 1, Kalender: 1, Event: 1, KEP: 1, Administrasi: 1 };
  var ALLT = ["Dashboard","Pengurus","Pewarta","Pewarta luar kota","PD","Umat","Kalender","Event","KEP","Administrasi"];
  var users = [];
  function api(action, input) {
    return fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: action, input: input }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || "Gagal."); return j; }); });
  }
  function pending() { return users.filter(function (u) { return u.status === "Menunggu"; }); }
  function refreshBell() {
    var n = pending().length, b = document.getElementById("epkBadge"), m = document.getElementById("epkBellMenu");
    if (b) { b.hidden = !n; b.textContent = String(n); }
    if (!m) return; m.textContent = "";
    if (!n) { m.appendChild(EPK.el("p", { class: "epk-empty", text: "Tidak ada tugas." })); return; }
    pending().forEach(function (u) {
      m.appendChild(EPK.el("button", { type: "button", onclick: function () { EPK.menuClose(); kelola(); } }, [
        "Setujui akses: " + (u.nama || u.email), EPK.el("br"), EPK.el("small", { text: u.email })]));
    });
  }
  function load() { return api("list").then(function (j) { users = j.users; refreshBell(); return users; }); }
  function tabBoxes(sel) {
    var wrap = EPK.el("span", { class: "epk-tabs" }), boxes = [];
    ALLT.forEach(function (t) {
      var cb = EPK.el("input", { type: "checkbox", value: t }); cb.checked = sel.indexOf(t) >= 0; boxes.push(cb);
      wrap.appendChild(EPK.el("label", {}, [cb, t]));
    });
    wrap.get = function () { return boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }); };
    return wrap;
  }
  function select(opts, val) {
    var s = EPK.el("select", {}, opts.map(function (o) { return EPK.el("option", { value: o[0], text: o[1] }); })); s.value = val; return s;
  }
  var LV = [["View","Hanya lihat"],["Edit","Edit"],["Admin","Admin (tambah pengguna View)"],["Superadmin","Superadmin"]];
  function msgBox() { var m = EPK.el("p", { class: "epk-msg" }); m.say = function (t, bad) { m.textContent = t; m.className = "epk-msg" + (bad ? " bad" : ""); }; return m; }
  function userCard(u, rerender) {
    var lv = select(LV, u.level), tb = tabBoxes(u.tabs.length || u.status !== "Menunggu" ? u.tabs : ["Dashboard"]), msg = msgBox();
    var isSelf = u.email.toLowerCase() === window.__ME__.email.toLowerCase();
    function save(extra, label) {
      msg.say("Menyimpan…");
      var body = { id: u.id, level: lv.value, tabs: tb.get() };
      Object.keys(extra).forEach(function (k) { body[k] = extra[k]; });
      return api("update", body).then(function () { return load(); }).then(function () { msg.say(label); rerender(); }, function (e) { msg.say(e.message, true); });
    }
    var actions = [];
    if (u.status === "Menunggu") {
      actions.push(EPK.el("button", { type: "button", class: "epk-btn", text: "Setujui", onclick: function () { save({ status: "Disetujui" }, "Disetujui."); } }));
      actions.push(EPK.el("button", { type: "button", class: "epk-btn bad", text: "Tolak", onclick: function () { save({ status: "Ditolak" }, "Ditolak."); } }));
    } else {
      actions.push(EPK.el("button", { type: "button", class: "epk-btn", text: "Simpan", onclick: function () { save({}, "Tersimpan."); } }));
      if (!isSelf) actions.push(u.status === "Disetujui"
        ? EPK.el("button", { type: "button", class: "epk-btn bad", text: "Nonaktifkan", onclick: function () { save({ status: "Ditolak" }, "Dinonaktifkan."); } })
        : EPK.el("button", { type: "button", class: "epk-btn sec", text: "Aktifkan", onclick: function () { save({ status: "Disetujui" }, "Diaktifkan."); } }));
    }
    return EPK.el("div", { class: "epk-card" }, [
      EPK.el("h4", { text: (u.nama || "(tanpa nama)") + (u.jabatan ? " · " + u.jabatan : "") }),
      EPK.el("div", { class: "sub", text: u.email + " · " + u.status }),
      EPK.el("div", { class: "epk-row" }, [EPK.el("label", {}, ["Level ", lv]), tb]),
      EPK.el("div", { class: "epk-row" }, actions), msg]);
  }
  function addForm(rerender) {
    var em = EPK.el("input", { type: "email", placeholder: "email Google", autocomplete: "off" }), nm = EPK.el("input", { type: "text", placeholder: "nama" }), jb = EPK.el("input", { type: "text", placeholder: "jabatan (opsional)" });
    var lv = select(LV, "View"), tb = tabBoxes(["Dashboard"]), msg = msgBox();
    var btn = EPK.el("button", { type: "button", class: "epk-btn", text: "Tambah pengguna", onclick: function () {
      msg.say("Menyimpan…");
      api("create", { email: em.value, nama: nm.value, jabatan: jb.value, level: lv.value, tabs: tb.get(), status: "Disetujui" })
        .then(function () { return load(); }).then(function () { rerender(); }, function (e) { msg.say(e.message, true); });
    } });
    return EPK.el("div", { class: "epk-card" }, [
      EPK.el("div", { class: "epk-row" }, [em, nm, jb]),
      EPK.el("div", { class: "epk-row" }, [EPK.el("label", {}, ["Level ", lv]), tb]),
      EPK.el("div", { class: "epk-row" }, [btn]), msg]);
  }
  var ME = window.__ME__, IS_SUPER = ME.level === "Superadmin";
  var umatCache = null;
  function show(title, holder, which) {
    var p = document.getElementById("admPane");
    if (!p) { EPK.modal(title, holder); return; }
    if (window.goTab) window.goTab("admin");
    p.textContent = ""; p.appendChild(holder);
    ["admTambah", "admKelola", "admRingkas"].forEach(function (id) { var b = document.getElementById(id); if (b) b.classList.toggle("on", id === which); });
  }
  function pick(preId) {
    var holder = EPK.el("div", {}, [EPK.el("p", { text: "Memuat daftar umat…" })]);
    show("Tambah pengguna dari daftar umat", holder, "admTambah");
    function ready(list) {
      holder.textContent = "";
      var q = EPK.el("input", { type: "search", placeholder: "Cari nama, panggilan, atau email", autocomplete: "off" });
      var jabs = {}, pds = {};
      list.forEach(function (u) { if (u.jab) u.jab.split(", ").forEach(function (j) { jabs[j] = 1; }); if (u.pd) pds[u.pd] = 1; });
      var fj = select([["", "Semua jabatan BPK"]].concat(Object.keys(jabs).sort().map(function (j) { return [j, j]; })), "");
      var fp = select([["", "Semua PD"]].concat(Object.keys(pds).sort().map(function (p) { return [p, p]; })), "");
      var only = EPK.el("input", { type: "checkbox" });
      var hits = {}, hitT = null;
      var box = EPK.el("div", { class: "epk-picklist" }), cnt = EPK.el("p", { class: "sub" });
      var form = EPK.el("div", {}), listWrap = EPK.el("div", {});
      var allowedTabs = IS_SUPER ? ALLT : ALLT.filter(function (t) { return (ME.tabsOwned || []).indexOf(t) >= 0; });
      function draw() {
        var t = q.value.trim().toLowerCase();
        var l = list.filter(function (u) {
          if (fj.value && (u.jab || "").split(", ").indexOf(fj.value) < 0) return false;
          if (fp.value && u.pd !== fp.value) return false;
          if (only.checked && !u.jab) return false;
          return !t || (u.nama + " " + u.pgl + " " + (u.mail || "")).toLowerCase().indexOf(t) >= 0 || !!hits[u.id];
        });
        cnt.textContent = l.length + " umat" + (l.length > 60 ? " (60 pertama ditampilkan, persempit pencarian)" : "");
        box.textContent = "";
        l.slice(0, 60).forEach(function (u) {
          var b = EPK.el("button", { type: "button", class: "epk-pickrow", disabled: u.terdaftar ? "" : null, onclick: function () { choose(u); } }, [
            EPK.el("b", { text: u.nama }), EPK.el("small", { text: [u.pgl, u.pd, u.jab].filter(Boolean).join(" · ") + (u.terdaftar ? " · sudah jadi pengguna" : "") })]);
          if (u.terdaftar) b.disabled = true;
          box.appendChild(b);
        });
      }
      function choose(u) {
        form.textContent = "";
        listWrap.hidden = true;
        var em = EPK.el("input", { type: "email", placeholder: u.hasEmail ? "kosongkan untuk memakai email umat (" + u.mail + ")" : "email Google (wajib)", autocomplete: "off" });
        var lv = IS_SUPER ? select([["View", "Hanya lihat"], ["Edit", "Edit"]], "View") : EPK.el("b", { text: "Hanya lihat (View)" });
        var tb = tabBoxes(["Dashboard"].filter(function (t) { return allowedTabs.indexOf(t) >= 0; }));
        Array.prototype.forEach.call(tb.querySelectorAll("input"), function (c) { if (allowedTabs.indexOf(c.value) < 0) { c.disabled = true; c.checked = false; c.parentNode.style.display = "none"; } });
        var msg = msgBox();
        var go = EPK.el("button", { type: "button", class: "epk-btn", text: "Tambahkan", onclick: function () {
          msg.say("Menyimpan…"); go.disabled = true;
          api("add", { umatId: u.id, email: em.value, level: IS_SUPER ? lv.value : "View", tabs: tb.get() }).then(function (j) {
            umatCache = null; msg.say("Selesai: " + u.nama + " ditambahkan. " + (j.emailed ? "Email sambutan terkirim." : "Email sambutan belum terkirim otomatis (SMTP belum diatur); kirim link aplikasi secara manual."));
            if (IS_SUPER) load().catch(function () {});
          }, function (e) { go.disabled = false; msg.say(e.message, true); });
        } });
        form.appendChild(EPK.el("div", { class: "epk-card" }, [
          EPK.el("button", { type: "button", class: "epk-btn sec", text: "← Pilih umat lain", onclick: function () { form.textContent = ""; listWrap.hidden = false; } }),
          EPK.el("h4", { text: u.nama }), EPK.el("div", { class: "sub", text: [u.pd, u.jab].filter(Boolean).join(" · ") }),
          EPK.el("div", { class: "epk-row" }, [EPK.el("label", {}, ["Email login ", em])]),
          EPK.el("div", { class: "epk-row" }, [EPK.el("label", {}, ["Hak akses ", lv]), tb]),
          EPK.el("div", { class: "epk-row" }, [go]), msg]));
        holder.scrollTop = 0;
      }
      [q, fj, fp].forEach(function (x) { x.addEventListener(x === q ? "input" : "change", draw); });
      q.addEventListener("input", function () {
        clearTimeout(hitT); var t = q.value.trim();
        if (t.length < 3) { hits = {}; return; }
        hitT = setTimeout(function () { api("umat", { q: t }).then(function (j) { hits = {}; (j.hits || []).forEach(function (id) { hits[id] = 1; }); draw(); }, function () {}); }, 350);
      });
      only.addEventListener("change", draw);
      listWrap.appendChild(EPK.el("div", { class: "epk-row" }, [q, fj, fp, EPK.el("label", {}, [only, "Hanya yang punya jabatan BPK"])]));
      listWrap.appendChild(cnt); listWrap.appendChild(box);
      holder.appendChild(listWrap); holder.appendChild(form);
      draw();
      if (preId) { var pu = list.filter(function (x) { return x.id === preId; })[0]; if (pu && !pu.terdaftar) choose(pu); }
    }
    (umatCache ? Promise.resolve(umatCache) : api("umat").then(function (j) { umatCache = j.umat; return umatCache; })).then(ready, function (e) { holder.textContent = e.message; });
  }
  window.EPK_TAMBAH = function () { pick(); };
  function ringkas() {
    var holder = EPK.el("div", {}, [EPK.el("p", { text: "Memuat…" })]);
    show("Ringkasan hak akses", holder, "admRingkas");
    var q = EPK.el("input", { type: "search", placeholder: "Cari nama, jabatan, PD", autocomplete: "off", "aria-label": "Cari" }), box = EPK.el("div", {}), data = {};
    function m(t) { var k = q.value.trim().toLowerCase(); return !k || t.toLowerCase().indexOf(k) >= 0; }
    function draw() {
      box.textContent = "";
      var belum = (data.umat || []).filter(function (u) { return u.jab && !u.terdaftar && m([u.nama, u.pgl, u.jab, u.pd].join(" ")); });
      box.appendChild(EPK.el("h3", { class: "epk-sec", text: "Pengurus BPK yang belum punya akses (" + belum.length + ")" }));
      box.appendChild(EPK.el("p", { class: "sub", text: "Klik nama untuk langsung memberi akses." }));
      belum.forEach(function (u) {
        box.appendChild(EPK.el("button", { type: "button", class: "epk-pickrow", onclick: function () { pick(u.id); } }, [EPK.el("b", { text: u.nama }), EPK.el("small", { text: [u.jab, u.pd].filter(Boolean).join(" · ") })]));
      });
      if (!belum.length) box.appendChild(EPK.el("p", { class: "sub", text: "Tidak ada." }));
      if (data.users) {
        var ada = data.users.filter(function (u) { return u.status === "Disetujui" && m([u.nama, u.email, u.jabatan, u.level].join(" ")); });
        box.appendChild(EPK.el("h3", { class: "epk-sec", text: "Sudah punya akses (" + ada.length + ")" }));
        ada.forEach(function (u) {
          box.appendChild(EPK.el("div", { class: "epk-card" }, [EPK.el("h4", { text: u.nama || u.email }),
            EPK.el("div", { class: "sub", text: [u.jabatan, u.level].filter(Boolean).join(" · ") }), EPK.el("div", { class: "sub", text: "Menu: " + (u.level === "Superadmin" ? "semua" : (u.tabs.join(", ") || "-")) })]));
        });
      }
    }
    q.addEventListener("input", draw);
    Promise.all([api("umat").then(function (j) { return j.umat; }), IS_SUPER ? load() : Promise.resolve(null)]).then(function (r) {
      data.umat = r[0]; data.users = r[1]; holder.textContent = ""; holder.appendChild(q); holder.appendChild(box); draw();
    }, function (e) { holder.textContent = e.message; });
  }
  window.EPK_RINGKAS = ringkas;
  function viewAsPicker() {
    var holder = EPK.el("div", {}, [EPK.el("p", { text: "Memuat pengguna…" })]);
    EPK.modal("Lihat sebagai", holder);
    api("list").then(function (j) {
      holder.textContent = "";
      holder.appendChild(EPK.el("p", { class: "sub", text: "Pilih pengguna untuk melihat tampilan dan hak aksesnya. Ini hanya pratinjau: data tidak bisa diubah selama mode ini aktif." }));
      var q = EPK.el("input", { type: "search", placeholder: "Cari nama, email, atau jabatan", autocomplete: "off" }), box = EPK.el("div", { class: "epk-picklist" });
      function draw() {
        var t = q.value.trim().toLowerCase(); box.textContent = "";
        j.users.filter(function (u) { return u.status === "Disetujui" && u.email.toLowerCase() !== ME.email.toLowerCase() && (!t || (u.nama + " " + u.email + " " + u.jabatan).toLowerCase().indexOf(t) >= 0); })
          .sort(function (a, b) { return (a.nama || a.email).localeCompare(b.nama || b.email, "id"); }).forEach(function (u) {
            box.appendChild(EPK.el("button", { type: "button", class: "epk-pickrow", onclick: function () {
              fetch("/api/viewas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: u.email }) })
                .then(function (r) { return r.json().then(function (b) { if (!r.ok) throw new Error(b.message || "Gagal."); location.href = "/dashboard"; }); }, function () {})
                .catch(function (e) { alert(e.message); });
            } }, [EPK.el("b", { text: u.nama || u.email }), EPK.el("small", { text: [u.level, u.jabatan, u.tabs.length + " menu"].filter(Boolean).join(" · ") })]));
          });
        if (!box.firstChild) box.appendChild(EPK.el("p", { class: "sub", text: "Tidak ada pengguna." }));
      }
      q.addEventListener("input", draw); holder.appendChild(q); holder.appendChild(box); draw();
    }, function (e) { holder.textContent = e.message; });
  }
  window.EPK_LIHATSEBAGAI = viewAsPicker;
  function kelola() {
    var holder = EPK.el("div", {}, [EPK.el("p", { text: "Memuat…" })]);
    show("Kelola Pengguna", holder, "admKelola");
    var kq = "", listBox = EPK.el("div", {});
    var search = EPK.el("input", { type: "search", placeholder: "Cari pengguna: nama, email, jabatan", autocomplete: "off", "aria-label": "Cari pengguna" });
    search.addEventListener("input", function () { kq = search.value.trim().toLowerCase(); draw(); });
    function match(u) { return !kq || [u.nama, u.email, u.jabatan, u.level].join(" ").toLowerCase().indexOf(kq) >= 0; }
    function draw() {
      listBox.textContent = "";
      var p = pending().filter(match);
      listBox.appendChild(EPK.el("h3", { class: "epk-sec", text: "Menunggu persetujuan (" + p.length + ")" }));
      if (!p.length) listBox.appendChild(EPK.el("p", { class: "sub", text: kq ? "Tidak ada yang cocok." : "Tidak ada permintaan baru." }));
      p.forEach(function (u) { listBox.appendChild(userCard(u, draw)); });
      var rest = users.filter(function (u) { return u.status !== "Menunggu" && match(u); });
      listBox.appendChild(EPK.el("h3", { class: "epk-sec", text: "Semua pengguna (" + rest.length + ")" }));
      if (!rest.length) listBox.appendChild(EPK.el("p", { class: "sub", text: "Tidak ada pengguna." }));
      rest.forEach(function (u) { listBox.appendChild(userCard(u, draw)); });
    }
    function build() {
      holder.textContent = "";
      holder.appendChild(EPK.el("div", { class: "epk-row" }, [search, EPK.el("button", { type: "button", class: "epk-btn", text: "＋ Tambah pengguna", onclick: function () { pick(); } })]));
      holder.appendChild(listBox); draw();
    }
    load().then(build, function (e) { holder.textContent = e.message; });
  }
  window.EPK_KELOLA = kelola;
  window.EPK_ADMIN_OPEN = function () { var p = document.getElementById("admPane"); if (p && !p.firstChild) { if (IS_SUPER) kelola(); else pick(); } };
  window.EPK_ADMIN_BOOT = function () {
    if (!IS_SUPER) return;
    load().then(function () { if (window.__ME__.openKelola) kelola(); }, function () {});
    setInterval(function () { load().catch(function () {}); }, 120000);
  };
})();
`;
