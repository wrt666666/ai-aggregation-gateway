/**
 * Channel Router, Load Balancer, Circuit Breaker & Protocol Adapter
 */

import type {
  ChannelConfig,
  ChannelNode,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage
} from '../types/schema.js';

export interface RouteCandidate {
  channel: ChannelNode;
  apiKey: string;
  upstreamModel: string;
}

export interface UpstreamHttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

export class ChannelRouter {
  private channels: Map<string, ChannelNode> = new Map();

  constructor(initialConfigs: ChannelConfig[] = []) {
    for (const config of initialConfigs) {
      this.registerChannel(config);
    }
  }

  /**
   * Register or update a channel node
   */
  public registerChannel(config: ChannelConfig): ChannelNode {
    const apiKeys = (config.apiKeys || [])
      .map((k) => k.trim())
      .filter(Boolean);

    const node: ChannelNode = {
      id: config.id,
      name: config.name,
      endpoint: config.endpoint.replace(/\/+$/, ''),
      protocol: config.protocol || 'openai',
      apiKeys: apiKeys.length > 0 ? apiKeys : ['dummy-key'],
      keyIndex: 0,
      weight: config.weight && config.weight > 0 ? config.weight : 1,
      models: config.models && config.models.length > 0 ? config.models : ['*'],
      modelMapping: config.modelMapping || {},
      status: 'healthy',
      failedCount: 0,
      consecutiveFailures: 0,
      maxFailures: config.maxFailures || 3,
      cooldownUntil: 0,
      cooldownDurationMs: config.cooldownDurationMs || 30_000,
    };
    this.channels.set(node.id, node);
    return node;
  }

  public getChannel(id: string): ChannelNode | undefined {
    return this.channels.get(id);
  }

  public getAllChannels(): ChannelNode[] {
    return Array.from(this.channels.values());
  }

  public removeChannel(id: string): boolean {
    return this.channels.delete(id);
  }

  public resetChannel(id: string): boolean {
    const ch = this.channels.get(id);
    if (!ch) return false;
    ch.status = 'healthy';
    ch.consecutiveFailures = 0;
    ch.cooldownUntil = 0;
    return true;
  }

  /**
   * Check if any configured channel supports the requested model
   */
  public hasModel(model: string): boolean {
    for (const ch of this.channels.values()) {
      if (
        ch.models.includes('*') ||
        ch.models.includes(model) ||
        Boolean(ch.modelMapping && ch.modelMapping[model])
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Select best channel node based on health, model support, and weight
   */
  public selectRoute(
    model: string,
    excludedChannelIds: Set<string> = new Set()
  ): RouteCandidate | null {
    const now = Date.now();

    // 1. Refresh cooling nodes
    for (const channel of this.channels.values()) {
      if (channel.status === 'cooling' && now >= channel.cooldownUntil) {
        channel.status = 'healthy';
        channel.consecutiveFailures = 0;
      }
    }

    // 2. Filter eligible channels
    const candidates = Array.from(this.channels.values()).filter((ch) => {
      if (excludedChannelIds.has(ch.id)) return false;
      if (ch.status !== 'healthy') return false;

      const supportsModel =
        ch.models.includes('*') ||
        ch.models.includes(model) ||
        Boolean(ch.modelMapping && ch.modelMapping[model]);

      return supportsModel;
    });

    if (candidates.length === 0) {
      return null;
    }

    // 3. Weighted random selection
    const totalWeight = candidates.reduce((sum, ch) => sum + ch.weight, 0);
    let randomVal = Math.random() * totalWeight;
    let selectedChannel = candidates[0];

    for (const candidate of candidates) {
      randomVal -= candidate.weight;
      if (randomVal <= 0) {
        selectedChannel = candidate;
        break;
      }
    }

    // 4. Multi-key round robin
    const apiKey = selectedChannel.apiKeys[selectedChannel.keyIndex];
    selectedChannel.keyIndex = (selectedChannel.keyIndex + 1) % selectedChannel.apiKeys.length;

    // 5. Model alias mapping
    const upstreamModel = selectedChannel.modelMapping?.[model] || model;

    return {
      channel: selectedChannel,
      apiKey,
      upstreamModel,
    };
  }

  /**
   * Record success to reset consecutive failures
   */
  public recordSuccess(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    channel.consecutiveFailures = 0;
    channel.status = 'healthy';
  }

  /**
   * Record failure and trigger cooldown if threshold exceeded
   */
  public recordFailure(channelId: string, error?: unknown): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    channel.failedCount++;
    channel.consecutiveFailures++;

    if (channel.consecutiveFailures >= channel.maxFailures) {
      channel.status = 'cooling';
      channel.cooldownUntil = Date.now() + channel.cooldownDurationMs;
    }
  }

  /**
   * Build upstream HTTP request according to channel protocol
   */
  public buildUpstreamRequest(
    candidate: RouteCandidate,
    clientReq: ChatCompletionRequest
  ): UpstreamHttpRequest {
    const { channel, apiKey, upstreamModel } = candidate;

    switch (channel.protocol) {
      case 'anthropic': {
        return this.buildAnthropicRequest(channel, apiKey, upstreamModel, clientReq);
      }
      case 'gemini': {
        return this.buildGeminiRequest(channel, apiKey, upstreamModel, clientReq);
      }
      case 'openai':
      default: {
        return this.buildOpenAIRequest(channel, apiKey, upstreamModel, clientReq);
      }
    }
  }

  private buildOpenAIRequest(
    channel: ChannelNode,
    apiKey: string,
    upstreamModel: string,
    clientReq: ChatCompletionRequest
  ): UpstreamHttpRequest {
    const baseEndpoint = channel.endpoint.replace(/\/chat\/completions$/, '');
    const url = `${baseEndpoint}/chat/completions`;
    const payload = {
      ...clientReq,
      model: upstreamModel,
    };

    return {
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    };
  }

  private extractMessageText(content: ChatMessage['content']): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map((c) => (c.type === 'text' ? c.text || '' : '')).join('\n');
    }
    return '';
  }

  private buildAnthropicRequest(
    channel: ChannelNode,
    apiKey: string,
    upstreamModel: string,
    clientReq: ChatCompletionRequest
  ): UpstreamHttpRequest {
    const baseEndpoint = channel.endpoint.replace(/\/messages$/, '');
    const url = `${baseEndpoint}/messages`;

    // Extract system message & normalize conversation history
    let systemPrompt: string | undefined;
    const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of clientReq.messages) {
      const textContent = this.extractMessageText(msg.content);

      if (msg.role === 'system') {
        systemPrompt = systemPrompt ? `${systemPrompt}\n${textContent}` : textContent;
      } else {
        const role = msg.role === 'assistant' ? 'assistant' : 'user';
        // Anthropic requires strictly alternating user/assistant roles. Merge consecutive turns.
        if (anthropicMessages.length > 0 && anthropicMessages[anthropicMessages.length - 1].role === role) {
          anthropicMessages[anthropicMessages.length - 1].content += `\n\n${textContent}`;
        } else {
          anthropicMessages.push({ role, content: textContent });
        }
      }
    }

    // Anthropic requires at least 1 message and the first must be 'user'
    if (anthropicMessages.length === 0) {
      anthropicMessages.push({ role: 'user', content: 'Hello' });
    } else if (anthropicMessages[0].role !== 'user') {
      anthropicMessages.unshift({ role: 'user', content: 'Please continue.' });
    }

    const payload: Record<string, any> = {
      model: upstreamModel,
      messages: anthropicMessages,
      max_tokens: clientReq.max_tokens ?? 4096,
      stream: clientReq.stream ?? false,
    };

    if (systemPrompt) {
      payload.system = systemPrompt;
    }
    if (clientReq.temperature !== undefined) {
      payload.temperature = clientReq.temperature;
    }
    if (clientReq.top_p !== undefined) {
      payload.top_p = clientReq.top_p;
    }

    return {
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    };
  }

  private buildGeminiRequest(
    channel: ChannelNode,
    apiKey: string,
    upstreamModel: string,
    clientReq: ChatCompletionRequest
  ): UpstreamHttpRequest {
    let endpoint = channel.endpoint;
    if (!endpoint.includes('/v1')) {
      endpoint = `${endpoint}/v1beta`;
    }

    const isStream = clientReq.stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
    const url = `${endpoint}/models/${upstreamModel}:${isStream}key=${apiKey}`;

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const m of clientReq.messages) {
      if (m.role === 'system') continue;
      const text = this.extractMessageText(m.content);
      const role = m.role === 'assistant' ? 'model' : 'user';

      // Gemini strictly requires alternating roles. Merge consecutive turns.
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts.push({ text });
      } else {
        contents.push({
          role,
          parts: [{ text }],
        });
      }
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    const systemInstruction = clientReq.messages
      .filter((m) => m.role === 'system')
      .map((m) => this.extractMessageText(m.content))
      .join('\n');

    const payload: Record<string, any> = {
      contents,
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (clientReq.temperature !== undefined || clientReq.max_tokens !== undefined) {
      payload.generationConfig = {};
      if (clientReq.temperature !== undefined) payload.generationConfig.temperature = clientReq.temperature;
      if (clientReq.max_tokens !== undefined) payload.generationConfig.maxOutputTokens = clientReq.max_tokens;
    }

    return {
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    };
  }

  /**
   * Adapter to normalize non-OpenAI upstream responses back to standard ChatCompletionResponse
   */
  public transformResponse(
    channel: ChannelNode,
    upstreamData: any,
    requestedModel: string
  ): ChatCompletionResponse {
    if (channel.protocol === 'anthropic') {
      const textContent = upstreamData.content
        ? upstreamData.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('')
        : '';

      const promptTokens = upstreamData.usage?.input_tokens ?? 0;
      const completionTokens = upstreamData.usage?.output_tokens ?? 0;

      const stopReason = upstreamData.stop_reason;
      let finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' = 'stop';
      if (stopReason === 'max_tokens') {
        finishReason = 'length';
      } else if (stopReason === 'tool_use') {
        finishReason = 'tool_calls';
      }

      return {
        id: upstreamData.id || `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: requestedModel,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: textContent,
            },
            finish_reason: finishReason,
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      };
    }

    if (channel.protocol === 'gemini') {
      const candidate = upstreamData.candidates?.[0];
      const text = candidate?.content?.parts?.map((p: any) => p.text).join('') ?? '';
      const promptTokens = upstreamData.usageMetadata?.promptTokenCount ?? 0;
      const completionTokens = upstreamData.usageMetadata?.candidatesTokenCount ?? 0;

      const geminiFinish = candidate?.finishReason;
      let finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' = 'stop';
      if (geminiFinish === 'MAX_TOKENS') {
        finishReason = 'length';
      } else if (geminiFinish === 'SAFETY' || geminiFinish === 'RECITATION') {
        finishReason = 'content_filter';
      }

      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: requestedModel,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: text,
            },
            finish_reason: finishReason,
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      };
    }

    // Standard OpenAI response
    if (upstreamData && typeof upstreamData === 'object') {
      upstreamData.model = requestedModel;
      return upstreamData as ChatCompletionResponse;
    }

    throw new Error('Invalid response format from upstream');
  }
}
