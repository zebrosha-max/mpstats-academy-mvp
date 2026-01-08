# Technical Specification

**Проект:** MPSTATS Academy MVP  
**Версия:** 1.0  
**Дата:** 2025-12-18

---

## 1. Архитектура системы

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                          │
│                         Next.js App (React)                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS SERVER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │  App Router │  │  API Routes │  │  Server Actions             │  │
│  │  (Pages)    │  │  (/api/*)   │  │  (mutations)                │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │
│                           │                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    tRPC Router                               │   │
│  │   auth | diagnostic | learning | profile | ai                │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
           │                    │                      │
           ▼                    ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│   PostgreSQL    │  │  Vector Store   │  │    LLM Provider         │
│   + pgvector    │  │  (same DB)      │  │  (OpenAI/Claude/Gemini) │
│                 │  │                 │  │                         │
│  Users          │  │  Embeddings     │  │  - Question Generation  │
│  Sessions       │  │  (chunks)       │  │  - Summarization        │
│  Diagnostics    │  │                 │  │  - Chat Completion      │
│  Progress       │  │                 │  │                         │
└─────────────────┘  └─────────────────┘  └─────────────────────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │   Video Hosting     │
                                         │   (Kinescope/YT)    │
                                         └─────────────────────┘
```

### 1.2 Monorepo Structure

```
mpstats-academy-mvp/
├── apps/
│   └── web/                    # Next.js application
│       ├── app/                # App Router pages
│       │   ├── (auth)/         # Auth group (login, register)
│       │   ├── (main)/         # Main app group
│       │   │   ├── dashboard/
│       │   │   ├── diagnostic/
│       │   │   ├── learn/
│       │   │   └── profile/
│       │   ├── api/            # API routes
│       │   └── layout.tsx
│       ├── components/         # React components
│       │   ├── ui/             # shadcn/ui components
│       │   ├── diagnostic/     # Diagnostic-specific
│       │   ├── learning/       # Learning-specific
│       │   └── shared/         # Shared components
│       ├── lib/                # Utilities
│       │   ├── trpc/           # tRPC client/server
│       │   ├── auth/           # NextAuth config
│       │   ├── ai/             # AI/LLM utilities
│       │   └── utils/          # General utilities
│       └── styles/             # Global styles
├── packages/
│   ├── db/                     # Prisma schema + migrations
│   ├── api/                    # tRPC routers
│   ├── ai/                     # AI/RAG logic
│   │   ├── embeddings/
│   │   ├── retrieval/
│   │   └── generation/
│   └── shared/                 # Shared types, constants
├── scripts/
│   ├── seed/                   # DB seeding
│   └── ingest/                 # Content ingestion pipeline
├── docs/                       # Documentation (SDD)
├── turbo.json                  # Turborepo config
├── package.json
└── docker-compose.yml          # Local dev (PostgreSQL)
```

---

## 2. Технологический стек

### 2.1 Core Stack

| Layer | Technology | Version | Justification |
|-------|------------|---------|---------------|
| **Runtime** | Node.js | 20 LTS | Stability, native ESM |
| **Framework** | Next.js | 14.x (App Router) | SSR, RSC, API routes |
| **Language** | TypeScript | 5.x | Type safety |
| **Database** | Supabase (PostgreSQL) | Latest | Managed DB + Auth + Storage |
| **Vector Search** | pgvector (Supabase) | 0.5+ | Включается как extension |
| **ORM** | Prisma | 5.x | Migrations, types (поверх Supabase) |
| **API** | tRPC | 11.x | E2E type safety |
| **Auth** | Supabase Auth | Latest | OAuth + Email/Password из коробки |
| **Styling** | Tailwind CSS | 3.x | Utility-first, responsive |
| **UI Components** | shadcn/ui | latest | Accessible, customizable |
| **Build** | Turborepo | 2.x | Monorepo, caching |

### 2.2 AI/ML Stack

| Purpose | Technology | Model/Config |
|---------|------------|--------------|
| **Embeddings** | OpenRouter → OpenAI | `text-embedding-3-small` (1536 dims) |
| **LLM Router** | OpenRouter | Единый API для всех моделей |
| **LLM (Primary)** | OpenRouter → GPT-4o-mini | Баланс цена/качество |
| **LLM (Fallback)** | OpenRouter → Claude Haiku / Gemini Flash | Автоматический fallback |
| **LLM Streaming** | Vercel AI SDK | React hooks для UI |
| **Prompt Management** | Custom | Template files |

### 2.3 Infrastructure

| Component | Technology | Notes |
|-----------|------------|-------|
| **Hosting** | Vercel | Оптимально для Next.js |
| **Database** | Supabase | Free tier: 500MB DB |
| **Video Hosting** | Kinescope | Профессиональный EdTech-хостинг |
| **Email** | Supabase (встроенный) | Для auth, можно добавить Resend |
| **Analytics** | PostHog / Plausible | Privacy-friendly |
| **Monitoring** | Sentry | Error tracking |

### 2.4 Supabase Setup

```sql
-- Включение pgvector в Supabase (через Dashboard или SQL)
CREATE EXTENSION IF NOT EXISTS vector;

-- Проверка
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**Supabase Free Tier лимиты:**
- 500 MB Database
- 1 GB File Storage
- 50,000 monthly active users (Auth)
- 500 MB bandwidth
- 2 Edge Function invocations/sec

Для MVP более чем достаточно.

---

## 3. Database Schema

### 3.1 Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      User       │       │ DiagnosticSession│       │  SkillProfile   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │       │ id (PK)         │
│ email           │  │    │ userId (FK)     │───────│ userId (FK)     │
│ passwordHash    │  └───▶│ status          │       │ analytics       │
│ name            │       │ startedAt       │       │ marketing       │
│ avatarUrl       │       │ completedAt     │       │ content         │
│ emailVerified   │       │ currentQuestion │       │ operations      │
│ createdAt       │       └─────────────────┘       │ finance         │
│ updatedAt       │               │                 │ updatedAt       │
└─────────────────┘               │                 └─────────────────┘
        │                         ▼
        │               ┌─────────────────┐
        │               │DiagnosticAnswer │
        │               ├─────────────────┤
        │               │ id (PK)         │
        │               │ sessionId (FK)  │
        │               │ questionId      │
        │               │ answer          │
        │               │ isCorrect       │
        │               │ difficulty      │
        │               │ skillCategory   │
        │               │ answeredAt      │
        │               └─────────────────┘
        │
        │       ┌─────────────────┐       ┌─────────────────┐
        │       │  LearningPath   │       │  LessonProgress │
        │       ├─────────────────┤       ├─────────────────┤
        └──────▶│ id (PK)         │──────▶│ id (PK)         │
                │ userId (FK)     │       │ pathId (FK)     │
                │ generatedAt     │       │ lessonId        │
                │ lessons (JSON)  │       │ status          │
                └─────────────────┘       │ watchedPercent  │
                                          │ completedAt     │
                                          └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│     Course      │       │     Lesson      │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──────▶│ id (PK)         │
│ title           │       │ courseId (FK)   │
│ description     │       │ title           │
│ slug            │       │ description     │
│ imageUrl        │       │ videoUrl        │
│ duration        │       │ duration        │
│ order           │       │ order           │
└─────────────────┘       │ skillCategory   │
                          │ skillLevel      │
                          └─────────────────┘
                                  │
                                  ▼
                          ┌─────────────────┐
                          │  ContentChunk   │
                          ├─────────────────┤
                          │ id (PK)         │
                          │ lessonId (FK)   │
                          │ content         │
                          │ embedding (vec) │
                          │ timecodeStart   │
                          │ timecodeEnd     │
                          │ metadata (JSON) │
                          └─────────────────┘

┌─────────────────┐
│   ChatMessage   │
├─────────────────┤
│ id (PK)         │
│ userId (FK)     │
│ lessonId        │
│ role            │
│ content         │
│ createdAt       │
└─────────────────┘
```

### 3.2 Prisma Schema (Supabase-compatible)

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL") // Supabase pooling
  extensions = [pgvector(map: "vector", schema: "extensions")]
}

// ============== USER PROFILE ==============
// Auth управляется Supabase, здесь только расширенный профиль

model UserProfile {
  id        String   @id // Совпадает с Supabase auth.users.id
  name      String?
  avatarUrl String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  diagnosticSessions DiagnosticSession[]
  skillProfile       SkillProfile?
  learningPath       LearningPath?
  chatMessages       ChatMessage[]
}

// ============== DIAGNOSTIC ==============

enum DiagnosticStatus {
  IN_PROGRESS
  COMPLETED
  ABANDONED
}

enum SkillCategory {
  ANALYTICS
  MARKETING
  CONTENT
  OPERATIONS
  FINANCE
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

model DiagnosticSession {
  id              String           @id @default(cuid())
  userId          String
  status          DiagnosticStatus @default(IN_PROGRESS)
  startedAt       DateTime         @default(now())
  completedAt     DateTime?
  currentQuestion Int              @default(0)

  user    UserProfile        @relation(fields: [userId], references: [id], onDelete: Cascade)
  answers DiagnosticAnswer[]
}

model DiagnosticAnswer {
  id            String        @id @default(cuid())
  sessionId     String
  questionId    String
  answer        String
  isCorrect     Boolean
  difficulty    Difficulty
  skillCategory SkillCategory
  answeredAt    DateTime      @default(now())

  session DiagnosticSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model SkillProfile {
  id         String   @id @default(cuid())
  userId     String   @unique
  analytics  Int      @default(0) // 0-100
  marketing  Int      @default(0)
  content    Int      @default(0)
  operations Int      @default(0)
  finance    Int      @default(0)
  updatedAt  DateTime @updatedAt

  user UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ============== LEARNING ==============

model Course {
  id          String   @id @default(cuid())
  title       String
  description String?
  slug        String   @unique
  imageUrl    String?
  duration    Int      // minutes
  order       Int      @default(0)
  createdAt   DateTime @default(now())

  lessons Lesson[]
}

model Lesson {
  id            String        @id @default(cuid())
  courseId      String
  title         String
  description   String?
  videoUrl      String        // Kinescope embed URL
  videoId       String?       // Kinescope video ID (для API)
  duration      Int           // minutes
  order         Int           @default(0)
  skillCategory SkillCategory
  skillLevel    Difficulty    @default(MEDIUM)

  course   Course           @relation(fields: [courseId], references: [id], onDelete: Cascade)
  chunks   ContentChunk[]
  progress LessonProgress[]
}

enum LessonStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
}

model LessonProgress {
  id             String       @id @default(cuid())
  pathId         String
  lessonId       String
  status         LessonStatus @default(NOT_STARTED)
  watchedPercent Int          @default(0)
  completedAt    DateTime?

  path   LearningPath @relation(fields: [pathId], references: [id], onDelete: Cascade)
  lesson Lesson       @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([pathId, lessonId])
}

model LearningPath {
  id          String   @id @default(cuid())
  userId      String   @unique
  generatedAt DateTime @default(now())
  lessons     Json     // ordered array of lessonIds with metadata

  user     UserProfile      @relation(fields: [userId], references: [id], onDelete: Cascade)
  progress LessonProgress[]
}

// ============== RAG ==============

model ContentChunk {
  id            String                       @id @default(cuid())
  lessonId      String
  content       String
  embedding     Unsupported("vector(1536)")?
  timecodeStart Int // seconds
  timecodeEnd   Int // seconds
  metadata      Json?

  lesson Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@index([lessonId])
}

// ============== CHAT ==============

enum MessageRole {
  USER
  ASSISTANT
}

model ChatMessage {
  id        String      @id @default(cuid())
  userId    String
  lessonId  String
  role      MessageRole
  content   String
  createdAt DateTime    @default(now())

  user UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, lessonId])
}

// ============== AI CACHE ==============

model SummaryCache {
  id        String   @id @default(cuid())
  lessonId  String   @unique
  summary   String
  createdAt DateTime @default(now())
  expiresAt DateTime
}
```

**Важно про Supabase:**
- `auth.users` управляется Supabase Auth (не Prisma)
- `UserProfile` связывается с `auth.users.id` через trigger
- При регистрации создаём профиль автоматически

```sql
-- Supabase SQL: Автосоздание профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public."UserProfile" (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 4. API Design (tRPC Routers)

### 4.1 Router Structure

```typescript
// packages/api/src/root.ts

import { router } from './trpc';
import { authRouter } from './routers/auth';
import { diagnosticRouter } from './routers/diagnostic';
import { learningRouter } from './routers/learning';
import { profileRouter } from './routers/profile';
import { aiRouter } from './routers/ai';

export const appRouter = router({
  auth: authRouter,
  diagnostic: diagnosticRouter,
  learning: learningRouter,
  profile: profileRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
```

### 4.2 Diagnostic Router

```typescript
// packages/api/src/routers/diagnostic.ts

export const diagnosticRouter = router({
  // Получить текущую сессию или null
  getCurrentSession: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.diagnosticSession.findFirst({
        where: { userId: ctx.user.id, status: 'IN_PROGRESS' },
        include: { answers: true },
      });
    }),

  // Начать новую сессию диагностики
  startSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Завершить предыдущие незавершённые сессии
      await ctx.db.diagnosticSession.updateMany({
        where: { userId: ctx.user.id, status: 'IN_PROGRESS' },
        data: { status: 'ABANDONED' },
      });
      
      return ctx.db.diagnosticSession.create({
        data: { userId: ctx.user.id },
      });
    }),

  // Получить следующий вопрос
  getNextQuestion: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Логика генерации вопроса через AI
      // Учитывает категорию, сложность, предыдущие ответы
    }),

  // Отправить ответ
  submitAnswer: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      questionId: z.string(),
      answer: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Проверка ответа
      // Запись в DiagnosticAnswer
      // Обновление currentQuestion
      // Проверка завершения
    }),

  // Завершить диагностику
  completeSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Расчёт SkillProfile
      // Генерация LearningPath
      // Обновление статуса сессии
    }),

  // Получить результаты
  getResults: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Возврат SkillProfile + рекомендации
    }),

  // История диагностик
  getHistory: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.diagnosticSession.findMany({
        where: { userId: ctx.user.id, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
      });
    }),
});
```

### 4.3 Learning Router

```typescript
// packages/api/src/routers/learning.ts

export const learningRouter = router({
  // Получить персональный трек
  getPath: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.learningPath.findUnique({
        where: { userId: ctx.user.id },
        include: { progress: { include: { lesson: true } } },
      });
    }),

  // Получить список уроков с фильтрами
  getLessons: protectedProcedure
    .input(z.object({
      category: z.nativeEnum(SkillCategory).optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Возврат уроков с прогрессом
    }),

  // Получить детали урока
  getLesson: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Урок + прогресс + чат-история
    }),

  // Обновить прогресс просмотра
  updateProgress: protectedProcedure
    .input(z.object({
      lessonId: z.string(),
      watchedPercent: z.number().min(0).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      // Upsert LessonProgress
      // Автоматическое завершение при 90%
    }),

  // Отметить урок как пройденный
  completeLesson: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Обновить статус
      // Обновить SkillProfile
    }),

  // Получить следующий рекомендованный урок
  getNextRecommendation: protectedProcedure
    .query(async ({ ctx }) => {
      // Логика рекомендации на основе path и progress
    }),
});
```

### 4.4 AI Router

```typescript
// packages/api/src/routers/ai.ts

export const aiRouter = router({
  // Получить резюме урока
  getLessonSummary: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Проверка кэша
      // Генерация через LLM
      // Сохранение в кэш
    }),

  // Чат по уроку (streaming)
  chat: protectedProcedure
    .input(z.object({
      lessonId: z.string(),
      message: z.string().max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit check
      // RAG: поиск релевантных chunks
      // Генерация ответа с citations
      // Сохранение в ChatMessage
    }),

  // Получить историю чата
  getChatHistory: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.chatMessage.findMany({
        where: { userId: ctx.user.id, lessonId: input.lessonId },
        orderBy: { createdAt: 'asc' },
      });
    }),
});
```

---

## 5. RAG Pipeline

### 5.1 Content Ingestion Flow

```
┌──────────────────┐
│  Video File      │
│  (course/lesson) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Whisper         │
│  Transcription   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│  Transcript      │────▶│  Chunking        │
│  with timecodes  │     │  (500-1000 tok)  │
└──────────────────┘     └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  OpenAI          │
                         │  Embeddings      │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  PostgreSQL      │
                         │  + pgvector      │
                         └──────────────────┘
```

### 5.2 Chunking Strategy

```typescript
// packages/ai/src/embeddings/chunker.ts

interface ChunkConfig {
  maxTokens: 800;        // Target chunk size
  overlapTokens: 100;    // Overlap for context
  minChunkTokens: 200;   // Don't create tiny chunks
}

interface TranscriptSegment {
  text: string;
  start: number;  // seconds
  end: number;    // seconds
}

function chunkTranscript(
  segments: TranscriptSegment[],
  config: ChunkConfig
): ContentChunk[] {
  // 1. Group segments by natural breaks (pauses, topic shifts)
  // 2. Split into chunks respecting maxTokens
  // 3. Add overlap from previous chunk
  // 4. Preserve timecode boundaries
}
```

### 5.3 Retrieval Strategy

```typescript
// packages/ai/src/retrieval/search.ts

interface RetrievalConfig {
  topK: 5;                    // Number of chunks to retrieve
  similarityThreshold: 0.7;   // Minimum similarity score
  contextLessonId?: string;   // Limit to specific lesson
}

async function retrieveRelevantChunks(
  query: string,
  config: RetrievalConfig
): Promise<ContentChunk[]> {
  // 1. Embed query
  const queryEmbedding = await embedText(query);
  
  // 2. Vector similarity search
  const chunks = await db.$queryRaw`
    SELECT 
      id, content, "lessonId", "timecodeStart", "timecodeEnd",
      1 - (embedding <=> ${queryEmbedding}::vector) as similarity
    FROM "ContentChunk"
    WHERE 
      ${config.contextLessonId ? Prisma.sql`"lessonId" = ${config.contextLessonId} AND` : Prisma.empty}
      1 - (embedding <=> ${queryEmbedding}::vector) > ${config.similarityThreshold}
    ORDER BY embedding <=> ${queryEmbedding}::vector
    LIMIT ${config.topK}
  `;
  
  return chunks;
}
```

### 5.4 Generation Prompts

```typescript
// packages/ai/src/generation/prompts.ts

export const PROMPTS = {
  // Генерация вопроса диагностики
  diagnosticQuestion: `
Ты — эксперт по обучению селлеров маркетплейсов.
Сгенерируй один вопрос для проверки знаний.

Категория навыка: {{category}}
Уровень сложности: {{difficulty}}
Контекст из курса:
---
{{context}}
---

Требования:
1. Вопрос должен проверять практическое понимание, не просто запоминание
2. 4 варианта ответа, один правильный
3. Ответ должен явно следовать из контекста

Формат JSON:
{
  "question": "текст вопроса",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "explanation": "почему это правильный ответ"
}
`,

  // Резюме урока
  lessonSummary: `
Создай краткое резюме урока для студента.

Транскрипт урока:
---
{{transcript}}
---

Требования:
1. 5-7 ключевых тезисов
2. Практические выводы, не абстракции
3. Markdown-форматирование
4. Максимум 300 слов
`,

  // Чат по уроку
  lessonChat: `
Ты — AI-ассистент MPSTATS Academy. Отвечай на вопросы студента по материалу урока.

Контекст из урока:
---
{{context}}
---

Правила:
1. Отвечай ТОЛЬКО на основе предоставленного контекста
2. Если ответа нет в контексте — честно скажи "Этот вопрос не рассматривается в данном уроке"
3. Указывай таймкод видео, где обсуждается тема: [смотри 5:30]
4. Будь кратким и практичным
5. Используй русский язык

История чата:
{{chatHistory}}

Вопрос студента: {{message}}
`,
};
```

---

## 6. Authentication Flow (Supabase Auth)

### 6.1 Supabase Client Configuration

```typescript
// apps/web/lib/supabase/client.ts

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```typescript
// apps/web/lib/supabase/server.ts

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

### 6.2 Auth Actions

```typescript
// apps/web/lib/auth/actions.ts

'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  
  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/verify-email');
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function resetPassword(email: string) {
  const supabase = await createClient();
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
```

### 6.3 Auth Callback Route

```typescript
// apps/web/app/auth/callback/route.ts

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

### 6.4 Protected Routes (Middleware)

```typescript
// apps/web/middleware.ts

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedRoute = 
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/diagnostic') ||
    request.nextUrl.pathname.startsWith('/learn') ||
    request.nextUrl.pathname.startsWith('/profile');

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### 6.5 Getting User in tRPC Context

```typescript
// packages/api/src/trpc.ts

import { createClient } from '@/lib/supabase/server';
import { initTRPC, TRPCError } from '@trpc/server';

export const createTRPCContext = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  return {
    supabase,
    user,
    db: prisma,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
```

### 6.6 Supabase Dashboard Setup

**В Supabase Dashboard нужно:**

1. **Authentication → Providers:**
   - Email: Enabled (default)
   - Google: Add Client ID + Secret

2. **Authentication → URL Configuration:**
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/auth/callback`

3. **Database → Extensions:**
   - Enable `vector` extension for pgvector
```

---

## 7. Performance & Caching

### 7.1 Caching Strategy

| Data | Cache | TTL | Invalidation |
|------|-------|-----|--------------|
| Lesson list | React Query | 5 min | On lesson update |
| Lesson details | React Query | 10 min | Manual |
| AI Summary | Database | 24h | On transcript change |
| Embeddings | Database | Permanent | On content update |
| User session | JWT | 7-30 days | Logout |

### 7.2 Rate Limiting

```typescript
// packages/api/src/middleware/rateLimit.ts

const rateLimits = {
  api: { window: 60, max: 100 },      // 100 req/min
  llm: { window: 3600, max: 50 },     // 50 req/hour
  chat: { window: 3600, max: 20 },    // 20 messages/hour
};
```

---

## 8. Deployment Architecture

### 8.1 Docker Compose (Local Dev)

```yaml
# docker-compose.yml

version: '3.8'

services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: mpstats
      POSTGRES_PASSWORD: mpstats
      POSTGRES_DB: academy
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### 8.2 Environment Variables

```env
# .env.example

# ============== SUPABASE ==============
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIs..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIs..."  # Только на сервере!

# Database (Prisma)
DATABASE_URL="postgresql://postgres.[project]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[project]:[password]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"

# ============== APP ==============
NEXT_PUBLIC_SITE_URL="http://localhost:3000"  # В проде: https://your-domain.com

# ============== AI / LLM ==============
OPENROUTER_API_KEY="sk-or-v1-..."
OPENROUTER_DEFAULT_MODEL="openai/gpt-4o-mini"
OPENROUTER_FALLBACK_MODEL="google/gemini-flash-1.5"
OPENROUTER_EMBEDDING_MODEL="openai/text-embedding-3-small"

# ============== KINESCOPE ==============
KINESCOPE_API_KEY="..."
KINESCOPE_PROJECT_ID="..."

# ============== ANALYTICS (optional) ==============
NEXT_PUBLIC_POSTHOG_KEY=""
NEXT_PUBLIC_POSTHOG_HOST="https://eu.posthog.com"

# ============== MONITORING (optional) ==============
SENTRY_DSN=""
```

### 8.3 Kinescope Integration

```typescript
// packages/shared/src/kinescope.ts

// Embed URL format
export const getKinescopeEmbedUrl = (videoId: string) => 
  `https://kinescope.io/embed/${videoId}`;

// Player with timecode
export const getKinescopeEmbedUrlWithTime = (videoId: string, seconds: number) =>
  `https://kinescope.io/embed/${videoId}?t=${seconds}`;

// Kinescope Player API (для трекинга просмотра)
// Документация: https://kinescope.io/dev/player/
```

### 8.4 OpenRouter Integration

```typescript
// packages/ai/src/llm/openrouter.ts

import { OpenAI } from 'openai';

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL,
    'X-Title': 'MPSTATS Academy',
  },
});

// Использование
const completion = await openrouter.chat.completions.create({
  model: process.env.OPENROUTER_DEFAULT_MODEL, // 'openai/gpt-4o-mini'
  messages: [{ role: 'user', content: 'Hello' }],
});

// Embeddings через OpenRouter
const embedding = await openrouter.embeddings.create({
  model: 'openai/text-embedding-3-small',
  input: 'text to embed',
});
```

---

## 9. Security Considerations

| Threat | Mitigation |
|--------|------------|
| SQL Injection | Prisma parameterized queries |
| XSS | React automatic escaping, CSP headers |
| CSRF | NextAuth CSRF tokens |
| Brute Force | Rate limiting, account lockout |
| Data Leak | Encrypted passwords, HTTPS only |
| Prompt Injection | Input sanitization, output validation |

---

## 10. Monitoring & Observability

### 10.1 Logging

```typescript
// packages/shared/src/logger.ts

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

// Usage
logger.info({ userId, action: 'diagnostic_started' }, 'User started diagnostic');
```

### 10.2 Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_request_duration` | Histogram | API latency |
| `llm_request_duration` | Histogram | LLM response time |
| `llm_tokens_used` | Counter | Token consumption |
| `diagnostic_completion_rate` | Gauge | % completed diagnostics |
| `active_users_daily` | Gauge | DAU |

---

**Следующий документ:** Task Breakdown
