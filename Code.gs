const TOKEN = "hazmanot-2026-hadar";

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function tokenOk(e, body) {
  var t = "";
  if (e && e.parameter && e.parameter.token) t = e.parameter.token;
  if (body && body.token) t = body.token;
  return t === TOKEN;
}

function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

function findHeaderRow(values) {
  var keys = ["קוד_לקוח", "קוד_סוכן", "מק״ט", 'מק"ט', "מס_הזמנה", "מס_שורה"];
  for (var i = 0; i < Math.min(5, values.length); i++) {
    var a = String(values[i][0] || "");
    for (var k = 0; k < keys.length; k++) if (a.indexOf(keys[k].replace("״", '"')) >= 0 || a === keys[k]) return i;
    if (a.indexOf("מק") === 0) return i;
  }
  return 0;
}

function readTable(name) {
  var sh = ss().getSheetByName(name);
  if (!sh) return [];
  var values = sh.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  var hi = findHeaderRow(values);
  var headers = values[hi].map(function (h) { return String(h); });
  var rows = [];
  for (var i = hi + 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = values[i][j];
    rows.push(obj);
  }
  return rows;
}

function colIndex(headers, name) {
  var n = String(name);
  for (var i = 0; i < headers.length; i++) if (String(headers[i]) === n) return i;
  return -1;
}

function doGet(e) {
  try {
    if (!tokenOk(e, null)) return jsonOut({ ok: false, error: "bad token" });
    var products = readTable("מוצרים").filter(function (p) {
      return String(p["פעיל"] || "כן") !== "לא";
    }).map(function (p) {
      return { sku: p["מק״ט"] || p['מק"ט'] || p["מק\"ט"], name: p["שם_מוצר"], unit: p["יחידה"] || "יח'" };
    });
    var stock = readTable("מלאי_מחסן_ראשי").map(function (s) {
      return {
        sku: s["מק״ט"] || s['מק"ט'],
        name: s["שם_מוצר"],
        qty: Number(s["מלאי_פיזי"] || s["יתרה_זמינה"] || 0),
        available: Number(s["יתרה_זמינה"] || s["מלאי_פיזי"] || 0),
        status: s["סטטוס_מלאי"] || ""
      };
    });
    var customers = readTable("לקוחות").filter(function (c) {
      return String(c["פעיל"] || "כן") !== "לא";
    }).map(function (c) {
      return {
        code: String(c["קוד_לקוח"]),
        name: c["שם_לקוח"],
        city: c["עיר"] || "",
        phone: c["טלפון"] || "",
        agent: String(c["סוכן_ברירת_מחדל"] || c["קוד_סוכן"] || "")
      };
    });
    var agents = readTable("סוכנים").filter(function (a) {
      return String(a["פעיל"] || "כן") !== "לא";
    }).map(function (a) {
      return { code: String(a["קוד_סוכן"]), name: a["שם_סוכן"], phone: a["טלפון"] || "" };
    });
    var lines = readTable("שורות_הזמנה");
    var orders = readTable("הזמנות").map(function (o) {
      var id = String(o["מס_הזמנה"]);
      var ol = lines.filter(function (l) { return String(l["מס_הזמנה"]) === id; }).map(function (l) {
        return {
          sku: l["מק״ט"] || l['מק"ט'],
          name: l["שם_מוצר"],
          qty: Number(l["כמות"] || 0),
          stock: l["סטטוס_מלאי"] || "",
          alert: l["התראה"] || "",
          open: l["פתוח_או_סגור"] || "פתוח"
        };
      });
      return {
        id: id,
        created: o["תאריך_הזמנה"] || "",
        delivery: o["תאריך_אספקה"] || "",
        customerCode: String(o["קוד_לקוח"] || ""),
        customer: o["שם_לקוח"] || "",
        agentCode: String(o["קוד_סוכן"] || ""),
        agent: o["שם_סוכן"] || "",
        status: o["סטטוס"] || "טיוטה",
        supplier: o["מי_מספק"] || "",
        note: o["הערת_מלאי"] || "",
        lines: ol
      };
    });
    orders.sort(function (a, b) {
      if (a.delivery === b.delivery) return (a.customer || "").localeCompare(b.customer || "", "he");
      return String(a.delivery).localeCompare(String(b.delivery));
    });
    return jsonOut({ ok: true, products: products, stock: stock, customers: customers, agents: agents, orders: orders });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function nextOrderId() {
  var rows = readTable("הזמנות");
  var max = 1000;
  rows.forEach(function (o) {
    var n = parseInt(String(o["מס_הזמנה"]).replace(/\D/g, ""), 10);
    if (n > max) max = n;
  });
  return "H-" + (max + 1);
}

function nextLineId() {
  return "L-" + Date.now();
}

function stockFor(sku) {
  var stock = readTable("מלאי_מחסן_ראשי");
  for (var i = 0; i < stock.length; i++) {
    var s = stock[i]["מק״ט"] || stock[i]['מק"ט'];
    if (String(s) === String(sku)) {
      return { available: Number(stock[i]["יתרה_זמינה"] || stock[i]["מלאי_פיזי"] || 0), status: stock[i]["סטטוס_מלאי"] || "" };
    }
  }
  return { available: 0, status: "חסר" };
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
    if (!tokenOk(e, body)) return jsonOut({ ok: false, error: "bad token" });
    if (body.action === "saveOrder") {
      var id = body.id || nextOrderId();
      var sh = ss().getSheetByName("הזמנות");
      var values = sh.getDataRange().getValues();
      var hi = findHeaderRow(values);
      var headers = values[hi].map(String);
      var existing = -1;
      var idCol = colIndex(headers, "מס_הזמנה");
      for (var r = hi + 1; r < values.length; r++) {
        if (String(values[r][idCol]) === String(id)) existing = r + 1;
      }
      var rowMap = {
        "מס_הזמנה": id,
        "תאריך_הזמנה": body.created || Utilities.formatDate(new Date(), "Asia/Jerusalem", "yyyy-MM-dd"),
        "תאריך_אספקה": body.delivery || "",
        "קוד_לקוח": body.customerCode || "",
        "שם_לקוח": body.customer || "",
        "קוד_סוכן": body.agentCode || "",
        "שם_סוכן": body.agent || "",
        "סטטוס": body.status || "טיוטה",
        "מי_מספק": body.supplier || "",
        "הערת_מלאי": body.note || "",
        "סהכ_שורות": (body.lines || []).length,
        "סהכ_כסף": 0,
        "נוצר_ע״י": body.by || "",
        "עודכן": new Date()
      };
      var arr = headers.map(function (h) { return rowMap[h] != null ? rowMap[h] : ""; });
      if (existing > 0) sh.getRange(existing, 1, 1, headers.length).setValues([arr]);
      else sh.appendRow(arr);

      var lsh = ss().getSheetByName("שורות_הזמנה");
      var lv = lsh.getDataRange().getValues();
      var lhi = findHeaderRow(lv);
      var lh = lv[lhi].map(String);
      var oidCol = colIndex(lh, "מס_הזמנה");
      for (var i = lv.length; i > lhi + 1; i--) {
        if (String(lv[i - 1][oidCol]) === String(id)) lsh.deleteRow(i);
      }
      (body.lines || []).forEach(function (line) {
        var st = stockFor(line.sku);
        var qty = Number(line.qty || 0);
        var status = qty > st.available ? (st.available <= 0 ? "חסר" : "נמוך") : (st.status || "תקין");
        var alert = status === "חסר" ? "חסר במחסן הראשי" : (status === "נמוך" ? "מלאי נמוך במחסן הראשי" : "");
        var lmap = {
          "מס_שורה": nextLineId(),
          "מס_הזמנה": id,
          "מק״ט": line.sku,
          "שם_מוצר": line.name || "",
          "כמות": qty,
          "מחיר_יח": 0,
          "סהכ": 0,
          "סטטוס_מלאי": status,
          "פתוח_או_סגור": body.status === "סופקה" || body.status === "בוטלה" ? "סגור" : "פתוח",
          "יתרה_זמינה": st.available,
          "התראה": alert,
          "הערה": line.note || ""
        };
        lsh.appendRow(lh.map(function (h) { return lmap[h] != null ? lmap[h] : ""; }));
      });
      return jsonOut({ ok: true, id: id });
    }
    if (body.action === "setStatus") {
      var sh2 = ss().getSheetByName("הזמנות");
      var vals = sh2.getDataRange().getValues();
      var h2 = findHeaderRow(vals);
      var hd = vals[h2].map(String);
      var cId = colIndex(hd, "מס_הזמנה");
      var cSt = colIndex(hd, "סטטוס");
      var cSup = colIndex(hd, "מי_מספק");
      for (var r2 = h2 + 1; r2 < vals.length; r2++) {
        if (String(vals[r2][cId]) === String(body.id)) {
          if (cSt >= 0) sh2.getRange(r2 + 1, cSt + 1).setValue(body.status || vals[r2][cSt]);
          if (cSup >= 0 && body.supplier != null) sh2.getRange(r2 + 1, cSup + 1).setValue(body.supplier);
          return jsonOut({ ok: true });
        }
      }
      return jsonOut({ ok: false, error: "order not found" });
    }
    return jsonOut({ ok: false, error: "unknown action" });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}
