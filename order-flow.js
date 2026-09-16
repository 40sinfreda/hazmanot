(function () {
  function appInstalled() {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.navigator.standalone === true) return true;
      if (localStorage.getItem("hazmanot_installed") === "1") return true;
    } catch (e) {}
    return false;
  }
  function hideInstallUi() {
    ["install-btn", "skip-install", "ios-hint"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
  }
  function markInstalled() {
    try { localStorage.setItem("hazmanot_installed", "1"); } catch (e) {}
    hideInstallUi();
  }
  if (appInstalled()) markInstalled();
  window.addEventListener("appinstalled", markInstalled);
  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then(function (apps) {
      if (apps && apps.length) markInstalled();
    }).catch(function () {});
  }
  window.hideSplash = function () {
    setProgress(100, "מוכן");
    if (!isMobile() || appInstalled()) {
      var wait = 2000 - (Date.now() - splashStarted);
      if (wait > 0) setTimeout(closeSplash, wait);
      else closeSplash();
    }
  };
  function showStep(step) {
    var meta = document.getElementById("step-meta");
    var lines = document.getElementById("step-lines");
    if (meta) meta.classList.toggle("on", step === "meta");
    if (lines) lines.classList.toggle("on", step === "lines");
  }
  function orderSummary() {
    var el = document.getElementById("order-meta-summary");
    if (!el) return;
    var parts = [];
    if (PICKED_CUST) parts.push(PICKED_CUST.name);
    var d = document.getElementById("delivery");
    if (d && d.value) parts.push(formatDateHe(d.value));
    var a = document.getElementById("agent");
    if (a && a.selectedIndex >= 0 && a.value) parts.push(a.options[a.selectedIndex].text);
    el.textContent = parts.join(" · ");
  }
  function goToLines() {
    if (!PICKED_CUST) { toast("בחר לקוח"); return; }
    if (!document.getElementById("delivery").value) { toast("בחר תאריך אספקה"); return; }
    orderSummary();
    showStep("lines");
  }
  function goToMeta() { showStep("meta"); }
  function showSaveWait(on, msg, pct) {
    var el = document.getElementById("save-wait");
    var lab = document.getElementById("save-wait-msg");
    var bar = document.getElementById("save-fill");
    if (lab && msg) lab.textContent = msg;
    if (bar && pct != null) bar.style.width = Math.max(8, Math.min(100, pct)) + "%";
    if (el) el.classList.toggle("show", !!on);
  }
  function row(label, val, href) {
    if (val == null || String(val).trim() === "") return "";
    var v = esc(val);
    if (href) v = '<a href="' + href + '">' + v + "</a>";
    return '<div class="cust-row"><span>' + label + '</span><b>' + v + "</b></div>";
  }
  window.openCustomer = function (code, name) {
    var c = (DATA.customers || []).filter(function (x) {
      return String(x.code) === String(code) || x.name === name;
    })[0] || { name: name || "", code: code || "" };
    var agent = (DATA.agents || []).filter(function (a) {
      return String(a.code) === String(c.agent || "") || a.name === c.agentName;
    })[0];
    var tel = String(c.phone || "").replace(/[^0-9+]/g, "");
    var html = "<h2>" + esc(c.name || name || "לקוח") + "</h2>";
    html += row("קוד לקוח", c.code);
    html += row("עיר", c.city);
    html += row("כתובת", c.address);
    html += row("טלפון", c.phone, tel ? ("tel:" + tel) : "");
    html += row("מייל", c.email, c.email ? ("mailto:" + c.email) : "");
    html += row("סוכן", c.agentName || (agent ? agent.name : "") || c.agent);
    if (c.payment) html += row("תנאי תשלום", c.payment);
    if (c.status) html += row("סטטוס", c.status);
    document.getElementById("cust-card-body").innerHTML = html;
    document.getElementById("cust-card").classList.add("show");
  };
  window.closeCustomer = function () {
    var el = document.getElementById("cust-card");
    if (el) el.classList.remove("show");
  };
  var _openOrder = window.openOrder;
  window.openOrder = function (id) {
    if (_openOrder) _openOrder(id);
    if (!CURRENT) return;
    var box = document.getElementById("detail");
    if (!box) return;
    var name = CURRENT.customer || "";
    var code = CURRENT.customerCode || "";
    box.innerHTML = box.innerHTML.replace(
      "<b>" + esc(name) + "</b>",
      '<b class="cust-link" data-code="' + esc(code) + '" data-name="' + esc(name) + '">' + esc(name) + "</b>"
    );
    var link = box.querySelector(".cust-link");
    if (link) link.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openCustomer(link.getAttribute("data-code"), link.getAttribute("data-name"));
    });
  };
  var _prepNew = window.prepNew;
  window.prepNew = function () {
    if (_prepNew) _prepNew();
    showStep("meta");
  };
  var _editOrder = window.editOrder;
  window.editOrder = function () {
    if (_editOrder) _editOrder();
    showStep("meta");
  };
  window.saveOrder = function () {
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
    var wasEdit = !!EDITING_ID;
    payload.id = EDITING_ID || ("H-L" + Date.now());
    showSaveWait(true, wasEdit ? "ההזמנה מתעדכנת" : "ההזמנה נשמרת", 18);
    EDITING_ID = null;
    postAction(payload, function (j) {
      showSaveWait(true, wasEdit ? "ההזמנה מתעדכנת" : "ההזמנה נשמרת", 70);
      if (j && j.ok && j.id) payload.id = j.id;
      saveLocalOrder(payload);
      load(function () {
        showSaveWait(true, wasEdit ? "ההזמנה מתעדכנת" : "ההזמנה נשמרת", 100);
        var found = uniqueOrders(DATA.orders || []).some(function (o) {
          return String(o.id) === String(payload.id) || (o.customer === payload.customer && toIsoDate(o.delivery) === toIsoDate(payload.delivery));
        });
        if (!found) {
          DATA.orders.push(payload);
          DATA.orders = uniqueOrders(DATA.orders);
        }
        renderHome();
        setTimeout(function () {
          showSaveWait(false);
          showScreen("home");
        }, 400);
      });
    });
  };
  var nextBtn = document.getElementById("next-lines-btn");
  var backBtn = document.getElementById("back-meta-btn");
  var closeBtn = document.getElementById("cust-card-close");
  if (nextBtn) nextBtn.addEventListener("click", function (e) { e.preventDefault(); goToLines(); });
  if (backBtn) backBtn.addEventListener("click", function (e) { e.preventDefault(); goToMeta(); });
  if (closeBtn) closeBtn.addEventListener("click", function (e) { e.preventDefault(); closeCustomer(); });
  var card = document.getElementById("cust-card");
  if (card) card.addEventListener("click", function (e) {
    if (e.target === card) closeCustomer();
  });
  showStep("meta");
})();
