package com.xja.ncut.monitor.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.xja.ncut.monitor.entity.User;
import com.xja.ncut.monitor.mapper.UserMapper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 用户业务：注册（密码 BCrypt 加密）、登录校验、按用户名查询。
 */
@Service
public class UserService {

    private final UserMapper userMapper;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public UserService(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    /** 注册：用户名唯一校验 + 密码加密落库。失败抛 IllegalArgumentException（携带中文提示）。 */
    public User register(String username, String password, String nickname) {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(password)) {
            throw new IllegalArgumentException("用户名和密码不能为空");
        }
        username = username.trim();
        if (username.length() < 2 || username.length() > 32) {
            throw new IllegalArgumentException("用户名长度需为 2-32 个字符");
        }
        if (password.length() < 4) {
            throw new IllegalArgumentException("密码长度不能少于 4 位");
        }
        long exists = userMapper.selectCount(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, username));
        if (exists > 0) {
            throw new IllegalArgumentException("用户名已存在，请更换");
        }
        User user = new User();
        user.setUsername(username);
        user.setPassword(encoder.encode(password));
        user.setNickname(StringUtils.hasText(nickname) ? nickname.trim() : username);
        user.setRole("USER");
        userMapper.insert(user);
        return user;
    }

    /** 登录校验：用户名存在且密码匹配则返回该用户，否则抛 IllegalArgumentException。 */
    public User login(String username, String password) {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(password)) {
            throw new IllegalArgumentException("请输入用户名和密码");
        }
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, username.trim()));
        if (user == null || !encoder.matches(password, user.getPassword())) {
            throw new IllegalArgumentException("用户名或密码错误");
        }
        return user;
    }
}
