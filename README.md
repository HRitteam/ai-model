# 大模型API费用统一监控预警系统

军工雷达监测风格的大模型 API 费用统一监控与分级告警系统。对接 Kimi、MiniMax、DeepSeek、火山引擎、OpenAI-Hub、智谱AI 六大平台，每 6 小时自动采集余额，前端六宫格实时展示，分级告警通过 SendCloud 邮件+短信送达。

## 功能特性

- **六大平台采集**：DeepSeek/Kimi/火山引擎/OpenAI-Hub 走官方 API，智谱AI/MiniMax 走抓包网页接口+Cookie
- **军工雷达 UI**：深色背景、青色主色、网格扫描线、六宫格状态卡片、Canvas 雷达扫描动画、ECharts 趋势折线图
- **三色预警**：绿(>阈值)/黄(<500)/红(<200) 三色状态，卡片边框与余额数字联动
- **分级告警**：余额 <500 元邮件+短信提醒一次（仅此一次），<200 元每 6 小时重复提醒；余额回升自动重置
- **去重状态机**：`alert_state` 表 + `alert_key` 双保险，防止重复发送
- **手动测试**：首页一键发送测试邮件/短信验证通道
- **优雅降级**：凭证缺失时平台显示"未配置"，不报错不告警
- **趋势分析**：近 7日/30日/90日 余额趋势切换

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js + Express 4 |
| 数据库 | MySQL 8.0（mysql2 连接池） |
| 前端 | 原生 HTML/CSS/JS + ECharts 5（CDN） |
| 调度 | node-cron（每 6 小时） |
| HTTP | axios |
| 告警 | SendCloud 邮件模板 + 短信（MD5 签名） |

## 本地部署（Windows）

### 步骤 1：克隆代码

```bat
cd D:\AHRflag项目\AAAA子系统
git clone https://github.com/HRitteam/ai-model.git ai-model
cd ai-model
```

### 步骤 2：安装依赖

```bat
npm install
```

### 步骤 3：配置环境变量

```bat
copy .env.example .env
```

编辑 `.env`，至少填写 MySQL 连接（阿里云 RDS 已建库 `ai_model`）：

```ini
MYSQL_HOST=rm-bp1h02bqtq3dqir4q7o.mysql.rds.aliyuncs.com
MYSQL_PORT=3306
MYSQL_USER=dms_user_4d2ca7b
MYSQL_PASSWORD=你的RDS密码
MYSQL_DATABASE=ai_model
```

其余平台凭证、SendCloud 配置、告警接收人按需填写（缺失则对应平台显示"未配置"，不影响系统启动）。

### 步骤 4：初始化数据库（建表 + 注入平台配置）

```bat
npm run init-db
```

> 该命令会在 `ai_model` 库中创建 5 张表并注入六大平台默认配置。阿里云 RDS 无建库权限时会自动跳过建库步骤（库已预建）。

### 步骤 5：启动服务

```bat
npm start
```

浏览器访问 `http://localhost:3000` 即可看到监控面板。

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制配置模板并填写凭证：

```bash
cp .env.example .env
```

`.env` 关键配置项（详见 `.env.example` 注释）：

```ini
# MySQL（阿里云 RDS）
MYSQL_HOST=rm-bp1h02bqtq3dqir4q7o.mysql.rds.aliyuncs.com
MYSQL_PORT=3306
MYSQL_USER=dms_user_4d2ca7b
MYSQL_PASSWORD=你的RDS密码
MYSQL_DATABASE=ai_model

# 各平台凭证（按需配置，缺失则该平台显示"未配置"）
DEEPSEEK_API_KEY=sk-xxx
MOONSHOT_API_KEY=sk-xxx
VOLC_AK=AKxxx
VOLC_SK=SKxxx
OPENAIHUB_TOKEN=xxx
OPENAIHUB_USER_ID=1
ZHIPU_COOKIE=xxx
ZHIPU_BALANCE_URL=https://open.bigmodel.cn/api/xxx
ZHIPU_BALANCE_FIELD=data.balance
MINIMAX_COOKIE=xxx
MINIMAX_BALANCE_URL=https://platform.minimaxi.com/api/xxx
MINIMAX_BALANCE_FIELD=data.balance

# SendCloud
SENDCLOUD_API_USER=xxx
SENDCLOUD_API_KEY=xxx
SENDCLOUD_FROM_EMAIL=monitor@yourdomain.com
SENDCLOUD_MAIL_TEMPLATE=model_api_balance_warning
SENDCLOUD_SMS_USER=xxx
SENDCLOUD_SMS_KEY=xxx
SENDCLOUD_SMS_TEMPLATE_ID=xxx

# 告警接收人
ALERT_EMAIL_TO=a@x.com,b@y.com
ALERT_SMS_PHONES=13800000000,13900000000
```

### 3. 初始化数据库

首次运行会自动建库建表并注入六大平台默认配置：

```bash
npm run init-db
```

### 4. 启动服务

```bash
npm start
```

访问 `http://localhost:3000` 即可看到监控面板。

## 六大平台采集方式

| 平台 | 方式 | 接口 | 认证 | 余额字段 |
|---|---|---|---|---|
| DeepSeek | 官方API | `GET /user/balance` | Bearer API Key | `balance_infos[0].total_balance` |
| Kimi | 官方API | `GET /v1/users/me/balance` | Bearer API Key | `data.available_balance` |
| 火山引擎 | 官方API | `QueryBalanceAcct` | AK/SK V4签名 | `Result.AvailableBalance` |
| OpenAI-Hub | 官方API | `GET /api/user/self` | Token+New-Api-User | `quota - used_quota` |
| 智谱AI | 抓包+Cookie | `.env` 配置 URL | Cookie | `.env` 配置字段路径 |
| MiniMax | 抓包+Cookie | `.env` 配置 URL | Cookie | `.env` 配置字段路径 |

> 智谱AI/MiniMax 无官方余额 API，需登录控制台用 DevTools 抓包余额接口的 XHR，将 URL、Cookie、余额字段路径填入 `.env`。Cookie 过期后前端会提示更新。

## 告警机制

| 余额区间 | 级别 | 行为 |
|---|---|---|
| ≥ 500 元 | 正常 | 不告警 |
| 200 ~ 500 元 | 黄色 | 邮件+短信各发**一次**，余额回升后复位可再次触发 |
| < 200 元 | 红色 | 每 6 小时重复邮件+短信提醒 |

去重核心：
- 黄色靠 `alert_state.yellow_sent` 标志位（一次性）
- 红色靠 `alert_state.red_last_sent_at` + 6小时间隔
- `alert_log.alert_key` 双保险兜底（黄色 key 固定，红色 key 含6h窗口）
- 余额回升到正常区自动重置整个状态机

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/dashboard` | 首页总览（平台列表+汇总+最近告警） |
| GET | `/api/platforms` | 平台列表 |
| GET | `/api/platforms/:code` | 单平台详情 |
| GET | `/api/records?range=7d` | 所有平台趋势 |
| GET | `/api/records/:code?range=7d` | 单平台历史记录 |
| POST | `/api/collect` | 手动触发采集 |
| GET | `/api/alerts` | 告警日志（分页） |
| POST | `/api/alerts/test` | 测试告警通道 |
| GET | `/api/settings` | 系统设置 |
| PUT | `/api/settings` | 更新设置 |
| GET | `/api/health` | 健康检查 |

## 目录结构

```
src/
├── server.js              # 应用入口
├── config/                # 配置加载与平台元数据
├── db/                    # 数据库连接池、schema、初始化
├── collectors/            # 六大平台采集器 + 调度执行器
├── alert/                 # 告警引擎、去重状态机、SendCloud通道
├── routes/                # API 路由
├── services/              # 业务服务层
├── jobs/                  # 定时任务（cron）
├── utils/                 # 工具（日志/HTTP/加密/错误）
└── middleware/            # 中间件
public/                    # 前端静态资源（军工雷达风格 UI）
```

## 运行环境注意

- Node.js >= 18
- 若 `NODE_OPTIONS` 环境变量异常导致 node/npm 报错，执行 `unset NODE_OPTIONS` 后重试
- ECharts 通过 CDN 引入，离线环境需将 `public/index.html` 中的 ECharts CDN 下载到 `public/vendor/` 本地引用
- 生产部署建议用 PM2 守护：`pm2 start src/server.js --name ai-cost-monitor`
