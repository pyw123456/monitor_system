package com.xja.ncut.monitor.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.xja.ncut.monitor.dto.AiEventRequest;
import com.xja.ncut.monitor.dto.AiObject;
import com.xja.ncut.monitor.entity.Alarm;
import com.xja.ncut.monitor.mapper.AlarmMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 接收 AI 模型识别结果并转换成业务告警。
 *
 * <p>模型只输出 person / car / fire 等类别，本服务统计后按平台场景规则判定：
 * <pre>
 *   1 个 person            -> 人员闯入
 *   2 个及以上 person      -> 人员聚集
 *   car / truck / bus 等   -> 车辆异常
 *   dog / cat 等           -> 动物进入
 *   backpack / suitcase 等 -> 物品异常
 *   fire 或 smoke          -> 烟火异常
 * </pre>
 */
@Service
public class AiEventService {

    private final AlarmMapper alarmMapper;

    public AiEventService(AlarmMapper alarmMapper) {
        this.alarmMapper = alarmMapper;
    }

    private static final String SOURCE = "AI视觉分析";

    /** 车辆类 */
    private static final List<String> VEHICLES = List.of("car", "truck", "bus", "motorcycle");
    /** 动物类 */
    private static final List<String> ANIMALS = List.of("dog", "cat");
    /** 物品异常类 */
    private static final List<String> LUGGAGE = List.of("backpack", "suitcase");
    /** 烟火类（类别名统一按小写比较） */
    private static final List<String> FIRE = List.of("fire", "smoke");

    /**
     * 处理一次识别事件。
     *
     * @return 已落库的告警列表；若无后端关注的类别则返回空列表（服务端跳过）。
     */
    public List<Alarm> handle(AiEventRequest request) {
        List<Alarm> alarms = new ArrayList<>();
        List<AiObject> objects = request.getObjects() == null ? List.of() : request.getObjects();
        if (objects.isEmpty()) {
            return alarms;
        }

        String area = parseArea(request.getImage());
        String imageName = request.getImage() == null ? "" : request.getImage();

        Map<String, List<AiObject>> matched = new LinkedHashMap<>();

        // 1. person：统计人数决定闯入/聚集
        List<AiObject> persons = filterByClass(objects, "person");
        if (persons.size() == 1) {
            matched.put("人员闯入", persons);
        } else if (persons.size() >= 2) {
            matched.put("人员聚集", persons);
        }

        // 2. 车辆 / 动物 / 物品
        List<AiObject> vehicles = filterByClasses(objects, VEHICLES);
        if (!vehicles.isEmpty()) {
            matched.put("车辆异常", vehicles);
        }
        List<AiObject> animals = filterByClasses(objects, ANIMALS);
        if (!animals.isEmpty()) {
            matched.put("动物进入", animals);
        }
        List<AiObject> luggage = filterByClasses(objects, LUGGAGE);
        if (!luggage.isEmpty()) {
            matched.put("物品异常", luggage);
        }

        // 3. 烟火
        List<AiObject> fire = filterByClasses(objects, FIRE);
        if (!fire.isEmpty()) {
            matched.put("烟火异常", fire);
        }

        for (Map.Entry<String, List<AiObject>> entry : matched.entrySet()) {
            String scene = entry.getKey();
            Alarm alarm = new Alarm();
            alarm.setType(scene);
            alarm.setArea(area);
            alarm.setLevel(levelFor(scene));
            alarm.setStatus("待处置");
            alarm.setSource(SOURCE);
            alarm.setDetail(buildDetail(scene, entry.getValue(), imageName));
            alarm.setImage(imageName == null || imageName.isBlank() ? null : imageName);
            alarm.setEventTime(LocalDateTime.now());
            alarmMapper.insert(alarm);
            alarms.add(alarm);
        }
        return alarms;
    }

    private List<AiObject> filterByClass(List<AiObject> objects, String className) {
        return filterByClasses(objects, List.of(className));
    }

    private List<AiObject> filterByClasses(List<AiObject> objects, List<String> classes) {
        List<AiObject> hits = new ArrayList<>();
        for (AiObject obj : objects) {
            String name = obj.getCls();
            if (name != null && classes.contains(name.trim().toLowerCase())) {
                hits.add(obj);
            }
        }
        return hits;
    }

    /** 从图片文件名解析区域，例如 "01_A区西门_单人闯入.png" -> "A区西门"。 */
    private String parseArea(String imageName) {
        if (imageName == null || imageName.isBlank()) {
            return "未知区域";
        }
        // 去掉扩展名后按 "_" 拆分
        String base = imageName.contains(".")
                ? imageName.substring(0, imageName.lastIndexOf('.'))
                : imageName;
        String[] parts = base.split("_");
        if (parts.length >= 2 && !parts[1].isBlank()) {
            return parts[1].trim();
        }
        return "未知区域";
    }

    private String levelFor(String scene) {
        return switch (scene) {
            case "人员闯入", "车辆异常", "烟火异常" -> "高";
            default -> "中";
        };
    }

    private String buildDetail(String scene, List<AiObject> hits, String imageName) {
        StringBuilder sb = new StringBuilder();
        for (AiObject obj : hits) {
            if (sb.length() > 0) {
                sb.append("、");
            }
            sb.append(obj.getCls());
            if (obj.getConf() != null) {
                sb.append(String.format("(%.2f)", obj.getConf()));
            }
        }
        String summary = sb.toString();
        return switch (scene) {
            case "人员闯入" -> "识别到 1 个 person，判定为人员闯入";
            case "人员聚集" -> "识别到 " + hits.size() + " 个 person，判定为人员聚集";
            case "车辆异常" -> "检测到车辆异常：" + summary;
            case "动物进入" -> "检测到动物进入：" + summary;
            case "物品异常" -> "检测到遗留物品异常：" + summary;
            case "烟火异常" -> "检测到疑似烟火异常：" + summary;
            default -> summary;
        };
    }

    public long countToday() {
        LocalDateTime start = LocalDateTime.now().toLocalDate().atStartOfDay();
        return alarmMapper.selectCount(new LambdaQueryWrapper<Alarm>()
                .ge(Alarm::getEventTime, start));
    }
}
