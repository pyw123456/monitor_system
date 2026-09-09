package com.xja.ncut.monitor.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 设备模块控制器。
 *
 * 数据源约定：本类中 DEVICE_LIST 是"设备列表"的唯一权威数据源，
 * 与 devices.html 静态表格内容一一对应；监控大屏的"接入设备 / 设备在线率"
 * KPI 由 /api/devices/stats 直接基于该列表计算，从而与设备列表始终一致。
 *
 * 不再依赖 device 表的 DB 数据——避免 DB 行数与静态设备列表不一致时，
 * 监控大屏 KPI 与设备列表页脱节。
 */
@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    /** 与 devices.html 表格一一对应的内存设备列表（权威数据源）。 */
    private static final List<Map<String, Object>> DEVICE_LIST = new ArrayList<>(Arrays.asList(
            item("01", "A区西门摄像头",    "摄像头", "A区西门",     "正常"),
            item("02", "教学楼南侧摄像头", "摄像头", "教学楼南侧", "正常"),
            item("03", "校园道路摄像头",   "摄像头", "校园道路",   "正常"),
            item("04", "宿舍区摄像头",     "摄像头", "宿舍区",     "正常"),
            item("05", "操场入口摄像头",   "摄像头", "操场入口",   "正常"),
            item("06", "图书馆门口摄像头", "摄像头", "图书馆门口", "正常"),
            item("07", "停车场摄像头",     "摄像头", "停车场",     "正常"),
            item("08", "仓库外侧摄像头",   "摄像头", "仓库外侧",   "正常"),
            item("09", "实验楼后侧摄像头", "摄像头", "实验楼后侧", "正常"),
            item("10", "校园广场摄像头",   "摄像头", "校园广场",   "正常")
    ));

    private static Map<String, Object> item(String no, String name, String type, String area, String status) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("no", no);
        m.put("name", name);
        m.put("type", type);
        m.put("area", area);
        m.put("ip", "----");
        m.put("status", status);
        return m;
    }

    /** 视为"非在线"的状态集合：只要不在此集合中一律视为在线（正常/在线/空 都算在线）。 */
    private static final java.util.Set<String> OFFLINE_STATUS = java.util.Set.of(
            "离线", "故障", "异常", "停用", "离线中",
            "OFFLINE", "FAULT", "ERROR", "DOWN", "0", "false");

    /** 判断设备是否在线：状态为"离线/故障/异常/停用/…"才判定离线，其余均视为在线。 */
    private static boolean isOnline(Map<String, Object> d) {
        Object v = d.get("status");
        String s = v == null ? "" : String.valueOf(v).trim();
        if (s.isEmpty()) return true;
        return !OFFLINE_STATUS.contains(s);
    }

    /**
     * 设备列表接口（权威数据源）：返回与 devices.html 一致的设备列表；
     * 前端可拉取后自行渲染（保持与监控大屏 KPI 来源一致）。
     */
    @GetMapping("/list")
    public List<Map<String, Object>> list() {
        return DEVICE_LIST;
    }

    /**
     * 设备在线情况统计。
     * 直接基于 DEVICE_LIST 计算，监控大屏接入设备 / 设备在线率 与设备列表始终一致。
     * 返回：total / online / offline / onlineRate（百分比，0-100 整数）。
     */
    @GetMapping("/stats")
    public Map<String, Object> stats() {
        long total = DEVICE_LIST.size();
        long online = DEVICE_LIST.stream().filter(DeviceController::isOnline).count();
        long offline = total - online;
        long rate = total == 0 ? 0L : Math.round(online * 100.0 / total);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("total", total);
        resp.put("online", online);
        resp.put("offline", offline);
        resp.put("onlineRate", rate);
        return resp;
    }
}