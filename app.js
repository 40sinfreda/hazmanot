var DATA = { products: [], stock: [], customers: [], agents: [], orders: [] };
var LINES = [];
var CURRENT = null;
var HOME_FILTER = "open";
var PICKED_CUST = null;
var PICKED_PROD = null;

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

function esc(s) {
  return String(s == null ? "" : s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;");
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
        "<div><b>" + esc(o.customer) + "</b><div class=\"fab-note\">" + esc(o.id) +
        (o.agent ? " · " + esc(o.agent) : "") +
        (o.supplier ? " · מספק: " + esc(o.supplier) : "") +
        " · " + ((o.lines || []).length) + " שורות</div></div>" +
        '<div class="row-side"><span class="badge ' + esc(o.status) + '">' + esc(o.status) + "</span>" +
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

function filterCustomers() {
  var q = (document.getElementById("cust-search").value || "").toLowerCase().trim();
  var box = document.getElementById("cust-results");
  if (!q) { box.innerHTML = ""; return; }
  var list = (DATA.customers || []).filter(function (c) {
    return (c.name + " " + c.code + " " + (c.city || "")).toLowerCase().indexOf(q) >= 0;
  }).slice(0, 20);
  if (!list.length) { box.innerHTML = '<div class="hint">לא נמצא</div>'; return; }
  box.innerHTML = list.map(function (c, i) {
    return '<button type="button" class="pick" onclick="pickCustomer(' + i + ')">' +
      esc(c.name) + '<span>' + esc(c.code) + (c.city ? " · " + esc(c.city) : "") + "</span></button>";
  }).join("");
  filterCustomers._list = list;
}

function pickCustomer(i) {
  var c = (filterCustomers._list || [])[i];
  if (!c) return;
  PICKED_CUST = c;
  document.getElementById("picked-cust").textContent = c.name + " (" + c.code + ")";
  document.getElementById("cust-search").value = "";
  document.getElementById("cust-results").innerHTML = "";
  if (c.agent) document.getElementById("agent").value = c.agent;
}

function filterProducts() {
  var q = (document.getElementById("prod-search").value || "").toLowerCase().trim();
  var box = document.getElementById("prod-results");
  var sm = stockMap();
  if (!q) { box.innerHTML = ""; return; }
  var list = (DATA.products || []).filter(function (p) {
    return (String(p.sku) + " " + (p.name || "")).toLowerCase().indexOf(q) >= 0;
  }).slice(0, 20);
  if (!list.length) { box.innerHTML = '<div class="hint">לא נמצא</div>'; return; }
  box.innerHTML = list.map(function (p, i) {
    var st = sm[p.sku];
    var extra = st ? " · יתרה " + st.available : "";
    return '<button type="button" class="pick" onclick="pickProduct(' + i + ')">' +
      esc(p.sku) + " · " + esc(p.name) + "<span>" + extra + "</span></button>";
  }).join("");
  filterProducts._list = list;
}

function pickProduct(i) {
  var p = (filterProducts._list || [])[i];
  if (!p) return;
  PICKED_PROD = p;
  document.getElementById("picked-prod").textContent = p.sku + " · " + p.name;
  document.getElementById("prod-search").value = "";
  document.getElementById("prod-results").innerHTML = "";
  var st = stockMap()[p.sku];
  var el = document.getElementById("stock-hint");
  if (!st) el.innerHTML = '<span class="st-חסר">אין יתרה במחסן הראשי</span>';
  else el.innerHTML = "יתרה זמינה: " + st.available + ' · <span class="st-' + st.status + '">' + st.status + "</span>";
}

function fillAgents() {
  var el = document.getElementById("agent");
  el.innerHTML = '<option value="">-- בחר סוכן --</option>' +
    (DATA.agents || []).map(function (a) {
      return '<option value="' + esc(a.code) + '">' + esc(a.name) + "</option>";
    }).join("");
}

function prepNew() {
  LINES = [];
  PICKED_CUST = null;
  PICKED_PROD = null;
  document.getElementById("delivery").value = "";
  document.getElementById("supplier").value = "";
  document.getElementById("qty").value = "1";
  document.getElementById("cust-search").value = "";
  document.getElementById("prod-search").value = "";
  document.getElementById("cust-results").innerHTML = "";
  document.getElementById("prod-results").innerHTML = "";
  document.getElementById("picked-cust").textContent = "לא נבחר לקוח";
  document.getElementById("picked-prod").textContent = "לא נבחר מוצר";
  document.getElementById("stock-hint").textContent = "";
  fillAgents();
  renderLines();
}

function addLine() {
  var p = PICKED_PROD;
  var qty = Number(document.getElementById("qty").value || 0);
  if (!p || qty <= 0) { toast("בחר מוצר וכמות"); return; }
  var st = stockMap()[p.sku] || { available: 0, status: "חסר" };
  var status = qty > st.available ? (st.available <= 0 ? "חסר" : "נמוך") : (st.status || "תקין");
  var existing = LINES.filter(function (l) { return String(l.sku) === String(p.sku); })[0];
  if (existing) existing.qty += qty;
  else LINES.push({ sku: p.sku, name: p.name, qty: qty, stock: status, available: st.available });
  if (status !== "תקין") toast(status === "חסר" ? "חסר במחסן הראשי" : "מלאי נמוך");
  renderLines();
}

function renderLines() {
  var el = document.getElementById("lines");
  if (!LINES.length) { el.innerHTML = '<div class="fab-note">אין שורות</div>'; return; }
  el.innerHTML = LINES.map(function (l, i) {
    var msg = l.stock === "חסר" ? "חסר במחסן הראשי" : (l.stock === "נמוך" ? "מלאי נמוך" : "");
    return '<div class="line"><div>' + esc(l.sku) + " · " + esc(l.name) + "<div class=\"fab-note\">" + l.qty +
      ' · <span class="st-' + l.stock + '">' + l.stock + (msg ? " — " + msg : "") +
      "</span></div></div><button type=\"button\" class=\"btn btn-outline btn-tiny\" onclick=\"LINES.splice(" + i + ",1);renderLines()\">✕</button></div>";
  }).join("");
}

function saveOrder() {
  if (!PICKED_CUST || !LINES.length) { toast("לקוח ושורות חובה"); return; }
  var ag = document.getElementById("agent").value;
  var a = (DATA.agents || []).filter(function (x) { return String(x.code) === String(ag); })[0];
  toast("שומר...");
  post({
    token: window.HAZMANOT_TOKEN,
    action: "saveOrder",
    delivery: document.getElementById("delivery").value,
    customerCode: PICKED_CUST.code,
    customer: PICKED_CUST.name,
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
    return "<div class=\"line\"><div>" + esc(l.sku) + " · " + esc(l.name || "") + "<div class=\"fab-note\">" + l.qty +
      ' · <span class="st-' + (l.stock || "") + '">' + esc(l.alert || l.stock || "") + "</span></div></div></div>";
  }).join("");
  document.getElementById("detail").innerHTML =
    "<b>" + esc(CURRENT.customer) + "</b><div class=\"fab-note\">" + esc(CURRENT.id) + " · " + formatDateHe(CURRENT.delivery) +
    "</div><div>סטטוס: " + esc(CURRENT.status) + "</div><div>סוכן: " + esc(CURRENT.agent || "") +
    "</div><div>מספק: " + esc(CURRENT.supplier || "—") + "</div>" + (lines || '<div class="fab-note">אין שורות</div>');
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
    document.getElementById("home-list").innerHTML = '<div class="card">חסרה כתובת Web App.</div>';
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
        '<div class="card">לא ניתן לטעון נתונים. בדוק חיבור ושהגשר פרוס.</div>';
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

load();
