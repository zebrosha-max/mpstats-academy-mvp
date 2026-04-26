---
phase: 49-lesson-materials
plan: 04
type: execute
wave: 3
depends_on: ['49-02']
files_modified:
  - apps/web/src/lib/analytics/constants.ts
  - apps/web/src/components/learning/MaterialCard.tsx
  - apps/web/src/components/learning/LessonMaterials.tsx
  - apps/web/src/app/(main)/learn/[id]/page.tsx
autonomous: true
requirements:
  - Phase 49 (D-25..D-31, D-41)

must_haves:
  truths:
    - "На странице /learn/[id] для урока с материалами отображается секция «Материалы к уроку» с карточками"
    - "На залоченном уроке секция вообще не рендерится (HTML отсутствует)"
    - "Клик по кнопке material с storagePath дёргает getSignedUrl и открывает signed URL"
    - "Клик по кнопке material с externalUrl открывает URL в новой вкладке напрямую"
    - "Yandex Metrika получает MATERIAL_OPEN при клике и MATERIAL_SECTION_VIEW при появлении секции в viewport"
  artifacts:
    - path: "apps/web/src/components/learning/MaterialCard.tsx"
      provides: "Карточка одного материала с иконкой по типу"
      min_lines: 80
    - path: "apps/web/src/components/learning/LessonMaterials.tsx"
      provides: "Section с grid карточек + Intersection Observer для аналитики"
      min_lines: 60
    - path: "apps/web/src/lib/analytics/constants.ts"
      provides: "MATERIAL_OPEN, MATERIAL_SECTION_VIEW цели"
  key_links:
    - from: "apps/web/src/app/(main)/learn/[id]/page.tsx"
      to: "LessonMaterials"
      via: "<LessonMaterials materials={lesson.materials} lessonId={lessonId} />"
      pattern: "LessonMaterials"
    - from: "MaterialCard"
      to: "trpc.material.getSignedUrl"
      via: "lazy mutation on click"
      pattern: "material.getSignedUrl"
---

<objective>
Создать UI секцию «Материалы к уроку» на странице урока: компонент `LessonMaterials` (контейнер с заголовком и grid'ом) + `MaterialCard` (карточка с иконкой по типу, accent-цветом, CTA-кнопкой). Вставить между `CollapsibleSummary` и навигационным блоком на десктопе (D-26). Подключить Yandex Metrika события `MATERIAL_OPEN` (клик) и `MATERIAL_SECTION_VIEW` (Intersection Observer).

Покрыть запрет на отображение для залоченных уроков (D-37 — backend уже отдаёт `materials: []`, но фронт явно проверяет `length === 0` и не рендерит секцию — D-29).

Purpose: видимая для клиента ценность фазы 49 — методолог прикрепил материал, юзер его видит и скачивает.
Output: 3 новых/модифицированных файла + интеграция в страницу урока.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/49-lesson-materials/49-CONTEXT.md
@.planning/phases/49-lesson-materials/49-02-SUMMARY.md
@MAAL/CLAUDE.md
@apps/web/src/app/(main)/learn/[id]/page.tsx
@apps/web/src/components/learning/CollapsibleSummary.tsx
@apps/web/src/components/learning/LessonCard.tsx
@apps/web/src/components/learning/LibrarySection.tsx
@apps/web/src/lib/analytics/constants.ts
@apps/web/src/lib/analytics/metrika.ts
@packages/shared/src/types.ts

<interfaces>
<!-- Existing analytics helper -->

From apps/web/src/lib/analytics/metrika.ts:
```typescript
export function reachGoal(goal: string, params?: Record<string, any>): void;
```

From apps/web/src/lib/analytics/constants.ts (Phase 26):
```typescript
export const METRIKA_GOALS = {
  SIGNUP: 'platform_signup',
  // ... 8 goals
} as const;
```

From learning.getLesson payload (после 49-02):
```typescript
materials: Array<{
  id: string;
  type: 'PRESENTATION' | 'CALCULATION_TABLE' | 'EXTERNAL_SERVICE' | 'CHECKLIST' | 'MEMO';
  title: string;
  description: string | null;
  ctaText: string;
  externalUrl: string | null;
  hasFile: boolean;  // true if storagePath set
  order: number;
}>
```

From packages/shared/src/types.ts:
```typescript
export const MATERIAL_TYPE_LABELS: Record<MaterialTypeValue, string>;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add MATERIAL_OPEN and MATERIAL_SECTION_VIEW to analytics constants</name>
  <files>apps/web/src/lib/analytics/constants.ts</files>
  <read_first>
    - apps/web/src/lib/analytics/constants.ts (целиком — 13 строк)
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-41)
  </read_first>
  <action>
В `apps/web/src/lib/analytics/constants.ts` добавить 2 новые цели в объект `METRIKA_GOALS`. Финальный файл:

```typescript
export const METRIKA_GOALS = {
  SIGNUP: 'platform_signup',
  LOGIN: 'platform_login',
  DIAGNOSTIC_START: 'platform_diagnostic_start',
  DIAGNOSTIC_COMPLETE: 'platform_diagnostic_complete',
  LESSON_OPEN: 'platform_lesson_open',
  PRICING_VIEW: 'platform_pricing_view',
  PAYMENT: 'platform_payment',
  CTA_CLICK: 'platform_cta_click',
  // Phase 49 — Lesson Materials (D-41)
  MATERIAL_OPEN: 'platform_material_open',
  MATERIAL_SECTION_VIEW: 'platform_material_section_view',
} as const;

export type MetrikaGoal = (typeof METRIKA_GOALS)[keyof typeof METRIKA_GOALS];
```

Никаких других правок. Не менять существующие ключи.
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && grep -c "MATERIAL_OPEN" apps/web/src/lib/analytics/constants.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "MATERIAL_OPEN: 'platform_material_open'" apps/web/src/lib/analytics/constants.ts` == 1
    - `grep -c "MATERIAL_SECTION_VIEW: 'platform_material_section_view'" apps/web/src/lib/analytics/constants.ts` == 1
    - `pnpm --filter @mpstats/web typecheck` exit 0
    - Не сломаны существующие 8 целей (их `grep -c` не уменьшился)
  </acceptance_criteria>
  <done>2 новые Metrika-цели добавлены, существующие не задеты.</done>
</task>

<task type="auto">
  <name>Task 2: Create MaterialCard + LessonMaterials components</name>
  <files>apps/web/src/components/learning/MaterialCard.tsx, apps/web/src/components/learning/LessonMaterials.tsx</files>
  <read_first>
    - apps/web/src/components/learning/LessonCard.tsx (паттерн карточки + Tailwind tokens из mp-design-system)
    - apps/web/src/components/learning/LibrarySection.tsx (паттерн section + grid)
    - apps/web/src/components/ui/card.tsx (shadcn Card primitives)
    - apps/web/src/components/ui/button.tsx (shadcn Button)
    - apps/web/src/lib/trpc/client.ts (использование tRPC client)
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-26..D-31)
    - packages/shared/src/types.ts (MATERIAL_TYPE_LABELS)
  </read_first>
  <action>
**Файл 1 — `apps/web/src/components/learning/MaterialCard.tsx`:**

```typescript
'use client';

import { useState } from 'react';
import { FileText, Table, ExternalLink, ListChecks, StickyNote, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { reachGoal } from '@/lib/analytics/metrika';
import { METRIKA_GOALS } from '@/lib/analytics/constants';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type MaterialCardProps = {
  id: string;
  type: 'PRESENTATION' | 'CALCULATION_TABLE' | 'EXTERNAL_SERVICE' | 'CHECKLIST' | 'MEMO';
  title: string;
  description: string | null;
  ctaText: string;
  externalUrl: string | null;
  hasFile: boolean;
  lessonId: string;
};

const TYPE_CONFIG = {
  PRESENTATION:      { Icon: FileText,    accent: 'bg-blue-50 text-blue-700 border-blue-200',     label: 'Презентация' },
  CALCULATION_TABLE: { Icon: Table,       accent: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Таблица расчётов' },
  EXTERNAL_SERVICE:  { Icon: ExternalLink, accent: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Внешний сервис' },
  CHECKLIST:         { Icon: ListChecks,  accent: 'bg-green-50 text-green-700 border-green-200',   label: 'Чек-лист' },
  MEMO:              { Icon: StickyNote,  accent: 'bg-gray-50 text-gray-700 border-gray-200',     label: 'Памятка' },
} as const;

export function MaterialCard({ id, type, title, description, ctaText, externalUrl, hasFile, lessonId }: MaterialCardProps) {
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();

  // useUtils for lazy fetch — does not run on mount
  const handleClick = async () => {
    reachGoal(METRIKA_GOALS.MATERIAL_OPEN, { materialId: id, materialType: type, lessonId });

    if (externalUrl) {
      window.open(externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (hasFile) {
      setLoading(true);
      try {
        const res = await utils.client.material.getSignedUrl.query({ materialId: id });
        window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
      } catch (err: any) {
        toast.error(err?.message?.includes('FORBIDDEN')
          ? 'Доступ к материалу ограничен'
          : 'Не удалось открыть материал. Попробуйте ещё раз.');
      } finally {
        setLoading(false);
      }
    }
  };

  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.Icon;

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="p-4 flex flex-col gap-3 h-full">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-md border shrink-0', cfg.accent)}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-mp-gray-500 mb-1">{cfg.label}</div>
            <div className="text-body font-semibold text-mp-gray-900 leading-tight">{title}</div>
          </div>
        </div>
        {description && (
          <p className="text-body-sm text-mp-gray-600 line-clamp-2">{description}</p>
        )}
        <div className="mt-auto pt-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleClick}
            disabled={loading}
            data-testid={`material-cta-${id}`}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {ctaText}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Файл 2 — `apps/web/src/components/learning/LessonMaterials.tsx`:**

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { MaterialCard, type MaterialCardProps } from './MaterialCard';
import { reachGoal } from '@/lib/analytics/metrika';
import { METRIKA_GOALS } from '@/lib/analytics/constants';

type Material = Omit<MaterialCardProps, 'lessonId'> & { order: number };

export type LessonMaterialsProps = {
  materials: Material[];
  lessonId: string;
};

export function LessonMaterials({ materials, lessonId }: LessonMaterialsProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const sentRef = useRef(false);

  // D-29: empty → render nothing
  useEffect(() => {
    if (!ref.current || materials.length === 0 || sentRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !sentRef.current) {
          sentRef.current = true;
          reachGoal(METRIKA_GOALS.MATERIAL_SECTION_VIEW, { lessonId, count: materials.length });
          observer.disconnect();
        }
      }
    }, { threshold: 0.4 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [materials.length, lessonId]);

  if (materials.length === 0) return null;

  return (
    <section ref={ref} data-testid="lesson-materials" className="space-y-3">
      <h2 className="text-heading flex items-center gap-2 text-mp-gray-900">
        <svg className="w-5 h-5 text-mp-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        Материалы к уроку
        <span className="text-xs text-mp-gray-400 font-normal">({materials.length})</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {materials.map(m => (
          <MaterialCard
            key={m.id}
            id={m.id}
            type={m.type}
            title={m.title}
            description={m.description}
            ctaText={m.ctaText}
            externalUrl={m.externalUrl}
            hasFile={m.hasFile}
            lessonId={lessonId}
          />
        ))}
      </div>
    </section>
  );
}
```
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && pnpm --filter @mpstats/web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/src/components/learning/MaterialCard.tsx` существует, ≥80 LoC
    - `apps/web/src/components/learning/LessonMaterials.tsx` существует, ≥60 LoC
    - `grep -c "MATERIAL_OPEN" apps/web/src/components/learning/MaterialCard.tsx` >= 1
    - `grep -c "MATERIAL_SECTION_VIEW" apps/web/src/components/learning/LessonMaterials.tsx` == 1
    - `grep -c "IntersectionObserver" apps/web/src/components/learning/LessonMaterials.tsx` >= 1
    - `grep -c "if (materials.length === 0) return null" apps/web/src/components/learning/LessonMaterials.tsx` == 1
    - `grep -c "material.getSignedUrl" apps/web/src/components/learning/MaterialCard.tsx` >= 1
    - `pnpm --filter @mpstats/web typecheck` exit 0
  </acceptance_criteria>
  <done>Компоненты существуют, типы валидны, оба Metrika-события привязаны.</done>
</task>

<task type="auto">
  <name>Task 3: Insert LessonMaterials in lesson page between summary and navigation</name>
  <files>apps/web/src/app/(main)/learn/[id]/page.tsx</files>
  <read_first>
    - apps/web/src/app/(main)/learn/[id]/page.tsx — найти grep'ом маркеры:
      * `<CollapsibleSummary` — конец блока «Ключевые тезисы»
      * `{/* Lesson info */}` или эквивалентный комментарий — начало блока с метаданными урока (badges)
      * `MobileChatCommentsTabs` — нижняя граница (вставка должна быть ВЫШЕ)
      Использовать `grep -n` чтобы найти точные позиции в текущем файле; line numbers из планирования могут устареть.
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-26 — расположение)
  </read_first>
  <action>
В `apps/web/src/app/(main)/learn/[id]/page.tsx`:

**Шаг 1 — добавить импорт** в начало файла рядом с другими `learning/*` импортами:
```typescript
import { LessonMaterials } from '@/components/learning/LessonMaterials';
```
(найти секцию импортов через `grep -n "from '@/components/learning/" apps/web/src/app/\(main\)/learn/\[id\]/page.tsx` — добавить рядом с CollapsibleSummary импортом).

**Шаг 2 — найти точку вставки** (НЕ полагаться на line numbers, использовать grep-маркеры):

```bash
grep -n "CollapsibleSummary\|Lesson info\|MobileChatCommentsTabs" apps/web/src/app/\(main\)/learn/\[id\]/page.tsx
```

Целевая позиция: ПОСЛЕ закрывающего `</CollapsibleSummary>` (или закрывающего `</div>` блока «Ключевые тезисы», обернувшего CollapsibleSummary), ПЕРЕД блоком который начинается с `{/* Lesson info */}` (это блок где `<div className="flex items-center justify-between">` содержит `<Badge variant={`).

Если маркер `{/* Lesson info */}` отсутствует — целевая позиция: ПЕРЕД блоком `<div className="flex items-center justify-between">` который содержит `<Badge variant=` (это и есть Lesson info секция).

В любом случае — должно быть ПЕРЕД `MobileChatCommentsTabs` (нижняя граница).

**Шаг 3 — вставить блок:**

```tsx
          {/* Phase 49 — Lesson Materials (between summary and lesson-info, per D-26) */}
          {data?.materials && (
            <LessonMaterials materials={data.materials} lessonId={lessonId} />
          )}
```

(используется `data` — это результат useQuery getLesson; если переменная называется иначе в файле, использовать ту же переменную, что и `summaryData`/`lesson` — ориентироваться на текущий код).

ВАЖНО: НЕ дублировать секцию для мобильной версии — общий контейнер виден на всех viewport'ах. Grid в самом `LessonMaterials` уже `grid-cols-1 sm:grid-cols-2`.

ВАЖНО: НЕ добавлять секцию ВНУТРИ `MobileChatCommentsTabs` — материалы должны быть выше навигации, до табов чата/комментариев.

**Шаг 4 — Если `data` объект используется не как `data.materials`, а из деструктуризации (например `const { lesson } = data` или `const lesson = data?.lesson`), убедиться, что `materials` доступен через `data.materials` (поле на верхнем уровне payload, не внутри lesson — мы так структурировали в 49-02, см. learning.ts return).

Если `data.materials` отсутствует, проверь, что Wave 2 (49-02 Task 2) действительно добавил поле в return блок getLesson. Без этого 49-04 не закроется.
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && pnpm --filter @mpstats/web typecheck && grep -c "LessonMaterials" apps/web/src/app/\(main\)/learn/\[id\]/page.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "import { LessonMaterials }" apps/web/src/app/(main)/learn/[id]/page.tsx` == 1
    - `grep -c "<LessonMaterials" apps/web/src/app/(main)/learn/[id]/page.tsx` == 1
    - В коде LessonMaterials появляется ПОСЛЕ строки `<CollapsibleSummary` (можно проверить через `grep -n` сравнением номеров строк — line у LessonMaterials > line у последнего CollapsibleSummary)
    - В коде LessonMaterials появляется ДО строки с `MobileChatCommentsTabs` (line у LessonMaterials < line у MobileChatCommentsTabs)
    - `pnpm --filter @mpstats/web typecheck` exit 0
    - `pnpm --filter @mpstats/web build` succeeds (smoke check)
    - Manual smoke: на dev-сервере открыть урок с привязанным материалом — секция отображается; открыть локированный урок — секция отсутствует в DOM (devtools поиск по `data-testid="lesson-materials"` не найдёт элемент)
  </acceptance_criteria>
  <done>Секция материалов вписана в страницу урока в правильном месте (по grep-маркерам, а не line numbers), билд проходит, локированный урок не рендерит секцию.</done>
</task>

</tasks>

<verification>
- typecheck + build проходят
- Visual: на уроке с материалами — секция видна, на залоченном — отсутствует в DOM
- DevTools Network: клик по карточке c hasFile=true → запрос на `/api/trpc/material.getSignedUrl` → ответ с signedUrl → открывается в новой вкладке
- DevTools Network: клик по карточке с externalUrl → открывается без запроса к нашему API
- Yandex Metrika preview (если настроен): MATERIAL_OPEN/MATERIAL_SECTION_VIEW появляются
</verification>

<success_criteria>
1. На странице урока с материалами видна секция «Материалы к уроку»
2. Карточки рендерятся с правильной иконкой/цветом по типу
3. CTA-кнопка работает: external открывает URL, file → signed URL
4. Залоченный урок: секция отсутствует
5. Yandex Metrika получает 2 цели
</success_criteria>

<output>
After completion, create `.planning/phases/49-lesson-materials/49-04-SUMMARY.md` documenting:
- Местоположение секции в структуре страницы
- Скриншот-ссылку (или описание визуала)
- Подтверждение что Metrika-цели зашиты
</output>
</content>
</invoke>
