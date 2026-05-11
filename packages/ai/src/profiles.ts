// packages/ai/src/profiles.ts
import 'server-only';
import { searchChunks, type ChunkSearchResult } from './retrieval';

export interface RetrievalProfile {
  name: string;
  sourceTypes: string[];
  trustTiers: number[];
  maxResults: number;
  threshold: number;
}

export const PROFILES = {
  'academy-lesson': {
    name: 'academy-lesson',
    sourceTypes: ['academy_audio', 'academy_video_frame'],
    trustTiers: [1],
    maxResults: 8,
    threshold: 0.5,
  },
} as const satisfies Record<string, RetrievalProfile>;

export type ProfileName = keyof typeof PROFILES;

export interface RetrieveOptions {
  query: string;
  lessonId?: string;
  limit?: number;
  threshold?: number;
  includeHidden?: boolean;
}

const VISUAL_QUERY_PATTERN = /(экран|ссылк|число|урл|url|интерфейс|показ|выручк|инструмент|таблиц|график|какая ссылк|на каком|какой|где находит|видн|изображен|скрин|кадр|слайд|кнопк|меню|меньше|больше|кол(-|и)?ч|сколько)/i;

export function isVisualQuery(query: string): boolean {
  return VISUAL_QUERY_PATTERN.test(query);
}

export async function retrieve(
  profileName: ProfileName,
  options: RetrieveOptions,
): Promise<ChunkSearchResult[]> {
  const profile = (PROFILES as Record<string, RetrievalProfile>)[profileName];
  if (!profile) throw new Error(`Unknown profile: ${profileName}`);

  const limit = options.limit ?? profile.maxResults;
  const baseThreshold = options.threshold ?? profile.threshold;

  // Pass 1: normal mixed retrieval
  const baseResults = await searchChunks({
    query: options.query,
    lessonId: options.lessonId,
    limit,
    threshold: baseThreshold,
    sourceTypes: profile.sourceTypes,
    trustTiers: profile.trustTiers,
    includeHidden: options.includeHidden,
  });

  // Pass 2: if visual query, boost frame recall with lower threshold
  if (!isVisualQuery(options.query)) {
    return baseResults;
  }

  const frameResults = await searchChunks({
    query: options.query,
    lessonId: options.lessonId,
    limit,
    threshold: 0.3,
    sourceTypes: ['academy_video_frame'],
    trustTiers: profile.trustTiers,
    includeHidden: options.includeHidden,
  });

  // Merge: dedupe by id, sort by similarity desc, cap at limit
  const seen = new Set<string>();
  const merged: ChunkSearchResult[] = [];
  for (const chunk of [...baseResults, ...frameResults].sort((a, b) => b.similarity - a.similarity)) {
    if (seen.has(chunk.id)) continue;
    seen.add(chunk.id);
    merged.push(chunk);
    if (merged.length >= limit) break;
  }
  return merged;
}
