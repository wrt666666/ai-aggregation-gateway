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

### 5. 生产构建

```powershell
pnpm.cmd run build
pnpm.cmd start
```

## 许可证

MIT
