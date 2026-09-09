package com.xja.ncut.monitor.controller;

import com.xja.ncut.monitor.dto.AiEventRequest;
import com.xja.ncut.monitor.entity.Alarm;
import com.xja.ncut.monitor.service.AiEventService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * AI 识别事件接收接口。模型服务（server.py）识别完成后 POST 到 /api/ai/event。
 */
@RestController
@RequestMapping("/api/ai")
public class AiEventController {

    private final AiEventService aiEventService;

    public AiEventController(AiEventService aiEventService) {
        this.aiEventService = aiEventService;
    }

    @PostMapping("/event")
    public Map<String, Object> receive(@RequestBody AiEventRequest request) {
        List<Alarm> created = aiEventService.handle(request);
        Map<String, Object> resp = new LinkedHashMap<>();
        if (created.isEmpty()) {
            resp.put("status", "ok");
            resp.put("alarmCount", 0);
            resp.put("message", "未识别到后端关注的类别，跳过");
            return resp;
        }
        resp.put("status", "ok");
        resp.put("alarmCount", created.size());
        resp.put("alarms", created.stream().map(Alarm::getId).toList());
        return resp;
    }
}
