'use client';

import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import type { SkillCategory } from '@mpstats/shared';

export interface FilterState {
  category: SkillCategory | 'ALL';
  status: string;
  topics: string[];
  difficulty: string;   // 'ALL' | 'EASY' | 'MEDIUM' | 'HARD'
  duration: string;     // 'ALL' | 'short' | 'medium' | 'long'
  courseId: string;      // 'ALL' | course.id
  marketplace: string;  // 'ALL' | 'WB' | 'OZON'
}

export const DEFAULT_FILTERS: FilterState = {
  category: 'ALL',
  status: 'ALL',
  topics: [],
  difficulty: 'ALL',
  duration: 'ALL',
  courseId: 'ALL',
  marketplace: 'ALL',
};

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableTopics: string[];
  availableCourses: { id: string; title: string }[];
}

const CATEGORY_FILTERS: { value: SkillCategory | 'ALL'; label: string; color: string }[] = [
  { value: 'ALL', label: 'Все', color: 'bg-mp-gray-100 text-mp-gray-700' },
  { value: 'ANALYTICS', label: 'Аналитика', color: 'bg-mp-blue-100 text-mp-blue-700' },
  { value: 'MARKETING', label: 'Маркетинг', color: 'bg-mp-green-100 text-mp-green-700' },
  { value: 'CONTENT', label: 'Контент', color: 'bg-mp-pink-100 text-mp-pink-700' },
  { value: 'OPERATIONS', label: 'Операции', color: 'bg-orange-100 text-orange-700' },
  { value: 'FINANCE', label: 'Финансы', color: 'bg-yellow-100 text-yellow-700' },
];

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Все уроки' },
  { value: 'NOT_STARTED', label: 'Не начатые' },
  { value: 'IN_PROGRESS', label: 'В процессе' },
  { value: 'COMPLETED', label: 'Завершённые' },
];

const MARKETPLACE_FILTERS = [
  { value: 'ALL', label: 'Все', color: 'bg-mp-gray-50 text-mp-gray-700' },
  { value: 'WB', label: 'WB', color: 'bg-purple-100 text-purple-700' },
  { value: 'OZON', label: 'OZON', color: 'bg-blue-100 text-blue-700' },
];

function isNonDefault(filters: FilterState): boolean {
  return (
    filters.category !== 'ALL' ||
    filters.status !== 'ALL' ||
    filters.topics.length > 0 ||
    filters.difficulty !== 'ALL' ||
    filters.duration !== 'ALL' ||
    filters.courseId !== 'ALL' ||
    filters.marketplace !== 'ALL'
  );
}

export function FilterPanel({ filters, onFiltersChange, availableTopics, availableCourses }: FilterPanelProps) {
  const update = (partial: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const toggleTopic = (topic: string) => {
    const next = filters.topics.includes(topic)
      ? filters.topics.filter(t => t !== topic)
      : [...filters.topics, topic];
    update({ topics: next });
  };

  return (
    <div className="flex flex-wrap gap-2 items-center overflow-x-auto">
      {/* Category pills */}
      {CATEGORY_FILTERS.map(cat => (
        <button
          key={cat.value}
          onClick={() => update({ category: cat.value })}
          className={cn(
            'px-3 py-2 rounded-full text-body-sm whitespace-nowrap transition-colors',
            filters.category === cat.value ? cat.color : 'bg-mp-gray-50 text-mp-gray-500'
          )}
        >
          {cat.label}
        </button>
      ))}

      {/* Separator */}
      <div className="w-px h-6 bg-mp-gray-200 hidden sm:block" />

      {/* Status pills */}
      {STATUS_FILTERS.map(st => (
        <button
          key={st.value}
          onClick={() => update({ status: st.value })}
          className={cn(
            'px-3 py-2 rounded-full text-body-sm whitespace-nowrap transition-colors',
            filters.status === st.value
              ? 'bg-mp-blue-100 text-mp-blue-700'
              : 'bg-mp-gray-50 text-mp-gray-500'
          )}
        >
          {st.label}
        </button>
      ))}

      {/* Separator */}
      <div className="w-px h-6 bg-mp-gray-200 hidden sm:block" />

      {/* Topics multi-select */}
      {availableTopics.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              'px-3 py-2 rounded-lg border text-body-sm whitespace-nowrap transition-colors',
              filters.topics.length > 0
                ? 'border-mp-blue-200 bg-mp-blue-50 text-mp-blue-700 font-semibold'
                : 'border-mp-gray-200 bg-white text-mp-gray-600'
            )}>
              {filters.topics.length > 0
                ? `Топики +${filters.topics.length}`
                : 'Все топики'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Поиск по топикам..." />
              <CommandList>
                <CommandEmpty>Не найдено</CommandEmpty>
                {availableTopics.map(topic => (
                  <CommandItem
                    key={topic}
                    value={topic}
                    onSelect={() => toggleTopic(topic)}
                    className="cursor-pointer"
                  >
                    <div className={cn(
                      'mr-2 flex h-4 w-4 items-center justify-center rounded border',
                      filters.topics.includes(topic)
                        ? 'border-mp-blue-600 bg-mp-blue-600'
                        : 'border-mp-gray-300'
                    )}>
                      {filters.topics.includes(topic) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-body-sm">{topic}</span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {/* Difficulty dropdown */}
      <select
        value={filters.difficulty}
        onChange={(e) => update({ difficulty: e.target.value })}
        className={cn(
          'px-3 py-2 rounded-lg border border-mp-gray-200 text-body-sm bg-white transition-colors',
          filters.difficulty !== 'ALL' && 'font-semibold'
        )}
      >
        <option value="ALL">Сложность</option>
        <option value="EASY">Легкий</option>
        <option value="MEDIUM">Средний</option>
        <option value="HARD">Сложный</option>
      </select>

      {/* Duration dropdown */}
      <select
        value={filters.duration}
        onChange={(e) => update({ duration: e.target.value })}
        className={cn(
          'px-3 py-2 rounded-lg border border-mp-gray-200 text-body-sm bg-white transition-colors',
          filters.duration !== 'ALL' && 'font-semibold'
        )}
      >
        <option value="ALL">Длительность</option>
        <option value="short">До 10 мин</option>
        <option value="medium">10-30 мин</option>
        <option value="long">30+ мин</option>
      </select>

      {/* Course dropdown */}
      {availableCourses.length > 0 && (
        <select
          value={filters.courseId}
          onChange={(e) => update({ courseId: e.target.value })}
          className={cn(
            'px-3 py-2 rounded-lg border border-mp-gray-200 text-body-sm bg-white transition-colors max-w-[200px]',
            filters.courseId !== 'ALL' && 'font-semibold'
          )}
        >
          <option value="ALL">Все курсы</option>
          {availableCourses.map(c => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      )}

      {/* Separator */}
      <div className="w-px h-6 bg-mp-gray-200 hidden sm:block" />

      {/* Marketplace pills */}
      {MARKETPLACE_FILTERS.map(mp => (
        <button
          key={mp.value}
          onClick={() => update({ marketplace: mp.value })}
          className={cn(
            'px-3 py-2 rounded-full text-body-sm whitespace-nowrap transition-colors',
            filters.marketplace === mp.value ? mp.color : 'bg-mp-gray-50 text-mp-gray-500'
          )}
        >
          {mp.label}
        </button>
      ))}

      {/* Reset link */}
      {isNonDefault(filters) && (
        <button
          onClick={() => onFiltersChange(DEFAULT_FILTERS)}
          className="text-body-sm text-mp-blue-600 hover:underline cursor-pointer whitespace-nowrap"
        >
          Сбросить фильтры
        </button>
      )}
    </div>
  );
}
