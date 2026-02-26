import { router } from './trpc';
import { profileRouter } from './routers/profile';
import { diagnosticRouter } from './routers/diagnostic';
import { learningRouter } from './routers/learning';
import { aiRouter } from './routers/ai';
import { adminRouter } from './routers/admin';

export const appRouter = router({
  profile: profileRouter,
  diagnostic: diagnosticRouter,
  learning: learningRouter,
  ai: aiRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
