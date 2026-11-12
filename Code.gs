// 家庭记账 · Apps Script 桥接
// 部署：扩展程序 → Apps Script → 粘贴本文件 → 把 SYNC_SECRET 改成你自己的密钥
// → 部署 → 新建部署 → 类型 Web 应用 → 访问权限“任何人” → 部署，复制网址填回 App。
const SYNC_SECRET = "jia-ting-2026";
const SHEET_NAME = "所有交易";
const HEADERS = ["日期","商家","大类","细分类","金额 (USD)","类型","来源","备注","交易ID"];

function doGet(e) {
  try {
    if ((e.parameter.secret || "") !== SYNC_SECRET) return json({ok:false, error:"密钥不对"});
    if (e.parameter.action !== "pull") return json({ok:false, error:"未知 action"});
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const vals = sh.getDataRange().getValues();
    const rows = [];
    for (let i = 1; i < vals.length; i++) {
      const r = vals[i];
      if (!r[0] && !r[1]) continue;
      let d = r[0];
      if (Object.prototype.toString.call(d) === "[object Date]") d = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
      rows.push({date: String(d).slice(0,10), merchant: String(r[1]||""), category: String(r[2]||""), subcategory: String(r[3]||""), amount: Number(r[4]||0), type: String(r[5]||"支出"), source: String(r[6]||"手动"), note: String(r[7]||""), id: String(r[8]||"")});
    }
    return json({ok:true, rows: rows});
  } catch (err) { return json({ok:false, error: String(err)}); }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    if (body.secret !== SYNC_SECRET) return json({ok:false, error:"密钥不对"});
    if (body.action !== "push") return json({ok:false, error:"未知 action"});
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) sh = ss.insertSheet(SHEET_NAME);
    const rows = body.rows || [];
    const values = [HEADERS];
    rows.forEach(function(r){ values.push([r.date, r.merchant, r.category, r.subcategory, Number(r.amount||0), r.type, r.source, r.note||"", r.id]); });
    sh.clear();
    sh.getRange(1, 1, values.length, values[0].length).setValues(values);
    sh.setFrozenRows(1);
    return json({ok:true, updated: rows.length});
  } catch (err) { return json({ok:false, error: String(err)}); }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
