# Coding Conventions

**Analysis Date:** 2026-02-16

## Naming Patterns

**Files:**
- React components: PascalCase with `.tsx` extension — `LessonCard.tsx`, `RadarChart.tsx`, `Logo.tsx`
- React pages: lowercase `page.tsx` (Next.js App Router convention)
- Utilities/libraries: camelCase with `.ts` extension — `utils.ts`, `client.ts`, `server.ts`, `actions.ts`
- Route handlers: `route.ts` (Next.js convention)
- Config files: lowercase with extension — `middleware.ts`, `tailwind.config.ts`, `vitest.config.ts`

**Functions:**
- React components: PascalCase — `LessonCard()`, `SkillRadarChart()`, `Button()`
- Hooks: camelCase with `use` prefix — `useParams()`, `useRouter()`, `useState()`
- Server actions: camelCase — `signUp()`, `signIn()`, `resetPasswordRequest()`, `getUser()`
- tRPC procedures: camelCase — `getProfile()`, `getDashboard()`, `startSession()`, `submitAnswer()`
- Utility functions: camelCase — `createClient()`, `formatTimecode()`, `searchChunks()`

**Variables:**
- Constants: SCREAMING_SNAKE_CASE — `MOCK_QUESTIONS`, `CACHE_TTL_MS`, `TARGET_SCORE`, `CATEGORY_LABELS`
- Local variables: camelCase — `summaryData`, `chatMessages`, `isLoading`, `lessonId`
- React state: camelCase — `activeTab`, `chatInput`, `setActiveTab`, `setChatInput`
- Type/interface props: camelCase with Props suffix — `LessonCardProps`, `ButtonProps`

**Types:**
- Interfaces: PascalCase — `ChatMessage`, `GenerationResult`, `SourceCitation`, `Context`
- Type aliases: PascalCase — `MockSession`, `CompletedSession`, `AuthResult`
- Enums: PascalCase with SCREAMING_SNAKE_CASE values — `DiagnosticStatus.IN_PROGRESS`, `SkillCategory.ANALYTICS`

**Database:**
- Models: PascalCase — `UserProfile`, `DiagnosticSession`, `ContentChunk`, `SkillProfile`
- Model fields: camelCase — `userId`, `startedAt`, `completedAt`, `skillCategory`
- Table names (mapped): snake_case — `@@map("content_chunk")`
- Column names (mapped): snake_case — `@map("lesson_id")`, `@map("timecode_start")`

## Code Style

**Formatting:**
- Tool: Prettier
- Config: `.prettierrc` (root level)
- Key settings:
  - `"semi": true` — semicolons required
  - `"singleQuote": true` — single quotes for strings
  - `"tabWidth": 2` — 2-space indentation
  - `"trailingComma": "es5"` — trailing commas in objects/arrays
  - `"printWidth": 100` — max line length 100 characters
  - `"arrowParens": "always"` — always wrap arrow function params in parens
  - `"endOfLine": "lf"` — Unix line endings

**Linting:**
- Tool: ESLint
- Config: `apps/web/.eslintrc.json`
- Extends: `next/core-web-vitals` (Next.js recommended rules)
- Run: `pnpm lint`

## Import Organization

**Order:**
1. React/Next.js core imports
2. External packages (tRPC, Supabase, UI libraries)
3. Internal packages (workspace imports)
4. Relative imports (components, utils, actions)
5. Type imports (marked with `type` keyword)

**Example:**
```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import type { LessonWithProgress } from '@mpstats/shared';
```

**Path Aliases:**
- `@/*` → `apps/web/src/*` (configured in `tsconfig.json`)
- `@mpstats/shared` → `packages/shared/src/index.ts`
- `@mpstats/api` → `packages/api/src/index.ts`
- `@mpstats/db` → `packages/db/src/index.ts`
- `@mpstats/ai` → `packages/ai/src/index.ts`

## Error Handling

**Patterns:**

**Server Actions:**
```typescript
export async function signUp(formData: FormData): Promise<AuthResult> {
  // 1. Early validation
  if (!email || !password) {
    return { error: 'Email и пароль обязательны' };
  }

  // 2. Try/catch on external calls
  const { error } = await supabase.auth.signUp(...);

  // 3. Log errors with context
  if (error) {
    console.error('Sign up error:', error);
    return { error: error.message };
  }

  // 4. Success response
  return { success: true };
}
```

**tRPC Procedures:**
```typescript
// 1. Use TRPCError for authentication
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// 2. Try/catch with fallback to mock data (Sprint 2 pattern)
try {
  const profile = await ctx.prisma.userProfile.findUnique(...);
  if (profile) return profile;
} catch {
  // DB not available, return mock
}
```

**Client Components:**
```typescript
// 1. React Query error states
const { data, isLoading, error } = trpc.learning.getLesson.useQuery({ lessonId });

if (error) {
  return <div>Ошибка загрузки: {error.message}</div>;
}

// 2. Mutation error handling
const chatMutation = trpc.ai.chat.useMutation({
  onSuccess: (result) => { /* ... */ },
  onError: (error) => {
    console.error('Chat error:', error);
    // Show error toast/alert
  },
});
```

**Silent catch for compatibility (middleware):**
```typescript
try {
  cookiesToSet.forEach(({ name, value, options }) =>
    cookieStore.set(name, value, options)
  );
} catch {
  // Server Component context — fail silently
}
```

## Logging

**Framework:** `console` (built-in)

**Patterns:**

**Error logging (always include context):**
```typescript
console.error('Sign in error:', error);
console.error('Update password error:', error);
```

**Debug logging (AI/backend operations):**
```typescript
console.log('[AI Router] getLessonSummary called with lessonId:', lessonId);
```

**Production consideration:**
- Replace `console.log` with proper logging service before production
- Keep `console.error` for error tracking (integrates with monitoring tools)

## Comments

**When to Comment:**
- Section dividers in large files:
  ```typescript
  // ============== SIGN UP ==============
  // ============== USER PROFILE ==============
  // ============== RAG ==============
  ```
- Complex business logic (not present in current codebase — kept minimal)
- TODO markers with context and Sprint reference:
  ```typescript
  // TODO: Calculate from real data in Sprint 4
  // TODO: Switch back to protectedProcedure after fixing Supabase SSR cookies
  ```
- Type/schema documentation (Prisma):
  ```prisma
  // Auth is managed by Supabase, this is the extended profile
  // Таблица content_chunk уже заполнена данными из E:\Academy Courses\
  ```

**What NOT to Comment:**
- Self-explanatory code
- Type definitions (TypeScript makes them obvious)
- Standard React patterns

**JSDoc/TSDoc:**
- Used minimally, primarily in AI package for public API functions:
  ```typescript
  /**
   * Generate a summary for a lesson using all its chunks
   *
   * @param lessonId - Lesson ID (e.g., "01_analytics_m01_start_001")
   * @returns Summary with source citations
   */
  export async function generateLessonSummary(lessonId: string): Promise<GenerationResult>
  ```

## Function Design

**Size:**
- Target: 20-30 lines for typical functions
- Complex flows (e.g., `generateChatResponse`) can be 50-100 lines if well-structured
- Over 100 lines: consider breaking into smaller functions

**Parameters:**
- Prefer object parameters for 3+ arguments:
  ```typescript
  // Good
  searchChunks({ query, lessonId, limit, threshold })

  // Avoid
  searchChunks(query, lessonId, limit, threshold)
  ```
- Use TypeScript for parameter validation:
  ```typescript
  export async function signUp(formData: FormData): Promise<AuthResult>
  ```

**Return Values:**
- Explicit return types for all exported functions
- Result objects for operations with multiple outcomes:
  ```typescript
  export type AuthResult = {
    error?: string;
    success?: boolean;
  };
  ```
- Async functions always return `Promise<T>`

**Early Returns:**
```typescript
// Used extensively throughout codebase
if (!email || !password) {
  return { error: 'Email и пароль обязательны' };
}

if (chunks.length === 0) {
  return {
    content: 'Контент для этого урока пока не загружен.',
    sources: [],
    model: MODELS.chat,
  };
}
```

## Module Design

**Exports:**
- Named exports (default exports not used):
  ```typescript
  export function LessonCard({ lesson, showCourse, courseName }: LessonCardProps)
  export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(...)
  export async function signUp(formData: FormData): Promise<AuthResult>
  ```
- Type exports with `type` keyword:
  ```typescript
  export type { ChatMessage, GenerationResult, SourceCitation }
  ```

**Barrel Files:**
- Used in packages for clean public API:
  - `packages/shared/src/index.ts` — re-exports all shared types
  - `packages/api/src/index.ts` — exports `appRouter` and `type RouterInputs/RouterOutputs`
  - `packages/ai/src/index.ts` — exports all AI functions and types
  - `packages/db/src/index.ts` — exports `prisma` client and `type PrismaClient`

**Server/Client Directives:**
- `'use client'` — all interactive React components (pages with hooks, state)
- `'use server'` — server actions file (`apps/web/src/lib/auth/actions.ts`)
- No directive — server components by default (Next.js App Router)

## TypeScript Conventions

**Strict Mode:**
```json
"strict": true,
"strictNullChecks": true,
"noImplicitAny": true
```

**Type Inference:**
- Prefer inference for local variables:
  ```typescript
  const lessonId = params.id as string; // Type from context
  const [activeTab, setActiveTab] = useState<'summary' | 'chat'>('summary'); // Explicit union
  ```

**Explicit Types:**
- Function parameters and return types (always)
- Component props (always via interface)
- React state when union types needed

**Type vs Interface:**
- Interface for component props: `interface LessonCardProps`
- Type for function returns: `export type AuthResult = { ... }`
- Type for complex unions: `type MockSession = { ... }`

**Utility Types:**
- `Record<string, string>` for constant mappings:
  ```typescript
  const CATEGORY_LABELS: Record<string, string> = {
    ANALYTICS: 'Аналитика',
    MARKETING: 'Маркетинг',
    // ...
  };
  ```
- `Array<T>` or `T[]` based on context (both used)

## React Patterns

**Component Structure:**
1. Directive (`'use client'`)
2. Imports
3. Constants/types outside component
4. Component definition with props interface
5. Hooks at top of component
6. Event handlers
7. Effects
8. Early returns for loading/error states
9. Render JSX

**Hooks Order:**
1. State hooks (`useState`)
2. Router hooks (`useParams`, `useRouter`, `useSearchParams`)
3. tRPC queries/mutations
4. Refs (`useRef`)
5. Effects (`useEffect`)

**Event Handlers:**
- Prefix with `handle`: `handleSendMessage()`, `handleSubmit()`
- Inline for simple operations: `onClick={() => setActiveTab('chat')}`

**Conditional Rendering:**
- Early returns for loading/error states
- Ternary for simple show/hide: `{showCourse && courseName && <div>...</div>}`
- Logical AND for optional content: `{lesson.description && <p>...</p>}`

## CSS/Styling

**Framework:** Tailwind CSS

**Utility-First:**
- All styling via Tailwind utility classes
- No custom CSS files (except `globals.css` for CSS variables)

**Component Variants:**
- Use `class-variance-authority` (CVA) for component variants:
  ```typescript
  const buttonVariants = cva(
    'base-classes',
    {
      variants: {
        variant: { default: '...', success: '...', featured: '...' },
        size: { default: '...', sm: '...', lg: '...' },
      },
      defaultVariants: { variant: 'default', size: 'default' },
    }
  );
  ```

**Custom Colors:**
- MPSTATS brand palette: `mp-blue`, `mp-green`, `mp-pink`, `mp-gray` (50-900 scales)
- Semantic colors: `primary`, `secondary`, `destructive`, `muted` (from CSS variables)

**Class Merging:**
- Use `cn()` utility (clsx + tailwind-merge) for conditional classes:
  ```typescript
  <div className={cn('base-class', status.color, className)} />
  ```

## Best Practices

**DRY (Don't Repeat Yourself):**
- Shared constants extracted to top of file or separate constants file
- Reusable UI components in `components/ui/`
- Shared types in `packages/shared/`

**Separation of Concerns:**
- Auth logic → `lib/auth/actions.ts`
- API logic → `packages/api/src/routers/`
- AI logic → `packages/ai/src/`
- Database access → via Prisma client in tRPC context

**Mock Data Strategy (Sprint 2):**
- In-memory storage using `globalThis` for development
- Try/catch with fallback to mock when DB unavailable
- Clear TODO comments for production migration

**Accessibility:**
- Semantic HTML elements
- ARIA attributes where needed (in shadcn/ui components)
- Focus states: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`

**Performance:**
- React Query caching for tRPC queries
- Conditional query execution: `{ enabled: activeTab === 'summary' }`
- In-memory caching for expensive operations (summary generation)

---

*Convention analysis: 2026-02-16*
