// scripts/vision-ingest/config.ts
export const INGEST_CONFIG = {
  academy_courses_root: 'E:/Academy Courses',
  pilot_target_course: '03_ai',
  pilot_lesson_count: 10,

  // Frame extraction
  frame_interval_seconds: 60,
  frames_cap_per_video: 120,

  // Perceptual hash dedup
  phash_hamming_threshold: 5,

  // VLM
  vlm_model: 'openai/gpt-4.1-mini',
  vlm_max_tokens: 800,
  vlm_rate_limit_rps: 5,
  vlm_retry_max: 1,

  // Embedding
  embedding_model: 'openai/text-embedding-3-small',
  embedding_dims: 1536,
  embedding_batch_size: 50,
  embedding_rate_limit_delay_ms: 500,

  // Supabase Storage
  storage_bucket: 'lesson-frames',

  // DB upload
  db_upload_batch_size: 10,
  db_upload_max_retries: 5,

  // Paths
  results_dir: 'scripts/vision-ingest/results',
  frames_dir: 'scripts/vision-ingest/results/frames',
} as const;
