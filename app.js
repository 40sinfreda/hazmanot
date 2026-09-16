var DATA = { products: [], stock: [], customers: [], agents: [], orders: [] };
var LINES = [];
var CURRENT = null;
var HOME_FILTER = "open";
var PICKED_CUST = null;
var PICKED_PROD = null;
var deferredPrompt = null;
var splashStarted = Date.now();
function toast(t) {
  var el = document.getElementById("toast");
  if (!el) return;
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
  return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : s;
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
    return [o.customer, o.agent, o.id, o.status].join(" ").toLowerCase().indexOf(q) >= 0;
  });
  var html = list.length ? "" : '<div class="card empty">אין הזמנות להצגה</div>';
  var last = null;
  list.forEach(function (o) {
    if (o.delivery !== last) {
      if (last !== null) html += "</div>";
      html += '<div class="group-title">' + formatDateHe(o.delivery) + '</div><div class="card">';
      last = o.delivery;
    }
    html += '<div class="order-row" onclick="openOrder(\'' + String(o.id).replace(/'/g, "") + '\')">' +
      "<div><b>" + esc(o.customer) + "</b><div class=\"fab-note\">" + esc(o.id) + (o.agent ? " · " + esc(o.agent) : "") + "</div></div>" +
      '<div><span class="badge ' + esc(o.status) + '">' + esc(o.status) + "</span></div></div>";
  });
  if (last !== null) html += "</div>";
  document.getElementById("home-list").innerHTML = html;
  var meta = document.getElementById("home-meta");
  if (meta) meta.textContent = (DATA.customers || []).length + " לקוחות · " + (DATA.products || []).length + " מק״טים";
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
  box.innerHTML = list.length ? list.map(function (c, i) {
    return '<button type="button" class="pick" onclick="pickCustomer(' + i + ')">' + esc(c.name) + "<span>" + esc(c.code) + "</span></button>";
  }).join("") : '<div class="hint">לא נמצא</div>';
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
  box.innerHTML = list.length ? list.map(function (p, i) {
    var st = sm[p.sku];
    return '<button type="button" class="pick" onclick="pickProduct(' + i + ')">' + esc(p.sku) + " · " + esc(p.name) + (st ? "<span>יתרה " + st.available + "</span>" : "") + "</button>";
  }).join("") : '<div class="hint">לא נמצא</div>';
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
  document.getElementById("stock-hint").textContent = st ? ("יתרה " + st.available + " · " + st.status) : "אין יתרה";
}
function fillAgents() {
  document.getElementById("agent").innerHTML = '<option value="">-- בחר --</option>' +
    (DATA.agents || []).map(function (a) { return '<option value="' + esc(a.code) + '">' + esc(a.name) + "</option>"; }).join("");
}
function prepNew() {
  LINES = []; PICKED_CUST = null; PICKED_PROD = null;
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
  fillAgents(); renderLines();
}
function addLine() {
  var p = PICKED_PROD;
  var qty = Number(document.getElementById("qty").value || 0);
  if (!p || qty <= 0) { toast("בחר מוצר וכמות"); return; }
  var st = stockMap()[p.sku] || { available: 0, status: "חסר" };
  var status = qty > st.available ? (st.available <= 0 ? "חסר" : "נמוך") : (st.status || "תקין");
  LINES.push({ sku: p.sku, name: p.name, qty: qty, stock: status });
  renderLines();
}
function renderLines() {
  var el = document.getElementById("lines");
  if (!LINES.length) { el.innerHTML = '<div class="fab-note">אין שורות</div>'; return; }
  el.innerHTML = LINES.map(function (l, i) {
    return '<div class="line"><div>' + esc(l.sku) + " · " + esc(l.name) + " · " + l.qty + '</div><button type="button" class="btn btn-outline btn-tiny" onclick="LINES.splice(' + i + ',1);renderLines()">✕</button></div>';
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
    extra.forEach(function (o) { DATA.orders.push(o); });
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
    agent: a ? a.name : "",
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
  document.getElementById("detail").innerHTML = "<b>" + esc(CURRENT.customer) + "</b><div>" + esc(CURRENT.id) + " · " + esc(CURRENT.status) + "</div>";
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
function setProgress(pct, msg) {
  var bar = document.getElementById("bar-fill");
  var lab = document.getElementById("splash-msg");
  if (bar) bar.style.width = Math.max(8, Math.min(100, pct)) + "%";
  if (lab && msg) lab.textContent = msg;
}
function closeSplash() {
  var el = document.getElementById("splash");
  if (!el) return;
  el.classList.add("hide");
  setTimeout(function () { el.style.display = "none"; }, 400);
}
function hideSplash() {
  setProgress(100, "מוכן");
  if (isStandalone()) {
    var wait = 2000 - (Date.now() - splashStarted);
    if (wait > 0) setTimeout(closeSplash, wait);
    else closeSplash();
    return;
  }
}
function tickSplash() {
  var elapsed = Date.now() - splashStarted;
  var pct = Math.min(90, 12 + elapsed / 22);
  setProgress(pct);
  if (elapsed < 2000) setTimeout(tickSplash, 80);
}
function getAll(cb) {
  setProgress(12, "טוען נתונים...");
  tickSplash();
  fetch("data.json?v=" + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (j) {
      DATA = j;
      DATA.orders = DATA.orders || [];
      mergeLocalOrders();
      setProgress(100, "מוכן");
      renderHome();
      hideSplash();
      cb && cb();
    })
    .catch(function () {
      setProgress(100, "לא נטען קטלוג");
      document.getElementById("home-list").innerHTML = '<div class="card">לא נטען נתונים</div>';
      hideSplash();
      cb && cb();
    });
}
function load(cb) { getAll(cb); }
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  deferredPrompt = e;
});
window.addEventListener("appinstalled", function () {
  deferredPrompt = null;
  closeSplash();
});
(function () {
  var btn = document.getElementById("install-btn");
  var skip = document.getElementById("skip-install");
  if (btn) btn.addEventListener("click", function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; });
      return;
    }
    var hint = document.getElementById("ios-hint");
    if (hint) hint.style.opacity = "1";
  });
  if (skip) skip.addEventListener("click", function () { closeSplash(); });
  if (isStandalone()) {
    if (btn) btn.style.display = "none";
    if (skip) skip.style.display = "none";
  }
})();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
load();
