/* ============================================================
   智瞳 · AI智能安防监控系统 — 真实数据接入脚本
   仅负责把 /api/alarms* 数据渲染进既有页面容器，
   不改变任何页面原有布局与样式体系。
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- 工具 ---------------- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function qs(obj) {
    var p = [];
    Object.keys(obj || {}).forEach(function (k) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
        p.push(encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]));
      }
    });
    return p.length ? "?" + p.join("&") : "";
  }
  function fmtDT(iso) {
    if (!iso) return "--";
    var s = String(iso).replace("T", " ").split(".")[0]; // 去毫秒
    return s.length >= 16 ? s : "--";
  }
  /* 从 detail 中提取最大置信度，如 "fire(0.94)、person(0.86)" -> 0.94 */
  function maxConf(detail) {
    if (!detail) return null;
    var m = String(detail).match(/\((\d+(?:\.\d+)?)\)/g);
    if (!m) return null;
    var best = -1;
    m.forEach(function (s) {
      var v = parseFloat(s.replace(/[()]/g, ""));
      if (!isNaN(v) && v > best) best = v;
    });
    return best < 0 ? null : best;
  }
  function confCls(c) { return c >= 0.9 ? "hi" : "mid"; }
  function trunc(s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? s.slice(0, n) + "…" : s;
  }
  function hexA(hex, a) {
    var h = String(hex || "#2AD6FF").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return "rgba(42,214,255," + a + ")";
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  /* ---------------- 语义 -> UI 映射 ---------------- */
  var TYPE_COLOR = {
    "人员闯入": "#FF5D5D", "人员聚集": "#8B7CFF", "烟火异常": "#FFC53D",
    "车辆异常": "#2AD6FF", "动物进入": "#3DDC97", "物品异常": "#9FB3D1"
  };
  var LEVEL_META = {
    "高": { label: "紧急", key: "urgent", bar: "level-red",    pill: "red" },
    "中": { label: "警告", key: "warn",   bar: "level-yellow", pill: "yellow" },
    "低": { label: "提示", key: "info",   bar: "level-cyan",   pill: "cyan" }
  };
  var STATUS_META = {
    "待处置": "red", "处置中": "yellow", "已派单": "cyan", "已关闭": "gray"
  };

  function lvMeta(l) {
    return LEVEL_META[l] || { label: l || "提示", key: "info", bar: "level-cyan", pill: "gray" };
  }
  function typePill(type) {
    var c = TYPE_COLOR[type] || "#5B6B85";
    return '<span class="type-pill" style="color:' + c + ";background:" + hexA(c, 0.12) + '">' + esc(type) + "</span>";
  }
  function statusPill(st) {
    var p = STATUS_META[st] || "gray";
    return '<span class="status-pill ' + p + '">' + esc(st || "--") + "</span>";
  }
  function confTag(c) {
    if (c == null) return "";
    var cls = confCls(c);
    var pct = Math.round(c * 100);
    return '<span class="conf-tag ' + cls + '">' + pct + "%</span>";
  }
  function confBig(c) {
    if (c == null) return '<span class="mono" style="color:var(--muted)">--</span>';
    return '<span class="conf-big ' + confCls(c) + '">' + Math.round(c * 100) + "<small>%</small></span>";
  }
  function emptyState(title, sub) {
    return '<div class="empty-state" style="min-height:220px;">' +
      '<span class="es-title">' + esc(title || "暂无数据") + "</span>" +
      '<span class="es-sub">' + esc(sub || "") + "</span></div>";
  }

  function norm(rec) {
    return {
      id: rec.id, type: rec.type || "未知类型", area: rec.area || "未知区域",
      level: rec.level || "低", status: rec.status || "待处置",
      source: rec.source || "AI视觉分析", detail: rec.detail || "",
      time: fmtDT(rec.eventTime), conf: maxConf(rec.detail),
      image: rec.image || ""
    };
  }

  /* "yyyy-MM-dd HH:mm:ss" -> "MM-dd HH:mm"（步骤条时间用短格式） */
  function shortDT(t) {
    var s = String(t || "");
    return s.length >= 16 ? s.slice(5, 16) : s;
  }

  /* ---------------- 处置记录本地存储（告警中心 → 处置记录页） ----------------
     同一告警重复点"处置"只保留一条（刷新时间），最新的排在最前 */
  var HANDLING_KEY = "handling_records";
  var HandlingStore = {
    all: function () {
      try { return JSON.parse(localStorage.getItem(HANDLING_KEY)) || []; }
      catch (e) { return []; }
    },
    save: function (list) {
      try { localStorage.setItem(HANDLING_KEY, JSON.stringify(list)); } catch (e) {}
    },
    add: function (rec, result, remark) {
      var list = this.all().filter(function (x) { return x.alarmId !== rec.id; });
      var now = new Date();
      var cost = 1;
      var evt = new Date(String(rec.time).replace(/-/g, "/"));
      if (!isNaN(evt)) cost = Math.max(1, Math.round((now - evt) / 60000));
      var hh = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
        " " + pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
      list.unshift({
        alarmId: rec.id, type: rec.type, area: rec.area, level: rec.level,
        source: rec.source, detail: rec.detail, eventTime: rec.time,
        handleTime: hh, cost: cost,
        result: result || "已完成", remark: remark || ""
      });
      this.save(list);
    }
  };

  /* 告警卡片右侧缩略图（加载失败/缺失时回退为"暂无照片"占位） */
  function thumbHTML(image) {
    if (!image) return '<div class="thumb empty"></div>';
    var url = "/alarm-img/" + encodeURIComponent(image);
    return '<div class="thumb"><img src="' + url + '" alt="检测照片" loading="lazy" ' +
      "onerror=\"this.remove();this.parentNode.classList.add('empty');\"></div>";
  }

  /* ---------------- API ---------------- */
  function api(path, params) {
    return fetch("/api" + path + qs(params)).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  /* ---------------- 环形图（保留原 SVG 语义：中心总数 + 底环） ---------------- */
  function donut(svg, segs, centerNum, labelText) {
    if (!svg) return;
    var g = svg.querySelector("g[transform]");
    if (!g) return;
    var bg = g.querySelector("circle");
    if (!bg) return;
    var r = bg.getAttribute("r") * 1 || 38;
    var C = 2 * Math.PI * r;
    // 保留背景环，重建分段
    while (g.querySelectorAll("circle").length > 1) {
      g.removeChild(g.querySelectorAll("circle")[g.querySelectorAll("circle").length - 1]);
    }
    var total = 0;
    segs = (segs || []).filter(function (s) { total += (s.v | 0); return s.v > 0; });
    if (total === 0) {
      g.querySelector("circle").setAttribute("stroke", "#16233C");
    } else {
      var acc = 0;
      segs.forEach(function (s) {
        var len = (s.v / total) * C;
        var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", bg.getAttribute("cx"));
        c.setAttribute("cy", bg.getAttribute("cy"));
        c.setAttribute("r", r);
        c.setAttribute("fill", "none");
        c.setAttribute("stroke", s.color || "#2AD6FF");
        c.setAttribute("stroke-width", bg.getAttribute("stroke-width"));
        c.setAttribute("stroke-dasharray", len.toFixed(2) + " " + (C - len).toFixed(2));
        c.setAttribute("stroke-dashoffset", (-acc).toFixed(2));
        g.appendChild(c);
        acc += len;
      });
    }
    // 中心数字：svg 下第一个 text（不含标题）
    var center = null, title = null;
    svg.querySelectorAll("text").forEach(function (t) {
      if (!center) center = t; else if (!title) title = t;
    });
    if (center && centerNum != null) center.textContent = String(centerNum);
    if (title && labelText) title.textContent = labelText;
  }

  /* ---------------- 分组统计转 Map ---------------- */
  function toMap(list, key) {
    var m = {};
    (list || []).forEach(function (it) {
      var k = it[key];
      if (k != null) m[k] = Number(it.cnt || it.count || 0);
    });
    return m;
  }
  function countOf(list, name) { var m = toMap(list, "type"); return m[name] || 0; }

  /* ---------------- 通用列表渲染容器 ---------------- */
  function listBox(container, emptyTitle, emptySub) {
    if (!container) return null;
    var emptyHtml = emptyState(emptyTitle || "暂无数据", emptySub || "");
    return {
      render: function (items, rowFn) {
        container.innerHTML = items.length ? items.map(rowFn).join("") : emptyHtml;
      }
    };
  }

  /* ============================================================
     页面 A：监控大屏 index.html
     ============================================================ */
  function initDashboard() {
    var kpiToday = document.querySelector('[data-kpi="aiToday"]');
    var kpiPending = document.querySelector('[data-kpi="pending"]');
    var kpiDevice = document.querySelector('[data-kpi="deviceTotal"]');
    var kpiOnlineRate = document.querySelector('[data-kpi="onlineRate"]');
    var alarmListEl = document.querySelector(".alarm-panel .alarm-list");
    var trendBody = document.querySelector(".chart-body");
    var donutSvg = document.querySelector(".donut-wrap svg");
    var donutLegend = document.querySelector(".donut-legend");
    var lvlBox = document.querySelector(".alarm-panel .lvl-summary");
    var panelSub = document.querySelector(".alarm-panel .card-head .sub");
    if (!alarmListEl && !donutSvg && !kpiPending) return; // 非大屏页

    var box = listBox(alarmListEl, "暂无告警记录", "AI 识别结果将实时展示在此");

    function rowHTML(rec) {
      var m = lvMeta(rec.level);
      return '<div class="alarm-row">' +
        '<div class="level-bar ' + m.bar + '"></div>' +
        '<div class="body">' +
        '<div class="a-title">' + typePill(rec.type) +
        "<span>" + esc(rec.area) + "</span></div>" +
        '<div class="a-meta"><span class="mono">' + rec.time + "</span><span>" +
        esc(rec.source) + "</span></div>" +
        '<div class="a-foot">' + statusPill(rec.status) + confTag(rec.conf) + "</div>" +
        "</div></div>";
    }
    function rowCompact(rec) {
      var m = lvMeta(rec.level);
      var time = rec.time && rec.time.length >= 16 ? rec.time.slice(5, 16) : rec.time;
      return '<div class="alarm-row" title="' + esc(rec.detail || rec.type + " " + rec.area) + '">' +
        '<div class="level-bar ' + m.bar + '"></div>' +
        '<div class="body"><div class="a-title">' + typePill(rec.type) +
        '<span class="mono" style="color:var(--muted);font-size:10.5px">' + esc(time) + "</span></div>" +
        '<div class="a-meta"><span>' + esc(rec.area) + "</span></div></div></div>";
    }

    function loadStats() {
      api("/alarms/stats").then(function (st) {
        if (kpiToday) {
          var v = kpiToday.querySelector(".kpi-value");
          if (v && v.childNodes[0]) v.childNodes[0].nodeValue = String(st.today || 0);
        }
        if (kpiPending) {
          var vp = kpiPending.querySelector(".kpi-value");
          if (vp && vp.childNodes[0]) vp.childNodes[0].nodeValue = String(st.pending || 0);
          var foot = kpiPending.querySelector(".kpi-foot");
          if (foot) {
            var nv = foot.querySelectorAll(".null-val");
            var pbl = st.pendingByLevel || [];
            var g = function (l) { return pbl.reduce(function (a, x) { return x.level === l ? Number(x.cnt) : a; }, 0); };
            if (nv.length >= 3) {
              nv[0].textContent = g("高"); nv[1].textContent = g("中"); nv[2].textContent = g("低");
            }
          }
        }
        // 今日 AI 识别 较昨日
        api("/alarms/trend", { days: 2 }).then(function (t) {
          var items = (t && t.items) || [];
          if (items.length === 2 && kpiToday) {
            var foot = kpiToday.querySelector(".kpi-foot");
            var yest = Number(items[0].count || 0);
            var delta = Number(items[1].count || 0) - yest;
            if (foot) {
              var s = foot.querySelector("span");
              if (s) {
                if (delta > 0) s.innerHTML = '<span class="trend up">+' + delta + "</span>";
                else if (delta < 0) s.innerHTML = '<span class="trend down">' + delta + "</span>";
                else s.textContent = "0";
              }
            }
          }
        }).catch(function () {});
        // 级别摘要（待处置分级）
        if (lvlBox) {
          var n = lvlBox.querySelectorAll(".lvl-pill .n");
          var pbl2 = st.pendingByLevel || [];
          var g2 = function (l) { return pbl2.reduce(function (a, x) { return x.level === l ? Number(x.cnt) : a; }, 0); };
          if (n.length === 3) {
            n[0].textContent = g2("高"); n[1].textContent = g2("中"); n[2].textContent = g2("低");
          }
        }
        if (panelSub) panelSub.innerHTML = "今日 <span class='mono'>" + (st.today || 0) + "</span> 条";
        // 类型分布环形图（今日）
        var todayTypes = st.todayByType || [];
        var segs = todayTypes.map(function (t) {
          return { v: Number(t.cnt), color: TYPE_COLOR[t.type] || "#5B6B85" };
        });
        var tTotal = todayTypes.reduce(function (a, x) { return a + Number(x.cnt); }, 0);
        if (donutSvg) donut(donutSvg, segs, tTotal, "今日识别次数");
        if (donutLegend) {
          if (!todayTypes.length) {
            donutLegend.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:6px 0">今日暂无识别记录</div>';
          } else {
            donutLegend.innerHTML = "";
            todayTypes.slice().sort(function (a, b) { return b.cnt - a.cnt; }).forEach(function (t) {
              var c = TYPE_COLOR[t.type] || "#5B6B85";
              var el = document.createElement("span");
              el.className = "lg";
              el.innerHTML = '<i style="background:' + c + '"></i>' + esc(t.type) +
                '<span class="v">' + t.cnt + "</span>" +
                '<span class="p">' + (tTotal ? Math.round(t.cnt / tTotal * 100) : 0) + "%</span>";
              donutLegend.appendChild(el);
            });
          }
        }
      }).catch(function (e) { console.warn("[data.js] stats 加载失败", e); });
    }

    function loadList() {
      api("/alarms", { page: 1, size: 8 }).then(function (d) {
        if (box) box.render((d.records || []).map(norm), rowCompact);
      }).catch(function (e) { console.warn("[data.js] 大屏列表加载失败", e); });
    }

    function loadTrend(days) {
      api("/alarms/trend", { days: days }).then(function (d) {
        var items = (d && d.items) || [];
        if (!trendBody) return;
        var allZero = items.length && items.every(function (x) { return !x.count; });
        if (!items.length || allZero) {
          trendBody.innerHTML = emptyState("暂无趋势数据", "近" + days + "日无告警记录");
          return;
        }
        var W = 560, H = 200, PL = 34, PR = 12, PT = 20, PB = 28;
        var plotW = W - PL - PR, plotH = H - PT - PB;
        var max = 1;
        items.forEach(function (x) { max = Math.max(max, Number(x.count)); });
        max = Math.ceil(max * 1.25);
        var step = plotW / items.length;
        var barW = Math.min(34, step * 0.52);
        var bars = "", grid = "", labels = "";
        for (var g = 0; g <= 4; g++) {
          var gy = PT + plotH - (g / 4) * plotH;
          grid += '<line x1="' + PL + '" y1="' + gy + '" x2="' + (W - PR) + '" y2="' + gy + '" stroke="rgba(148,178,224,.08)"/>';
          grid += '<text x="' + (PL - 7) + '" y="' + (gy + 3) + '" text-anchor="end" class="axis-text">' +
            Math.round((g / 4) * max) + "</text>";
        }
        items.forEach(function (x, i) {
          var h = (Number(x.count) / max) * plotH;
          var x0 = PL + i * step + (step - barW) / 2;
          var y0 = PT + plotH - h;
          bars += '<rect x="' + x0.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + barW.toFixed(1) +
            '" height="' + Math.max(h, 1).toFixed(1) + '" rx="3" fill="url(#gTrend)"/>';
          bars += '<text x="' + (x0 + barW / 2).toFixed(1) + '" y="' + (y0 - 6).toFixed(1) +
            '" text-anchor="middle" fill="#E8F0FB" font-family="JetBrains Mono,monospace" font-size="9">' + x.count + "</text>";
          labels += '<text x="' + (PL + i * step + step / 2).toFixed(1) + '" y="' + (H - 8) +
            '" text-anchor="middle" class="axis-text">' + esc(x.label) + "</text>";
        });
        trendBody.innerHTML = '<svg class="chart-svg" viewBox="0 0 ' + W + " " + H + '">' +
          '<defs><linearGradient id="gTrend" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#4FE0FF"/><stop offset="1" stop-color="#0FB5DF"/></linearGradient></defs>' +
          grid + bars + labels + "</svg>";
      }).catch(function (e) { console.warn("[data.js] 趋势加载失败", e); });
    }

    function loadDeviceStats() {
      api("/devices/stats").then(function (s) {
        var total = Number(s.total || 0);
        var online = Number(s.online || 0);
        var offline = Number(s.offline || 0);
        var rate = Number(s.onlineRate || 0);
        // 接入设备：value=总台数，foot=在线 X · 离线 Y
        if (kpiDevice) {
          var v = kpiDevice.querySelector(".kpi-value");
          if (v && v.childNodes[0]) v.childNodes[0].nodeValue = String(total);
          var foot = kpiDevice.querySelector(".kpi-foot");
          if (foot) {
            var sp = foot.querySelectorAll(".null-val");
            if (sp.length >= 2) { sp[0].textContent = online; sp[1].textContent = offline; }
          }
        }
        // 设备在线率：value=百分比，foot=在线 X · 离线 Y
        if (kpiOnlineRate) {
          var v2 = kpiOnlineRate.querySelector(".kpi-value");
          if (v2 && v2.childNodes[0]) v2.childNodes[0].nodeValue = String(rate);
          var foot2 = kpiOnlineRate.querySelector(".kpi-foot");
          if (foot2) {
            var sp2 = foot2.querySelectorAll(".null-val");
            if (sp2.length >= 2) { sp2[0].textContent = online; sp2[1].textContent = offline; }
          }
        }
      }).catch(function (e) { console.warn("[data.js] device stats 加载失败", e); });
    }

    loadStats();
    loadList();
    loadTrend(7);
    loadDeviceStats();

    // 顶部胶囊：今日 / 近7日 / 近30日 -> 趋势天数（默认对齐"近7日"标题）
    var pills = document.querySelectorAll(".page-header .pill-group .pill");
    var daysMap = [1, 7, 30];
    if (pills.length === 3) {
      pills.forEach(function (p, i) {
        p.addEventListener("click", function () {
          pills.forEach(function (q) { q.classList.remove("active"); });
          p.classList.add("active");
          loadTrend(daysMap[i]);
        });
      });
      pills[0].classList.remove("active");
      pills[1].classList.add("active");
    }

    setInterval(function () { loadStats(); loadList(); loadDeviceStats(); }, 15000);
  }

  /* ============================================================
     页面 B：实时告警中心 alarms.html
     ============================================================ */
  function initAlarms() {
    var listEl = document.querySelector(".alarm-center .ac-list");
    var pillGroup = document.querySelector('.page-header .pill-group');
    var donutSvg = document.querySelector(".mini-donut-wrap svg");
    var miniLegend = document.querySelector(".mini-legend");
    var updateEl = document.querySelector(".ac-aside .card .card-head .sub");
    var lcCard = document.querySelector(".latest-critical");
    var lcTitle = lcCard && lcCard.querySelector(".lc-title");
    var lcMeta = lcCard && lcCard.querySelector(".lc-meta");
    var lcStatus = lcCard && lcCard.querySelector(".status-pill");
    if (!listEl && !donutSvg) return;

    var box = listBox(listEl, "暂无待处置告警", "请调整级别筛选，或等待新的 AI 告警");
    var curLevel = ""; // '' = 全部待处置, '高','中','低'
    var recCache = {}; // id -> 记录缓存（"处置"按钮点击时取用）

    function acRow(rec) {
      var m = lvMeta(rec.level);
      var crit = rec.level === "高" ? " critical" : "";
      return '<div class="ac-card' + crit + '">' +
        '<div class="level-bar ' + m.bar + '"></div>' +
        '<div class="ac-main">' +
        '<div class="ac-title">' + typePill(rec.type) + "<span>" + esc(rec.area) + "</span></div>" +
        '<div class="ac-meta"><span class="mono">' + rec.time + "</span>" +
        "<span>" + esc(rec.source) + "</span>" +
        '<span class="mono" style="opacity:.7">#' + rec.id + "</span></div>" +
        '<div class="ac-meta" style="font-size:11px">' + esc(trunc(rec.detail, 90)) + "</div>" +
        /* 处置按钮：位于底部"X级"标签上方，右对齐 */
        '<div style="display:flex; justify-content:flex-end; margin-top:2px;">' +
        '<button type="button" class="btn btn-ghost btn-sm handle-btn" data-id="' + rec.id + '" ' +
        'style="color:var(--cyan);" title="处置该告警并登记处置记录">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' +
        "处置</button></div>" +
        '<div class="ac-foot">' + statusPill(rec.status) + confTag(rec.conf) +
        '<span class="sp"></span><span class="mono" style="color:var(--muted);font-size:10.5px">' +
        m.label + "级</span></div>" +
        "</div>" + thumbHTML(rec.image) +
        "</div>";
    }

    function loadList() {
      var params = { status: "待处置", page: 1, size: 60 };
      if (curLevel) params.level = curLevel;
      api("/alarms", params).then(function (d) {
        var list = (d.records || []).map(norm);
        list.forEach(function (r) { recCache[r.id] = r; });
        if (box) box.render(list, acRow);
      }).catch(function (e) { console.warn("[data.js] 告警列表加载失败", e); });
    }

    /* "处置"弹窗（内联样式动态创建，不改 alarms.html 布局）：
       选择结果 已完成/已忽略/误报 + 选填备注 → 上报后端状态 → 登记处置记录 → 跳转处置记录页 */
    function openHandleDialog(rec) {
      var chosen = "已完成";
      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed;inset:0;z-index:999;background:rgba(4,9,18,.65);" +
        "display:flex;align-items:center;justify-content:center;";
      var dlg = document.createElement("div");
      dlg.style.cssText = "width:400px;max-width:calc(100vw - 48px);background:#121E36;" +
        "border:1px solid rgba(148,178,224,.18);border-radius:14px;" +
        "box-shadow:0 24px 60px rgba(0,0,0,.55);padding:22px 24px;";
      dlg.innerHTML =
        '<div style="font-weight:700;font-size:15px;color:#E8F0FB;">处置告警</div>' +
        '<div style="font-size:12px;color:#8CA2C3;margin:4px 0 16px;">' +
        esc(rec.type) + " · " + esc(rec.area) + ' · <span class="mono">#' + rec.id + "</span></div>" +
        '<div style="font-size:12px;color:#8CA2C3;margin-bottom:6px;">处置结果 <span style="color:#FF5D5D;">*</span></div>' +
        '<div id="hdOpts" style="display:flex;gap:8px;margin-bottom:14px;"></div>' +
        '<div style="font-size:12px;color:#8CA2C3;margin-bottom:6px;">备注 <span style="opacity:.6;">（选填）</span></div>' +
        '<textarea id="hdRemark" rows="3" maxlength="200" placeholder="补充处置说明，将显示在告警处置记录中…" ' +
        'style="width:100%;box-sizing:border-box;padding:8px 12px;background:#0A1120;' +
        'border:1px solid rgba(148,178,224,.18);border-radius:8px;color:#E8F0FB;font-size:13px;' +
        'outline:none;resize:none;font-family:inherit;"></textarea>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">' +
        '<button type="button" class="btn btn-ghost btn-sm" id="hdCancel">取消</button>' +
        '<button type="button" class="btn btn-primary btn-sm" id="hdOk">确认处置</button></div>';
      ov.appendChild(dlg);
      document.body.appendChild(ov);

      var optsWrap = dlg.querySelector("#hdOpts");
      var keys = Object.keys(RESULT_META);
      var btns = keys.map(function (k) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("data-key", k);
        b.textContent = k;
        optsWrap.appendChild(b);
        return b;
      });
      function paint() {
        btns.forEach(function (b) {
          var m = RESULT_META[b.getAttribute("data-key")];
          var on = b.getAttribute("data-key") === chosen;
          b.style.cssText = "flex:1;height:36px;border-radius:8px;font-size:13px;cursor:pointer;" +
            "border:1px solid " + (on ? m.color : "rgba(148,178,224,.18)") + ";" +
            "background:" + (on ? hexA(m.color, 0.14) : "#0A1120") + ";" +
            "color:" + (on ? m.color : "#8CA2C3") + ";font-weight:" + (on ? "700" : "400") + ";";
        });
      }
      btns.forEach(function (b) {
        b.addEventListener("click", function () { chosen = b.getAttribute("data-key"); paint(); });
      });
      paint();

      function close() { ov.remove(); document.removeEventListener("keydown", onKey); }
      function onKey(e) { if (e.key === "Escape") close(); }
      document.addEventListener("keydown", onKey);
      ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
      dlg.querySelector("#hdCancel").addEventListener("click", close);
      dlg.querySelector("#hdOk").addEventListener("click", function () {
        var okBtn = this;
        okBtn.disabled = true;
        var remark = dlg.querySelector("#hdRemark").value.trim();
        /* 先上报后端状态（等它完成再跳转，避免导航中断请求）；失败不阻断本地流程 */
        fetch("/api/alarms/" + rec.id + "/handle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: chosen })
        }).then(function () { finish(); }, function (e) {
          console.warn("[data.js] 处置状态上报失败", e);
          finish();
        });
        function finish() {
          close();
          window.location.href = "handling.html";
        }
      });
      setTimeout(function () { dlg.querySelector("#hdRemark").focus(); }, 50);
    }

    /* "处置"按钮（事件委托）：弹出处置弹窗 */
    if (listEl) {
      listEl.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest(".handle-btn") : null;
        if (!btn) return;
        var rec = recCache[btn.getAttribute("data-id")];
        if (!rec) return;
        openHandleDialog(rec);
      });
    }

    function loadStats() {
      api("/alarms/stats").then(function (st) {
        var pend = st.pendingByLevel || [];
        var get = function (lv) { return pend.reduce(function (a, x) { return x.level === lv ? Number(x.cnt) : a; }, 0); };
        // pill 数量
        if (pillGroup) {
          var nums = pillGroup.querySelectorAll(".pill .num");
          if (nums.length === 4) {
            nums[0].textContent = st.pending || 0;      // 全部（待处置）
            nums[1].textContent = get("高");
            nums[2].textContent = get("中");
            nums[3].textContent = get("低");
          }
        }
        // 今日告警统计（中心 + 图例）
        var todayLv = st.todayByLevel || [];
        var tget = function (lv) { return todayLv.reduce(function (a, x) { return x.level === lv ? Number(x.cnt) : a; }, 0); };
        var todayTotal = todayLv.reduce(function (a, x) { return a + Number(x.cnt); }, 0);
        if (donutSvg) {
          donut(donutSvg, [
            { v: tget("高"), color: "#FF5D5D" },
            { v: tget("中"), color: "#FFC53D" },
            { v: tget("低"), color: "#2AD6FF" }
          ], todayTotal, "今日告警");
        }
        if (miniLegend) {
          var map = [["高", "#FF5D5D", "紧急"], ["中", "#FFC53D", "警告"], ["低", "#2AD6FF", "提示"]];
          var rows = miniLegend.querySelectorAll(".lg");
          rows.forEach(function (r, i) {
            if (i < 3 && r) {
              r.innerHTML = '<i style="background:' + map[i][1] + '"></i>' + map[i][2] +
                '<span class="mono">' + tget(map[i][0]) + "</span>";
            }
          });
        }
        // 更新于
        var now = new Date();
        if (updateEl) updateEl.innerHTML = "更新于 <span class='mono'>" +
          pad(now.getHours()) + ":" + pad(now.getMinutes()) + "</span>";
        // 最新紧急告警
        api("/alarms", { level: "高", status: "待处置", page: 1, size: 1 }).then(function (d) {
          var rec = d.records && d.records[0];
          if (lcCard && rec) {
            var r = norm(rec);
            if (lcTitle) lcTitle.innerHTML = typePill(r.type) +
              " <span style='color:var(--text)'>" + esc(r.area) + "</span>";
            if (lcMeta) {
              lcMeta.innerHTML = '<span class="mono">' + r.time + "</span>" +
                "<span>" + esc(r.source) + "</span>" +
                "<span>置信度 " + (r.conf != null
                  ? '<span class="mono">' + Math.round(r.conf * 100) + "%</span>"
                  : '<span class="mono">--</span>') + "</span>";
            }
            if (lcStatus) {
              lcStatus.className = "status-pill " + (STATUS_META[r.status] || "gray");
              lcStatus.textContent = r.status;
            }
          }
        }).catch(function () {});
      }).catch(function (e) { console.warn("[data.js] 告警统计加载失败", e); });
    }

    // pill 筛选绑定
    if (pillGroup) {
      var pills = pillGroup.querySelectorAll(".pill");
      pills.forEach(function (p, i) {
        p.addEventListener("click", function () {
          pills.forEach(function (q) { q.classList.remove("active"); });
          p.classList.add("active");
          curLevel = i === 0 ? "" : (i === 1 ? "高" : i === 2 ? "中" : "低");
          loadList();
        });
      });
    }

    loadList();
    loadStats();
    setInterval(function () { loadList(); loadStats(); }, 15000);
  }

  /* ============================================================
     页面 C：AI识别记录 records.html
     ============================================================ */
  function initRecords() {
    var typeCards = document.querySelectorAll(".type-card");
    var recList = document.querySelector(".rec-list");
    var pagerBtns = document.querySelector(".pager");
    var pageInfo = document.querySelector(".pager .page-info");
    var dateInputs = document.querySelectorAll('.date-range input[type="date"]');
    var sels = document.querySelectorAll(".select-box select");
    var typeSel = sels.length ? sels[0] : null;
    var levelSel = sels.length > 1 ? sels[1] : null;
    var queryBtn = document.querySelector(".btn-primary");
    var resetBtn = document.getElementById("resetFilter");
    if (!recList) return;

    var box = listBox(recList, "暂无识别记录", "请调整筛选条件后重试");
    var state = { page: 1, size: 10, type: "", level: "", from: "", to: "" };

    /* 真实类型 / 等级 选项（与 alarm 表枚举一致） */
    var typeDefs = ["人员闯入", "人员聚集", "烟火异常", "车辆异常", "动物进入", "物品异常"];
    if (typeSel) {
      typeSel.innerHTML = '<option value="">全部类型</option>' +
        typeDefs.map(function (t) { return '<option value="' + t + '">' + t + "</option>"; }).join("");
    }
    if (levelSel) {
      levelSel.innerHTML = '<option value="">全部等级</option>' +
        '<option value="高">紧急</option><option value="中">警告</option><option value="低">提示</option>';
      // 把"置信度"占位标签改为"告警等级"（不改布局，仅修正语义文字）
      var lab = levelSel.closest("label");
      if (lab) {
        lab.childNodes.forEach(function (n) {
          if (n.nodeType === 3 && n.textContent && n.textContent.trim()) n.nodeValue = "告警等级";
        });
      }
    }

    function tcardDefs() {
      return [
        { name: "人员闯入", c: "#FF5D5D" },
        { name: "人员聚集", c: "#8B7CFF" },
        { name: "烟火异常", c: "#FFC53D" },
        { name: "车辆异常", c: "#2AD6FF" },
        { name: "其他告警", c: "#9FB3D1" }
      ];
    }

    function loadCards() {
      api("/alarms/stats").then(function (st) {
        var byType = st.byType || [];
        var other = 0;
        byType.forEach(function (t) {
          if (["动物进入", "物品异常"].indexOf(t.type) >= 0) other += Number(t.cnt);
        });
        var defs = tcardDefs();
        typeCards.forEach(function (card, i) {
          if (i >= defs.length) return;
          var d = defs[i];
          var nm = card.querySelector(".tc-name");
          var num = card.querySelector(".tc-num");
          card.style.setProperty("--tc", d.c);
          if (nm) nm.textContent = d.name;
          if (num && num.childNodes[0]) {
            num.childNodes[0].nodeValue = i < 4 ? String(countOf(byType, d.name)) : String(other);
          }
        });
      }).catch(function (e) { console.warn("[data.js] 记录统计加载失败", e); });
    }

    function recRow(rec) {
      return '<div class="rec-item">' +
        '<div class="rec-main">' +
        '<div class="rec-line1">' + typePill(rec.type) +
        '<span class="rec-time">' + rec.time + "</span>" + statusPill(rec.status) + "</div>" +
        '<div class="rec-line2"><span>' + esc(rec.area) + "</span>" +
        "<span>" + esc(trunc(rec.detail, 110)) + "</span></div>" +
        "</div>" +
        '<div style="text-align:right">' + confBig(rec.conf) +
        '<div style="font-size:10px;color:var(--muted);margin-top:2px">' + esc(rec.source) + "</div></div>" +
        "</div>";
    }

    function renderPager(total) {
      if (!pagerBtns) return;
      var pages = Math.max(1, Math.ceil(total / state.size));
      if (state.page > pages) state.page = pages;
      var start = Math.max(1, state.page - 2), end = Math.min(pages, start + 4);
      start = Math.max(1, end - 4);
      var nums = "";
      for (var i = start; i <= end; i++) {
        nums += '<button class="pg' + (i === state.page ? " active" : "") + '" data-pg="' + i + '">' + i + "</button>";
      }
      pagerBtns.innerHTML = '<span class="page-info"></span>' +
        '<button class="pg" data-pg="prev"' + (state.page <= 1 ? " disabled" : "") + '>‹</button>' +
        nums +
        '<button class="pg" data-pg="next"' + (state.page >= pages ? " disabled" : "") + '>›</button>';
      var info2 = pagerBtns.querySelector(".page-info");
      if (info2) info2.innerHTML = "共 <span class='mono'>" + total + "</span> 条记录 · 第 <span class='mono'>" +
        state.page + "/" + pages + "</span> 页";
      pagerBtns.querySelectorAll("[data-pg]").forEach(function (b) {
        b.addEventListener("click", function () {
          var v = b.getAttribute("data-pg");
          if (b.disabled) return;
          if (v === "prev") state.page--;
          else if (v === "next") state.page++;
          else state.page = Number(v);
          loadRecords();
        });
      });
    }

    function loadRecords() {
      var params = { page: state.page, size: state.size, from: state.from, to: state.to };
      if (state.type) params.type = state.type;
      if (state.level) params.level = state.level;
      api("/alarms", params).then(function (d) {
        if (box) box.render((d.records || []).map(norm), recRow);
        renderPager(Number(d.total || 0));
      }).catch(function (e) { console.warn("[data.js] 记录列表加载失败", e); });
    }

    // 绑定筛选
    if (typeSel) typeSel.addEventListener("change", function () { state.type = this.value; state.page = 1; loadRecords(); });
    if (levelSel) levelSel.addEventListener("change", function () { state.level = this.value; state.page = 1; loadRecords(); });
    if (dateInputs.length === 2) {
      dateInputs[0].addEventListener("change", function () { state.from = this.value; });
      dateInputs[1].addEventListener("change", function () { state.to = this.value; });
    }
    if (queryBtn) queryBtn.addEventListener("click", function () { state.page = 1; loadRecords(); });
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        state = { page: 1, size: state.size, type: "", level: "", from: "", to: "" };
        if (typeSel) typeSel.value = "";
        if (levelSel) levelSel.value = "";
        dateInputs.forEach(function (d) { d.value = ""; });
        loadRecords();
        loadCards();
      });
    }

    loadCards();
    loadRecords();
  }

  /* ============================================================
     页面 D：告警处置记录 handling.html
     数据来源：告警中心"处置"按钮写入 localStorage 的处置记录
     ============================================================ */
  var HANDLE_NOTE = {
    "人员闯入": "已派安保赶赴现场，人员已劝离并登记",
    "人员聚集": "已现场疏导人群，秩序恢复正常",
    "烟火异常": "已通知安保现场核实并妥善处理，隐患消除",
    "车辆异常": "已联系相关人员挪车，车辆处置完毕",
    "动物进入": "已驱离闯入动物，区域恢复管控",
    "物品异常": "已核查遗留物品，确认为无主物并清理"
  };
  var LEVEL_COLOR = { "高": "#FF5D5D", "中": "#FFC53D", "低": "#2AD6FF" };

  /* 处置结果（复用 style.css 预置的 .result-badge.done/.ignored/.false） */
  var RESULT_META = {
    "已完成": { cls: "done",    color: "#3DDC97", icon: '<path d="M5 12.5l4.5 4.5L19 7.5"/>' },
    "已忽略": { cls: "ignored", color: "#8CA2C3", icon: '<path d="M5 12h14"/>' },
    "误报":   { cls: "false",   color: "#FFC53D", icon: '<path d="M6 6l12 12M18 6L6 18"/>' }
  };
  /* 无自定义备注时，按结果给默认处置说明（"已完成"沿用按类型的 HANDLE_NOTE） */
  var RESULT_NOTE = {
    "误报": "经人工核实为误报，已标记处理",
    "已忽略": "经确认无需处置，已按策略忽略"
  };

  function hItemHTML(r) {
    var m = lvMeta(r.level);
    var lc = LEVEL_COLOR[r.level] || "#2AD6FF";
    var rm = RESULT_META[r.result] || RESULT_META["已完成"];
    /* 备注优先：用户填写 > 按结果默认说明 > 按类型默认说明 */
    var note = r.remark || RESULT_NOTE[r.result] || HANDLE_NOTE[r.type] || "警情已核实并处置完毕";
    var evtT = shortDT(r.eventTime), hdlT = shortDT(r.handleTime);
    /* 超时判定：处置结果为"已完成"但用时超过 30 分钟 → 徽章改"超时完成"并标红 */
    var timeout = (r.result || "已完成") === "已完成" && (r.cost || 0) > 30;
    var badgeStyle = timeout ? ' style="color:var(--red);background:var(--red-dim);"' : "";
    var badgeText = timeout ? "超时完成" : (r.result || "已完成");
    var defs = [["告警产生", evtT], ["推送值守", evtT], ["人工处置", hdlT], ["完成归档", hdlT]];
    var stepsHTML = "";
    defs.forEach(function (s, i) {
      if (i) stepsHTML += '<div class="step-line done"></div>';
      stepsHTML += '<div class="step done"><div class="dot">' + (i + 1) + '</div>' +
        '<div><span class="s-label">' + esc(s[0]) + '</span><span class="s-time">' + esc(s[1]) + "</span></div></div>";
    });
    return '<div class="h-item" data-id="' + r.alarmId + '">' +
      '<div class="h-summary">' +
      /* 批量导出勾选框：默认隐藏，进入选择模式后由页面级 CSS 显示 */
      '<input type="checkbox" class="h-check" data-id="' + r.alarmId + '">' +
      '<span class="h-name">' + typePill(r.type) + " " + esc(r.area) + "</span>" +
      '<div class="h-meta"><span class="mono">#' + r.alarmId + "</span>" +
      "<span>告警于 <span class=\"mono\">" + esc(r.eventTime) + "</span></span>" +
      '<span style="color:' + lc + '">' + m.label + "级</span></div>" +
      '<span class="sp"></span>' +
      '<span class="result-badge ' + rm.cls + '"' + badgeStyle + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + rm.icon + "</svg>" + esc(badgeText) + "</span>" +
      "</div>" +
      '<div class="h-track"><div class="h-track-top"><div class="steps">' + stepsHTML + "</div></div>" +
      '<div class="h-track-info">' +
      '<div class="h-user"><div class="avatar">' + esc((r.handleBy || "用").charAt(0)) + '</div><span class="u-name">' + esc(r.handleBy || "系统") + '</span></div>' +
      '<span class="h-cost"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>' + r.cost + " 分钟</span>" +
      '<span class="h-note">' + esc(note) + "</span>" +
      "</div></div></div>";
  }

  /* 超时处置标准：处置用时超过 30 分钟 */
  var HANDLE_TIMEOUT_MIN = 30;

  function initHandling() {
    var listEl = document.querySelector(".handle-list");
    if (!listEl) return;
    var fromEl = document.getElementById("handDateFrom");
    var toEl = document.getElementById("handDateTo");
    var searchEl = document.getElementById("handSearch");
    var pillsWrap = document.getElementById("handPills");

    var activePill = "全部";  /* 当前结果胶囊 */
    var keyword = "";         /* 当前搜索关键字 */
    var lastFiltered = [];    /* 最近一次渲染的记录（批量导出"全选"以此为准） */
    var handledList = [];     /* 后端拉取的已处置记录（替代原 localStorage 数据源） */

    /* 列表渲染：按 胶囊结果 + 日期范围 + 关键字 过滤（KPI 始终按全量计算） */
    function apply() {
      var list = handledList;
      var from = fromEl ? fromEl.value : "";
      var to = toEl ? toEl.value : "";
      var kw = keyword.trim().toLowerCase();
      var filtered = list.filter(function (r) {
        var result = r.result || "已完成";
        if (activePill !== "全部" && result !== activePill) return false;
        var d = String(r.handleTime || "").slice(0, 10);
        if (from && d && d < from) return false;
        if (to && d && d > to) return false;
        if (kw) {
          var hay = [r.type, r.area, r.detail, r.remark, "#" + r.alarmId, String(r.alarmId), result]
            .join(" ").toLowerCase();
          if (hay.indexOf(kw) === -1) return false;
        }
        return true;
      });
      lastFiltered = filtered;
      var countEl = document.getElementById("handPagerTotal");
      if (countEl) countEl.textContent = filtered.length;
      if (!filtered.length) {
        listEl.innerHTML =
          '<div class="empty-state" style="min-height:280px;">' +
          '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
          '<span class="es-title">' + (list.length ? "未找到匹配的处置记录" : "暂无处置记录") + "</span>" +
          '<span class="es-sub">' + (list.length ? "调整筛选条件或关键字后重试" : "在实时告警中心点击「处置」按钮，将在此生成记录") + "</span></div>";
        return;
      }
      listEl.innerHTML = filtered.map(hItemHTML).join("");
      if (exportMode) restoreChecks();   /* 筛选变化重建 DOM 后不丢勾选 */
    }

    /* KPI 与列表均由 loadHandled() 拉取后端数据后填充 */

    if (fromEl) fromEl.addEventListener("change", apply);
    if (toEl) toEl.addEventListener("change", apply);
    if (searchEl) searchEl.addEventListener("input", function () { keyword = this.value; apply(); });
    if (pillsWrap) {
      pillsWrap.querySelectorAll(".pill").forEach(function (p) {
        p.addEventListener("click", function () {
          pillsWrap.querySelectorAll(".pill").forEach(function (x) { x.classList.remove("active"); });
          p.classList.add("active");
          activePill = p.textContent.trim();
          apply();
        });
      });
    }

    /* ---------- 批量导出：点"导出记录"进入勾选模式，确认后下载 .dat ---------- */
    var btnExport = document.getElementById("btnHandExport");
    var btnCheckAll = document.getElementById("btnHandCheckAll");
    var btnCancelExp = document.getElementById("btnHandCancelExport");
    var btnConfirmExp = document.getElementById("btnHandConfirmExport");

    var exportMode = false;   /* 是否处于勾选导出模式 */
    var selectedIds = [];     /* 已勾选的告警编号集合 */

    /* 当前列表是否已全部勾选（决定"全选/全不选"文案） */
    function allChecked() {
      return lastFiltered.length > 0 && lastFiltered.every(function (r) {
        return selectedIds.indexOf(r.alarmId) !== -1;
      });
    }

    /* apply() 重建 DOM 后，按 selectedIds 恢复各行勾选状态 */
    function restoreChecks() {
      listEl.querySelectorAll(".h-check").forEach(function (c) {
        c.checked = selectedIds.indexOf(Number(c.getAttribute("data-id"))) !== -1;
      });
    }

    function syncExportBtns() {
      if (!btnConfirmExp) return;
      btnConfirmExp.disabled = (selectedIds.length === 0);
      btnConfirmExp.style.opacity = (selectedIds.length === 0) ? ".45" : "";
      if (btnCheckAll) btnCheckAll.textContent = allChecked() ? "全不选" : "全选";
    }

    function enterExportMode() {
      if (!handledList.length) { alert("当前没有可导出的处置记录"); return; }
      exportMode = true;
      listEl.classList.add("select-mode");
      if (btnExport) btnExport.style.display = "none";
      if (btnCheckAll) btnCheckAll.style.display = "";
      if (btnCancelExp) btnCancelExp.style.display = "";
      if (btnConfirmExp) btnConfirmExp.style.display = "";
      selectedIds = lastFiltered.map(function (r) { return r.alarmId; }); /* 默认勾选当前筛选结果 */
      restoreChecks();
      syncExportBtns();
    }

    function exitExportMode() {
      exportMode = false;
      listEl.classList.remove("select-mode");
      if (btnExport) btnExport.style.display = "";
      if (btnCheckAll) btnCheckAll.style.display = "none";
      if (btnCancelExp) btnCancelExp.style.display = "none";
      if (btnConfirmExp) btnConfirmExp.style.display = "none";
      selectedIds = [];
    }

    /* 导出行格式：异常类型 - 地点 - 告警时间 - 告警级别 - #告警编号 - 处置结果 - 处置时间 - 处置用时 */
    function exportLine(r) {
      return [
        r.type || "未知异常",
        r.area || "--",
        r.eventTime || "--",
        lvMeta(r.level).label + "级",
        "#" + r.alarmId,
        r.result || "已完成",
        r.handleTime || "--",
        (r.cost || 0) + "分钟"
      ].join(" - ");
    }

    function doExport() {
      var recs = handledList.filter(function (r) {
        return selectedIds.indexOf(r.alarmId) !== -1;
      });
      if (!recs.length) { alert("请先勾选要导出的处置记录"); return; }
      var blob = new Blob(["\ufeff" + recs.map(exportLine).join("\r\n")],
        { type: "application/octet-stream" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "处置记录.dat";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
      exitExportMode();
    }

    if (btnExport) btnExport.addEventListener("click", enterExportMode);
    if (btnCancelExp) btnCancelExp.addEventListener("click", exitExportMode);
    if (btnConfirmExp) btnConfirmExp.addEventListener("click", doExport);
    if (btnCheckAll) btnCheckAll.addEventListener("click", function () {
      selectedIds = allChecked() ? [] : lastFiltered.map(function (r) { return r.alarmId; });
      restoreChecks();
      syncExportBtns();
    });
    /* 行勾选变化：事件委托（apply() 重建 DOM 后依然生效） */
    listEl.addEventListener("change", function (e) {
      if (!exportMode || !e.target || !e.target.classList.contains("h-check")) return;
      var id = Number(e.target.getAttribute("data-id"));
      var idx = selectedIds.indexOf(id);
      if (e.target.checked && idx === -1) selectedIds.push(id);
      if (!e.target.checked && idx !== -1) selectedIds.splice(idx, 1);
      syncExportBtns();
    });

    /* 处置记录数据源：后端 /api/alarms/handled（替代原 localStorage） */
    function parseDT(iso) {
      if (!iso) return null;
      var s = String(iso).replace("T", " ").split(".")[0].replace(/-/g, "/");
      var d = new Date(s);
      return isNaN(d) ? null : d;
    }
    function fmtS(iso) {
      if (!iso) return "--";
      var s = String(iso).replace("T", " ");
      return s.length >= 19 ? s.slice(0, 19) : s;
    }
    function loadHandled() {
      api("/alarms/handled", { page: 1, size: 200 }).then(function (d) {
        handledList = (d.records || []).map(function (a) {
          var evt = parseDT(a.eventTime);
          var hdl = parseDT(a.handleTime);
          var cost = 1;
          if (evt && hdl) cost = Math.max(1, Math.round((hdl - evt) / 60000));
          return {
            alarmId: a.id, type: a.type, area: a.area, level: a.level,
            source: a.source, detail: a.detail,
            eventTime: fmtS(a.eventTime), handleTime: fmtS(a.handleTime),
            cost: cost, result: a.status || "已完成", remark: "",
            handleBy: a.handleBy || "系统"
          };
        });
        renderHandlingKpi(handledList);
        apply();
      }).catch(function (e) { console.warn("[data.js] 处置记录加载失败", e); });
    }
    loadHandled();
  }

  /* 处置 KPI：今日处置/平均响应、待复核(误报待复核)、误报率、超时处置 */
  function renderHandlingKpi(list) {
    var now = new Date();
    var today = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
    var todayList = list.filter(function (r) { return String(r.handleTime || "").slice(0, 10) === today; });
    var avg = todayList.length
      ? Math.round(todayList.reduce(function (s, r) { return s + (r.cost || 0); }, 0) / todayList.length)
      : 0;
    var falseCnt = list.filter(function (r) { return r.result === "误报"; }).length;
    var rate = list.length ? Math.round(falseCnt * 1000 / list.length) / 10 : 0; /* 保留一位小数 */
    var timeoutCnt = list.filter(function (r) {
      return (r.result || "已完成") === "已完成" && (r.cost || 0) > HANDLE_TIMEOUT_MIN;
    }).length;
    setKpi("kpiToday", todayList.length);
    setKpi("kpiAvgCost", avg);
    setKpi("kpiReview", falseCnt);
    setKpi("kpiFalseRate", rate);
    setKpi("kpiFalseCnt", falseCnt);
    setKpi("kpiTotalCnt", list.length);
    setKpi("kpiTimeout", timeoutCnt);
  }

  function setKpi(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    initDashboard();
    initAlarms();
    initRecords();
    initHandling();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
