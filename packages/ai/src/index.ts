/**
 * @mpstats/ai - AI services for MPSTATS Academy
 *
 * Provides RAG (Retrieval Augmented Generation) capabilities:
 * - Query embedding generation
 * - Vector similarity search via Supabase pgvector
 * - LLM generation for summaries and chat
 */

// OpenRouter client
export { openrouter, MODELS, MODEL_CONFIG } from './openrouter';
export type { ModelType } from './openrouter';

// Embedding service
export { embedQuery, embedBatch, EMBEDDING_DIMS } from './embeddings';

// Retrieval service
export { searchChunks, getChunksForLesson, formatTimecode, supabase } from './retrieval';
export type { ChunkSearchResult, SearchOptions } from './retrieval';

// Generation service
export { generateLessonSummary, generateChatResponse } from './generation';
export type { GenerationResult, SourceCitation, ChatMessage } from './generation';

// Question generation
export { generateDiagnosticQuestions, CATEGORY_TO_COURSES } from './question-generator';
export type { MockQuestionsFn } from './question-generator';
export { generatedQuestionSchema, generatedQuestionsArraySchema, questionJsonSchema } from './question-schema';
export type { GeneratedQuestion } from './question-schema';
