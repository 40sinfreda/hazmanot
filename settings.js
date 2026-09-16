(function () {
  var SET_TAB = "cust";
  var EDIT_CUST = null;

  function lsGet(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function overrides() {
    return lsGet("hazmanot_overrides", { customers: {}, agents: [], suppliers: [] });
  }
  function saveOverrides(o) { lsSet("hazmanot_overrides", o); }

  function pad(n) { return ("0" + n).slice(-2); }
  function isoFromDate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function isWeekend(iso) {
    if (!iso) return false;
    var p = String(iso).split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    var day = d.getDay();
    return day === 5 || day === 6;
  }
  function nextWorkday(from) {
    var d = from ? new Date(from.getTime()) : new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 5 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return isoFromDate(d);
  }
  window.nextWorkday = nextWorkday;
  window.isWeekend = isWeekend;

  function applyCustomerOverrides() {
    var ov = overrides();
    var extraC = ov.customers || {};
    (DATA.customers || []).forEach(function (c) {
      var p = extraC[String(c.code)];
      if (!p) return;
      Object.keys(p).forEach(function (k) {
        if (p[k] != null && p[k] !== "") c[k] = p[k];
      });
    });
    Object.keys(extraC).forEach(function (code) {
      var exists = (DATA.customers || []).some(function (c) { return String(c.code) === String(code); });
      if (!exists && extraC[code] && extraC[code].name) DATA.customers.push(extraC[code]);
    });
    if (ov.agents && ov.agents.length) {
      ov.agents.forEach(function (a) {
        var i = (DATA.agents || []).findIndex(function (x) { return String(x.code) === String(a.code); });
        if (i >= 0) DATA.agents[i] = Object.assign({}, DATA.agents[i], a);
        else DATA.agents.push(a);
      });
    }
    DATA.suppliers = ov.suppliers && ov.suppliers.length ? ov.suppliers.slice() : (DATA.agents || []).map(function (a) {
      return { code: a.code, name: a.name, phone: a.phone || "" };
    });
  }

  function supplierOptions(selected) {
    var sel = selected == null ? "" : String(selected);
    var list = DATA.suppliers && DATA.suppliers.length ? DATA.suppliers : (DATA.agents || []);
    return '<option value="">-- בחר --</option>' + list.map(function (a) {
      var on = String(a.code) === sel || String(a.name) === sel ? " selected" : "";
      return '<option value="' + esc(a.code || a.name) + '"' + on + '>' + esc(a.name) + "</option>";
    }).join("");
  }
  window.fillSuppliers = function (selected) {
    var el = document.getElementById("supplier");
    if (el) el.innerHTML = supplierOptions(selected);
  };

  var _prepNew = window.prepNew;
  window.prepNew = function () {
    if (_prepNew) _prepNew();
    var d = document.getElementById("delivery");
    if (d && !d.value) d.value = nextWorkday();
    var hint = document.getElementById("date-hint");
    if (hint) hint.textContent = "ברירת מחדל: מחר · אין הזמנות בשישי ושבת";
  };

  var _editOrder = window.editOrder;
  window.editOrder = function () {
    if (_editOrder) _editOrder();
    var d = document.getElementById("delivery");
    if (d && isWeekend(d.value)) {
      d.value = nextWorkday();
      toast("תאריך עודכן ליום עסקים (לא שישי/שבת)");
    }
  };

  var del = document.getElementById("delivery");
  if (del) {
    del.addEventListener("change", function () {
      if (isWeekend(del.value)) {
        toast("לא ניתן להזמין לשישי או שבת");
        del.value = nextWorkday();
      }
    });
  }

  var _goToLines = null;
  var nextBtn = document.getElementById("next-lines-btn");
  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      var d = document.getElementById("delivery");
      if (d && isWeekend(d.value)) {
        toast("לא ניתן להזמין לשישי או שבת");
        d.value = nextWorkday();
      }
    }, true);
  }

  var _show = window.showScreen;
  window.showScreen = function (name, keep) {
    ["home", "new", "detail", "settings"].forEach(function (s) {
      var el = document.getElementById("screen-" + s);
      if (el) el.classList.toggle("active", s === name);
    });
    document.querySelectorAll(".nav button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-s") === name);
    });
    if (name === "new" && !keep) {
      if (_prepNew) _prepNew();
      var d = document.getElementById("delivery");
      if (d && !d.value) d.value = nextWorkday();
      var meta = document.getElementById("step-meta");
      var lines = document.getElementById("step-lines");
      if (meta) meta.classList.add("on");
      if (lines) lines.classList.remove("on");
    }
    if (name === "settings") renderSettings();
    if (name !== "new" && name !== "settings" && name !== "detail" && name !== "home") {
      if (_show) _show(name, keep);
    }
  };

  function setTab(t) {
    SET_TAB = t;
    document.querySelectorAll("#settings-tabs button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-t") === t);
    });
    renderSettings();
  }
  window.setSettingsTab = setTab;

  function renderSettings() {
    var box = document.getElementById("settings-body");
    if (!box) return;
    if (SET_TAB === "cust") renderCustSettings(box);
    else if (SET_TAB === "agent") renderPeopleSettings(box, "agents", "סוכן");
    else renderPeopleSettings(box, "suppliers", "ספק");
  }

  function renderCustSettings(box) {
    var q = ((document.getElementById("set-cust-q") || {}).value || "").toLowerCase();
    var html = '<input class="search" id="set-cust-q" placeholder="חיפוש לקוח לעריכה" value="' + esc(q) + '">' +
      '<button type="button" class="btn btn-outline" id="set-cust-new">לקוח חדש</button>';
    if (EDIT_CUST) html += custForm(EDIT_CUST);
    else {
      var list = (DATA.customers || []).filter(function (c) {
        if (!q) return false;
        return (c.name + " " + c.code + " " + (c.city || "")).toLowerCase().indexOf(q) >= 0;
      }).slice(0, 15);
      html += list.length ? list.map(function (c) {
        return '<button type="button" class="pick set-pick-c" data-code="' + esc(c.code) + '">' + esc(c.name) + "</button>";
      }).join("") : (q ? '<div class="hint">לא נמצא</div>' : '<div class="hint">חפש לקוח כדי לערוך</div>');
    }
    box.innerHTML = html;
    var inp = document.getElementById("set-cust-q");
    if (inp) inp.addEventListener("input", function () { EDIT_CUST = null; renderSettings(); });
    box.querySelectorAll(".set-pick-c").forEach(function (b) {
      b.addEventListener("click", function () {
        EDIT_CUST = (DATA.customers || []).filter(function (c) { return String(c.code) === b.getAttribute("data-code"); })[0];
        renderSettings();
      });
    });
    var nw = document.getElementById("set-cust-new");
    if (nw) nw.addEventListener("click", function () {
      EDIT_CUST = { code: "N" + Date.now(), name: "", city: "", address: "", phone: "", email: "", waze: "", contacts: [], agent: "" };
      renderSettings();
    });
    bindCustForm();
  }

  function custForm(c) {
    var contacts = c.contacts || [];
    if (!contacts.length && c.phone) contacts = [{ name: "ראשי", phone: c.phone }];
    var rows = contacts.map(function (p, i) {
      return '<div class="contact-row">' +
        '<input data-ci="' + i + '" data-f="name" placeholder="שם איש קשר" value="' + esc(p.name || "") + '">' +
        '<input data-ci="' + i + '" data-f="phone" placeholder="טלפון" value="' + esc(p.phone || "") + '">' +
        '</div>';
    }).join("");
    return '<div class="card">' +
      '<label>שם לקוח</label><input id="sc-name" value="' + esc(c.name || "") + '">' +
      '<label>עיר</label><input id="sc-city" value="' + esc(c.city || "") + '">' +
      '<label>כתובת</label><input id="sc-address" value="' + esc(c.address || "") + '">' +
      '<label>קישור וויז</label><input id="sc-waze" placeholder="הדבק קישור וויז או כתובת" value="' + esc(c.waze || "") + '">' +
      '<label>מייל</label><input id="sc-email" value="' + esc(c.email || "") + '">' +
      '<label>אנשי קשר וטלפונים</label>' + rows +
      '<button type="button" class="btn btn-outline" id="sc-add-phone">+הוסף איש קשר</button>' +
      '<button type="button" class="btn btn-primary" id="sc-save">שמור לקוח</button>' +
      '<button type="button" class="btn btn-outline" id="sc-cancel">ביטול</button>' +
      '</div>';
  }

  function bindCustForm() {
    var add = document.getElementById("sc-add-phone");
    if (add) add.addEventListener("click", function () {
      readCustForm();
      EDIT_CUST.contacts = EDIT_CUST.contacts || [];
      EDIT_CUST.contacts.push({ name: "", phone: "" });
      renderSettings();
    });
    var save = document.getElementById("sc-save");
    if (save) save.addEventListener("click", function () {
      var c = readCustForm();
      if (!c.name) { toast("חסר שם לקוח"); return; }
      var ov = overrides();
      ov.customers = ov.customers || {};
      ov.customers[String(c.code)] = c;
      saveOverrides(ov);
      applyCustomerOverrides();
      EDIT_CUST = null;
      toast("הלקוח נשמר");
      renderSettings();
    });
    var cancel = document.getElementById("sc-cancel");
    if (cancel) cancel.addEventListener("click", function () { EDIT_CUST = null; renderSettings(); });
  }

  function readCustForm() {
    if (!EDIT_CUST) return {};
    EDIT_CUST.name = (document.getElementById("sc-name") || {}).value || "";
    EDIT_CUST.city = (document.getElementById("sc-city") || {}).value || "";
    EDIT_CUST.address = (document.getElementById("sc-address") || {}).value || "";
    EDIT_CUST.waze = (document.getElementById("sc-waze") || {}).value || "";
    EDIT_CUST.email = (document.getElementById("sc-email") || {}).value || "";
    var contacts = [];
    document.querySelectorAll(".contact-row").forEach(function (row) {
      var n = (row.querySelector('[data-f="name"]') || {}).value || "";
      var p = (row.querySelector('[data-f="phone"]') || {}).value || "";
      if (n || p) contacts.push({ name: n, phone: p });
    });
    EDIT_CUST.contacts = contacts;
    if (contacts[0]) EDIT_CUST.phone = contacts[0].phone;
    return EDIT_CUST;
  }

  function renderPeopleSettings(box, key, label) {
    var list = DATA[key] || [];
    var html = '<button type="button" class="btn btn-outline" id="pe-add">הוסף ' + label + "</button>";
    html += list.map(function (a, i) {
      return '<div class="card pe-card">' +
        '<label>קוד</label><input data-i="' + i + '" data-k="code" value="' + esc(a.code || "") + '">' +
        '<label>שם</label><input data-i="' + i + '" data-k="name" value="' + esc(a.name || "") + '">' +
        '<label>טלפון</label><input data-i="' + i + '" data-k="phone" value="' + esc(a.phone || "") + '">' +
        '</div>';
    }).join("");
    html += '<button type="button" class="btn btn-primary" id="pe-save">שמור ' + label + "ים</button>";
    box.innerHTML = html;
    var add = document.getElementById("pe-add");
    if (add) add.addEventListener("click", function () {
      DATA[key] = DATA[key] || [];
      DATA[key].push({ code: String((DATA[key].length || 0) + 1), name: "", phone: "" });
      renderSettings();
    });
    var save = document.getElementById("pe-save");
    if (save) save.addEventListener("click", function () {
      var out = [];
      var cards = box.querySelectorAll(".pe-card");
      cards.forEach(function (card) {
        var obj = {};
        card.querySelectorAll("input").forEach(function (inp) { obj[inp.getAttribute("data-k")] = inp.value; });
        if (obj.name) out.push(obj);
      });
      DATA[key] = out;
      var ov = overrides();
      ov[key] = out;
      saveOverrides(ov);
      if (key === "agents") fillAgents("");
      fillSuppliers("");
      toast("נשמר");
    });
  }

  var _openCustomer = window.openCustomer;
  window.openCustomer = function (code, name) {
    if (_openCustomer) _openCustomer(code, name);
    var c = (DATA.customers || []).filter(function (x) {
      return String(x.code) === String(code) || x.name === name;
    })[0];
    if (!c) return;
    var extra = "";
    if (c.waze) {
      var href = c.waze.indexOf("http") === 0 ? c.waze : ("https://waze.com/ul?q=" + encodeURIComponent(c.waze));
      extra += '<div class="cust-row"><span>וויז</span><b><a href="' + href + '" target="_blank" rel="noopener">פתח ניווט</a></b></div>';
    }
    (c.contacts || []).forEach(function (p) {
      if (!p.phone) return;
      var tel = String(p.phone).replace(/[^0-9+]/g, "");
      extra += '<div class="cust-row"><span>' + esc(p.name || "טלפון") + '</span><b><a href="tel:' + tel + '">' + esc(p.phone) + "</a></b></div>";
    });
    var body = document.getElementById("cust-card-body");
    if (body && extra) body.innerHTML += extra;
  };

  var _load = window.load;
  window.load = function (cb) {
    _load(function () {
      applyCustomerOverrides();
      fillAgents((document.getElementById("agent") || {}).value || "");
      fillSuppliers((document.getElementById("supplier") || {}).value || "");
      cb && cb();
    });
  };
  applyCustomerOverrides();
})();
