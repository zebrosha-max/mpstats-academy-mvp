import type { DiagnosticQuestion, SkillCategory, Difficulty } from '@mpstats/shared';

// Mock questions for diagnostic - 25 questions (5 per category)
export const MOCK_QUESTIONS: DiagnosticQuestion[] = [
  // ============== ANALYTICS ==============
  {
    id: 'q-analytics-1',
    question: 'Какой показатель отражает долю товара в общих продажах категории?',
    options: ['CTR', 'Доля рынка', 'Конверсия', 'ROI'],
    correctIndex: 1,
    explanation: 'Доля рынка показывает какой процент от общих продаж категории занимает ваш товар.',
    difficulty: 'EASY' as Difficulty,
    skillCategory: 'ANALYTICS' as SkillCategory,
  },
  {
    id: 'q-analytics-2',
    question: 'Что означает термин ABC-анализ в контексте управления ассортиментом?',
    options: [
      'Анализ конкурентов',
      'Классификация товаров по вкладу в выручку',
      'Анализ рекламных кампаний',
      'Оценка качества товаров',
    ],
    correctIndex: 1,
    explanation: 'ABC-анализ делит товары на группы A (20% товаров = 80% выручки), B и C по их вкладу.',
    difficulty: 'MEDIUM' as Difficulty,
    skillCategory: 'ANALYTICS' as SkillCategory,
  },
  {
    id: 'q-analytics-3',
    question: 'Как рассчитывается оборачиваемость товара?',
    options: [
      'Выручка / Средний остаток',
      'Прибыль / Затраты',
      'Продажи / Показы',
      'Заказы / Визиты',
    ],
    correctIndex: 0,
    explanation: 'Оборачиваемость = Выручка за период / Средний остаток товара на складе.',
    difficulty: 'MEDIUM' as Difficulty,
    skillCategory: 'ANALYTICS' as SkillCategory,
  },
  {
    id: 'q-analytics-4',
    question: 'Что такое когортный анализ в e-commerce?',
    options: [
      'Анализ возвратов',
      'Группировка клиентов по времени первой покупки',
      'Анализ ценовых сегментов',
      'Сравнение категорий товаров',
    ],
    correctIndex: 1,
    explanation: 'Когортный анализ группирует клиентов по дате первой покупки для отслеживания LTV.',
    difficulty: 'HARD' as Difficulty,
    skillCategory: 'ANALYTICS' as SkillCategory,
  },
  {
    id: 'q-analytics-5',
    question: 'Какой инструмент MPSTATS показывает динамику продаж конкурентов?',
    options: [
      'Категорийный анализ',
      'Трекинг товаров',
      'SEO-анализ',
      'Анализ отзывов',
    ],
    correctIndex: 1,
    explanation: 'Трекинг товаров позволяет отслеживать продажи, остатки и цены конкурентов.',
    difficulty: 'EASY' as Difficulty,
    skillCategory: 'ANALYTICS' as SkillCategory,
  },

  // ============== MARKETING ==============
  {
    id: 'q-marketing-1',
    question: 'Что такое CTR в контексте рекламы на маркетплейсе?',
    options: [
      'Стоимость клика',
      'Отношение кликов к показам',
      'Конверсия в покупку',
      'Рентабельность рекламы',
    ],
    correctIndex: 1,
    explanation: 'CTR (Click-Through Rate) = Клики / Показы × 100%. Показывает привлекательность объявления.',
    difficulty: 'EASY' as Difficulty,
    skillCategory: 'MARKETING' as SkillCategory,
  },
  {
    id: 'q-marketing-2',
    question: 'Какой тип рекламной кампании на WB даёт максимальный охват?',
    options: [
      'Поиск + Каталог',
      'Только Поиск',
      'Автоматическая кампания',
      'Карточка товара',
    ],
    correctIndex: 2,
    explanation: 'Автоматическая кампания охватывает все плейсменты: поиск, каталог, карточки, рекомендации.',
    difficulty: 'MEDIUM' as Difficulty,
    skillCategory: 'MARKETING' as SkillCategory,
  },
  {
    id: 'q-marketing-3',
    question: 'Что такое ДРР в контексте рекламы?',
    options: [
      'Дневной рекламный расход',
      'Доля рекламных расходов в выручке',
      'Динамика рекламного ранга',
      'Дополнительный рекламный ресурс',
    ],
    correctIndex: 1,
    explanation: 'ДРР = Расходы на рекламу / Выручка от рекламы × 100%. Ключевая метрика эффективности.',
    difficulty: 'MEDIUM' as Difficulty,
    skillCategory: 'MARKETING' as SkillCategory,
  },
  {
    id: 'q-marketing-4',
    question: 'Как влияет участие в акции на органическое ранжирование товара?',
    options: [
      'Никак не влияет',
      'Временно повышает за счёт роста продаж',
      'Всегда снижает позиции',
      'Влияет только на платные размещения',
    ],
    correctIndex: 1,
    explanation: 'Рост продаж во время акции улучшает позиции, но эффект временный без поддержки.',
    difficulty: 'HARD' as Difficulty,
    skillCategory: 'MARKETING' as SkillCategory,
  },
  {
    id: 'q-marketing-5',
    question: 'Какой минимальный бюджет для запуска рекламы на Wildberries?',
    options: ['100 рублей', '500 рублей', '1000 рублей', '5000 рублей'],
    correctIndex: 1,
    explanation: 'Минимальный бюджет для запуска рекламной кампании на WB — 500 рублей.',
    difficulty: 'EASY' as Difficulty,
    skillCategory: 'MARKETING' as SkillCategory,
  },

  // ============== CONTENT ==============
  {
    id: 'q-content-1',
    question: 'Какой оптимальный размер главного фото карточки товара на WB?',
    options: ['500x500', '900x1200', '1000x1000', '1920x1080'],
    correctIndex: 1,
    explanation: 'Рекомендуемый размер 900x1200 (соотношение 3:4) для оптимального отображения.',
    difficulty: 'EASY' as Difficulty,
    skillCategory: 'CONTENT' as SkillCategory,
  },
  {
    id: 'q-content-2',
    question: 'Сколько характеристик рекомендуется заполнять в карточке товара?',
    options: ['Только обязательные', 'Минимум 50%', 'Максимально возможное количество', '10-15 штук'],
    correctIndex: 2,
    explanation: 'Чем больше заполнено характеристик, тем лучше индексация и попадание в фильтры.',
    difficulty: 'EASY' as Difficulty,
    skillCategory: 'CONTENT' as SkillCategory,
  },
  {
    id: 'q-content-3',
    question: 'Что такое Rich-контент на маркетплейсе?',
    options: [
      'Видео-обзор товара',
      'Расширенное описание с инфографикой',
      '3D-модель товара',
      'Отзывы с фото',
    ],
    correctIndex: 1,
    explanation: 'Rich-контент — это расширенное описание с изображениями, таблицами, инфографикой.',
    difficulty: 'MEDIUM' as Difficulty,
    skillCategory: 'CONTENT' as SkillCategory,
  },
  {
    id: 'q-content-4',
    question: 'Как влияет видео в карточке на конверсию?',
    options: [
      'Не влияет',
      'Снижает загрузку страницы',
      'Повышает конверсию на 10-30%',
      'Влияет только на дорогие товары',
    ],
    correctIndex: 2,
    explanation: 'По статистике, видео в карточке повышает конверсию на 10-30% за счёт доверия.',
    difficulty: 'MEDIUM' as Difficulty,
    skillCategory: 'CONTENT' as SkillCategory,
  },
  {
    id: 'q-content-5',
    question: 'Какой элемент карточки больше всего влияет на CTR в выдаче?',
    options: ['Описание', 'Характеристики', 'Главное фото', 'Отзывы'],
    correctIndex: 2,
    explanation: 'Главное фото — первое, что видит покупатель. Оно определяет 80% решения о клике.',
    difficulty: 'EASY' as Difficulty,
    skillCategory: 'CONTENT' as SkillCategory,
  },

  // ============== OPERATIONS ==============
  {
    id: 'q-operations-1',
    question: 'Что такое FBO на маркетплейсе?',
    options: [
      'Продажа со своего склада',
      'Хранение и доставка силами маркетплейса',
      'Кросс-докинг',
      'Дропшиппинг',
    ],
    correctIndex: 1,
    explanation: 'FBO (Fulfillment by Operator) — товар хранится на складе МП, доставка силами МП.',
    difficulty: 'EASY' as Difficulty,
    skillCategory: 'OPERATIONS' as SkillCategory,
  },
  {
    id: 'q-operations-2',
    question: 'Как рассчитать страховой запас товара?',
    options: [
      'Средние продажи × 30 дней',
      'Максимальные продажи × срок поставки',
      '(Макс. продажи - средние) × срок поставки',
      'Минимальные продажи × 2',
    ],
    correctIndex: 2,
    explanation: 'Страховой запас покрывает колебания спроса: (Пик - Среднее) × Время поставки.',
    difficulty: 'HARD' as Difficulty,
    skillCategory: 'OPERATIONS' as SkillCategory,
  },
  {
    id: 'q-operations-3',
    question: 'Что происходит при out-of-stock на WB?',
    options: [
      'Карточка удаляется',
      'Позиции в выдаче падают',
      'Ничего не меняется',
      'Рейтинг снижается',
    ],
    correctIndex: 1,
    explanation: 'При отсутствии на складе позиции падают, восстановление занимает время.',
    difficulty: 'MEDIUM' as Difficulty,
    skillCategory: 'OPERATIONS' as SkillCategory,
  },
  {
    id: 'q-operations-4',
    question: 'Какой срок хранения товара на складе WB до начала платного хранения?',
    options: ['30 дней', '60 дней', '90 дней', '120 дней'],
    correctIndex: 1,
    explanation: 'Бесплатное хранение — 60 дней, далее начисляется плата за хранение.',
    difficulty: 'MEDIUM' as Difficulty,
    skillCategory: 'OPERATIONS' as SkillCategory,
  },
  {
    id: 'q-operations-5',
    question: 'Что такое коэффициент приёмки на WB?',
    options: [
      'Скидка за объём поставки',
      'Множитель к базовой цене за логистику',
      'Оценка качества поставки',
      'Рейтинг поставщика',
    ],
    correctIndex: 1,
    explanation: 'Коэффициент приёмки может увеличивать или уменьшать стоимость логистики.',
    difficulty: 'MEDIUM' as Difficulty,
    skillCategory: 'OPERATIONS' as SkillCategory,
  },

  // ============== FINANCE ==============
  {
    id: 'q-finance-1',
    question: 'Как рассчитать маржинальность товара?',
    options: [
      'Выручка - Себестоимость',
      '(Выручка - Себестоимость) / Выручка × 100%',
      'Прибыль / Затраты',
      'Продажи / Остаток',
    ],
    correctIndex: 1,
    explanation: 'Маржинальность = (Цена продажи - Себестоимость) / Цена продажи × 100%.',
    difficulty: 'EASY' as Difficulty,
    skillCategory: 'FINANCE' as SkillCategory,
  },
  {
    id: 'q-finance-2',
    question: 'Что входит в unit-экономику товара на маркетплейсе?',
    options: [
      'Только себестоимость',
      'Себестоимость + комиссия МП',
      'Все затраты на единицу товара',
      'Только переменные затраты',
    ],
    correctIndex: 2,
    explanation: 'Unit-экономика включает: себестоимость, логистику, комиссию, рекламу, возвраты.',
    difficulty: 'MEDIUM' as Difficulty,
    skillCategory: 'FINANCE' as SkillCategory,
  },
  {
    id: 'q-finance-3',
    question: 'Какая средняя комиссия WB для категории "Одежда"?',
    options: ['5-10%', '10-15%', '15-20%', '20-25%'],
    correctIndex: 2,
    explanation: 'Комиссия WB для одежды составляет 15-20% в зависимости от подкатегории.',
    difficulty: 'MEDIUM' as Difficulty,
    skillCategory: 'FINANCE' as SkillCategory,
  },
  {
    id: 'q-finance-4',
    question: 'Что такое ROI в контексте запуска товара?',
    options: [
      'Возврат инвестиций',
      'Рентабельность операций',
      'Оборачиваемость склада',
      'Индекс качества',
    ],
    correctIndex: 0,
    explanation: 'ROI = (Прибыль - Инвестиции) / Инвестиции × 100%. Показывает окупаемость вложений.',
    difficulty: 'EASY' as Difficulty,
    skillCategory: 'FINANCE' as SkillCategory,
  },
  {
    id: 'q-finance-5',
    question: 'Как учитывать возвраты в финансовой модели?',
    options: [
      'Игнорировать, это редкость',
      'Закладывать средний % по категории',
      'Учитывать только после факта',
      'Включать в рекламный бюджет',
    ],
    correctIndex: 1,
    explanation: 'Нужно закладывать средний % возвратов (5-15% для одежды) в unit-экономику.',
    difficulty: 'HARD' as Difficulty,
    skillCategory: 'FINANCE' as SkillCategory,
  },
];

// Get questions by category
export const getQuestionsByCategory = (category: SkillCategory): DiagnosticQuestion[] => {
  return MOCK_QUESTIONS.filter((q) => q.skillCategory === category);
};

// Get random questions for diagnostic (balanced across categories)
export const getBalancedQuestions = (count: number = 15): DiagnosticQuestion[] => {
  const categories: SkillCategory[] = ['ANALYTICS', 'MARKETING', 'CONTENT', 'OPERATIONS', 'FINANCE'];
  const perCategory = Math.floor(count / categories.length);
  const result: DiagnosticQuestion[] = [];

  categories.forEach((category) => {
    const categoryQuestions = getQuestionsByCategory(category);
    const shuffled = [...categoryQuestions].sort(() => Math.random() - 0.5);
    result.push(...shuffled.slice(0, perCategory));
  });

  // Shuffle final result
  return result.sort(() => Math.random() - 0.5);
};
