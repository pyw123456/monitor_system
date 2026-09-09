# monitor_system
一个实时监控系统项目,完全开源，目前处于 V0.0.1(Demo) 版本

# 智瞳 · AI 智能安防监控系统（校园安防实训项目）

基于 **YOLOv5 双模型视觉识别 + Spring Boot 后端 + 原生前端** 的校园安防监控系统。摄像头图片经 AI 自动识别后生成业务告警，支撑告警查询、处置、统计与监控大屏展示的完整闭环。

## 1. 项目简介

系统模拟校园安防场景下的智能告警流程：

1. 待识别图片投放至监听目录 `C:\model\ai-watch\`；
2. Python 模型服务（YOLOv5）每 2 秒扫描一次，将同一张图片分别交给 **COCO 通用检测模型** 和 **D-Fire 烟火检测模型** 推理，合并识别结果；
3. 识别完成后图片被移动至 `ai-watch\已检测\`，识别结果以 JSON 回调 Java 后端 `/api/ai/event`；
4. 后端按业务规则将原始类别（person / car / fire 等）转换为告警（人员闯入、人员聚集、烟火异常等）并落库；
5. 前端页面提供登录注册、监控大屏、实时告警、AI 识别记录、告警处置、处置记录查询、设备信息等功能。

## 2. 技术栈

| 层次 | 技术 | 说明 |
| ---- | ---- | ---- |
| AI 模型服务 | Python 3 + FastAPI + PyTorch + YOLOv5 | 端口 8000，双模型推理（yolov5s-coco + yolov5s-dfire） |
| 后端 | Spring Boot 3.3.4 + MyBatis-Plus 3.5.7 + MySQL 8.0 | 端口 8080，库 `security_monitor` |
| 前端 | 原生 HTML / CSS / JavaScript | 静态页面直接由 Spring Boot 托管 |
| 安全 | HttpSession 登录态 + BCrypt 密码加密 + 拦截器鉴权 | 白名单外的接口均需登录 |

## 3. 系统架构

```
图片投放 C:\model\ai-watch\
        │  (每 2 秒扫描)
        ▼
┌─────────────────────────────┐
│  Python 模型服务  :8000     │
│  yolov5s-coco  +  yolov5s-dfire
└──────────┬──────────────────┘
           │ POST /api/ai/event
           │ {image, imagePath, objects:[{class, conf}]}
           ▼
┌─────────────────────────────┐
│  Spring Boot 后端  :8080    │
│  告警判定 → 落库 → 接口提供 │
└──────────┬──────────────────┘
           │ REST API
           ▼
┌─────────────────────────────┐
│  前端页面（静态资源托管）    │
│  登录 / 大屏 / 告警 / 处置  │
└─────────────────────────────┘
           ▲ 图片展示
           │ GET /alarm-img/{name} （读 ai-watch\已检测）
```

## 4. 功能模块

| 页面 | 文件 | 功能 |
| ---- | ---- | ---- |
| 登录 | `login.html` | 注册 / 登录，登录态存于 Session，密码 BCrypt 加密 |
| 监控大屏 | `index.html` | 告警 KPI（今日新增、待处置、按类型/级别分布）、近 N 天趋势图、接入设备与在线率 |
| 实时告警中心 | `alarms.html` | 告警分页查询，按类型/级别/状态/时间段过滤，展示检测图片 |
| AI 识别记录 | `handling.html` | AI 识别产生的告警处置入口：标记 已完成 / 已忽略 / 误报 |
| 告警处置记录 | `records.html` | 已处置告警查询（按处置时间倒序），展示处置人与处置时间 |
| 设备信息 | `devices.html` | 摄像头设备列表（后端内存数据源为权威，与大屏 KPI 保持一致） |

### 告警判定规则（AiEventService）

| 识别结果 | 告警类型 | 级别 |
| ---- | ---- | ---- |
| 1 个 person | 人员闯入 | 高 |
| ≥2 个 person | 人员聚集 | 中 |
| car / truck / bus / motorcycle | 车辆异常 | 高 |
| dog / cat | 动物进入 | 中 |
| backpack / suitcase | 物品异常 | 中 |
| fire / smoke（D-Fire 模型） | 烟火异常 | 高 |

事发区域从图片文件名解析（如 `01_A区西门_单人闯入.png` → `A区西门`）。

## 5. 目录结构

```
shixunxiangmu/
├── README.md                 # 本文件
├── monitor_system/           # Spring Boot 后端（含前端静态页面）
│   ├── pom.xml
│   ├── db/auth_schema.sql    # sys_user 表 + alarm 处置字段（一次性执行）
│   └── src/main/
│       ├── java/com/xja/ncut/monitor/
│       │   ├── Application.java          # 启动类
│       │   ├── config/                   # MyBatis-Plus、拦截器配置
│       │   ├── controller/               # AiEvent / AlarmQuery / AlarmImage / Auth / Device
│       │   ├── service/                  # 告警判定、用户认证
│       │   ├── entity/ mapper/ dto/      # Alarm / Device / User 等
│       │   └── interceptor/              # 登录拦截器
│       └── resources/
│           ├── application.yml           # 端口 8080、MySQL 连接配置
│           └── static/                   # 登录页、监控大屏、告警中心等前端页面
├── verify_shot/              # 功能验证截图
├── visual design.md          # 视觉设计说明
└── dfire_readme.md           # D-Fire 烟火数据集说明

C:\model\                     # 模型环境（与代码项目分离）
├── yolovenv/                 # Python 虚拟环境
├── yolov5/                   # YOLOv5 仓库
├── models/
│   ├── yolov5s-coco.pt       # COCO 通用检测权重
│   └── yolov5s-dfire.pt      # D-Fire 烟火检测权重
├── ai-watch/                 # 待识别图片监听目录
│   └── 已检测/               # 识别完成后的图片（告警图片从此读取）
├── server.py                 # 模型识别服务（FastAPI，端口 8000）
├── start_all.bat             # 一键启动后端 + 模型服务
└── stop_all.bat              # 一键停止
```

## 6. 环境要求

- JDK 17、Maven 3.8+（IDEA 自带即可）
- MySQL 8.0，账号 `root / root`（可在 `application.yml` 修改）
- Python 3.10+（模型服务，虚拟环境位于 `C:\model\yolovenv`）
- 依赖 Python 包：`torch`、`fastapi`、`uvicorn`、`requests`

## 7. 数据库初始化

1. 创建数据库：

   ```sql
   CREATE DATABASE security_monitor DEFAULT CHARSET utf8mb4;
   ```

2. 创建告警表 `alarm`（核心字段如下）：

   ```sql
   CREATE TABLE alarm (
     id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
     type        VARCHAR(64)  COMMENT '告警类型：人员闯入/人员聚集/车辆异常/动物进入/物品异常/烟火异常',
     area        VARCHAR(64)  COMMENT '事发区域',
     level       VARCHAR(16)  COMMENT '级别：高/中/低',
     status      VARCHAR(16)  COMMENT '状态：待处置/已完成/已忽略/误报',
     source      VARCHAR(64)  COMMENT '来源，如：AI视觉分析',
     detail      VARCHAR(512) COMMENT '详情描述',
     image       VARCHAR(255) COMMENT '检测图片文件名（已检测目录内）',
     event_time  DATETIME(6)  COMMENT '告警时间',
     PRIMARY KEY (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
   ```

3. 执行 `monitor_system/db/auth_schema.sql`：创建 `sys_user` 用户表并为 `alarm` 表追加 `handle_by`（处置人）、`handle_time`（处置时间）字段。

## 8. 部署与运行

### 8.1 打包后端

```bash
cd monitor_system
mvn package -DskipTests
# 产物：target/security-monitor-1.0.0.jar
```

### 8.2 一键启动

双击 `C:\model\start_all.bat`（需 GBK/ANSI 编码保存），脚本会：

1. 结束 8000 / 8080 端口旧进程；
2. 启动 Spring Boot 后端（8080，日志 `C:\model\backend.log`）；
3. 启动 YOLOv5 模型服务（8000，首次加载约 30~60 秒，日志 `C:\model\server.log`）；
4. 等待两个端口就绪后提示启动成功。

停止服务：双击 `C:\model\stop_all.bat`。

### 8.3 使用

1. 浏览器访问 `http://127.0.0.1:8080`，未登录会跳转登录页；首次使用请注册账号（或使用已有账号）；
2. 把待识别图片（jpg / jpeg / png）放入 `C:\model\ai-watch\`，命名建议 `序号_区域_场景.png`（如 `01_A区西门_单人闯入.png`），区域将被自动解析进告警；
3. 约 2 秒后模型完成识别，图片移入 `已检测\`，命中规则的告警出现在"实时告警中心"和"AI 识别记录"页；
4. 在"AI 识别记录"中对告警进行处置（已完成 / 已忽略 / 误报），处置人与时间自动记录；
5. "监控大屏"实时展示告警统计、趋势与设备在线情况。

### 8.4 手工验证模型

模型服务提供 `GET http://127.0.0.1:8000/detect?url=<图片路径>` 手工识别接口，便于单独调试模型。

## 9. 接口一览

| 方法 | 路径 | 说明 | 鉴权 |
| ---- | ---- | ---- | ---- |
| POST | `/api/auth/register` | 注册并自动登录（用户名唯一、密码 BCrypt） | 否 |
| POST | `/api/auth/login` | 登录，登录态存 HttpSession | 否 |
| POST | `/api/auth/logout` | 登出销毁会话 | 否 |
| GET | `/api/auth/me` | 当前登录用户信息 | 否 |
| POST | `/api/ai/event` | 模型服务回调：接收识别结果并生成告警 | 否（白名单） |
| GET | `/api/alarms` | 告警分页查询，参数 `type/level/status/from/to/page/size` | 是 |
| GET | `/api/alarms/stats` | 告警统计：今日新增、待处置、按类型/级别分布 | 是 |
| GET | `/api/alarms/trend?days=N` | 近 N 天（1-90）每日告警数趋势 | 是 |
| POST | `/api/alarms/{id}/handle` | 处置告警，body `{"status":"已完成/已忽略/误报"}` | 是 |
| GET | `/api/alarms/handled` | 已处置告警分页查询（按处置时间倒序） | 是 |
| GET | `/api/devices/list` | 设备列表（内存权威数据源） | 否 |
| GET | `/api/devices/stats` | 设备统计 `{total, online, offline, onlineRate}` | 否 |
| GET | `/alarm-img/{name}` | 检测图片访问（读 `ai-watch\已检测`，防目录穿越） | 否 |

## 10. 说明与约定

- 模型服务与后端通过 `BACKEND_URL` / `MODEL_ROOT` 环境变量解耦，默认值与本项目部署一致；
- 设备列表以 `DeviceController` 内存数据源为唯一权威，监控大屏 KPI 与设备列表页始终一致，不依赖 `device` 表；
- 检测图片接口做了路径穿越防护（拒绝 `..`、`/`、`\` 等）；
- `verify_shot/` 目录内存放各功能页面的验证截图，可作为效果参考；
- 本项目为实训项目，默认数据库账号密码即开发配置，生产环境请务必修改。
