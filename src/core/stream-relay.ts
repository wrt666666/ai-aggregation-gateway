/**
 * Anti-Half-Packet SSE Stream Relay Pipeline & Token Usage Settlement
 */

import type { ChatCompletionChunk, UpstreamProtocol, Usage } from '../types/schema.js';

export interface StreamRelayOptions {
  protocol: UpstreamProtocol;
  model: string;
  promptText?: string;
  promptTokens?: number;
  includeUsage?: boolean;
  onUsageSettled?: (usage: Usage) => void;
}

type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;

function mapAnthropicStopReason(reason?: string): FinishReason {
  if (!reason) return null;
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_calls';
    default:
      return 'stop';
  }
}

function mapGeminiFinishReason(reason?: string): FinishReason {
  if (!reason) return null;
  switch (reason.toUpperCase()) {
    case 'STOP':
      return 'stop';
    case 'MAX_TOKENS':
      return 'length';
    case 'SAFETY':
    case 'RECITATION':
      return 'content_filter';
    default:
      return 'stop';
  }
}

export function createStreamRelay(
  upstreamBody: ReadableStream<Uint8Array>,
  options: StreamRelayOptions
): ReadableStream<Uint8Array> {
  const { protocol, model, promptText, promptTokens: initialPromptTokens, includeUsage, onUsageSettled } = options;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8');

  let buffer = '';
  let promptTokens = initialPromptTokens ?? 0;
  let completionTokens = 0;
  let accumulatedText = '';
  let lastFinishReason: FinishReason = null;
  let doneEmitted = false;
  let usageChunkEmitted = false;

  const streamId = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  function estimateTokens(text: string): number {
    // Standard estimation: 1 token ~= 3.5 chars for mixed English/Chinese
    return Math.max(1, Math.ceil(text.length / 3.5));
  }

  function formatOpenAIChunk(
    deltaContent: string | null,
    finishReason: FinishReason = null,
    role?: 'assistant'
  ): string {
    const delta: Record<string, any> = {};
    if (role) delta.role = role;
    if (deltaContent !== null) delta.content = deltaContent;

    const chunk: ChatCompletionChunk = {
      id: streamId,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [
        {
          index: 0,
          delta,
          finish_reason: finishReason,
        },
      ],
    };
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }

  function emitUsageChunk(controller: TransformStreamDefaultController<Uint8Array>, usage: Usage) {
    if (usageChunkEmitted) return;
    usageChunkEmitted = true;
    const chunk = {
      id: streamId,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [],
      usage,
    };
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
  }

  function processEvent(eventStr: string, controller: TransformStreamDefaultController<Uint8Array>) {
    if (!eventStr.trim()) return;

    if (protocol === 'openai') {
      const lines = eventStr.split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith(':')) {
          // SSE comment/keep-alive
          controller.enqueue(encoder.encode(`${line}\n\n`));
        } else if (line.startsWith('data:')) {
          const dataPayload = line.slice(5).trim();

          if (dataPayload === '[DONE]') {
            doneEmitted = true;
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            continue;
          }

          try {
            const parsed = JSON.parse(dataPayload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulatedText += delta;
            }

            if (parsed.usage) {
              promptTokens = parsed.usage.prompt_tokens ?? promptTokens;
              completionTokens = parsed.usage.completion_tokens ?? completionTokens;
            }

            // Standardize model name
            parsed.model = model;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
          } catch {
            controller.enqueue(encoder.encode(`${line}\n\n`));
          }
        }
      }
    } else if (protocol === 'anthropic') {
      const lines = eventStr.split(/\r?\n/);
      let eventType = '';
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }

      const dataPayload = dataLines.join('\n').trim();
      if (!dataPayload) return;

      if (eventType === 'message_start') {
        try {
          const parsed = JSON.parse(dataPayload);
          if (parsed.message?.usage?.input_tokens) {
            promptTokens = parsed.message.usage.input_tokens;
          }
          controller.enqueue(encoder.encode(formatOpenAIChunk('', null, 'assistant')));
        } catch {
          // Ignore
        }
      } else if (eventType === 'content_block_delta') {
        try {
          const parsed = JSON.parse(dataPayload);
          const text = parsed.delta?.text;
          if (text) {
            accumulatedText += text;
            controller.enqueue(encoder.encode(formatOpenAIChunk(text, null)));
          }
        } catch {
          // Ignore
        }
      } else if (eventType === 'message_delta') {
        try {
          const parsed = JSON.parse(dataPayload);
          if (parsed.usage?.output_tokens) {
            completionTokens = parsed.usage.output_tokens;
          }
          if (parsed.delta?.stop_reason) {
            lastFinishReason = mapAnthropicStopReason(parsed.delta.stop_reason);
          }
        } catch {
          // Ignore
        }
      } else if (eventType === 'message_stop') {
        controller.enqueue(encoder.encode(formatOpenAIChunk(null, lastFinishReason || 'stop')));
        if (includeUsage) {
          const calculatedTokens = completionTokens || (accumulatedText ? estimateTokens(accumulatedText) : 1);
          const pTokens = promptTokens || (promptText ? estimateTokens(promptText) : Math.max(1, Math.round(calculatedTokens * 0.5)));
          emitUsageChunk(controller, {
            prompt_tokens: pTokens,
            completion_tokens: calculatedTokens,
            total_tokens: pTokens + calculatedTokens,
          });
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        doneEmitted = true;
      }
    } else if (protocol === 'gemini') {
      const lines = eventStr.split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const dataPayload = line.slice(5).trim();
          if (!dataPayload) continue;

          try {
            const parsed = JSON.parse(dataPayload);
            const candidate = parsed.candidates?.[0];
            const text = candidate?.content?.parts?.map((p: any) => p.text).join('') ?? '';
            const finishReason = mapGeminiFinishReason(candidate?.finishReason);

            if (text) {
              accumulatedText += text;
              controller.enqueue(encoder.encode(formatOpenAIChunk(text, null)));
            }

            if (parsed.usageMetadata) {
              promptTokens = parsed.usageMetadata.promptTokenCount ?? promptTokens;
              completionTokens = parsed.usageMetadata.candidatesTokenCount ?? completionTokens;
            }

            if (finishReason) {
              lastFinishReason = finishReason;
              controller.enqueue(encoder.encode(formatOpenAIChunk(null, finishReason)));
              if (includeUsage) {
                const calculatedTokens = completionTokens || (accumulatedText ? estimateTokens(accumulatedText) : 1);
                const pTokens = promptTokens || (promptText ? estimateTokens(promptText) : Math.max(1, Math.round(calculatedTokens * 0.5)));
                emitUsageChunk(controller, {
                  prompt_tokens: pTokens,
                  completion_tokens: calculatedTokens,
                  total_tokens: pTokens + calculatedTokens,
                });
              }
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              doneEmitted = true;
            }
          } catch {
            // Ignore parse errors on partials
          }
        }
      }
    }
  }

  const transformStream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      // 1. Anti-half-packet buffering
      buffer += decoder.decode(chunk, { stream: true });

      // Split by double newline (SSE event separator)
      const events = buffer.split(/\r?\n\r?\n/);
      // Keep last incomplete chunk in buffer
      buffer = events.pop() || '';

      for (const eventStr of events) {
        processEvent(eventStr, controller);
      }
    },

    flush(controller) {
      // Flush any trailing decoder bytes
      buffer += decoder.decode();

      // Process any remaining event left in buffer
      if (buffer.trim()) {
        processEvent(buffer, controller);
        buffer = '';
      }

      // Token settlement calculation
      if (completionTokens === 0 && accumulatedText.length > 0) {
        completionTokens = estimateTokens(accumulatedText);
      }
      if (promptTokens === 0) {
        if (initialPromptTokens && initialPromptTokens > 0) {
          promptTokens = initialPromptTokens;
        } else if (promptText) {
          promptTokens = estimateTokens(promptText);
        } else {
          promptTokens = Math.max(1, Math.round(completionTokens * 0.5));
        }
      }

      const totalTokens = promptTokens + completionTokens;
      const finalUsage: Usage = {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      };

      if (onUsageSettled) {
        onUsageSettled(finalUsage);
      }

      // Ensure clean stream termination if not already emitted
      if (!doneEmitted) {
        if (protocol !== 'openai') {
          controller.enqueue(encoder.encode(formatOpenAIChunk(null, lastFinishReason || 'stop')));
        }
        if (includeUsage) {
          emitUsageChunk(controller, finalUsage);
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        doneEmitted = true;
      }
    },
  });

  return upstreamBody.pipeThrough(transformStream);
}
