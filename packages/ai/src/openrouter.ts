/**
 * OpenRouter client configuration
 *
 * Uses OpenAI SDK with OpenRouter base URL for multi-model access.
 */

import OpenAI from 'openai';

// Initialize OpenRouter client (OpenAI-compatible)
export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'X-Title': 'MPSTATS Academy',
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
