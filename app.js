var DATA = { products: [], stock: [], customers: [], agents: [], orders: [] };
var LINES = [];
var CURRENT = null;
var EDITING_ID = null;
var HOME_FILTER = "open";
var PICKED_CUST = null;
var PICKED_PROD = null;
var deferredPrompt = null;
var splashStarted = Date.now();
function apiUrl() {
  return (window.HAZMANOT_WEBAPP || "") + "?token=" + encodeURIComponent(window.HAZMANOT_TOKEN || "");
}
function postAction(payload, cb) {
  var url = window.HAZMANOT_WEBAPP;
  if (!url) { cb && cb(null); return; }
  payload.token = window.HAZMANOT_TOKEN || "";
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  }).then(function (r) { return r.json(); }).then(function (j) {
    cb && cb(j);
  }).catch(function () { cb && cb(null); });
}
function toast(t) {
  var el = document.getElementById("toast");
  if (!el) return;
  el.textContent = t;
  el.classList.add("show");
  setTimeout(function () { el.classList.remove("show"); }, 2400);
}
function setSaveLabel() {
  var b = document.getElementById("save-btn");
  if (b) b.textContent = EDITING_ID ? "עדכן הזמנה" : "שמור הזמנה";
}
function showPickedProd() {
  var lab = document.getElementById("picked-prod-label");
  if (!lab) return;
  if (!PICKED_PROD) { lab.style.display = "none"; lab.textContent = ""; return; }
  lab.style.display = "block";
  lab.textContent = "נבחר: " + PICKED_PROD.name;
}
function showScreen(name, keep) {
  ["home", "new", "detail"].forEach(function (s) {
    var el = document.getElementById("screen-" + s);
    if (el) el.classList.toggle("active", s === name);
  });
  document.querySelectorAll(".nav button").forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-s") === name);
  });
  if (name === "new" && !keep) prepNew();
}
function stockMap() {
  var m = {};
  (DATA.stock || []).forEach(function (s) { if (s && s.sku) m[String(s.sku)] = s; });
  return m;
}
function formatDateHe(d) {
  var iso = toIsoDate(d);
  if (!iso) return "ללא תאריך";
  var p = iso.split("-");
  return p[2] + "." + p[1] + "." + p[0];
}
function toIsoDate(d) {
  if (!d) return "";
  var s = String(d).trim();
  var m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + "-" + m[2] + "-" + m[3];
  if ((m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/))) {
    var dd = ("0" + m[1]).slice(-2), mm = ("0" + m[2]).slice(-2);
    return m[3] + "-" + mm + "-" + dd;
  }
  var dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return dt.getFullYear() + "-" + ("0" + (dt.getMonth() + 1)).slice(-2) + "-" + ("0" + dt.getDate()).slice(-2);
  }
  return "";
}
function esc(s) {
  return String(s == null ? "" : s).split("&").join("&").split("<").join("<").split(">").join(">");
}
function agentOptions(selected) {
  var sel = selected == null ? "" : String(selected);
  return '<option value="">-- בחר --</option>' +
    (DATA.agents || []).map(function (a) {
      var on = String(a.code) === sel || String(a.name) === sel ? " selected" : "";
      return '<option value="' + esc(a.code) + '"' + on + '>' + esc(a.name) + "</option>";
    }).join("");
}
function orderKey(o) {
  return String(o.customerCode || o.customer || "") + "|" + toIsoDate(o.delivery);
}
function uniqueOrders(list) {
  var byId = {};
  (list || []).forEach(function (o) {
    if (!o || !o.id) return;
    byId[String(o.id)] = o;
  });
  var byKey = {};
  Object.keys(byId).forEach(function (id) {
    var o = byId[id];
    var k = orderKey(o);
    var prev = byKey[k];
    if (!prev) { byKey[k] = o; return; }
    var prevLocal = String(prev.id).indexOf("H-L") === 0;
    var curLocal = String(o.id).indexOf("H-L") === 0;
    if (prevLocal && !curLocal) byKey[k] = o;
    else if (!prevLocal && curLocal) return;
    else if ((o.lines || []).length >= (prev.lines || []).length) byKey[k] = o;
  });
  return Object.keys(byKey).map(function (k) { return byKey[k]; });
}
function renderHome() {
  var q = ((document.getElementById("home-search") || {}).value || "").toLowerCase();
  var list = uniqueOrders(DATA.orders || []).filter(function (o) {
    if (HOME_FILTER === "open") return o.status !== "סופקה" && o.status !== "בוטלה";
    if (HOME_FILTER === "draft") return o.status === "טיוטה";
    if (HOME_FILTER === "ready") return o.status === "מוכנה";
    return true;
  }).filter(function (o) {
    if (!q) return true;
    return String(o.customer || "").toLowerCase().indexOf(q) >= 0;
  });
  var html = list.length ? "" : '<div class="card empty">אין הזמנות להצגה</div>';
  var last = null;
  list.forEach(function (o) {
    if (o.delivery !== last) {
      if (last !== null) html += "</div>";
      html += '<div class="group-title">' + formatDateHe(o.delivery) + '</div><div class="card">';
      last = o.delivery;
    }
    html += '<div class="order-row" data-oid="' + esc(o.id) + '">' +
      "<div><b>" + esc(o.customer) + "</b></div>" +
      '<div><span class="badge">' + esc(o.status) + "</span></div></div>";
  });
  if (last !== null) html += "</div>";
  var box = document.getElementById("home-list");
  box.innerHTML = html;
  box.querySelectorAll(".order-row").forEach(function (row) {
    row.addEventListener("click", function () { openOrder(row.getAttribute("data-oid")); });
  });
  var meta = document.getElementById("home-meta");
  if (meta) meta.textContent = uniqueOrders(DATA.orders || []).length + " הזמנות";
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
    return '<button type="button" class="pick" data-i="' + i + '">' + esc(c.name) + "</button>";
  }).join("") : '<div class="hint">לא נמצא</div>';
  filterCustomers._list = list;
  box.querySelectorAll(".pick").forEach(function (b) {
    b.addEventListener("click", function () { pickCustomer(Number(b.getAttribute("data-i"))); });
  });
}
function pickCustomer(i) {
  var c = (filterCustomers._list || [])[i];
  if (!c) return;
  PICKED_CUST = c;
  document.getElementById("cust-search").value = c.name;
  document.getElementById("cust-results").innerHTML = "";
  fillAgents(c.agent);
  fillSuppliers(c.agent);
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
    return '<button type="button" class="pick" data-i="' + i + '">' + esc(p.name) + (st ? "<span>יתרה " + st.available + "</span>" : "") + "</button>";
  }).join("") : '<div class="hint">לא נמצא</div>';
  filterProducts._list = list;
  box.querySelectorAll(".pick").forEach(function (b) {
    b.addEventListener("click", function () { pickProduct(Number(b.getAttribute("data-i"))); });
  });
}
function pickProduct(i) {
  var p = (filterProducts._list || [])[i];
  if (!p) return;
  PICKED_PROD = p;
  document.getElementById("prod-search").value = "";
  document.getElementById("prod-results").innerHTML = "";
  var st = stockMap()[p.sku];
  document.getElementById("stock-hint").textContent = st ? ("יתרה " + st.available + " · " + st.status) : "אין יתרה";
  showPickedProd();
}
function fillAgents(selected) {
  var el = document.getElementById("agent");
  if (el) el.innerHTML = agentOptions(selected);
}
function fillSuppliers(selected) {
  var el = document.getElementById("supplier");
  if (el) el.innerHTML = agentOptions(selected);
}
function prepNew() {
  EDITING_ID = null;
  LINES = []; PICKED_CUST = null; PICKED_PROD = null;
  document.getElementById("delivery").value = "";
  document.getElementById("qty").value = "1";
  document.getElementById("cust-search").value = "";
  document.getElementById("prod-search").value = "";
  document.getElementById("cust-results").innerHTML = "";
  document.getElementById("prod-results").innerHTML = "";
  document.getElementById("stock-hint").textContent = "";
  showPickedProd();
  fillAgents(""); fillSuppliers(""); renderLines(); setSaveLabel();
}
function addLine() {
  var p = PICKED_PROD;
  var qty = Number(document.getElementById("qty").value || 0);
  if (!p) { toast("קודם בחר מוצר מהרשימה"); return; }
  if (qty <= 0) { toast("הזן כמות"); return; }
  var st = stockMap()[p.sku] || { available: 0, status: "חסר" };
  var status = qty > st.available ? (st.available <= 0 ? "חסר" : "נמוך") : (st.status || "תקין");
  LINES.push({ sku: p.sku, name: p.name, qty: qty, stock: status });
  PICKED_PROD = null;
  document.getElementById("prod-search").value = "";
  document.getElementById("qty").value = "1";
  document.getElementById("stock-hint").textContent = "";
  showPickedProd();
  renderLines();
}
function renderLines() {
  var el = document.getElementById("lines");
  if (!el) return;
  if (!LINES.length) { el.innerHTML = '<div class="fab-note">אין שורות</div>'; return; }
  el.innerHTML = LINES.map(function (l, i) {
    return '<div class="line"><div>' + esc(l.name) + " · " + l.qty + '</div><button type="button" class="btn btn-outline btn-tiny" data-i="' + i + '">✕</button></div>';
  }).join("");
  el.querySelectorAll("[data-i]").forEach(function (b) {
    b.addEventListener("click", function () {
      LINES.splice(Number(b.getAttribute("data-i")), 1);
      renderLines();
    });
  });
}
function saveLocalOrder(o) {
  try {
    var extra = JSON.parse(localStorage.getItem("hazmanot_orders") || "[]");
    extra = extra.filter(function (x) { return String(x.id) !== String(o.id); });
    extra.push(o);
    localStorage.setItem("hazmanot_orders", JSON.stringify(extra));
  } catch (e) {}
}
function mergeLocalOrders() {
  try {
    var extra = JSON.parse(localStorage.getItem("hazmanot_orders") || "[]");
    extra.forEach(function (o) {
      var exists = (DATA.orders || []).some(function (x) { return String(x.id) === String(o.id); });
      if (!exists) DATA.orders.push(o);
      else {
        DATA.orders = DATA.orders.map(function (x) { return String(x.id) === String(o.id) && (o.lines && o.lines.length) ? o : x; });
      }
    });
  } catch (e) {}
}
function saveOrder() {
  if (!PICKED_CUST || !LINES.length) { toast("לקוח ושורות חובה"); return; }
  var ag = document.getElementById("agent").value;
  var a = (DATA.agents || []).filter(function (x) { return String(x.code) === String(ag); })[0];
  var supCode = document.getElementById("supplier").value;
  var sup = (DATA.agents || []).filter(function (x) { return String(x.code) === String(supCode); })[0];
  var payload = {
    action: "saveOrder",
    delivery: document.getElementById("delivery").value,
    customerCode: PICKED_CUST.code,
    customer: PICKED_CUST.name,
    agentCode: a ? a.code : ag,
    agent: a ? a.name : "",
    status: "טיוטה",
    supplier: sup ? sup.name : (supCode || ""),
    lines: LINES.slice()
  };
  payload.id = EDITING_ID || ("H-L" + Date.now());
  saveLocalOrder(payload);
  DATA.orders = (DATA.orders || []).filter(function (x) { return String(x.id) !== String(payload.id); });
  DATA.orders.push(payload);
  DATA.orders = uniqueOrders(DATA.orders);
  toast("שומר הזמנה");
  showScreen("home");
  renderHome();
  EDITING_ID = null;
  postAction(payload, function (j) {
    if (j && j.ok && j.id) {
      var oldId = payload.id;
      payload.id = j.id;
      DATA.orders = (DATA.orders || []).map(function (x) { return String(x.id) === String(oldId) ? payload : x; });
      DATA.orders = uniqueOrders(DATA.orders);
      saveLocalOrder(payload);
    }
    load(function () { renderHome(); });
  });
}
function openOrder(id) {
  CURRENT = (DATA.orders || []).filter(function (o) { return String(o.id) === String(id); })[0];
  if (!CURRENT) { toast("הזמנה לא נמצאה"); return; }
  var lines = (CURRENT.lines || []).map(function (l) {
    return '<div class="line"><div>' + esc(l.name || l.sku) + '</div><div>' + esc(l.qty) + '</div></div>';
  }).join("") || '<div class="fab-note">אין שורות</div>';
  document.getElementById("detail").innerHTML =
    "<b>" + esc(CURRENT.customer) + "</b>" +
    '<div class="fab-note">' + esc(CURRENT.status) + " · " + formatDateHe(CURRENT.delivery) + "</div>" +
    (CURRENT.agent ? '<div class="fab-note">סוכן: ' + esc(CURRENT.agent) + "</div>" : "") +
    (CURRENT.supplier ? '<div class="fab-note">מספק: ' + esc(CURRENT.supplier) + "</div>" : "") +
    "<div style=\"margin-top:10px\">" + lines + "</div>";
  showScreen("detail");
}
function editOrder() {
  try {
    if (!CURRENT) { toast("קודם פתח הזמנה"); return; }
    EDITING_ID = CURRENT.id;
    CURRENT.status = "טיוטה";
    saveLocalOrder(CURRENT);
    postAction({ action: "setStatus", id: CURRENT.id, status: "טיוטה" }, function () {});
    var name = CURRENT.customer || "";
    PICKED_CUST = (DATA.customers || []).filter(function (c) {
      return c.name === name || String(c.code) === String(CURRENT.customerCode || "");
    })[0] || { code: CURRENT.customerCode || "", name: name, agent: CURRENT.agentCode || "" };
    LINES = (CURRENT.lines || []).map(function (l) {
      return { sku: l.sku, name: l.name || l.sku, qty: Number(l.qty || 0), stock: l.stock || "" };
    });
    PICKED_PROD = null;
    showScreen("new", true);
    document.getElementById("cust-search").value = PICKED_CUST.name || "";
    document.getElementById("cust-results").innerHTML = "";
    document.getElementById("prod-search").value = "";
    document.getElementById("prod-results").innerHTML = "";
    document.getElementById("delivery").value = toIsoDate(CURRENT.delivery);
    document.getElementById("qty").value = "1";
    document.getElementById("stock-hint").textContent = "";
    showPickedProd();
    fillAgents(CURRENT.agentCode || CURRENT.agent || "");
    fillSuppliers(CURRENT.supplier || CURRENT.agentCode || CURRENT.agent || "");
    renderLines();
    setSaveLabel();
    toast("עורך הזמנה " + (CURRENT.id || ""));
  } catch (err) {
    toast("שגיאה בעריכה: " + err);
  }
}
function setStatus(st) {
  if (!CURRENT) return;
  CURRENT.status = st;
  saveLocalOrder(CURRENT);
  toast(st);
  postAction({ action: "setStatus", id: CURRENT.id, status: st }, function () {});
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
function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.innerWidth < 900 && "ontouchstart" in window);
}
function hideSplash() {
  setProgress(100, "מוכן");
  if (!isMobile() || isStandalone()) {
    var wait = 2000 - (Date.now() - splashStarted);
    if (wait > 0) setTimeout(closeSplash, wait);
    else closeSplash();
  }
}
function tickSplash() {
  var elapsed = Date.now() - splashStarted;
  var pct = Math.min(90, 12 + elapsed / 22);
  setProgress(pct);
  if (elapsed < 2000) setTimeout(tickSplash, 80);
}
function loadRemoteOrders(done) {
  if (!window.HAZMANOT_WEBAPP) { done && done(); return; }
  fetch(apiUrl())
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (j && j.ok && j.orders) DATA.orders = j.orders;
      mergeLocalOrders();
      DATA.orders = uniqueOrders(DATA.orders);
      done && done();
    })
    .catch(function () {
      mergeLocalOrders();
      DATA.orders = uniqueOrders(DATA.orders);
      done && done();
    });
}
function getAll(cb) {
  setProgress(12, "טוען נתונים...");
  tickSplash();
  fetch("data.json?v=" + Date.now())
    .then(function (r) { return r.json(); })
    .then(function (j) {
      DATA = j;
      DATA.orders = DATA.orders || [];
      setProgress(70, "טוען הזמנות...");
      loadRemoteOrders(function () {
        setProgress(100, "מוכן");
        renderHome();
        hideSplash();
        cb && cb();
      });
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
  var addBtn = document.getElementById("add-line-btn");
  var saveBtn = document.getElementById("save-btn");
  var editBtn = document.getElementById("edit-btn");
  if (addBtn) addBtn.addEventListener("click", function (e) { e.preventDefault(); addLine(); });
  if (saveBtn) saveBtn.addEventListener("click", function (e) { e.preventDefault(); saveOrder(); });
  if (editBtn) editBtn.addEventListener("click", function (e) { e.preventDefault(); editOrder(); });
  if (!isMobile()) {
    if (btn) btn.style.display = "none";
    if (skip) skip.style.display = "none";
    var hint = document.getElementById("ios-hint");
    if (hint) hint.style.display = "none";
  }
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
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (regs) {
    regs.forEach(function (r) { r.update(); });
  });
  navigator.serviceWorker.register("sw.js?v=30").catch(function () {});
}
load();
