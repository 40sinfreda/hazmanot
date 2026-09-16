var DATA = { products: [], stock: [], customers: [], agents: [], orders: [] };
var LINES = [];
var CURRENT = null;
var HOME_FILTER = "open";

function toast(t) {
  var el = document.getElementById("toast");
  el.textContent = t;
  el.classList.add("show");
  setTimeout(function () { el.classList.remove("show"); }, 2400);
}

function apiUrl() {
  var u = window.HAZMANOT_WEBAPP || "";
  if (!u) return "";
  return u + (u.indexOf("?") >= 0 ? "&" : "?") + "token=" + encodeURIComponent(window.HAZMANOT_TOKEN || "");
}

function showScreen(name) {
  ["home", "new", "detail"].forEach(function (s) {
    document.getElementById("screen-" + s).classList.toggle("active", s === name);
  });
  document.querySelectorAll(".nav button").forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-s") === name);
  });
  if (name === "new") prepNew();
}

function stockMap() {
  var m = {};
  (DATA.stock || []).forEach(function (s) { if (s && s.sku) m[String(s.sku)] = s; });
  return m;
}

function formatDateHe(d) {
  if (!d) return "ללא תאריך";
  var s = String(d).slice(0, 10);
  var p = s.split("-");
  if (p.length === 3) return p[2] + "." + p[1] + "." + p[0];
  return s;
}

function renderHome() {
  var q = ((document.getElementById("home-search") || {}).value || "").toLowerCase();
  var list = (DATA.orders || []).filter(function (o) {
    if (HOME_FILTER === "open") return o.status !== "סופקה" && o.status !== "בוטלה";
    if (HOME_FILTER === "draft") return o.status === "טיוטה";
    if (HOME_FILTER === "ready") return o.status === "מוכנה";
    return true;
  }).filter(function (o) {
    if (!q) return true;
    var hay = [o.customer, o.agent, o.id, o.supplier, o.status].join(" ").toLowerCase();
    return hay.indexOf(q) >= 0;
  });
  var html = "";
  if (!list.length) {
    html = '<div class="card empty">אין הזמנות להצגה</div>';
  } else {
    var last = null;
    list.forEach(function (o) {
      if (o.delivery !== last) {
        if (last !== null) html += "</div>";
        html += '<div class="group-title">' + formatDateHe(o.delivery) + '</div><div class="card">';
        last = o.delivery;
      }
      var warn = (o.lines || []).some(function (l) { return l.stock === "חסר" || l.stock === "נמוך"; });
      html += '<div class="order-row" onclick="openOrder(\'' + String(o.id).replace(/'/g, "") + '\')">' +
        "<div><b>" + (o.customer || "") + "</b><div class=\"fab-note\">" + o.id +
        (o.agent ? " · " + o.agent : "") +
        (o.supplier ? " · מספק: " + o.supplier : "") +
        " · " + ((o.lines || []).length) + " שורות</div></div>" +
        '<div class="row-side"><span class="badge ' + o.status + '">' + o.status + "</span>" +
        (warn ? '<div class="st-חסר">מלאי</div>' : "") + "</div></div>";
    });
    if (last !== null) html += "</div>";
  }
  document.getElementById("home-list").innerHTML = html;
  var n = (DATA.orders || []).filter(function (o) { return o.status !== "סופקה" && o.status !== "בוטלה"; }).length;
  var meta = document.getElementById("home-meta");
  if (meta) meta.textContent = n + " פתוחות · " + (DATA.customers || []).length + " לקוחות · " + (DATA.products || []).length + " מק״טים";
}

function setHomeFilter(f) {
  HOME_FILTER = f;
  document.querySelectorAll(".chips button").forEach(function (b) {
    b.classList.toggle("on", b.getAttribute("data-f") === f);
  });
  renderHome();
}

function fillSelect(id, items) {
  var el = document.getElementById(id);
  el.innerHTML = '<option value="">-- בחר --</option>' + items.map(function (it) {
    return '<option value="' + String(it.val).replace(/"/g, """) + '">' + it.label + "</option>";
  }).join("");
}

function filterCustomers() {
  var q = (document.getElementById("cust-search").value || "").toLowerCase();
  var list = (DATA.customers || []).filter(function (c) {
    return !q || (c.name + " " + c.code + " " + (c.city || "")).toLowerCase().indexOf(q) >= 0;
  }).slice(0, 200);
  fillSelect("customer", list.map(function (c) {
    return { val: c.code, label: c.name + " (" + c.code + ")" + (c.city ? " · " + c.city : "") };
  }));
}

function filterProducts() {
  var q = (document.getElementById("prod-search").value || "").toLowerCase();
  var sm = stockMap();
  var list = (DATA.products || []).filter(function (p) {
    return !q || (String(p.sku) + " " + (p.name || "")).toLowerCase().indexOf(q) >= 0;
  }).slice(0, 150);
  fillSelect("product", list.map(function (p) {
    var st = sm[p.sku];
    var extra = st ? " · " + st.available : "";
    return { val: p.sku, label: p.sku + " · " + (p.name || "") + extra };
  }));
  onProduct();
}

function onCustomer() {
  var code = document.getElementById("customer").value;
  var c = (DATA.customers || []).filter(function (x) { return String(x.code) === String(code); })[0];
  if (c && c.agent) document.getElementById("agent").value = c.agent;
}

function onProduct() {
  var sku = document.getElementById("product").value;
  var st = stockMap()[sku];
  var el = document.getElementById("stock-hint");
  if (!sku) { el.textContent = ""; return; }
  if (!st) { el.innerHTML = '<span class="st-חסר">אין יתרה במחסן הראשי</span>'; return; }
  el.innerHTML = "יתרה זמינה: " + st.available + ' · <span class="st-' + st.status + '">' + st.status + "</span>";
}

function prepNew() {
  LINES = [];
  document.getElementById("delivery").value = "";
  document.getElementById("supplier").value = "";
  document.getElementById("qty").value = "1";
  document.getElementById("cust-search").value = "";
  document.getElementById("prod-search").value = "";
  fillSelect("agent", (DATA.agents || []).map(function (a) { return { val: a.code, label: a.name }; }));
  filterCustomers();
  filterProducts();
  renderLines();
}

function addLine() {
  var sku = document.getElementById("product").value;
  var qty = Number(document.getElementById("qty").value || 0);
  var p = (DATA.products || []).filter(function (x) { return String(x.sku) === String(sku); })[0];
  if (!sku || !p || qty <= 0) { toast("בחר מוצר וכמות"); return; }
  var st = stockMap()[sku] || { available: 0, status: "חסר" };
  var status = qty > st.available ? (st.available <= 0 ? "חסר" : "נמוך") : (st.status || "תקין");
  var existing = LINES.filter(function (l) { return String(l.sku) === String(sku); })[0];
  if (existing) existing.qty += qty;
  else LINES.push({ sku: sku, name: p.name, qty: qty, stock: status, available: st.available });
  if (status !== "תקין") toast(status === "חסר" ? "חסר במחסן הראשי" : "מלאי נמוך");
  renderLines();
}

function renderLines() {
  var el = document.getElementById("lines");
  if (!LINES.length) { el.innerHTML = '<div class="fab-note">אין שורות</div>'; return; }
  el.innerHTML = LINES.map(function (l, i) {
    var msg = l.stock === "חסר" ? "חסר במחסן הראשי" : (l.stock === "נמוך" ? "מלאי נמוך" : "");
    return '<div class="line"><div>' + l.sku + " · " + l.name + "<div class=\"fab-note\">" + l.qty +
      ' · <span class="st-' + l.stock + '">' + l.stock + (msg ? " — " + msg : "") +
      "</span></div></div><button class=\"btn btn-outline btn-tiny\" onclick=\"LINES.splice(" + i + ",1);renderLines()\">✕</button></div>";
  }).join("");
}

function saveOrder() {
  var cust = document.getElementById("customer").value;
  var c = (DATA.customers || []).filter(function (x) { return String(x.code) === String(cust); })[0];
  var ag = document.getElementById("agent").value;
  var a = (DATA.agents || []).filter(function (x) { return String(x.code) === String(ag); })[0];
  if (!c || !LINES.length) { toast("לקוח ושורות חובה"); return; }
  post({
    token: window.HAZMANOT_TOKEN,
    action: "saveOrder",
    delivery: document.getElementById("delivery").value,
    customerCode: c.code,
    customer: c.name,
    agentCode: a ? a.code : "",
    agent: a ? a.name : "",
    supplier: document.getElementById("supplier").value,
    status: "טיוטה",
    lines: LINES
  }, function (res) {
    if (!res || !res.ok) { toast((res && res.error) || "שגיאה בשמירה"); return; }
    toast("נשמר " + res.id);
    load(function () { showScreen("home"); });
  });
}

function openOrder(id) {
  CURRENT = (DATA.orders || []).filter(function (o) { return String(o.id) === String(id); })[0];
  if (!CURRENT) return;
  var lines = (CURRENT.lines || []).map(function (l) {
    return "<div class=\"line\"><div>" + l.sku + " · " + (l.name || "") + "<div class=\"fab-note\">" + l.qty +
      ' · <span class="st-' + (l.stock || "") + '">' + (l.alert || l.stock || "") + "</span></div></div></div>";
  }).join("");
  document.getElementById("detail").innerHTML =
    "<b>" + CURRENT.customer + "</b><div class=\"fab-note\">" + CURRENT.id + " · " + formatDateHe(CURRENT.delivery) +
    "</div><div>סטטוס: " + CURRENT.status + "</div><div>סוכן: " + (CURRENT.agent || "") +
    "</div><div>מספק: " + (CURRENT.supplier || "—") + "</div>" + (lines || '<div class="fab-note">אין שורות</div>');
  showScreen("detail");
}

function setStatus(st) {
  if (!CURRENT) return;
  post({ token: window.HAZMANOT_TOKEN, action: "setStatus", id: CURRENT.id, status: st, supplier: CURRENT.supplier }, function (res) {
    if (!res || !res.ok) { toast((res && res.error) || "שגיאה"); return; }
    toast(st);
    load(function () { showScreen("home"); });
  });
}

function getAll(cb) {
  var u = apiUrl();
  if (!u) {
    document.getElementById("home-list").innerHTML =
      '<div class="card">חסרה כתובת Web App ב-config.js. פרוס את Code.gs כפרויקט אינטרנט והדבק את קישור ה-/exec. ראה SETUP.md.</div>';
    cb && cb();
    return;
  }
  fetch(u + "&action=all")
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j.ok) throw new Error(j.error || "שגיאה");
      DATA = j;
      renderHome();
      cb && cb();
    })
    .catch(function (err) {
      toast(String(err.message || err));
      document.getElementById("home-list").innerHTML =
        '<div class="card">לא ניתן לטעון נתונים. בדוק שהגשר פרוס ושהטוקן תואם.</div>';
      cb && cb();
    });
}

function post(body, cb) {
  var u = window.HAZMANOT_WEBAPP;
  if (!u) { toast("חסר Web App"); return; }
  fetch(u, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  }).then(function (r) { return r.json(); }).then(cb)
    .catch(function (err) { toast(String(err)); });
}

function load(cb) { getAll(cb); }

document.getElementById("product").addEventListener("change", onProduct);
load();
