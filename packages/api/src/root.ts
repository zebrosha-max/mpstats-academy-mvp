import { router } from './trpc';
import { profileRouter } from './routers/profile';
import { diagnosticRouter } from './routers/diagnostic';
import { learningRouter } from './routers/learning';
import { aiRouter } from './routers/ai';

export const appRouter = router({
  profile: profileRouter,
  diagnostic: diagnosticRouter,
  learning: learningRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
