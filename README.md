# AI Aggregation Gateway (AI 聚合平台核心网关)

一个高性能、微内核的 AI 多模型聚合与分发网关。基于 **TypeScript + Hono + Web Stream 原生流式管道** 构建，对外完全兼容 OpenAI 协议（`/v1/chat/completions`），对内抹平 OpenAI、Claude (Anthropic)、Google Gemini、Ollama 等多厂商协议差异。

## 核心特性

- 🌐 **协议大一统**：对外暴露标准 OpenAI 兼容接口，自动转换 Anthropic 与 Gemini 原生请求/响应规范，支持历史上下文连续角色自动合并（Turn Merging）。
- 🌊 **防半包 SSE 零拷贝管道**：基于 Web Stream `TransformStream` 原样流式透传，解决网络切包断片、半包粘包问题，实时统一厂商事件格式并精准结算 Token。
- ⚖️ **加权路由与多 Key 轮询**：支持各渠道按权重负载均衡，单个渠道支持配置多 API Key 自动原子轮询，防止速率超限 (429)。
- 🛡️ **静默故障转移 (Failover)**：在上游出现 429 限流、5xx 服务故障或 15 秒超时无响应时，首包前自动熔断并静默切换备用渠道，调用方完全无感。
- 🔒 **安全与运维**：统一 Bearer 鉴权，`/admin/channels` 渠道监控接口默认脱敏遮蔽真实 API Key。

## 目录结构

```
├── src/
│   ├── types/schema.ts        # 统一契约 (OpenAI 协议大一统、跨模态、渠道节点)
│   ├── core/router.ts         # 渠道路由、加权负载、多 Key 轮询、熔断器与协议适配
│   ├── core/stream-relay.ts   # 零拷贝 SSE 流式管道、多厂商 Chunk 统一与 Token 结算
│   └── index.ts               # Hono 网关主入口、静默 Failover 重试与安全鉴权
├── test/
│   └── verify.ts              # 11 组端到端综合测试套件
├── package.json
└── tsconfig.json
```

## 快速上手

### 1. 安装依赖

```powershell
pnpm install
# 或在 Windows PowerShell 下:
pnpm.cmd install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

根据需要配置监听端口及各模型提供商的 API Key。

### 3. 启动开发模式

```powershell
pnpm.cmd dev
```

服务默认在 `http://127.0.0.1:3000` 启动。

### 4. 运行测试

```powershell
pnpm.cmd test
```

### 5. 生产构建与本地运行

```powershell
pnpm.cmd run build
pnpm.cmd start
```

## 🚀 服务器一键生产部署 (Server Deployment)

### 方案 A：Docker Compose 一键部署（推荐）

在服务器（如 Ubuntu / Debian / CentOS）上只需安装 Docker，执行以下三行命令即可：

```bash
# 1. 克隆仓库
git clone https://github.com/wrt666666/ai-aggregation-gateway.git
cd ai-aggregation-gateway

# 2. 配置秘钥环境变量
cp .env.example .env
vim .env  # 填入您的 GATEWAY_API_KEY 与各上游模型 Key

# 3. 后台启动容器
docker compose up -d --build
```

查看实时运行日志：
```bash
docker compose logs -f
```

停止与更新：
```bash
git pull
docker compose up -d --build
```

---

### 方案 B：Linux VPS 原生 PM2 / Node 22 部署

```bash
# 1. 安装 Node.js 22 与 pnpm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm pm2

# 2. 安装依赖并编译构建
pnpm install --frozen-lockfile
pnpm run build

# 3. 使用 PM2 守护进程运行
pm2 start dist/index.js --name "ai-gateway"
pm2 save
pm2 startup
```

---

### 方案 C：Nginx 反向代理配置（支持 SSE 流式打字机）

若前端使用域名访问并配置了 Nginx 反向代理，**必须关闭 Nginx 缓冲**，否则流式打字机会出现卡顿：

参考本仓库提供的 `nginx.conf.example`：
```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;

    # 关键设置：支持 SSE 流式透传（关闭缓冲）
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## 许可证

MIT
