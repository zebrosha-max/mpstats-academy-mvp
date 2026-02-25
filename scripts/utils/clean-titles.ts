/**
 * Shared title cleanup functions for lesson titles, module descriptions, and course names.
 * Used by both cleanup-names.ts (one-time fix) and seed-from-manifest.ts (future seeds).
 */

/**
 * Clean lesson title: remove file extensions, numeric prefixes, underscores
 * Example: "1 SEO-оптимизация.mp4" -> "SEO-оптимизация"
 * Example: "1.2 Типы конкуренции как понять, кто мой конкурент.mp4" -> "Типы конкуренции как понять, кто мой конкурент"
 */
export function cleanLessonTitle(raw: string): string {
  let title = raw;

  // 1. Remove file extensions (anchored to end of string)
  title = title.replace(/\.(mp4|mov|avi|mkv|webm|flv)$/i, '');

  // 2. Remove leading numeric prefixes:
  //    - "1. Title" or "1.2 Title" (number + dot + optional sub-number + space)
  //    - "001_Title" or "m01_Title" (number + underscore)
  //    - "1 Title" ONLY when title originally had extension (heuristic)
  //      i.e., bare "N word" like "3 способа" is preserved as meaningful content
  //    Also handle emoji digit variants (e.g. "5\uFE0F")
  title = title.replace(/^m?\d+[\uFE0F\u20E3]*[._]\s*\d*\.?\s*/, '');
  // Handle bare "N " ONLY when title originally had extension
  if (raw.match(/\.(mp4|mov|avi|mkv|webm|flv)$/i)) {
    title = title.replace(/^\d+[\uFE0F\u20E3]*\s+/, '');
  }

  // 3. Replace underscores with spaces
  title = title.replace(/_/g, ' ');

  // 4. Collapse multiple spaces, trim
  title = title.replace(/\s{2,}/g, ' ').trim();

  // 5. Capitalize first letter, preserve rest (natural Russian style)
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  // Safety: if result is empty or too short, keep original
  if (title.length < 2) {
    console.warn(`  WARNING: cleaned title too short for "${raw}" -> "${title}", keeping original`);
    return raw;
  }

  return title;
}

/**
 * Clean module description: remove "Модуль: Модуль N_" prefix, clean underscores
 * Example: "Модуль: Модуль 6_ Трафик_ привлекаем клиентов SEO и рекламой"
 *       -> "Трафик: привлекаем клиентов SEO и рекламой"
 */
export function cleanModuleDescription(raw: string): string {
  let desc = raw;

  // 1. Remove "Модуль: " prefix
  desc = desc.replace(/^Модуль:\s*/, '');

  // 2. Remove "Модуль N_ " or "Модуль N " prefix (the duplicate)
  desc = desc.replace(/^Модуль\s+\d+_?\s*/, '');

  // 3. Replace first "_ " (underscore + space) with ": " (section separator)
  //    e.g. "Трафик_ привлекаем" -> "Трафик: привлекаем"
  //    e.g. "Экономика продаж_ считаем" -> "Экономика продаж: считаем"
  desc = desc.replace(/_\s+/, ': ');

  // 4. Replace remaining underscores with spaces
  desc = desc.replace(/_/g, ' ');

  // 5. Collapse multiple spaces, trim
  desc = desc.replace(/\s{2,}/g, ' ').trim();

  // 6. Capitalize first letter
  if (desc.length > 0) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  return desc;
}

/**
 * Hardcoded clean Russian names for 6 courses
 */
export const COURSE_NAMES: Record<string, { title: string; description: string }> = {
  '01_analytics': {
    title: 'Аналитика для маркетплейсов',
    description: 'Внутренняя и внешняя аналитика, юнит-экономика, конкурентный анализ',
  },
  '02_ads': {
    title: 'Реклама и продвижение',
    description: 'SEO-оптимизация, рекламные кампании, трафик и конверсии',
  },
  '03_ai': {
    title: 'AI-инструменты для селлеров',
    description: 'Использование искусственного интеллекта в работе на маркетплейсах',
  },
  '04_workshops': {
    title: 'Практические воркшопы',
    description: 'Пошаговые разборы и мастер-классы',
  },
  '05_ozon': {
    title: 'Работа с Ozon',
    description: 'Особенности продаж и продвижения на площадке Ozon',
  },
  '06_express': {
    title: 'Экспресс-курсы',
    description: 'Быстрые курсы по ключевым темам маркетплейсов',
  },
};
