/**
 * Unified Cross-Model Protocol Schema & Channel Types
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string; detail?: string };
  }>;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  n?: number;
  max_tokens?: number;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
  stream_options?: {
    include_usage?: boolean;
  };
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponseChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionResponseChoice[];
  usage?: Usage;
  system_fingerprint?: string;
}

export interface ChatCompletionChunkDelta {
  role?: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: 'function';
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionChunkDelta;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  usage?: Usage | null;
}

export type UpstreamProtocol = 'openai' | 'anthropic' | 'gemini';

export interface ChannelNode {
  id: string;
  name: string;
  endpoint: string; // Base URL, e.g. "https://api.openai.com/v1"
  protocol: UpstreamProtocol;
  apiKeys: string[];
  keyIndex: number;
  weight: number;
  models: string[]; // List of supported model IDs or wildcard "*"
  modelMapping?: Record<string, string>; // Client model -> Upstream model alias

  // Circuit breaker & cooldown state
  status: 'healthy' | 'cooling' | 'dead';
  failedCount: number;
  consecutiveFailures: number;
  maxFailures: number;
  cooldownUntil: number;
  cooldownDurationMs: number;
}

export interface ChannelConfig {
  id: string;
  name: string;
  endpoint: string;
  protocol?: UpstreamProtocol;
  apiKeys: string[];
  weight?: number;
  models?: string[];
  modelMapping?: Record<string, string>;
  maxFailures?: number;
  cooldownDurationMs?: number;
}
