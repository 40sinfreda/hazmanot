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
  return String(s == null ? "" : s).split("&").join("&").split("<").join("<").split(">").join(">");
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
    return [o.customer, o.agent, o.id, o.supplier, o.status].join(" ").toLowerCase().indexOf(q) >= 0;
  });
  var html = "";
  if (!list.length) html = '<div class="card empty">אין הזמנות להצגה</div>';
  else {
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
  if (!st) el.innerHTML = '<span class="st-חסר">אין יתרה</span>';
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
  LINES = []; PICKED_CUST = null; PICKED_PROD = null;
  ["delivery","supplier","cust-search","prod-search"].forEach(function (id) { document.getElementById(id).value = ""; });
  document.getElementById("qty").value = "1";
  document.getElementById("cust-results").innerHTML = "";
  document.getElementById("prod-results").innerHTML = "";
  document.getElementById("picked-cust").textContent = "לא נבחר לקוח";
  document.getElementById("picked-prod").textContent = "לא נבחר מוצר";
  document.getElementById("stock-hint").textContent = "";
  fillAgents(); renderLines();
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
  renderLines();
}
function renderLines() {
  var el = document.getElementById("lines");
  if (!LINES.length) { el.innerHTML = '<div class="fab-note">אין שורות</div>'; return; }
  el.innerHTML = LINES.map(function (l, i) {
    return '<div class="line"><div>' + esc(l.sku) + " · " + esc(l.name) + "<div class=\"fab-note\">" + l.qty +
      ' · <span class="st-' + l.stock + '">' + l.stock + "</span></div></div>" +
      '<button type="button" class="btn btn-outline btn-tiny" onclick="LINES.splice(' + i + ',1);renderLines()">✕</button></div>';
  }).join("");
}
function saveLocalOrder(o) {
  try {
    var extra = JSON.parse(localStorage.getItem("hazmanot_orders") || "[]");
    extra = extra.filter(function (x) { return x.id !== o.id; });
    extra.push(o);
    localStorage.setItem("hazmanot_orders", JSON.stringify(extra));
  } catch (e) {}
}
function mergeLocalOrders() {
  try {
    var extra = JSON.parse(localStorage.getItem("hazmanot_orders") || "[]");
    var have = {};
    (DATA.orders || []).forEach(function (o) { have[o.id] = true; });
    extra.forEach(function (o) { if (!have[o.id]) DATA.orders.push(o); });
  } catch (e) {}
}
function saveOrder() {
  if (!PICKED_CUST || !LINES.length) { toast("לקוח ושורות חובה"); return; }
  var ag = document.getElementById("agent").value;
  var a = (DATA.agents || []).filter(function (x) { return String(x.code) === String(ag); })[0];
  var local = {
    id: "H-L" + Date.now(),
    delivery: document.getElementById("delivery").value,
    customer: PICKED_CUST.name,
    customerCode: PICKED_CUST.code,
    agent: a ? a.name : "",
    supplier: document.getElementById("supplier").value,
    status: "טיוטה",
    lines: LINES.slice()
  };
  saveLocalOrder(local);
  toast("נשמר " + local.id);
  load(function () { showScreen("home"); });
}
function openOrder(id) {
  CURRENT = (DATA.orders || []).filter(function (o) { return String(o.id) === String(id); })[0];
  if (!CURRENT) return;
  var lines = (CURRENT.lines || []).map(function (l) {
    return "<div class=\"line\"><div>" + esc(l.sku) + " · " + esc(l.name || "") + "<div class=\"fab-note\">" + l.qty +
      ' · <span class="st-' + (l.stock || "") + '">' + esc(l.stock || "") + "</span></div></div></div>";
  }).join("");
  document.getElementById("detail").innerHTML =
    "<b>" + esc(CURRENT.customer) + "</b><div class=\"fab-note\">" + esc(CURRENT.id) + " · " + formatDateHe(CURRENT.delivery) +
    "</div><div>סטטוס: " + esc(CURRENT.status) + "</div><div>סוכן: " + esc(CURRENT.agent || "") + "</div>" +
    (lines || "");
  showScreen("detail");
}
function setStatus(st) {
  if (!CURRENT) return;
  CURRENT.status = st;
  saveLocalOrder(CURRENT);
  toast(st);
  renderHome();
  showScreen("home");
}
function getAll(cb) {
  var files = ["products.json?v=6","customers-1.json?v=6","customers-2.json?v=6","customers-3.json?v=6","customers-4.json?v=6"];
  Promise.all(files.map(function (f) { return fetch(f).then(function (r) { if (!r.ok) throw new Error(f); return r.json(); }); }))
    .then(function (arr) {
      DATA.products = arr[0].products;
      DATA.stock = arr[0].stock;
      DATA.agents = arr[0].agents;
      DATA.customers = arr[1].concat(arr[2], arr[3], arr[4]);
      DATA.orders = DATA.orders || [];
      mergeLocalOrders();
      renderHome();
      cb && cb();
    })
    .catch(function (err) {
      document.getElementById("home-list").innerHTML = '<div class="card">טוען קטלוג... רענן בעוד כעבור דקה</div>';
      cb && cb();
    });
}
function load(cb) { getAll(cb); }
load();
