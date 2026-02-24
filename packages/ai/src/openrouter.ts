/**
 * OpenRouter client configuration
 *
 * Uses OpenAI SDK with OpenRouter base URL for multi-model access.
 */

import OpenAI from 'openai';

// Lazy-initialized OpenRouter client to avoid build-time errors
// (OPENROUTER_API_KEY is a runtime env var, not available during Next.js build)
let _openrouter: OpenAI | null = null;

export function getOpenRouterClient(): OpenAI {
  if (!_openrouter) {
    _openrouter = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || 'build-placeholder',
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'MPSTATS Academy',
      },
    });
  }
  return _openrouter;
}

/** @deprecated Use getOpenRouterClient() for lazy initialization */
export const openrouter = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return (getOpenRouterClient() as any)[prop];
  },
});

// Model configuration
export const MODELS = {
  // Primary chat model (fast, cheap)
  chat: process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-2.5-flash',
  // Fallback model
  fallback: process.env.OPENROUTER_FALLBACK_MODEL || 'openai/gpt-4o-mini',
  // Embedding model (must match what's in Supabase!)
  embedding: 'openai/text-embedding-3-small',
} as const;

// Model parameters
export const MODEL_CONFIG = {
  maxTokens: 2048,
  temperature: 0.7,
  // For RAG - lower temperature, more factual
  ragTemperature: 0.3,
} as const;

export type ModelType = keyof typeof MODELS;
