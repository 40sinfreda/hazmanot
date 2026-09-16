(function () {
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
  if (nextBtn) nextBtn.addEventListener("click", function (e) { e.preventDefault(); goToLines(); });
  if (backBtn) backBtn.addEventListener("click", function (e) { e.preventDefault(); goToMeta(); });
  showStep("meta");
})();
