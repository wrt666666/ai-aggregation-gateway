/**
 * AI Gateway Main Entry Point (Hono Gateway)
 * Features: Auth, Channel Routing, Silent Failover, Anti-Half-Packet SSE, Protocol Adaptation
 */

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { ChannelRouter } from './core/router.js';
import { createStreamRelay } from './core/stream-relay.js';
import type { ChannelConfig, ChatCompletionRequest } from './types/schema.js';

const app = new Hono();

// Cross-origin & basic middlewares
app.use('*', cors());

const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY || 'sk-gateway-secret-key-123456';
const PORT = Number(process.env.PORT || 3000);

// Initialize router with default upstream channels
const defaultChannels: ChannelConfig[] = [
  {
    id: 'primary-openai',
    name: 'Primary OpenAI Channel',
    endpoint: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    protocol: 'openai',
    apiKeys: (process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY || 'sk-test-key-1,sk-test-key-2')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    weight: 10,
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
  },
  {
    id: 'backup-anthropic',
    name: 'Backup Anthropic Channel',
    endpoint: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
    protocol: 'anthropic',
    apiKeys: (process.env.ANTHROPIC_API_KEYS || process.env.ANTHROPIC_API_KEY || 'sk-ant-test-key')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    weight: 5,
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    modelMapping: {
      'gpt-4o': 'claude-3-5-sonnet-20241022',
      'gpt-4o-mini': 'claude-3-5-haiku-20241022',
    },
  },
];

export const router = new ChannelRouter(defaultChannels);

// Authentication Middleware
const authMiddleware = async (c: Context, next: () => Promise<void>) => {
  if (GATEWAY_API_KEY) {
    const authHeader = c.req.header('Authorization') || c.req.header('x-api-key');
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

    if (!token || token !== GATEWAY_API_KEY) {
      return c.json(
        {
          error: {
            message: 'Unauthorized: Invalid Gateway API Key',
            type: 'invalid_request_error',
            code: 401,
          },
        },
        401
      );
    }
  }
  await next();
};

app.use('/v1/*', authMiddleware);
app.use('/chat/*', authMiddleware);
app.use('/models/*', authMiddleware);
app.use('/admin/*', authMiddleware);

// Health & Monitoring (Public)
app.get('/health', (c) => {
  const channels = router.getAllChannels().map((ch) => ({
    id: ch.id,
    name: ch.name,
    protocol: ch.protocol,
    status: ch.status,
    consecutiveFailures: ch.consecutiveFailures,
    failedCount: ch.failedCount,
    cooldownUntil: ch.cooldownUntil,
  }));

  return c.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    channels,
  });
});

function getModelList() {
  const allChannels = router.getAllChannels();
  const modelSet = new Set<string>();

  for (const ch of allChannels) {
    for (const m of ch.models) {
      if (m !== '*') modelSet.add(m);
    }
    if (ch.modelMapping) {
      for (const m of Object.keys(ch.modelMapping)) {
        modelSet.add(m);
      }
    }
  }

  return Array.from(modelSet).map((modelId) => ({
    id: modelId,
    object: 'model',
    created: 1700000000,
    owned_by: 'ai-gateway',
  }));
}

// Models List Endpoint
const handleModelsList = (c: Context) => {
  return c.json({
    object: 'list',
    data: getModelList(),
  });
};

app.get('/v1/models', handleModelsList);
app.get('/models', handleModelsList);

// Model Detail Endpoint
const handleModelDetail = (c: Context) => {
  const modelId = c.req.param('model') || '';
  const models = getModelList();
  const found = models.find((m) => m.id === modelId);

  if (!found && !router.hasModel(modelId)) {
    return c.json(
      {
        error: {
          message: `The model '${modelId}' does not exist`,
          type: 'invalid_request_error',
          param: 'model',
          code: 'model_not_found',
        },
      },
      404
    );
  }

  return c.json(
    found || {
      id: modelId,
      object: 'model',
      created: 1700000000,
      owned_by: 'ai-gateway',
    }
  );
};

app.get('/v1/models/:model', handleModelDetail);
app.get('/models/:model', handleModelDetail);

// Admin channel registration & status
app.get('/admin/channels', (c) => {
  const showKeys = c.req.query('showKeys') === 'true';
  const channels = router.getAllChannels().map((ch) => ({
    ...ch,
    apiKeys: showKeys
      ? ch.apiKeys
      : ch.apiKeys.map((k) => (k.length > 8 ? `${k.slice(0, 4)}***${k.slice(-4)}` : '***')),
  }));

  return c.json({ channels });
});

app.post('/admin/channels', async (c) => {
  try {
    const body = await c.req.json<ChannelConfig>();
    if (!body.id || !body.endpoint || !body.apiKeys) {
      return c.json({ error: 'Missing required fields: id, endpoint, apiKeys' }, 400);
    }
    const node = router.registerChannel(body);
    return c.json({ success: true, channel: node });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

app.delete('/admin/channels/:id', (c) => {
  const id = c.req.param('id');
  const deleted = router.removeChannel(id);
  if (!deleted) {
    return c.json({ error: `Channel with id '${id}' not found` }, 404);
  }
  return c.json({ success: true, message: `Channel '${id}' removed` });
});

app.post('/admin/channels/:id/reset', (c) => {
  const id = c.req.param('id');
  const reset = router.resetChannel(id);
  if (!reset) {
    return c.json({ error: `Channel with id '${id}' not found` }, 404);
  }
  return c.json({ success: true, message: `Channel '${id}' reset to healthy` });
});

// Core Chat Completion Gateway Endpoint with Silent Failover
const handleChatCompletion = async (c: Context) => {
  let reqBody: ChatCompletionRequest;
  try {
    reqBody = await c.req.json<ChatCompletionRequest>();
  } catch {
    return c.json({ error: { message: 'Malformed JSON payload', type: 'invalid_request_error', code: 400 } }, 400);
  }

  if (!reqBody.model) {
    return c.json({ error: { message: 'Missing model parameter', type: 'invalid_request_error', code: 400 } }, 400);
  }

  if (!Array.isArray(reqBody.messages) || reqBody.messages.length === 0) {
    return c.json({ error: { message: 'Missing or empty messages list', type: 'invalid_request_error', code: 400 } }, 400);
  }

  // Verify if requested model is supported by any configured channel
  if (!router.hasModel(reqBody.model)) {
    return c.json(
      {
        error: {
          message: `The model '${reqBody.model}' does not exist or is not supported by any configured channel.`,
          type: 'invalid_request_error',
          param: 'model',
          code: 'model_not_found',
        },
      },
      404
    );
  }

  // Pre-calculate prompt content text for accurate token accounting
  const promptCombinedText = reqBody.messages
    .map((m) =>
      typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map((c) => (c.type === 'text' ? c.text || '' : '')).join(' ')
          : ''
    )
    .join(' ');

  const triedChannelIds = new Set<string>();
  const allChannels = router.getAllChannels();
  const maxRetries = Math.max(3, allChannels.length);
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const candidate = router.selectRoute(reqBody.model, triedChannelIds);

    if (!candidate) {
      break;
    }

    triedChannelIds.add(candidate.channel.id);
    const upstreamReq = router.buildUpstreamRequest(candidate, reqBody);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000);

      const upstreamResponse = await fetch(upstreamReq.url, {
        method: upstreamReq.method,
        headers: upstreamReq.headers,
        body: upstreamReq.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle upstream failure
      if (!upstreamResponse.ok) {
        const errorText = await upstreamResponse.text();
        router.recordFailure(candidate.channel.id, errorText);
        lastError = {
          channelId: candidate.channel.id,
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          body: errorText,
        };
        console.warn(
          `[Gateway Failover] Channel '${candidate.channel.id}' returned status ${upstreamResponse.status}. Attempting next channel...`
        );
        continue;
      }

      // Success
      router.recordSuccess(candidate.channel.id);

      // Streaming response
      if (reqBody.stream) {
        if (!upstreamResponse.body) {
          throw new Error('Upstream response has no readable body for streaming');
        }

        const relayStream = createStreamRelay(upstreamResponse.body as ReadableStream<Uint8Array>, {
          protocol: candidate.channel.protocol,
          model: reqBody.model,
          promptText: promptCombinedText,
          includeUsage: reqBody.stream_options?.include_usage,
          onUsageSettled: (usage) => {
            console.log(
              `[Gateway Stream] Settled tokens for ${reqBody.model} via ${candidate.channel.id}:`,
              usage
            );
          },
        });

        return new Response(relayStream, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'x-gateway-channel': candidate.channel.id,
          },
        });
      }

      // Non-streaming response
      const upstreamJson = await upstreamResponse.json();
      const standardResponse = router.transformResponse(candidate.channel, upstreamJson, reqBody.model);

      return c.json(standardResponse, 200, {
        'x-gateway-channel': candidate.channel.id,
      });
    } catch (err: any) {
      router.recordFailure(candidate.channel.id, err);
      lastError = {
        channelId: candidate.channel.id,
        error: err?.message || String(err),
      };
      console.warn(
        `[Gateway Failover] Channel '${candidate.channel.id}' failed with exception: ${err?.message}. Attempting next channel...`
      );
    }
  }

  // All eligible channels were tried or cooling
  const statusCode = triedChannelIds.size > 0 ? 502 : 503;
  return c.json(
    {
      error: {
        message:
          triedChannelIds.size > 0
            ? 'All available upstream channels exhausted or failed to respond'
            : `All channels for model '${reqBody.model}' are currently cooling or unavailable.`,
        type: 'gateway_error',
        code: statusCode,
        details: lastError,
      },
    },
    statusCode
  );
};

app.post('/v1/chat/completions', handleChatCompletion);
app.post('/chat/completions', handleChatCompletion);

// Start Server
export function startServer(port = PORT) {
  console.log(`Starting AI Gateway on port ${port}...`);
  const server = serve({
    fetch: app.fetch,
    port,
  });
  console.log(`AI Gateway listening on http://localhost:${port}`);
  return server;
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isDirectRun) {
  startServer();
}

export default app;
