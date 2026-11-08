/**
 * Comprehensive Gateway Test Suite
 * Tests:
 * 1. Router: Multi-Key Round Robin, Weighted Selection, Circuit Breaker Cooldown & Recovery
 * 2. Protocol Adapters: Request building and response transformation (OpenAI, Anthropic, Gemini)
 * 3. Stream Relay: Anti-half-packet parsing, chunk reassembly, token usage calculation
 * 4. End-to-End Gateway: Auth verification, Models listing, and Silent Failover with Mock Upstreams
 */

process.env.NODE_ENV = 'test';
import assert from 'node:assert';
import { ChannelRouter } from '../src/core/router.js';
import { stateStore } from '../src/core/state-store.js';
import { createStreamRelay } from '../src/core/stream-relay.js';
import app, { router as gatewayRouter } from '../src/index.js';
import type { Usage } from '../src/types/schema.js';

async function runTests() {
  console.log('=== AI Gateway Verification Suite ===\n');

  // Test 1: Channel Router & Multi-Key Round Robin
  console.log('[Test 1] Testing Channel Router & Multi-Key Round Robin...');
  const router = new ChannelRouter([
    {
      id: 'test-openai',
      name: 'OpenAI Test Node',
      endpoint: 'https://mock.openai.com/v1',
      protocol: 'openai',
      apiKeys: ['key-alpha', 'key-beta', 'key-gamma'],
      weight: 10,
      models: ['gpt-4o', 'gpt-4o-mini'],
      maxFailures: 2,
      cooldownDurationMs: 500, // 500ms cooldown for fast test
    },
    {
      id: 'test-backup',
      name: 'Backup Test Node',
      endpoint: 'https://mock.backup.com/v1',
      protocol: 'openai',
      apiKeys: ['key-backup'],
      weight: 1,
      models: ['fallback-model'],
      maxFailures: 3,
    },
  ]);

  // Check round-robin of api keys
  const route1 = router.selectRoute('gpt-4o');
  assert.strictEqual(route1?.apiKey, 'key-alpha');
  const route2 = router.selectRoute('gpt-4o');
  assert.strictEqual(route2?.apiKey, 'key-beta');
  const route3 = router.selectRoute('gpt-4o');
  assert.strictEqual(route3?.apiKey, 'key-gamma');
  const route4 = router.selectRoute('gpt-4o');
  assert.strictEqual(route4?.apiKey, 'key-alpha');
  console.log('  ✓ Multi-key round robin works correctly.');

  // Test 2: Circuit Breaker & Cooldown
  console.log('\n[Test 2] Testing Circuit Breaker & Cooldown Recovery...');
  router.recordFailure('test-openai', '500 Internal Server Error');
  assert.strictEqual(router.getChannel('test-openai')?.status, 'healthy');
  assert.strictEqual(router.getChannel('test-openai')?.consecutiveFailures, 1);

  router.recordFailure('test-openai', '500 Internal Server Error'); // hits maxFailures = 2
  assert.strictEqual(router.getChannel('test-openai')?.status, 'cooling');
  console.log('  ✓ Channel correctly tripped to cooling state after 2 failures.');

  // Enable gpt-4o on backup to test failover routing
  router.getChannel('test-backup')!.models.push('gpt-4o');

  // Selecting route should now skip 'test-openai' and route to 'test-backup'
  const fallbackRoute = router.selectRoute('gpt-4o');
  assert.strictEqual(fallbackRoute?.channel.id, 'test-backup');
  console.log('  ✓ Router automatically skipped cooling channel and picked backup.');

  // Reset backup models so recovered node is unambiguously chosen
  router.getChannel('test-backup')!.models = ['fallback-model'];

  // Wait for cooldown to expire
  console.log('  Waiting 550ms for cooldown expiration...');
  await new Promise((r) => setTimeout(r, 550));

  // Cooldown auto-recovery
  const recoveredRoute = router.selectRoute('gpt-4o');
  assert.strictEqual(recoveredRoute?.channel.id, 'test-openai');
  assert.strictEqual(router.getChannel('test-openai')?.status, 'healthy');
  console.log('  ✓ Channel successfully auto-recovered to healthy after cooldown.');

  // Test 3: Protocol Adapters
  console.log('\n[Test 3] Testing Protocol Request Adapters & Response Normalization...');
  const anthropicRouter = new ChannelRouter([
    {
      id: 'node-anthropic',
      name: 'Anthropic Node',
      endpoint: 'https://api.anthropic.com/v1',
      protocol: 'anthropic',
      apiKeys: ['sk-ant-test'],
      models: ['claude-3-5-sonnet-20241022'],
      modelMapping: {
        'gpt-4o': 'claude-3-5-sonnet-20241022',
      },
    },
  ]);

  const candidate = anthropicRouter.selectRoute('gpt-4o');
  assert.ok(candidate);
  const upstreamReq = anthropicRouter.buildUpstreamRequest(candidate, {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello!' },
    ],
    temperature: 0.7,
  });

  assert.strictEqual(upstreamReq.url, 'https://api.anthropic.com/v1/messages');
  assert.strictEqual(upstreamReq.headers['x-api-key'], 'sk-ant-test');
  const anthropicBody = JSON.parse(upstreamReq.body);
  assert.strictEqual(anthropicBody.model, 'claude-3-5-sonnet-20241022');
  assert.strictEqual(anthropicBody.system, 'You are helpful.');
  assert.strictEqual(anthropicBody.messages[0].content, 'Hello!');
  console.log('  ✓ Anthropic request builder translated OpenAI message schema correctly.');

  // Test Anthropic response normalization
  const mockAnthropicResponse = {
    id: 'msg_01XyZ',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello from Claude!' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 15, output_tokens: 25 },
  };

  const normalized = anthropicRouter.transformResponse(
    candidate.channel,
    mockAnthropicResponse,
    'gpt-4o'
  );
  assert.strictEqual(normalized.object, 'chat.completion');
  assert.strictEqual(normalized.model, 'gpt-4o');
  assert.strictEqual(normalized.choices[0].message.content, 'Hello from Claude!');
  assert.strictEqual(normalized.usage?.prompt_tokens, 15);
  assert.strictEqual(normalized.usage?.completion_tokens, 25);
  assert.strictEqual(normalized.usage?.total_tokens, 40);
  console.log('  ✓ Anthropic response normalized to OpenAI ChatCompletionResponse correctly.');

  // Test 4: Stream Relay with Anti-Half-Packet SSE & Usage Settlement
  console.log('\n[Test 4] Testing Anti-Half-Packet SSE Stream Relay & Usage Settlement...');
  // Simulate fragmented stream chunks across byte boundaries
  const fragments = [
    'data: {"id":"chat-1","choices":[{"index":0,"delta":{"content":"Hel', // incomplete JSON
    'lo "}}]}\n\n', // completed first event
    'data: {"id":"chat-1","choices":[{"index":0,"delta":{"content":"world', // incomplete JSON
    '!"}}]}\n\n', // completed second event
    'data: [DONE]\n\n',
  ];

  const encoder = new TextEncoder();
  const mockReadable = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const frag of fragments) {
        controller.enqueue(encoder.encode(frag));
      }
      controller.close();
    },
  });

  let settledUsage: Usage | null = null;
  const relayedStream = createStreamRelay(mockReadable, {
    protocol: 'openai',
    model: 'gpt-4o',
    onUsageSettled: (u) => {
      settledUsage = u;
    },
  });

  const reader = relayedStream.getReader();
  const decoder = new TextDecoder();
  let receivedData = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedData += decoder.decode(value);
  }

  assert.ok(receivedData.includes('Hello '));
  assert.ok(receivedData.includes('world!'));
  assert.ok(receivedData.includes('data: [DONE]'));
  assert.ok(settledUsage);
  assert.ok((settledUsage as Usage).completion_tokens > 0);
  console.log('  ✓ Anti-half-packet reassembly and token settlement verified successfully.');
  console.log(`    Settled Usage: Prompt=${settledUsage?.prompt_tokens}, Completion=${settledUsage?.completion_tokens}, Total=${settledUsage?.total_tokens}`);

  // Test 5: End-to-End Hono Gateway Integration & Auth
  console.log('\n[Test 5] Testing Hono Gateway Endpoints & Authentication...');
  // 5.1 Unauthorized test
  const unauthRes = await app.request('/v1/models', {
    method: 'GET',
  });
  assert.strictEqual(unauthRes.status, 401);
  console.log('  ✓ 401 Unauthorized returned when API Key is missing or invalid.');

  // 5.2 Authorized test: models endpoint
  const authRes = await app.request('/v1/models', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer sk-gateway-secret-key-123456',
    },
  });
  assert.strictEqual(authRes.status, 200);
  const modelsData = await authRes.json();
  assert.strictEqual(modelsData.object, 'list');
  assert.ok(modelsData.data.length > 0);
  console.log(`  ✓ Models list returned ${modelsData.data.length} models.`);

  // 5.3 Health endpoint
  const healthRes = await app.request('/health');
  assert.strictEqual(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.strictEqual(healthData.status, 'ok');
  assert.ok(Array.isArray(healthData.channels));
  console.log('  ✓ Health endpoint responded with system status and channels.');

  // Test 6: End-to-End Mock Upstream & Silent Failover
  console.log('\n[Test 6] Testing End-to-End Silent Failover Mechanism...');
  // We register two test upstream mock endpoints via a dynamic mock fetch or custom channels
  // Setup a mini mock server using Node's http or fetch interception
  const originalFetch = globalThis.fetch;
  let primaryCallCount = 0;
  let backupCallCount = 0;

  // Intercept global fetch for test 6
  globalThis.fetch = (async (input: any, init?: any) => {
    const urlStr = typeof input === 'string' ? input : input.url;

    if (urlStr.includes('api.openai.com')) {
      primaryCallCount++;
      // Simulate primary channel returning 500 server error
      return new Response(JSON.stringify({ error: 'OpenAI 500 Overloaded' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (urlStr.includes('api.anthropic.com')) {
      backupCallCount++;
      // Backup Anthropic channel returns success
      return new Response(
        JSON.stringify({
          id: 'msg_backup_ok',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Failover to Anthropic succeeded seamlessly!' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 12 },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return originalFetch(input, init);
  }) as any;

  // Configure gatewayRouter weights to ensure primary is picked first
  const primaryCh = gatewayRouter.getChannel('primary-openai')!;
  const backupCh = gatewayRouter.getChannel('backup-anthropic')!;
  primaryCh.weight = 100000;
  primaryCh.status = 'healthy';
  primaryCh.consecutiveFailures = 0;
  backupCh.weight = 1;
  backupCh.status = 'healthy';
  backupCh.consecutiveFailures = 0;

  try {
    const chatRes = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-gateway-secret-key-123456',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi test' }],
      }),
    });

    assert.strictEqual(chatRes.status, 200);
    const chatData = await chatRes.json();
    assert.strictEqual(
      chatData.choices[0].message.content,
      'Failover to Anthropic succeeded seamlessly!'
    );
    assert.strictEqual(chatRes.headers.get('x-gateway-channel'), 'backup-anthropic');
    assert.ok(primaryCallCount >= 1, 'Primary channel should have been attempted');
    assert.ok(backupCallCount >= 1, 'Backup channel should have been engaged');
    console.log('  ✓ Silent Failover verified: Primary failed (500) -> Seamlessly switched to Backup channel.');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Test 7: End-to-End Streaming Chat Completion Relay
  console.log('\n[Test 7] Testing End-to-End Streaming Chat Completion Relay...');
  const mockStreamFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init: any) => {
    const s = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Live stream token content"}}]}\n\n'));
        c.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        c.close();
      },
    });
    return new Response(s, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }) as any;

  try {
    const streamRes = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-gateway-secret-key-123456',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        stream: true,
        messages: [{ role: 'user', content: 'Stream test' }],
      }),
    });

    assert.strictEqual(streamRes.status, 200);
    assert.ok(streamRes.headers.get('content-type')?.includes('text/event-stream'));
    const bodyText = await streamRes.text();
    assert.ok(bodyText.includes('Live stream token'));
    assert.ok(bodyText.includes('[DONE]'));
    console.log('  ✓ End-to-End Streaming SSE relay returned 200 with text/event-stream.');
  } finally {
    globalThis.fetch = mockStreamFetch;
  }

  // Test 8: Gemini Protocol Request & Response Mapping
  console.log('\n[Test 8] Testing Gemini Protocol Request Adapter & Finish Reason Mapping...');
  const geminiRouter = new ChannelRouter([
    {
      id: 'node-gemini',
      name: 'Gemini Node',
      endpoint: 'https://generativelanguage.googleapis.com',
      protocol: 'gemini',
      apiKeys: ['sk-gemini-test-key'],
      models: ['gemini-1.5-flash'],
    },
  ]);

  const geminiCandidate = geminiRouter.selectRoute('gemini-1.5-flash');
  assert.ok(geminiCandidate);
  const geminiReq = geminiRouter.buildUpstreamRequest(geminiCandidate, {
    model: 'gemini-1.5-flash',
    messages: [
      { role: 'system', content: 'Gemini system instruction.' },
      { role: 'user', content: 'Part 1' },
      { role: 'user', content: 'Part 2' }, // Consecutive user messages
    ],
    temperature: 0.2,
  });

  assert.ok(geminiReq.url.includes('/v1beta/models/gemini-1.5-flash:generateContent?key=sk-gemini-test-key'));
  assert.strictEqual(geminiReq.headers['x-goog-api-key'], 'sk-gemini-test-key');
  const geminiBody = JSON.parse(geminiReq.body);
  assert.strictEqual(geminiBody.systemInstruction.parts[0].text, 'Gemini system instruction.');
  // Consecutive user turns must be merged into 1 contents entry
  assert.strictEqual(geminiBody.contents.length, 1);
  assert.strictEqual(geminiBody.contents[0].parts.length, 2);
  assert.strictEqual(geminiBody.contents[0].parts[0].text, 'Part 1');
  assert.strictEqual(geminiBody.contents[0].parts[1].text, 'Part 2');

  // Test Gemini response mapping for MAX_TOKENS -> length
  const geminiMaxTokensRes = geminiRouter.transformResponse(
    geminiCandidate.channel,
    {
      candidates: [
        {
          content: { parts: [{ text: 'Cut off response' }] },
          finishReason: 'MAX_TOKENS',
        },
      ],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 50 },
    },
    'gemini-1.5-flash'
  );
  assert.strictEqual(geminiMaxTokensRes.choices[0].finish_reason, 'length');
  assert.strictEqual(geminiMaxTokensRes.usage?.total_tokens, 62);
  console.log('  ✓ Gemini request building and finishReason (MAX_TOKENS -> length) verified.');

  // Test 9: Anthropic & Gemini Streaming SSE Relays
  console.log('\n[Test 9] Testing Anthropic & Gemini Cross-Model Streaming Relays...');
  // Anthropic streaming simulation
  const anthropicSSEChunks = [
    'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","role":"assistant","usage":{"input_tokens":8}}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello "}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Claude"}}\n\n',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":6}}\n\n',
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ];

  const anthropicStream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of anthropicSSEChunks) {
        c.enqueue(new TextEncoder().encode(ch));
      }
      c.close();
    },
  });

  let anthropicSettled: Usage | null = null;
  const anthropicRelayed = createStreamRelay(anthropicStream, {
    protocol: 'anthropic',
    model: 'claude-3-5-sonnet',
    onUsageSettled: (u) => {
      anthropicSettled = u;
    },
  });

  const anthropicReader = anthropicRelayed.getReader();
  let anthropicOutput = '';
  while (true) {
    const { done, value } = await anthropicReader.read();
    if (done) break;
    anthropicOutput += new TextDecoder().decode(value);
  }

  assert.ok(anthropicOutput.includes('"content":"Hello "'));
  assert.ok(anthropicOutput.includes('"content":"Claude"'));
  assert.ok(anthropicOutput.includes('"finish_reason":"stop"'));
  assert.ok(anthropicOutput.includes('data: [DONE]'));
  assert.strictEqual(anthropicSettled?.prompt_tokens, 8);
  assert.strictEqual(anthropicSettled?.completion_tokens, 6);
  console.log('  ✓ Anthropic SSE stream converted to OpenAI chunks with accurate usage settlement.');

  // Test 10: Stream Options include_usage
  console.log('\n[Test 10] Testing stream_options.include_usage in SSE Pipeline...');
  const geminiSSEChunks = [
    'data: {"candidates":[{"content":{"parts":[{"text":"Stream chunk 1"}]}}]}\n\n',
    'data: {"candidates":[{"content":{"parts":[{"text":" and 2"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":10}}\n\n',
  ];

  const geminiStream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of geminiSSEChunks) {
        c.enqueue(new TextEncoder().encode(ch));
      }
      c.close();
    },
  });

  const geminiRelayed = createStreamRelay(geminiStream, {
    protocol: 'gemini',
    model: 'gemini-1.5-flash',
    includeUsage: true,
  });

  const geminiReader = geminiRelayed.getReader();
  let geminiOutput = '';
  while (true) {
    const { done, value } = await geminiReader.read();
    if (done) break;
    geminiOutput += new TextDecoder().decode(value);
  }

  assert.ok(geminiOutput.includes('"content":"Stream chunk 1"'));
  assert.ok(geminiOutput.includes('"content":" and 2"'));
  assert.ok(geminiOutput.includes('"usage":{"prompt_tokens":5,"completion_tokens":10,"total_tokens":15}'));
  assert.ok(geminiOutput.includes('data: [DONE]'));
  console.log('  ✓ Gemini SSE stream generated standardized chunk with include_usage successfully.');

  // Test 11: Admin Security & 404 Model Not Found
  console.log('\n[Test 11] Testing Admin Security & 404 Model Not Found Handling...');
  // 11.1 Admin endpoints require auth
  const unauthAdmin = await app.request('/admin/channels');
  assert.strictEqual(unauthAdmin.status, 401);

  // 11.2 Admin endpoints mask API keys by default
  const authAdmin = await app.request('/admin/channels', {
    headers: { Authorization: 'Bearer sk-gateway-secret-key-123456' },
  });
  assert.strictEqual(authAdmin.status, 200);
  const adminData = await authAdmin.json();
  const firstKey = adminData.channels[0].apiKeys[0];
  assert.ok(firstKey.includes('***'), 'API keys must be masked in admin endpoint');

  // 11.3 Requesting unsupported model returns 404 model_not_found
  const missingModelRes = await app.request('/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-gateway-secret-key-123456',
    },
    body: JSON.stringify({
      model: 'non-existent-super-ai',
      messages: [{ role: 'user', content: 'test' }],
    }),
  });
  assert.strictEqual(missingModelRes.status, 404);
  const missingData = await missingModelRes.json();
  assert.strictEqual(missingData.error.code, 'model_not_found');
  console.log('  ✓ Admin security and 404 model_not_found behavior verified.');

  // Test 12: SPA Dashboard & Admin Management APIs
  console.log('\n[Test 12] Testing SPA Dashboard & Admin Management APIs...');
  // 12.1 Public SPA page
  const spaRes = await app.request('/admin');
  assert.strictEqual(spaRes.status, 200);
  const html = await spaRes.text();
  assert.ok(html.includes('AI Gateway Hub'), 'Admin SPA HTML title not found');
  assert.ok(html.includes('id="tab-channels"'), 'Channels tab missing');
  assert.ok(html.includes('id="tab-playground"'), 'Playground tab missing');
  assert.ok(html.includes('id="tab-logs"'), 'Logs tab missing');

  // 12.2 Admin API auth with X-Admin-Key
  const adminChannelsRes = await app.request('/api/admin/channels', {
    headers: { 'X-Admin-Key': 'admin-secret-2026' },
  });
  assert.strictEqual(adminChannelsRes.status, 200);
  const adminChannelsData = await adminChannelsRes.json();
  assert.ok(Array.isArray(adminChannelsData.channels));
  assert.ok(adminChannelsData.channels[0].apiKeys[0].includes('***'));

  // 12.3 Dynamic Channel Add & Field Validation
  const invalidAddRes = await app.request('/api/admin/channels', {
    method: 'POST',
    headers: { 'X-Admin-Key': 'admin-secret-2026', 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'broken-ch' }),
  });
  assert.strictEqual(invalidAddRes.status, 400);

  const addChannelRes = await app.request('/api/admin/channels', {
    method: 'POST',
    headers: { 'X-Admin-Key': 'admin-secret-2026', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'dynamic-test-node',
      name: 'Dynamic Test Channel',
      endpoint: 'https://mock.dynamic.com/v1',
      protocol: 'openai',
      apiKeys: ['sk-dynamic-123456789'],
      models: ['test-model'],
      weight: 5,
    }),
  });
  assert.strictEqual(addChannelRes.status, 200);
  assert.ok(gatewayRouter.getChannel('dynamic-test-node'));

  // 12.4 Toggle Channel Status
  const toggleRes = await app.request('/api/admin/channels/dynamic-test-node/toggle', {
    method: 'POST',
    headers: { 'X-Admin-Key': 'admin-secret-2026' },
  });
  assert.strictEqual(toggleRes.status, 200);
  assert.strictEqual(gatewayRouter.getChannel('dynamic-test-node')?.status, 'dead');

  const toggleBackRes = await app.request('/api/admin/channels/dynamic-test-node/toggle', {
    method: 'POST',
    headers: { 'X-Admin-Key': 'admin-secret-2026' },
  });
  assert.strictEqual(toggleBackRes.status, 200);
  assert.strictEqual(gatewayRouter.getChannel('dynamic-test-node')?.status, 'healthy');

  // 12.5 Dynamic Delete Channel
  const deleteRes = await app.request('/api/admin/channels/dynamic-test-node', {
    method: 'DELETE',
    headers: { 'X-Admin-Key': 'admin-secret-2026' },
  });
  assert.strictEqual(deleteRes.status, 200);
  assert.strictEqual(gatewayRouter.getChannel('dynamic-test-node'), undefined);

  // 12.6 Metrics & Logs endpoints
  const metricsRes = await app.request('/api/admin/metrics', {
    headers: { 'X-Admin-Key': 'admin-secret-2026' },
  });
  assert.strictEqual(metricsRes.status, 200);
  const metricsData = await metricsRes.json();
  assert.strictEqual(typeof metricsData.totalRequests, 'number');

  const logsRes = await app.request('/api/admin/logs?limit=10', {
    headers: { 'X-Admin-Key': 'admin-secret-2026' },
  });
  assert.strictEqual(logsRes.status, 200);
  const logsData = await logsRes.json();
  assert.ok(Array.isArray(logsData.logs));
  console.log('  ✓ SPA Dashboard and Admin Management APIs verified successfully.');

  // Test 13: Async Video Generation & StateStore FIFO Ring Buffer
  console.log('\n[Test 13] Testing Async Video Generation & StateStore Circular Buffer...');
  // 13.1 Video prompt validation
  const invalidVideoRes = await app.request('/v1/videos/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-gateway-secret-key-123456',
    },
    body: JSON.stringify({}),
  });
  assert.strictEqual(invalidVideoRes.status, 400);

  // 13.2 Create valid video task
  const createVideoRes = await app.request('/v1/videos/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-gateway-secret-key-123456',
    },
    body: JSON.stringify({
      model: 'sora-1.0',
      prompt: 'Cyberpunk flying car in rainy Tokyo night',
    }),
  });
  assert.strictEqual(createVideoRes.status, 202);
  const taskData = await createVideoRes.json();
  assert.ok(taskData.id.startsWith('vid_'));
  assert.strictEqual(taskData.status, 'pending');

  // 13.3 Query video task
  const queryVideoRes = await app.request(`/v1/videos/tasks/${taskData.id}`, {
    headers: { Authorization: 'Bearer sk-gateway-secret-key-123456' },
  });
  assert.strictEqual(queryVideoRes.status, 200);
  const queriedTask = await queryVideoRes.json();
  assert.strictEqual(queriedTask.id, taskData.id);

  // 13.4 Query 404 video task
  const notFoundVideoRes = await app.request('/v1/videos/tasks/vid_non_existent', {
    headers: { Authorization: 'Bearer sk-gateway-secret-key-123456' },
  });
  assert.strictEqual(notFoundVideoRes.status, 404);

  // 13.5 StateStore FIFO Ring Buffer Boundary (insert > 200 logs)
  for (let i = 0; i < 220; i++) {
    stateStore.appendLog({
      id: `stress-log-${i}`,
      timestamp: Date.now(),
      model: 'gpt-4o',
      stream: false,
      durationMs: 50,
      status: 'success',
      statusCode: 200,
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    });
  }
  const allLogs = stateStore.getLogs(300);
  assert.strictEqual(allLogs.length, 200, 'Circular buffer must be strictly capped at 200 items');
  assert.strictEqual(allLogs[0].id, 'stress-log-219', 'Newest log must be at index 0');
  const metricsAfterStress = stateStore.getMetrics();
  assert.strictEqual(metricsAfterStress.totalRequests, 200);
  assert.strictEqual(metricsAfterStress.totalTokens, 200 * 30);
  console.log('  ✓ Async video generation and StateStore 200 FIFO buffer verified successfully.');

  console.log('\n=======================================');
  console.log('🎉 ALL 13 VERIFICATION TEST SUITES PASSED!');
  console.log('=======================================');
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
