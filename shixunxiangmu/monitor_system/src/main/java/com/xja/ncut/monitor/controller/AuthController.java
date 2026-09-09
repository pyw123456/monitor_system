package com.xja.ncut.monitor.controller;

import com.xja.ncut.monitor.entity.User;
import com.xja.ncut.monitor.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 认证接口：注册 / 登录 / 登出 / 当前登录用户。
 * 登录态保存在 HttpSession（Session 名 loginUser，值为登录用户对象）。
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    /** Session 中保存已登录用户的属性名。 */
    public static final String SESSION_USER = "loginUser";

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    /** 注册并自动登录。 */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, String> body,
                                                        HttpServletRequest request) {
        Map<String, Object> resp = new LinkedHashMap<>();
        try {
            String username = body.get("username");
            String password = body.get("password");
            String nickname = body.get("nickname");
            User user = userService.register(username, password, nickname);
            request.getSession(true).setAttribute(SESSION_USER, user);
            resp.put("ok", true);
            resp.put("user", safeUser(user));
            return ResponseEntity.ok(resp);
        } catch (IllegalArgumentException ex) {
            resp.put("ok", false);
            resp.put("msg", ex.getMessage());
            return ResponseEntity.badRequest().body(resp);
        }
    }

    /** 登录。 */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> body,
                                                     HttpServletRequest request) {
        Map<String, Object> resp = new LinkedHashMap<>();
        try {
            User user = userService.login(body.get("username"), body.get("password"));
            request.getSession(true).setAttribute(SESSION_USER, user);
            resp.put("ok", true);
            resp.put("user", safeUser(user));
            return ResponseEntity.ok(resp);
        } catch (IllegalArgumentException ex) {
            resp.put("ok", false);
            resp.put("msg", ex.getMessage());
            return ResponseEntity.badRequest().body(resp);
        }
    }

    /** 登出：销毁会话。 */
    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ok", true);
        return resp;
    }

    /** 当前登录用户（前端刷新用户名用）。未登录返回 401。 */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        User user = session == null ? null : (User) session.getAttribute(SESSION_USER);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("ok", false, "msg", "未登录"));
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ok", true);
        resp.put("user", safeUser(user));
        return ResponseEntity.ok(resp);
    }

    /** 去掉敏感字段（password）再返回。 */
    private Map<String, Object> safeUser(User user) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", user.getId());
        m.put("username", user.getUsername());
        m.put("nickname", user.getNickname() == null ? user.getUsername() : user.getNickname());
        m.put("role", user.getRole() == null ? "USER" : user.getRole());
        return m;
    }
}
