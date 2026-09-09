/* ============================================================
   智瞳 · AI智能安防监控系统 — 公共脚本
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 顶栏系统时间（JetBrains Mono） ---------- */
  function pad(n) { return String(n).padStart(2, "0"); }

  function tick() {
    var el = document.getElementById("sysTime");
    if (!el) return;
    var now = new Date();
    var week = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
    el.textContent =
      pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
    var d = document.getElementById("sysDate");
    if (d) {
      d.textContent =
        now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
        " 星期" + week;
    }
  }

  tick();
  setInterval(tick, 1000);

  /* ---------- 筛选胶囊切换 ---------- */
  document.querySelectorAll(".pill-group").forEach(function (group) {
    group.querySelectorAll(".pill").forEach(function (pill) {
      pill.addEventListener("click", function () {
        group.querySelectorAll(".pill").forEach(function (p) { p.classList.remove("active"); });
        pill.classList.add("active");
      });
    });
  });

  /* ---------- 表格行筛选（设备状态等，data-filter） ---------- */
  document.querySelectorAll("[data-filter-table]").forEach(function (pill) {
    pill.addEventListener("click", function () {
      var val = pill.getAttribute("data-filter-table");
      var table = document.querySelector(pill.getAttribute("data-filter-table"));
      if (!table) return;
      table.querySelectorAll("tbody tr").forEach(function (tr) {
        var st = tr.getAttribute("data-status") || "";
        tr.style.display = (val === "all" || st === val) ? "" : "none";
      });
    });
  });

  /* ---------- 声音开关 ---------- */
  var snd = document.getElementById("soundToggle");
  if (snd) {
    snd.addEventListener("click", function () {
      snd.classList.toggle("on");
    });
  }

  /* ---------- 当前登录用户：更新顶栏头像/用户名，未登录跳登录页 ---------- */
  function initAuth() {
    fetch("/api/auth/me", { headers: { "Accept": "application/json" } })
      .then(function (r) {
        if (r.status === 401) { window.location.replace("login.html"); throw new Error("unauthorized"); }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        var u = d.user || {};
        // 优先显示“当前登录的用户名”（username），昵称仅作为备选
        var name = u.username || u.nickname || "";
        var roleText = u.role === "ADMIN" ? "管理员" : "普通用户";
        var avatar = document.querySelector(".avatar-chip .avatar");
        var who = document.querySelector(".avatar-chip .who");
        if (avatar) avatar.textContent = (name || "用").charAt(0);
        if (who) {
          var roleEl = who.querySelector(".role");
          // 保留 role(<span class="role">) 节点，替换其文字，昵称/用户名填到其前面
          if (roleEl) {
            roleEl.textContent = roleText;
            var firstText = who.childNodes[0];
            if (firstText && firstText.nodeType === 3) firstText.nodeValue = name || "";
            else who.insertBefore(document.createTextNode(name || ""), roleEl);
          } else {
            who.textContent = name;
          }
        }
      })
      .catch(function (e) { if (e.message !== "unauthorized") console.warn("[common] 获取当前用户失败", e); });
  }
  initAuth();
})();
