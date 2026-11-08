/**
 * Single-Page Application Dashboard (SPA Admin UI)
 * Dark Geek Tech Style, Zero-build-step HTML/JS Renderer
 */

export interface AdminUIOptions {
  adminKey?: string;
  gatewayKey?: string;
}

export function renderAdminUI(options: AdminUIOptions = {}): string {
  const defaultAdminKey = options.adminKey || 'admin-secret-2026';
  const defaultGatewayKey = options.gatewayKey || 'sk-gateway-secret-key-123456';

  return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Gateway Hub - 极客控制台</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-hover: #162032;
      --border: #1f293d;
      --border-focus: #3b82f6;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --accent: #06b6d4;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
      background: rgba(17, 24, 39, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 50;
      padding: 0.85rem 1.75rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: #fff;
    }

    .brand .logo-icon {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #6366f1, #06b6d4);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 14px;
    }

    .brand .badge {
      font-size: 0.7rem;
      padding: 2px 7px;
      border-radius: 9999px;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3);
      font-weight: 500;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .auth-inputs {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      background: rgba(0, 0, 0, 0.25);
      padding: 4px 8px;
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    .auth-inputs label {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }

    .auth-inputs input {
      background: #090d16;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 4px 8px;
      color: #fff;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      width: 150px;
    }

    .auth-inputs input:focus {
      outline: none;
      border-color: var(--primary);
    }

    .nav-tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border);
      background: #0d131f;
      padding: 0 1.75rem;
    }

    .tab-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      padding: 0.9rem 1.25rem;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .tab-btn:hover {
      color: #fff;
    }

    .tab-btn.active {
      color: #818cf8;
      border-bottom-color: #6366f1;
    }

    main {
      padding: 1.5rem 1.75rem;
      flex: 1;
      max-width: 1440px;
      width: 100%;
      margin: 0 auto;
    }

    .panel {
      display: none;
    }

    .panel.active {
      display: block;
      animation: fadeIn 0.2s ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Cards & Grids */
    .grid-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .metric-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .metric-title {
      font-size: 0.8rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metric-value {
      font-size: 1.85rem;
      font-weight: 700;
      color: #fff;
      font-family: var(--font-mono);
    }

    .metric-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.2rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }

    .card-title {
      font-size: 1.1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: var(--primary);
      color: #fff;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, transform 0.05s;
    }

    .btn:hover {
      background: var(--primary-hover);
    }

    .btn:active {
      transform: scale(0.98);
    }

    .btn-secondary {
      background: #1f293d;
      color: #e5e7eb;
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: #2d3b55;
    }

    .btn-danger {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.25);
    }

    .btn-sm {
      padding: 0.3rem 0.65rem;
      font-size: 0.75rem;
      border-radius: 6px;
    }

    /* Tables */
    .table-container {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.85rem;
    }

    th {
      background: #0f1624;
      color: var(--text-muted);
      font-weight: 600;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
      text-transform: uppercase;
      font-size: 0.725rem;
      letter-spacing: 0.05em;
    }

    td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border);
      color: #e5e7eb;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: var(--card-hover);
    }

    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status-healthy {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .status-cooling {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .status-dead {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .badge-protocol {
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.72rem;
      font-family: var(--font-mono);
      font-weight: 600;
    }

    .proto-openai { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
    .proto-anthropic { background: rgba(168, 85, 247, 0.2); color: #d8b4fe; }
    .proto-gemini { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }

    /* Forms */
    .form-group {
      margin-bottom: 1rem;
    }

    .form-label {
      display: block;
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 0.35rem;
      font-weight: 500;
    }

    .form-control {
      width: 100%;
      background: #090d16;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.6rem 0.85rem;
      color: #fff;
      font-size: 0.85rem;
      transition: border-color 0.15s;
    }

    .form-control:focus {
      outline: none;
      border-color: var(--primary);
    }

    textarea.form-control {
      resize: vertical;
      min-height: 80px;
    }

    /* Split Playground Layout */
    .playground-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    @media (max-width: 900px) {
      .playground-grid {
        grid-template-columns: 1fr;
      }
    }

    .output-box {
      background: #090d16;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      min-height: 220px;
      max-height: 380px;
      overflow-y: auto;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      color: #e2e8f0;
      white-space: pre-wrap;
      word-break: break-word;
      position: relative;
    }

    .output-box.streaming::after {
      content: '▋';
      color: #6366f1;
      animation: blink 0.8s infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    .progress-bar-container {
      width: 100%;
      height: 8px;
      background: #1f293d;
      border-radius: 4px;
      overflow: hidden;
      margin: 0.75rem 0;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #6366f1, #06b6d4);
      width: 0%;
      transition: width 0.3s ease;
    }

    /* Modal */
    .modal-backdrop {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }

    .modal-backdrop.open {
      display: flex;
    }

    .modal-dialog {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      width: 90%;
      max-width: 540px;
      padding: 1.5rem;
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.4);
    }

    .tag {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      background: #1f293d;
      color: #94a3b8;
      font-size: 0.72rem;
      font-family: var(--font-mono);
      margin-right: 4px;
      margin-bottom: 2px;
    }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      z-index: 999;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.25s;
      pointer-events: none;
    }

    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }

    .toast-success { background: #10b981; color: #fff; }
    .toast-error { background: #ef4444; color: #fff; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="logo-icon">AI</div>
      <span>AI Gateway Hub</span>
      <span class="badge">v1.0 Live</span>
    </div>

    <div class="header-controls">
      <div class="auth-inputs">
        <label>Admin Key:</label>
        <input type="password" id="adminKeyInput" value="${defaultAdminKey}" title="Admin API Key" />
        <label style="margin-left:8px;">Gateway Token:</label>
        <input type="password" id="gatewayKeyInput" value="${defaultGatewayKey}" title="Bearer Token" />
      </div>
    </div>
  </header>

  <nav class="nav-tabs">
    <button class="tab-btn active" data-tab="tab-channels">🔌 渠道与密钥池管理</button>
    <button class="tab-btn" data-tab="tab-playground">⚡ 对话 & 视频生成演练场</button>
    <button class="tab-btn" data-tab="tab-logs">📊 实时审计与性能大盘</button>
  </nav>

  <main>
    <!-- TAB 1: CHANNELS -->
    <section id="tab-channels" class="panel active">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔌 活跃模型与密钥池列表</div>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="loadChannels()">🔄 刷新</button>
            <button class="btn btn-sm" onclick="openAddModal()">➕ 新增渠道</button>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>渠道名称</th>
                <th>协议</th>
                <th>基础 Endpoint</th>
                <th>脱敏密钥池 (首尾4位)</th>
                <th>权重</th>
                <th>支持模型</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="channelsTableBody">
              <tr><td colspan="9" style="text-align:center; color:var(--text-muted);">加载中...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- TAB 2: PLAYGROUND -->
    <section id="tab-playground" class="panel">
      <div class="playground-grid">
        <!-- Chat Playground -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">💬 多模型对话 (SSE 流式打字机)</div>
          </div>

          <div class="form-group">
            <label class="form-label">模型 Model:</label>
            <select id="chatModelSelect" class="form-control" style="font-family:var(--font-mono);">
              <option value="gpt-4o">gpt-4o (Primary / Mapped Sonnet)</option>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet-20241022</option>
              <option value="claude-3-5-haiku-20241022">claude-3-5-haiku-20241022</option>
              <option value="o3-mini">o3-mini</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">系统 Prompt / 指令 (可选):</label>
            <input type="text" id="chatSystemPrompt" class="form-control" placeholder="你是一个精准、干练的 AI 架构助手" />
          </div>

          <div class="form-group">
            <label class="form-label">用户消息 (Prompt):</label>
            <textarea id="chatUserPrompt" class="form-control" placeholder="输入对话内容，例如：请简明阐述分布式微服务降级与熔断的最佳实践。">请简述智能多模态 AI 网关架构的核心设计要点。</textarea>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; cursor:pointer;">
              <input type="checkbox" id="chatStreamCheckbox" checked /> 启用 SSE 流式传输
            </label>
            <button class="btn" id="sendChatBtn" onclick="runChatCompletion()">🚀 发送请求</button>
          </div>

          <div class="form-label">响应输出 (Response Stream):</div>
          <div id="chatOutput" class="output-box">等待请求中...</div>
          <div id="chatStats" style="margin-top:0.5rem; font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);"></div>
        </div>

        <!-- Video Playground -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🎬 异步视频生成演练场</div>
          </div>

          <div class="form-group">
            <label class="form-label">视频模型 Model:</label>
            <select id="videoModelSelect" class="form-control" style="font-family:var(--font-mono);">
              <option value="sora-1.0">OpenAI Sora 1.0 (Text-to-Video)</option>
              <option value="kling-v1">快手 Kling 1.5 Pro</option>
              <option value="runway-gen3">Runway Gen-3 Alpha</option>
              <option value="cogvideox">CogVideoX 5B</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">视频生成 Prompt (画面细节、运镜、风格):</label>
            <textarea id="videoPrompt" class="form-control" placeholder="画面描述...">Cinematic 4K drone shot over a futuristic neon-lit metropolis at dusk, hyper-detailed reflections, 60fps.</textarea>
          </div>

          <div style="display:flex; justify-content:flex-end; margin-bottom:1rem;">
            <button class="btn" id="generateVideoBtn" onclick="submitVideoTask()">🎥 提交视频生成任务</button>
          </div>

          <div id="videoTaskStatusCard" style="display:none; background:#090d16; border:1px solid var(--border); border-radius:8px; padding:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem;">
              <span id="taskStatusTitle" style="font-weight:600; color:#818cf8;">任务提交中...</span>
              <span id="taskStatusBadge" class="badge-status status-cooling">PENDING</span>
            </div>
            <div class="progress-bar-container">
              <div id="videoProgressBar" class="progress-bar"></div>
            </div>
            <div id="videoProgressLabel" style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono); text-align:right;">0%</div>
            
            <div id="videoPlayerContainer" style="margin-top:1rem; display:none;">
              <video id="videoElement" controls autoplay muted loop style="width:100%; border-radius:6px; max-height:260px; background:#000;"></video>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 3: LOGS & METRICS -->
    <section id="tab-logs" class="panel">
      <!-- KPI Stats -->
      <div class="grid-metrics">
        <div class="metric-card">
          <div class="metric-title">总调用请求数</div>
          <div class="metric-value" id="metricTotalReq">-</div>
          <div class="metric-sub" id="metricSuccessRate">成功率: -%</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">平均响应延迟</div>
          <div class="metric-value" id="metricAvgDuration">- <span style="font-size:1rem; font-weight:normal;">ms</span></div>
          <div class="metric-sub">全渠道端到端平均用时</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">总 Token 消耗</div>
          <div class="metric-value" id="metricTotalTokens">-</div>
          <div class="metric-sub" id="metricTokenBreakdown">Prompt: - / Comp: -</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">环形日志缓冲区容量</div>
          <div class="metric-value">200</div>
          <div class="metric-sub">FIFO 内存滚动保留最近调用</div>
        </div>
      </div>

      <!-- Audit Logs Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 最近 50 条审计流水</div>
          <button class="btn btn-secondary btn-sm" onclick="loadMetricsAndLogs()">🔄 刷新大盘</button>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>渠道 ID</th>
                <th>模型</th>
                <th>传输模式</th>
                <th>耗时</th>
                <th>Token (P / C / Total)</th>
                <th>HTTP 状态</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody id="logsTableBody">
              <tr><td colspan="8" style="text-align:center; color:var(--text-muted);">暂无日志数据</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </main>

  <!-- Add Channel Modal -->
  <div id="addChannelModal" class="modal-backdrop">
    <div class="modal-dialog">
      <div class="card-header" style="margin-bottom:1rem;">
        <div class="card-title">➕ 动态注册新增渠道</div>
        <button class="btn btn-secondary btn-sm" onclick="closeAddModal()">✕</button>
      </div>

      <div class="form-group">
        <label class="form-label">渠道 ID (唯一标识):</label>
        <input type="text" id="newChId" class="form-control" placeholder="e.g. backup-gemini" />
      </div>

      <div class="form-group">
        <label class="form-label">渠道名称:</label>
        <input type="text" id="newChName" class="form-control" placeholder="e.g. Google Gemini Pro Channel" />
      </div>

      <div class="form-group">
        <label class="form-label">协议类型 Protocol:</label>
        <select id="newChProtocol" class="form-control">
          <option value="openai">OpenAI (ChatCompletions 规范)</option>
          <option value="anthropic">Anthropic (Claude Messages 规范)</option>
          <option value="gemini">Google Gemini (GenerateContent 规范)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">基础 Base Endpoint:</label>
        <input type="text" id="newChEndpoint" class="form-control" placeholder="https://api.openai.com/v1" />
      </div>

      <div class="form-group">
        <label class="form-label">API 密钥 (支持多 Key 逗号分隔轮询):</label>
        <input type="text" id="newChKeys" class="form-control" placeholder="sk-key1, sk-key2" />
      </div>

      <div class="form-group">
        <label class="form-label">支持模型 (逗号分隔，* 为通配):</label>
        <input type="text" id="newChModels" class="form-control" value="*" />
      </div>

      <div class="form-group">
        <label class="form-label">负载均衡权重 (Weight):</label>
        <input type="number" id="newChWeight" class="form-control" value="10" />
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
        <button class="btn btn-secondary" onclick="closeAddModal()">取消</button>
        <button class="btn" onclick="submitAddChannel()">确认添加</button>
      </div>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    // Local state & persistence
    const state = {
      adminKey: localStorage.getItem('ai_gw_admin_key') || '${defaultAdminKey}',
      gatewayKey: localStorage.getItem('ai_gw_token') || '${defaultGatewayKey}',
      activeVideoTaskId: null,
      videoPollTimer: null,
    };

    const adminKeyInput = document.getElementById('adminKeyInput');
    const gatewayKeyInput = document.getElementById('gatewayKeyInput');

    adminKeyInput.value = state.adminKey;
    gatewayKeyInput.value = state.gatewayKey;

    adminKeyInput.addEventListener('change', () => {
      state.adminKey = adminKeyInput.value.trim();
      localStorage.setItem('ai_gw_admin_key', state.adminKey);
      showToast('Admin Key 已保存', 'success');
    });

    gatewayKeyInput.addEventListener('change', () => {
      state.gatewayKey = gatewayKeyInput.value.trim();
      localStorage.setItem('ai_gw_token', state.gatewayKey);
      showToast('Gateway Token 已保存', 'success');
    });

    // Toast utility
    function showToast(msg, type = 'success') {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.className = 'toast show ' + (type === 'error' ? 'toast-error' : 'toast-success');
      setTimeout(() => el.className = 'toast', 2500);
    }

    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');

        if (tabId === 'tab-channels') loadChannels();
        if (tabId === 'tab-logs') loadMetricsAndLogs();
      });
    });

    function getAuthHeaders() {
      return {
        'Content-Type': 'application/json',
        'X-Admin-Key': state.adminKey,
        'Authorization': 'Bearer ' + (state.gatewayKey || state.adminKey)
      };
    }

    // 1. Channel Management
    async function loadChannels() {
      try {
        const res = await fetch('/api/admin/channels', { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const tbody = document.getElementById('channelsTableBody');
        tbody.innerHTML = '';

        if (!data.channels || data.channels.length === 0) {
          tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted);">暂无配置渠道</td></tr>';
          return;
        }

        data.channels.forEach(ch => {
          const tr = document.createElement('tr');
          const statusClass = ch.status === 'healthy' ? 'status-healthy' : (ch.status === 'cooling' ? 'status-cooling' : 'status-dead');
          const protoClass = ch.protocol === 'openai' ? 'proto-openai' : (ch.protocol === 'anthropic' ? 'proto-anthropic' : 'proto-gemini');

          const modelsHtml = (ch.models || []).map(m => '<span class="tag">' + m + '</span>').join('');
          const keysHtml = (ch.apiKeys || []).map(k => '<span class="tag" style="color:#6ee7b7;">' + k + '</span>').join(' ');

          tr.innerHTML = \`
            <td style="font-family:var(--font-mono); font-weight:600;">\${ch.id}</td>
            <td>\${ch.name}</td>
            <td><span class="badge-protocol \${protoClass}">\${ch.protocol.toUpperCase()}</span></td>
            <td style="font-family:var(--font-mono); font-size:0.75rem; color:#94a3b8;">\${ch.endpoint}</td>
            <td>\${keysHtml}</td>
            <td>\${ch.weight}</td>
            <td>\${modelsHtml}</td>
            <td><span class="badge-status \${statusClass}">\${ch.status.toUpperCase()}</span></td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="toggleChannel('\${ch.id}')">\${ch.status === 'healthy' ? '⏸ 停用' : '▶ 启用'}</button>
              <button class="btn btn-danger btn-sm" onclick="deleteChannel('\${ch.id}')">🗑</button>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      } catch (err) {
        showToast('加载渠道列表失败: ' + err.message, 'error');
      }
    }

    async function toggleChannel(id) {
      try {
        const res = await fetch('/api/admin/channels/' + encodeURIComponent(id) + '/toggle', {
          method: 'POST',
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('操作失败: HTTP ' + res.status);
        showToast('渠道状态已切换', 'success');
        loadChannels();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function deleteChannel(id) {
      if (!confirm('确定删除渠道 ' + id + ' 吗?')) return;
      try {
        const res = await fetch('/api/admin/channels/' + encodeURIComponent(id), {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('删除失败: HTTP ' + res.status);
        showToast('渠道已删除', 'success');
        loadChannels();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    function openAddModal() {
      document.getElementById('addChannelModal').classList.add('open');
    }

    function closeAddModal() {
      document.getElementById('addChannelModal').classList.remove('open');
    }

    async function submitAddChannel() {
      const id = document.getElementById('newChId').value.trim();
      const name = document.getElementById('newChName').value.trim();
      const protocol = document.getElementById('newChProtocol').value;
      const endpoint = document.getElementById('newChEndpoint').value.trim();
      const keysRaw = document.getElementById('newChKeys').value.trim();
      const modelsRaw = document.getElementById('newChModels').value.trim();
      const weight = Number(document.getElementById('newChWeight').value || 1);

      if (!id || !endpoint || !keysRaw) {
        showToast('请填写 ID、Endpoint 和 API Keys', 'error');
        return;
      }

      const apiKeys = keysRaw.split(',').map(s => s.trim()).filter(Boolean);
      const models = modelsRaw.split(',').map(s => s.trim()).filter(Boolean);

      try {
        const res = await fetch('/api/admin/channels', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ id, name: name || id, protocol, endpoint, apiKeys, models, weight }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || ('HTTP ' + res.status));
        }
        showToast('渠道添加成功', 'success');
        closeAddModal();
        loadChannels();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    // 2. Chat Playground (SSE Stream Relay)
    async function runChatCompletion() {
      const model = document.getElementById('chatModelSelect').value;
      const systemPrompt = document.getElementById('chatSystemPrompt').value.trim();
      const userPrompt = document.getElementById('chatUserPrompt').value.trim();
      const isStream = document.getElementById('chatStreamCheckbox').checked;

      const outputEl = document.getElementById('chatOutput');
      const statsEl = document.getElementById('chatStats');
      const sendBtn = document.getElementById('sendChatBtn');

      if (!userPrompt) {
        showToast('请输入用户消息内容', 'error');
        return;
      }

      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: userPrompt });

      outputEl.textContent = '';
      outputEl.classList.add('streaming');
      statsEl.textContent = '连接网关流中...';
      sendBtn.disabled = true;

      const startTime = performance.now();
      let firstTokenTime = null;

      try {
        const res = await fetch('/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (state.gatewayKey || state.adminKey),
          },
          body: JSON.stringify({
            model,
            messages,
            stream: isStream,
            stream_options: { include_usage: true }
          })
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error?.message || ('HTTP ' + res.status));
        }

        if (!isStream) {
          const data = await res.json();
          const latency = Math.round(performance.now() - startTime);
          outputEl.classList.remove('streaming');
          outputEl.textContent = data.choices?.[0]?.message?.content || '无内容返回';
          statsEl.textContent = \`总耗时: \${latency}ms | Tokens: \${data.usage?.total_tokens || 0} (Prompt: \${data.usage?.prompt_tokens || 0}, Completion: \${data.usage?.completion_tokens || 0})\`;
          sendBtn.disabled = false;
          return;
        }

        // SSE Streaming Read
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullText = '';
        let finalUsage = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;

            try {
              const chunk = JSON.parse(payload);
              if (!firstTokenTime) {
                firstTokenTime = Math.round(performance.now() - startTime);
              }
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                outputEl.textContent = fullText;
                outputEl.scrollTop = outputEl.scrollHeight;
              }
              if (chunk.usage) {
                finalUsage = chunk.usage;
              }
            } catch (e) {}
          }
        }

        const totalLatency = Math.round(performance.now() - startTime);
        outputEl.classList.remove('streaming');
        statsEl.textContent = \`首字耗时(TTFT): \${firstTokenTime || totalLatency}ms | 总耗时: \${totalLatency}ms | Tokens: \${finalUsage?.total_tokens || '估算中'}\`;
      } catch (err) {
        outputEl.classList.remove('streaming');
        outputEl.textContent = '❌ 调用出错: ' + err.message;
        statsEl.textContent = '';
        showToast('请求失败: ' + err.message, 'error');
      } finally {
        sendBtn.disabled = false;
      }
    }

    // 3. Video Playground
    async function submitVideoTask() {
      const model = document.getElementById('videoModelSelect').value;
      const prompt = document.getElementById('videoPrompt').value.trim();
      const statusCard = document.getElementById('videoTaskStatusCard');
      const titleEl = document.getElementById('taskStatusTitle');
      const badgeEl = document.getElementById('taskStatusBadge');
      const barEl = document.getElementById('videoProgressBar');
      const labelEl = document.getElementById('videoProgressLabel');
      const playerContainer = document.getElementById('videoPlayerContainer');
      const videoEl = document.getElementById('videoElement');

      if (!prompt) {
        showToast('请输入视频提示词', 'error');
        return;
      }

      statusCard.style.display = 'block';
      playerContainer.style.display = 'none';
      videoEl.pause();
      videoEl.src = '';

      titleEl.textContent = '提交生成任务...';
      badgeEl.className = 'badge-status status-cooling';
      badgeEl.textContent = 'PENDING';
      barEl.style.width = '10%';
      labelEl.textContent = '10%';

      try {
        const res = await fetch('/v1/videos/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (state.gatewayKey || state.adminKey),
          },
          body: JSON.stringify({ model, prompt })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || ('HTTP ' + res.status));
        }

        const task = await res.json();
        state.activeVideoTaskId = task.id;
        titleEl.textContent = '任务已启动: ' + task.id;

        // Start polling task progress
        if (state.videoPollTimer) clearInterval(state.videoPollTimer);
        state.videoPollTimer = setInterval(() => pollVideoTask(task.id), 1000);
      } catch (err) {
        titleEl.textContent = '任务提交失败: ' + err.message;
        badgeEl.className = 'badge-status status-dead';
        badgeEl.textContent = 'FAILED';
        showToast('视频任务提交失败: ' + err.message, 'error');
      }
    }

    async function pollVideoTask(taskId) {
      try {
        const res = await fetch('/v1/videos/tasks/' + taskId, {
          headers: { 'Authorization': 'Bearer ' + (state.gatewayKey || state.adminKey) }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const task = await res.json();

        const badgeEl = document.getElementById('taskStatusBadge');
        const barEl = document.getElementById('videoProgressBar');
        const labelEl = document.getElementById('videoProgressLabel');
        const titleEl = document.getElementById('taskStatusTitle');
        const playerContainer = document.getElementById('videoPlayerContainer');
        const videoEl = document.getElementById('videoElement');

        barEl.style.width = task.progress + '%';
        labelEl.textContent = task.progress + '%';
        titleEl.textContent = '任务运行中: ' + taskId;

        if (task.status === 'succeeded') {
          clearInterval(state.videoPollTimer);
          badgeEl.className = 'badge-status status-healthy';
          badgeEl.textContent = 'SUCCEEDED';
          titleEl.textContent = '✅ 视频生成已完成';
          if (task.videoUrl) {
            playerContainer.style.display = 'block';
            videoEl.src = task.videoUrl;
            videoEl.play().catch(() => {});
          }
          showToast('视频生成完成！', 'success');
        } else if (task.status === 'failed') {
          clearInterval(state.videoPollTimer);
          badgeEl.className = 'badge-status status-dead';
          badgeEl.textContent = 'FAILED';
          titleEl.textContent = '❌ 生成失败: ' + (task.error || '未知错误');
        } else {
          badgeEl.className = 'badge-status status-cooling';
          badgeEl.textContent = task.status.toUpperCase();
        }
      } catch (err) {
        console.warn('Poll error:', err);
      }
    }

    // 4. Logs & Metrics
    async function loadMetricsAndLogs() {
      try {
        const [metricsRes, logsRes] = await Promise.all([
          fetch('/api/admin/metrics', { headers: getAuthHeaders() }),
          fetch('/api/admin/logs?limit=50', { headers: getAuthHeaders() })
        ]);

        if (metricsRes.ok) {
          const m = await metricsRes.json();
          document.getElementById('metricTotalReq').textContent = m.totalRequests;
          const rate = m.totalRequests > 0 ? Math.round((m.totalSuccess / m.totalRequests) * 100) : 100;
          document.getElementById('metricSuccessRate').textContent = \`成功率: \${rate}% (\${m.totalSuccess} / \${m.totalRequests})\`;
          document.getElementById('metricAvgDuration').innerHTML = \`\${m.averageDurationMs} <span style="font-size:1rem; font-weight:normal;">ms</span>\`;
          document.getElementById('metricTotalTokens').textContent = m.totalTokens.toLocaleString();
          document.getElementById('metricTokenBreakdown').textContent = \`Prompt: \${m.totalPromptTokens.toLocaleString()} / Comp: \${m.totalCompletionTokens.toLocaleString()}\`;
        }

        if (logsRes.ok) {
          const data = await logsRes.json();
          const tbody = document.getElementById('logsTableBody');
          tbody.innerHTML = '';

          if (!data.logs || data.logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">暂无调用流水</td></tr>';
            return;
          }

          data.logs.forEach(log => {
            const tr = document.createElement('tr');
            const timeStr = new Date(log.timestamp).toLocaleTimeString();
            const statusClass = log.status === 'success' ? 'status-healthy' : 'status-dead';

            tr.innerHTML = \`
              <td style="font-family:var(--font-mono); color:var(--text-muted);">\${timeStr}</td>
              <td style="font-family:var(--font-mono); font-weight:600;">\${log.channelId || '-'}</td>
              <td><span class="tag">\${log.model}</span></td>
              <td>\${log.stream ? '⚡ SSE 流式' : '📦 同步'}</td>
              <td style="font-family:var(--font-mono);">\${log.durationMs}ms</td>
              <td style="font-family:var(--font-mono); font-size:0.75rem;">\${log.promptTokens} / \${log.completionTokens} / \${log.totalTokens}</td>
              <td style="font-family:var(--font-mono);">\${log.statusCode}</td>
              <td><span class="badge-status \${statusClass}">\${log.status.toUpperCase()}</span></td>
            \`;
            tbody.appendChild(tr);
          });
        }
      } catch (err) {
        showToast('大盘数据拉取失败: ' + err.message, 'error');
      }
    }

    // Initial load
    loadChannels();
  </script>
</body>
</html>`;
}
