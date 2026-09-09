package com.xja.ncut.monitor.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 检测图片访问接口。
 *
 * <p>模型服务把识别后的图片存到 {@code <MODEL_ROOT>/ai-watch/已检测} 目录，
 * 本接口按文件名将其暴露为 HTTP 图片，供告警中心等页面展示：
 * {@code GET /alarm-img/{图片文件名}}。目录可用环境变量 MODEL_ROOT 覆盖（与模型服务约定一致）。
 */
@RestController
public class AlarmImageController {

    /** 检测完成图片目录（与 server.py 的 DONE_DIR 保持一致）。 */
    private static final Path DONE_DIR = Paths.get(
            System.getenv().getOrDefault("MODEL_ROOT", "C:" + File.separator + "model"),
            "ai-watch", "已检测");

    @GetMapping(value = "/alarm-img/{name}")
    public ResponseEntity<byte[]> image(@PathVariable String name) {
        if (name == null || name.isBlank()
                || name.contains("..") || name.contains("/") || name.contains("\\")
                || name.indexOf('\0') >= 0) {
            return ResponseEntity.badRequest().build();
        }
        Path target = DONE_DIR.resolve(name).normalize();
        if (!target.startsWith(DONE_DIR) || !Files.isRegularFile(target)) {
            return ResponseEntity.notFound().build();
        }
        try {
            byte[] bytes = Files.readAllBytes(target);
            String lower = name.toLowerCase();
            MediaType mediaType;
            if (lower.endsWith(".png")) {
                mediaType = MediaType.IMAGE_PNG;
            } else if (lower.endsWith(".gif")) {
                mediaType = MediaType.IMAGE_GIF;
            } else if (lower.endsWith(".webp")) {
                mediaType = MediaType.parseMediaType("image/webp");
            } else {
                mediaType = MediaType.IMAGE_JPEG;
            }
            return ResponseEntity.ok().contentType(mediaType).body(bytes);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
