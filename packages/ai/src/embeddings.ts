/**
 * Embedding service for query vectorization
 *
 * Uses OpenAI text-embedding-3-small (1536 dimensions)
 * via OpenRouter API for consistency with stored embeddings.
 */

import { openrouter, MODELS } from './openrouter';

// Embedding dimensions (must match Supabase vector column!)
export const EMBEDDING_DIMS = 1536;

/**
 * Generate embedding vector for a text query
 *
 * @param text - User query or content to embed
 * @returns Float array of 1536 dimensions
 */
export async function embedQuery(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot embed empty text');
  }

  const response = await openrouter.embeddings.create({
    model: MODELS.embedding,
    input: text.trim(),
    encoding_format: 'float',
  });

  const embedding = response.data[0]?.embedding;

  if (!embedding || embedding.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Invalid embedding: expected ${EMBEDDING_DIMS} dims, got ${embedding?.length || 0}`
    );
  }

  return embedding;
}

/**
 * Batch embed multiple texts (for efficiency)
 *
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const validTexts = texts.filter((t) => t && t.trim().length > 0);
  if (validTexts.length === 0) return [];

  const response = await openrouter.embeddings.create({
    model: MODELS.embedding,
    input: validTexts.map((t) => t.trim()),
    encoding_format: 'float',
  });

  return response.data.map((d) => d.embedding);
}
