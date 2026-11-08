# ==========================================
# 阶段 1: 构建阶段 (Builder)
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 先复制依赖描述文件，充分利用 Docker 缓存层
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

# 安装全量依赖（包含 TypeScript 与类型定义）
RUN pnpm install --frozen-lockfile

# 复制源码并执行构建
COPY tsconfig.json ./
COPY src/ ./src/

RUN pnpm run build

# ==========================================
# 阶段 2: 生产运行阶段 (Runner)
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 仅安装生产依赖，保持镜像体积极小
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN pnpm install --prod --frozen-lockfile

# 从构建层复制编译后的 dist
COPY --from=builder /app/dist ./dist

# 暴露端口
EXPOSE 3000

# 启动微内核网关
CMD ["node", "dist/index.js"]
