package com.xja.ncut.monitor.interceptor;

import com.xja.ncut.monitor.controller.AuthController;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 登录拦截器。
 * - 已登录（Session 存在 loginUser）→ 放行
 * - 未登录访问 /api/**（业务接口）→ 返回 401 JSON
 * - 未登录访问业务页面（.html / /）→ 重定向 /login.html
 * 白名单（/api/auth/**, /api/ai/event, 静态资源, /login.html）在 WebConfig 中排除，不会进入本拦截器。
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        String uri = request.getRequestURI();
        HttpSession session = request.getSession(false);
        Object user = session == null ? null : session.getAttribute(AuthController.SESSION_USER);
        if (user != null) {
            return true;
        }
        // 未登录
        if (uri.startsWith("/api/")) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"ok\":false,\"msg\":\"未登录或登录已失效\"}");
            return false;
        }
        // 页面请求 → 跳转登录页
        response.sendRedirect("/login.html");
        return false;
    }
}
