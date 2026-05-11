import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import { buildContextWithSources } from '../generation';

describe('buildContextWithSources', () => {
  it('formats audio chunks with [АУДИО MM:SS-MM:SS]', () => {
    const ctx = buildContextWithSources([
      {
        id: 'a', lesson_id: 'l', content: 'audio text',
        timecode_start: 134, timecode_end: 154, similarity: 0.9,
        source_type: 'academy_audio', trust_tier: 1,
      },
    ]);
    expect(ctx).toContain('[1] (АУДИО 2:14-2:34');
    expect(ctx).toContain('audio text');
  });

  it('formats frame chunks with [ЭКРАН @ MM:SS]', () => {
    const ctx = buildContextWithSources([
      {
        id: 'f', lesson_id: 'l', content: '[ЭКРАН @ 03:30] описание',
        timecode_start: 210, timecode_end: 210, similarity: 0.92,
        source_type: 'academy_video_frame', trust_tier: 1,
      },
    ]);
    expect(ctx).toContain('[1] (ЭКРАН @ 3:30');
  });

  it('mixes both source types with sequential numbering', () => {
    const ctx = buildContextWithSources([
      { id: 'a', lesson_id: 'l', content: 'audio',
        timecode_start: 0, timecode_end: 10, similarity: 0.8,
        source_type: 'academy_audio', trust_tier: 1 },
      { id: 'f', lesson_id: 'l', content: '[ЭКРАН @ 00:30]',
        timecode_start: 30, timecode_end: 30, similarity: 0.9,
        source_type: 'academy_video_frame', trust_tier: 1 },
    ]);
    expect(ctx).toMatch(/\[1\] \(АУДИО.*\[2\] \(ЭКРАН/s);
  });
});
