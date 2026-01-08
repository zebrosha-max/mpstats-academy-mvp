import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@mpstats/api';

export const trpc = createTRPCReact<AppRouter>();
