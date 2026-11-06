// Skrip antarmuka Kelola Pengguna. Hanya dikirim ke browser Superadmin; penegakan hak tetap di /api/admin.
export const ADMIN_JS = String.raw`
(function () {
  var TABN = [["beranda","Dashboard"],["pengurus","Pengurus"],["pewarta","Pewarta"],["luar","Pewarta luar kota"],["pd","PD"],["umat","Umat"],["kalender","Kalender"]];
  var TABLABEL = { Dashboard: 1, Pengurus: 1, Pewarta: 1, "Pewarta luar kota": 1, PD: 1, Umat: 1, Kalender: 1 };
  var ALLT = ["Dashboard","Pengurus","Pewarta","Pewarta luar kota","PD","Umat","Kalender"];
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
  var LV = [["View","Hanya lihat"],["Edit","Edit"],["Superadmin","Superadmin"]];
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
  function kelola() {
    var holder = EPK.el("div", {}, [EPK.el("p", { text: "Memuat…" })]);
    EPK.modal("Kelola Pengguna", holder);
    function draw() {
      holder.textContent = "";
      var p = pending();
      holder.appendChild(EPK.el("h3", { class: "epk-sec", text: "Menunggu persetujuan (" + p.length + ")" }));
      if (!p.length) holder.appendChild(EPK.el("p", { class: "sub", text: "Tidak ada permintaan baru." }));
      p.forEach(function (u) { holder.appendChild(userCard(u, draw)); });
      holder.appendChild(EPK.el("h3", { class: "epk-sec", text: "Tambah pengguna" }));
      holder.appendChild(addForm(draw));
      var rest = users.filter(function (u) { return u.status !== "Menunggu"; });
      holder.appendChild(EPK.el("h3", { class: "epk-sec", text: "Semua pengguna (" + rest.length + ")" }));
      rest.forEach(function (u) { holder.appendChild(userCard(u, draw)); });
    }
    load().then(draw, function (e) { holder.textContent = e.message; });
  }
  window.EPK_KELOLA = kelola;
  window.EPK_ADMIN_BOOT = function () {
    load().then(function () { if (window.__ME__.openKelola) kelola(); }, function () {});
    setInterval(function () { load().catch(function () {}); }, 120000);
  };
})();
`;
