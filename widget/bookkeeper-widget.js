// 家庭记账 · iOS 小组件（Scriptable）
// 用法：装 Scriptable（App Store 免费）→ 新建脚本 → 把这段代码粘贴进去
// → 填 SECRET 和 BUDGET（SCRIPT_URL 已经填好）→ 运行一次确认能出数字
// → 回主屏幕添加 Scriptable 小组件。
// 小组件点一下会打开记账 App。刷新时间由 iOS 决定（一般 15 分钟到 1 小时），
// 不是实时的；断网时会显示上次缓存的数字和更新时间。
// 想让它每天自动跑几次不用你点：见 README 里的「自动刷新」，
// 在快捷指令里建几个「时间」自动化（比如 8:00 / 12:00 / 18:00 / 22:00），
// 每个自动化执行「运行脚本」选这个脚本就行。脚本被自动化跑的时候
// 只刷新缓存不弹窗，下一次小组件重画就显示新数字。
// 注意：SECRET 不要写进任何会上传的文件里，直接在 Scriptable 里填。

// ====== 配置 ======
// 这个文件是被 loader（家庭记账小组件-loader.js）从网上拉下来执行的，
// 也可以直接粘进 Scriptable 单独用。配置优先读 loader 传进来的
// globalThis.__BOOKKEEPER_WIDGET_CONFIG，读不到才用下面这几行的值。
// 注意：SECRET 不要写进这个文件——这个文件是要传到公开 GitHub 仓库的。
// 密钥只存在手机上 loader 那份里。
const __CFG = (typeof globalThis !== "undefined" && globalThis.__BOOKKEEPER_WIDGET_CONFIG) || {};
const SCRIPT_URL = __CFG.SCRIPT_URL || "https://script.google.com/macros/s/AKfycbxoj-eQbPxDVvoAo-oy_-IpYZKglH2IYoLo5ZsHQBhTZq4l0N7cwV8oAeGTeLiCjPmAOg/exec";
const SECRET = __CFG.SECRET || "";       // 同步密钥，和 Apps Script 里 SYNC_SECRET 填一样的
const BUDGET = (__CFG.BUDGET !== undefined) ? __CFG.BUDGET : 0;  // 每月预算（美元）。不知道先填 0，只显示已花
const APP_URL = __CFG.APP_URL || "https://yichencoding.github.io/bookkeeper/";
// =============================

const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), "family-bookkeeping-widget.json");

function fmt(n) {
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "-$" : "$") + s;
}
function monthKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
function summarize(rows, ym) {
  let net = 0, spent = 0, refunds = 0, count = 0;
  for (const r of rows) {
    if (!r || String(r.date || "").slice(0, 7) !== ym) continue;
    const a = Number(r.amount || 0);
    net += a; count++;
    if (a > 0) spent += a; else if (a < 0) refunds += a;
  }
  return { net, spent, refunds, count };
}
function barImage(pct, w, h) {
  // Scriptable 的 DrawContext 没有 fillRoundedRect，用 fillRect 画进度条
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.setFillColor(new Color("#e5e7eb"));
  ctx.fillRect(new Rect(0, 0, w, h));
  ctx.setFillColor(new Color(pct >= 1 ? "#ef4444" : pct >= 0.85 ? "#f59e0b" : "#2563eb"));
  ctx.fillRect(new Rect(0, 0, Math.max(2, w * Math.min(1, Math.max(0, pct))), h));
  return ctx.getImage();
}

let data = null, fromCache = false, cacheNote = "";
const now = new Date();
const ym = monthKey(now);
try {
  if (!SCRIPT_URL || !SECRET) throw new Error("not-configured");
  const req = new Request(SCRIPT_URL + "?action=pull&secret=" + encodeURIComponent(SECRET));
  req.timeoutInterval = 30;   // Apps Script 冷启动可能要 10 秒以上，15 秒容易超时只剩缓存
  const res = await req.loadJSON();
  if (!res || res.ok !== true) throw new Error((res && res.error) || "pull-failed");
  const rows = [].concat(res.amex || []).concat(res.manual || []);
  const s = summarize(rows, ym);
  data = { ...s, ts: Date.now() };
  fm.writeString(cachePath, JSON.stringify(data));
} catch (e) {
  if (fm.fileExists(cachePath)) {
    try { data = JSON.parse(fm.readString(cachePath)); fromCache = true; } catch (_) {}
  }
  cacheNote = String(e && e.message ? e.message : e);
}

const w = new ListWidget();
w.backgroundColor = new Color("#ffffff");
w.url = APP_URL + "?month=" + ym;   // 点小组件打开 App，直接停在小组件显示的这个月
// 告诉 iOS 最早 30 分钟后可以再刷新一次。只是建议，不保证准时：
// iOS 会看电量、你看小组件的频率来决定，实际一般 15–60 分钟。
w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

if (!SCRIPT_URL || !SECRET) {
  const t = w.addText("请先在脚本顶部填网址和密钥");
  t.font = Font.mediumSystemFont(14); t.textColor = new Color("#111827");
  w.addSpacer();
  const t2 = w.addText("SCRIPT_URL / SECRET");
  t2.font = Font.systemFont(12); t2.textColor = new Color("#6b7280");
} else if (!data) {
  const t = w.addText("同步失败");
  t.font = Font.mediumSystemFont(16); t.textColor = new Color("#111827");
  w.addSpacer(4);
  const t2 = w.addText(cacheNote === "not-configured" ? "请检查网址和密钥" : "拉取失败：" + cacheNote);
  t2.font = Font.systemFont(12); t2.textColor = new Color("#ef4444");
  w.addSpacer();
  const t3 = w.addText("点一下打开记账 App");
  t3.font = Font.systemFont(12); t3.textColor = new Color("#6b7280");
} else {
  const title = w.addText("家庭记账 · " + ym);
  title.font = Font.mediumSystemFont(13); title.textColor = new Color("#6b7280");
  w.addSpacer(6);
  const net = w.addText(fmt(data.net));
  net.font = Font.boldSystemFont(30); net.textColor = new Color("#111827");
  const netLabel = w.addText("本月净支出" + (fromCache ? "（缓存）" : ""));
  netLabel.font = Font.systemFont(12); netLabel.textColor = new Color("#6b7280");
  w.addSpacer(6);
  const row = w.addStack();
  const c1 = row.addText("支出 " + fmt(data.spent));
  c1.font = Font.systemFont(12); c1.textColor = new Color("#374151");
  row.addSpacer();
  const c2 = row.addText("退款 " + fmt(data.refunds));
  c2.font = Font.systemFont(12); c2.textColor = new Color("#374151");
  row.addSpacer();
  const c3 = row.addText(data.count + " 笔");
  c3.font = Font.systemFont(12); c3.textColor = new Color("#374151");
  if (BUDGET > 0 && config.widgetFamily !== "small") {
    w.addSpacer(8);
    const left = BUDGET - data.net;
    const pct = data.net / BUDGET;
    const brow = w.addStack();
    const b1 = brow.addText("预算 " + fmt(BUDGET));
    b1.font = Font.systemFont(12); b1.textColor = new Color("#374151");
    brow.addSpacer();
    const b2 = brow.addText("还剩 " + fmt(left));
    b2.font = Font.boldSystemFont(12); b2.textColor = new Color(left < 0 ? "#ef4444" : "#16a34a");
    w.addSpacer(4);
    w.addImage(barImage(pct, 320, 8));
    const p = w.addText("已用 " + Math.round(pct * 100) + "%");
    p.font = Font.systemFont(11); p.textColor = new Color("#6b7280");
  }
  w.addSpacer();
  const ts = new Date(data.ts);
  const foot = w.addText("更新于 " + String(ts.getHours()).padStart(2, "0") + ":" + String(ts.getMinutes()).padStart(2, "0") + (fromCache ? " · 离线缓存" : ""));
  foot.font = Font.systemFont(11); foot.textColor = new Color("#9ca3af");
}

if (config.runsInWidget) {
  Script.setWidget(w);
} else if (config.runsInApp) {
  // 只在 Scriptable App 里手动运行时才预览；快捷指令自动化在后台跑的时候
  // 不弹窗，只拉新数据写进缓存，下一轮小组件刷新时就显示新数字。
  if (config.widgetFamily === "small") {
    w.presentSmall();
  } else {
    w.presentMedium();
  }
}
// 快捷指令自动化跑的时候（既不在小组件里，也不在 App 里），上面两个分支
// 都不走，脚本只做拉数据、写缓存这两件事，不打扰你。
Script.complete();
