# Windows 服务器部署指南

> 本项目是 Node.js + Express 后端 + 静态前端，**无需 build**，直接部署源码即可。

---

## 一、环境准备（服务器上执行一次）

### 1. 安装 Node.js（>=18）
下载 LTS 版：https://nodejs.org/zh-cn/download
安装后命令行验证：
```cmd
node -v
npm -v
```

### 2. 安装 PM2（进程守护，开机自启，崩溃自动重启）
```cmd
npm install -g pm2 pm2-windows-startup
pm2-startup install
```

---

## 二、部署项目

### 1. 解压部署包
把 `ai-model-deploy.zip` 解压到服务器目录，例如：
```
D:\app\ai-model\
```

### 2. 安装依赖
```cmd
cd /d D:\app\ai-model
npm install --production
```
> 生产环境用 `--production` 不装 devDependencies（nodemon 等），更轻量。

### 3. 配置环境变量
复制 `.env.example` 为 `.env`，填入实际凭证：
```cmd
copy .env.example .env
notepad .env
```

**必须修改的关键项**：
```ini
# 数据库（阿里云 RDS）
MYSQL_HOST=rm-bp1h02bqtq3dqir4q7o.mysql.rds.aliyuncs.com
MYSQL_USER=dms_user_4d2ca7b
MYSQL_PASSWORD=HRflagMySql1
MYSQL_DATABASE=ai_model

# 4 个平台 API Key
DEEPSEEK_API_KEY=sk-xxx
MOONSHOT_API_KEY=sk-xxx
VOLC_AK=AKLTxxx
VOLC_SK=xxx
OPENAIHUB_TOKEN=sk-xxx
OPENAIHUB_USER_ID=10254

# 阿里云 DirectMail
ALIYUN_DM_ACCESS_KEY_ID=LTAIxxx
ALIYUN_DM_ACCESS_KEY_SECRET=xxx
ALIYUN_DM_ACCOUNT_NAME=no-reply@alerts.hrflag.cn

# 生产域名
DASHBOARD_URL=https://aimodel.hrflag.com
```

### 4. 初始化数据库（首次部署）
```cmd
npm run init-db
```
看到 "表结构创建完成" 和 "初始数据注入完成" 即成功。

### 5. 启动服务
```cmd
pm2 start src/server.js --name ai-cost-monitor
pm2 save
```

验证：
```cmd
pm2 status
pm2 logs ai-cost-monitor --lines 20
```

看到以下输出即启动成功：
```
========================================
AI 模型费用监控系统已启动
端口: 3000  环境: production
面板: https://aimodel.hrflag.com
采集: 0 * * * * (每 1 小时)
数据库: 已连接
========================================
```

---

## 三、反向代理（IIS 或 Nginx）

如果要用 `https://aimodel.hrflag.com` 域名访问，需要反向代理把 443 → 3000。

### 方案 A：Nginx（推荐）
```nginx
server {
    listen 443 ssl;
    server_name aimodel.hrflag.com;

    ssl_certificate     C:/ssl/aimodel.hrflag.com.pem;
    ssl_certificate_key C:/ssl/aimodel.hrflag.com.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 方案 B：IIS + Application Request Routing (ARR)
1. 安装 IIS + URL Rewrite + ARR
2. 创建空网站，绑定 `aimodel.hrflag.com:443`（SSL 证书）
3. 启用代理，规则转发到 `http://127.0.0.1:3000`

---

## 四、日常运维命令

```cmd
pm2 status                      :: 查看状态
pm2 logs ai-cost-monitor        :: 实时日志
pm2 restart ai-cost-monitor     :: 重启
pm2 stop ai-cost-monitor        :: 停止
pm2 delete ai-cost-monitor      :: 删除
pm2 monit                       :: 监控面板
```

---

## 五、更新代码

后续更新只需：
1. 重新打包解压覆盖（保留 `.env` 不要覆盖）
2. `npm install --production`（如有新依赖）
3. `npm run init-db`（如有 schema 变更）
4. `pm2 restart ai-cost-monitor`

---

## 常见问题

**Q: `pnpm run build` 报错 Missing script: build？**
A: 本项目没有构建步骤，无需 build，直接 `pm2 start src/server.js` 即可。

**Q: 数据库连不上？**
A: 检查阿里云 RDS 白名单是否加了服务器公网 IP。

**Q: 端口 3000 被占用？**
A: `netstat -ano | findstr :3000` 找到 PID，`taskkill /PID xxx /F` 结束，或改 `.env` 里的 `PORT`。
