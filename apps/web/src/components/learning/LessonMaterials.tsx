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

/**
 * Phase 49 Wave 4 — секция «Материалы к уроку» (D-26..D-31).
 *
 * Показывается между «Ключевыми тезисами» и навигацией на уроке.
 * - D-29: пустой массив → секция не рендерится (никакого «Материалов пока нет»).
 * - D-30: grid sm:grid-cols-2 (1 колонка на mobile, 2 на desktop).
 * - D-31: skeleton не нужен — payload приходит вместе с lesson.
 * - D-37: backend для locked-урока возвращает materials=[], так что эта же ветка ловит
 *   и locked-кейс (компонент даже не вызовется, потому что родитель передаёт пустой массив).
 * - D-41: MATERIAL_SECTION_VIEW шлётся один раз при появлении секции в viewport.
 */
export function LessonMaterials({ materials, lessonId }: LessonMaterialsProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const sentRef = useRef(false);

  useEffect(() => {
    if (!ref.current || materials.length === 0 || sentRef.current) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !sentRef.current) {
            sentRef.current = true;
            reachGoal(METRIKA_GOALS.MATERIAL_SECTION_VIEW, {
              lessonId,
              count: materials.length,
            });
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [materials.length, lessonId]);

  // D-29: empty → render nothing
  if (materials.length === 0) return null;

  return (
    <section
      ref={ref}
      data-testid="lesson-materials"
      data-tour="lesson-materials"
      className="space-y-3"
    >
      <h2 className="text-heading flex items-center gap-2 text-mp-gray-900">
        <svg
          className="w-5 h-5 text-mp-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Материалы к уроку
        <span className="text-xs text-mp-gray-400 font-normal">({materials.length})</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {materials.map((m) => (
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
