package com.xja.ncut.monitor.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.xja.ncut.monitor.entity.Alarm;
import com.xja.ncut.monitor.entity.User;
import com.xja.ncut.monitor.mapper.AlarmMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 告警查询接口（供页面后续接入）。
 */
@RestController
@RequestMapping("/api/alarms")
public class AlarmQueryController {

    private final AlarmMapper alarmMapper;

    public AlarmQueryController(AlarmMapper alarmMapper) {
        this.alarmMapper = alarmMapper;
    }

    /** 分页查询告警，可按类型/级别/状态/时间段过滤，按时间倒序。 */
    @GetMapping
    public Map<String, Object> list(@RequestParam(required = false) String type,
                                    @RequestParam(required = false) String level,
                                    @RequestParam(required = false) String status,
                                    @RequestParam(required = false) String from,
                                    @RequestParam(required = false) String to,
                                    @RequestParam(defaultValue = "1") long page,
                                    @RequestParam(defaultValue = "20") long size) {
        LambdaQueryWrapper<Alarm> qw = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(type)) {
            qw.eq(Alarm::getType, type);
        }
        if (StringUtils.hasText(level)) {
            qw.eq(Alarm::getLevel, level);
        }
        if (StringUtils.hasText(status)) {
            qw.eq(Alarm::getStatus, status);
        }
        // 时间段过滤：from/to 为 yyyy-MM-dd（含当天）
        if (StringUtils.hasText(from)) {
            qw.ge(Alarm::getEventTime, LocalDate.parse(from).atStartOfDay());
        }
        if (StringUtils.hasText(to)) {
            qw.le(Alarm::getEventTime, LocalDate.parse(to).plusDays(1).atStartOfDay().minusNanos(1));
        }
        qw.orderByDesc(Alarm::getEventTime).orderByDesc(Alarm::getId);

        Page<Alarm> result = alarmMapper.selectPage(new Page<>(page, size), qw);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("total", result.getTotal());
        resp.put("page", page);
        resp.put("size", size);
        resp.put("records", result.getRecords());
        return resp;
    }

    /** 告警统计：今日新增、各级别待处置数、按类型分布。 */
    @GetMapping("/stats")
    public Map<String, Object> stats() {
        LocalDateTime startOfToday = LocalDateTime.now().toLocalDate().atStartOfDay();
        long today = alarmMapper.selectCount(new LambdaQueryWrapper<Alarm>()
                .ge(Alarm::getEventTime, startOfToday));
        long pending = alarmMapper.selectCount(new LambdaQueryWrapper<Alarm>()
                .eq(Alarm::getStatus, "待处置"));

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("today", today);
        resp.put("pending", pending);
        resp.put("total", alarmMapper.selectCount(null));

        // 按类型分组统计：全部 / 今日
        List<Map<String, Object>> byType = alarmMapper.selectMaps(
                new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<Alarm>()
                        .select("type AS type, COUNT(*) AS cnt")
                        .groupBy("type"));
        resp.put("byType", byType);

        List<Map<String, Object>> todayByType = alarmMapper.selectMaps(
                new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<Alarm>()
                        .select("type AS type, COUNT(*) AS cnt")
                        .ge("event_time", LocalDate.now().atStartOfDay())
                        .groupBy("type"));
        resp.put("todayByType", todayByType);

        // 按级别分组统计：全部 / 今日 / 待处置
        resp.put("byLevel", levelGroup(false, false));
        resp.put("todayByLevel", levelGroup(true, false));
        resp.put("pendingByLevel", levelGroup(false, true));
        return resp;
    }

    /** 近 N 天每日告警数（含今天），供趋势图使用。 */
    @GetMapping("/trend")
    public Map<String, Object> trend(@RequestParam(defaultValue = "7") int days) {
        int n = Math.min(Math.max(days, 1), 90);
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = n - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            LocalDateTime start = day.atStartOfDay();
            LocalDateTime end = day.plusDays(1).atStartOfDay().minusNanos(1);
            long cnt = alarmMapper.selectCount(new LambdaQueryWrapper<Alarm>()
                    .ge(Alarm::getEventTime, start)
                    .le(Alarm::getEventTime, end));
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", day.format(DateTimeFormatter.ISO_LOCAL_DATE));
            m.put("label", day.format(DateTimeFormatter.ofPattern("MM-dd")));
            m.put("count", cnt);
            items.add(m);
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("days", n);
        resp.put("items", items);
        return resp;
    }

    /** 处置告警：把状态更新为 已完成 / 已忽略 / 误报，并记录处置人（当前登录用户）与处置时间。 */
    @PostMapping("/{id}/handle")
    public Map<String, Object> handle(@PathVariable("id") Long id,
                                      @RequestBody(required = false) Map<String, String> body,
                                      HttpServletRequest request) {
        String status = body == null ? null : body.get("status");
        Map<String, Object> resp = new LinkedHashMap<>();
        if (!"已完成".equals(status) && !"已忽略".equals(status) && !"误报".equals(status)) {
            resp.put("ok", false);
            resp.put("msg", "处置结果必须是 已完成 / 已忽略 / 误报");
            return resp;
        }
        Alarm alarm = alarmMapper.selectById(id);
        if (alarm == null) {
            resp.put("ok", false);
            resp.put("msg", "告警不存在: " + id);
            return resp;
        }
        alarm.setStatus(status);
        // 记录处置人（当前登录用户）与处置时间
        HttpSession session = request.getSession(false);
        User user = session == null ? null : (User) session.getAttribute(AuthController.SESSION_USER);
        if (user != null) {
            alarm.setHandleBy(user.getUsername());
            alarm.setHandleTime(LocalDateTime.now());
        }
        alarmMapper.updateById(alarm);
        resp.put("ok", true);
        resp.put("id", id);
        resp.put("status", status);
        resp.put("handleBy", alarm.getHandleBy());
        return resp;
    }

    /** 已处置告警记录（状态为 已完成/已忽略/误报），供告警处置记录页使用；按处置时间倒序。 */
    @GetMapping("/handled")
    public Map<String, Object> handled(@RequestParam(defaultValue = "1") long page,
                                       @RequestParam(defaultValue = "100") long size) {
        LambdaQueryWrapper<Alarm> qw = new LambdaQueryWrapper<>();
        qw.in(Alarm::getStatus, "已完成", "已忽略", "误报")
                .orderByDesc(Alarm::getHandleTime)
                .orderByDesc(Alarm::getId);
        Page<Alarm> result = alarmMapper.selectPage(new Page<>(page, size), qw);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("total", result.getTotal());
        resp.put("page", page);
        resp.put("size", size);
        resp.put("records", result.getRecords());
        return resp;
    }

    /** 按级别分组统计告警数，可叠加"仅今日 / 仅待处置"条件。 */
    private List<Map<String, Object>> levelGroup(boolean todayOnly, boolean pendingOnly) {
        com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<Alarm> qw =
                new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<>();
        qw.select("level AS level, COUNT(*) AS cnt").groupBy("level");
        if (todayOnly) {
            qw.ge("event_time", LocalDate.now().atStartOfDay());
        }
        if (pendingOnly) {
            qw.eq("status", "待处置");
        }
        return alarmMapper.selectMaps(qw);
    }
}
