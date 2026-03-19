import type { MetrikaGoal } from './constants';

export function reachGoal(goal: MetrikaGoal, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (!window.ym) return;
  const counterId = process.env.NEXT_PUBLIC_YANDEX_ID;
  if (!counterId) return;
  window.ym(parseInt(counterId, 10), 'reachGoal', goal, params);
}
