package com.xja.ncut.monitor.config;

import com.xja.ncut.monitor.interceptor.AuthInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * WebMvc 配置：注册登录拦截器。
 * 白名单（模型回调 / 登录注册 / 静态资源 / 登录页）全部放行，其余需登录。
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;

    public WebConfig(AuthInterceptor authInterceptor) {
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns(
                        // 登录/注册/当前用户/登出
                        "/api/auth/**",
                        // AI 模型服务回调（server.py 无登录态，必须放行）
                        "/api/ai/event",
                        // 设备统计/列表（监控大屏 KPI 实时刷新用，未登录也可查看）
                        "/api/devices/**",
                        // 静态资源
                        "/css/**", "/js/**", "/img/**", "/favicon.ico",
                        // 登录页
                        "/login.html"
                );
    }
}
