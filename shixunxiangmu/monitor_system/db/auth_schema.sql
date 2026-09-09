-- ============================================================
-- 登录注册 + 处置人落库 所需表结构（一次性执行）
-- 库：security_monitor  用户：root/root
-- ============================================================
USE security_monitor;

-- 1) 用户表
CREATE TABLE IF NOT EXISTS sys_user (
  id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  username    VARCHAR(64)  NOT NULL COMMENT '登录用户名（唯一）',
  password    VARCHAR(128) NOT NULL COMMENT 'BCrypt 加密后的密码',
  nickname    VARCHAR(64)  DEFAULT NULL COMMENT '显示昵称',
  role        VARCHAR(32)  NOT NULL DEFAULT 'USER' COMMENT '角色：USER / ADMIN',
  create_time DATETIME(6)  DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='系统用户';

-- 2) alarm 表：追加处置人 / 处置时间
ALTER TABLE alarm
  ADD COLUMN handle_by   VARCHAR(64)  DEFAULT NULL COMMENT '处置人用户名' AFTER image,
  ADD COLUMN handle_time DATETIME(6)  DEFAULT NULL COMMENT '处置时间' AFTER handle_by;
