// 家庭记账 · Apps Script 桥接 v3（隔离版）
// 部署：打开 Google Sheets《家庭记账》→ 扩展程序 → Apps Script → 把本文件
// 全部粘贴进去（替换掉旧版）→ 把 SYNC_SECRET 改成你自己的密钥
// → 部署 → 管理部署 → 选已有的 Web 应用部署 → 新版本 → 部署。
// 网址不变，App 里不用改网址。密钥只存在各人自己的设备上。
const SYNC_SECRET = "jia-ting-2026";
const SHEET_AMEX = "Amex交易";     // 只读：只有 Muse 的每日 Plaid 拉取写这里，App 绝不写
const SHEET_MANUAL = "手动交易";   // 只写：App 手动记的只写这里，绝不碰 Amex交易
const HEADERS = ["日期","商家","大类","细分类","金额 (USD)","类型","来源","备注","交易ID"];

function readTab(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) return [];
  const vals = sh.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < vals.length; i++) {
    const r = vals[i];
    if (!r[0] && !r[1]) continue;
    let d = r[0];
    if (Object.prototype.toString.call(d) === "[object Date]") d = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
    rows.push({date: String(d).slice(0,10), merchant: String(r[1]||""), category: String(r[2]||""), subcategory: String(r[3]||""), amount: Number(r[4]||0), type: String(r[5]||"支出"), source: String(r[6]||"手动"), note: String(r[7]||""), id: String(r[8]||"")});
  }
  return rows;
}

function doGet(e) {
  try {
    if ((e.parameter.secret || "") !== SYNC_SECRET) return json({ok:false, error:"密钥不对"});
    if (e.parameter.action !== "pull") return json({ok:false, error:"未知 action"});
    return json({ok:true, amex: readTab(SHEET_AMEX), manual: readTab(SHEET_MANUAL)});
  } catch (err) { return json({ok:false, error: String(err)}); }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    if (body.secret !== SYNC_SECRET) return json({ok:false, error:"密钥不对"});
    if (body.action !== "pushManual") return json({ok:false, error:"未知 action：v3 只接受 pushManual，不再接受全量 push"});
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SHEET_MANUAL);
    if (!sh) sh = ss.insertSheet(SHEET_MANUAL);
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
