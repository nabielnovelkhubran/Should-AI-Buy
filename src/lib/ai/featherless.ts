import OpenAI from 'openai';
import { sanitizeErrorMessage } from '../errors';

// ---------------------------------------------------------------------------
// Featherless AI Integration Module
// Integrates Featherless.ai via OpenAI-compatible SDK endpoint.
// Default Model: Qwen/Qwen3.8-27B-Instruct
// Base URL: https://api.featherless.ai/v1
// INVARIANT: Zero credential exposure in payloads, errors, or logs.
// ---------------------------------------------------------------------------

export const FEATHERLESS_DEFAULT_BASE_URL = 'https://api.featherless.ai/v1';
export const FEATHERLESS_DEFAULT_MODEL = 'Qwen/Qwen3.8-27B-Instruct';

export interface FeatherlessConfig {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  timeoutMs?: number;
}

export interface FeatherlessMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface FeatherlessCompletionOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface FeatherlessChatOptions {
  messages: FeatherlessMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface FeatherlessCompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  latencyMs: number;
  rawResponse?: any;
}

/**
 * Returns whether the Featherless API key is present in the environment.
 */
export function isFeatherlessConfigured(): boolean {
  const key = process.env.FEATHERLESS_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}

/**
 * Retrieves the configured Featherless model identifier.
 */
export function getFeatherlessModel(): string {
  return process.env.FEATHERLESS_MODEL || FEATHERLESS_DEFAULT_MODEL;
}

/**
 * Retrieves the configured Featherless base URL.
 */
export function getFeatherlessBaseUrl(): string {
  return process.env.FEATHERLESS_BASE_URL || FEATHERLESS_DEFAULT_BASE_URL;
}

/**
 * Creates or retrieves a configured OpenAI client pointed to Featherless AI.
 */
export function getFeatherlessClient(configOverrides?: Partial<FeatherlessConfig>): OpenAI {
  const apiKey = configOverrides?.apiKey || process.env.FEATHERLESS_API_KEY || '';
  const baseURL = configOverrides?.baseURL || getFeatherlessBaseUrl();
  const timeout = configOverrides?.timeoutMs ?? 30000;

  return new OpenAI({
    apiKey: apiKey || 'unconfigured_placeholder',
    baseURL,
    timeout,
    maxRetries: 2
  });
}

/**
 * Executes a single-turn or system-prompted completion with Featherless AI.
 */
export async function generateFeatherlessCompletion(
  options: FeatherlessCompletionOptions,
  configOverrides?: Partial<FeatherlessConfig>
): Promise<FeatherlessCompletionResult> {
  const startTime = Date.now();
  const model = options.model || configOverrides?.defaultModel || getFeatherlessModel();

  if (!isFeatherlessConfigured() && !configOverrides?.apiKey) {
    throw new Error('FEATHERLESS_NOT_CONFIGURED: FEATHERLESS_API_KEY environment variable is missing.');
  }

  const client = getFeatherlessClient(configOverrides);
  const messages: FeatherlessMessage[] = [];

  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.prompt });

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      top_p: options.topP ?? 1.0
    });

    const content = response.choices?.[0]?.message?.content || '';
    const latencyMs = Date.now() - startTime;

    return {
      content,
      model: response.model || model,
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens
      },
      latencyMs,
      rawResponse: response
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const sanitizedMsg = sanitizeErrorMessage(err?.message || 'Featherless completion failed.');
    throw new Error(`FEATHERLESS_COMPLETION_ERROR (${latencyMs}ms): ${sanitizedMsg}`);
  }
}

/**
 * Executes a multi-turn chat conversation with Featherless AI.
 */
export async function generateFeatherlessChat(
  options: FeatherlessChatOptions,
  configOverrides?: Partial<FeatherlessConfig>
): Promise<FeatherlessCompletionResult> {
  const startTime = Date.now();
  const model = options.model || configOverrides?.defaultModel || getFeatherlessModel();

  if (!isFeatherlessConfigured() && !configOverrides?.apiKey) {
    throw new Error('FEATHERLESS_NOT_CONFIGURED: FEATHERLESS_API_KEY environment variable is missing.');
  }

  const client = getFeatherlessClient(configOverrides);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      top_p: options.topP ?? 1.0
    });

    const content = response.choices?.[0]?.message?.content || '';
    const latencyMs = Date.now() - startTime;

    return {
      content,
      model: response.model || model,
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens
      },
      latencyMs,
      rawResponse: response
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const sanitizedMsg = sanitizeErrorMessage(err?.message || 'Featherless chat completion failed.');
    throw new Error(`FEATHERLESS_CHAT_ERROR (${latencyMs}ms): ${sanitizedMsg}`);
  }
}

/**
 * Performs a diagnostic test request against Featherless AI.
 */
export async function testFeatherlessConnection(
  configOverrides?: Partial<FeatherlessConfig>
): Promise<{ success: boolean; model: string; message: string; latencyMs: number; error?: string }> {
  const model = configOverrides?.defaultModel || getFeatherlessModel();
  const startTime = Date.now();

  if (!isFeatherlessConfigured() && !configOverrides?.apiKey) {
    return {
      success: false,
      model,
      message: 'FEATHERLESS_API_KEY is not set.',
      latencyMs: 0,
      error: 'NOT_CONFIGURED'
    };
  }

  try {
    const result = await generateFeatherlessCompletion(
      {
        prompt: 'Respond with "PONG" to confirm connectivity.',
        systemPrompt: 'You are a diagnostic healthcheck assistant. Reply concisely.',
        maxTokens: 10,
        temperature: 0.1
      },
      configOverrides
    );

    return {
      success: true,
      model: result.model,
      message: result.content.trim(),
      latencyMs: result.latencyMs
    };
  } catch (err: any) {
    return {
      success: false,
      model,
      message: 'Featherless connectivity test failed.',
      latencyMs: Date.now() - startTime,
      error: sanitizeErrorMessage(err?.message || 'Unknown error')
    };
  }
}
