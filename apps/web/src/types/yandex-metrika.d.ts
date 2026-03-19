export {};

declare global {
  interface Window {
    ym?: (
      counterId: number,
      method: 'hit' | 'reachGoal' | 'params' | 'userParams' | 'init',
      ...args: unknown[]
    ) => void;
  }
}
