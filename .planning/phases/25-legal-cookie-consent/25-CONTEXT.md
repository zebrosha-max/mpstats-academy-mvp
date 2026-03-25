# Phase 25: Legal + Cookie Consent - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

5 legal-страниц на платформе, 3 чекбокса на форме регистрации, cookie consent баннер, ссылки в footer. Контент документов берётся с основного сайта mpstats.academy (тексты те же, домен наш).

НЕ входит: правки текстов документов (юридическая ответственность на юристах), GDPR (только РФ законодательство).

</domain>

<decisions>
## Implementation Decisions

### Подход к legal-контенту
- **D-01:** Вариант B — свои страницы на platform.mpstats.academy (не ссылки на основной сайт)
- **D-02:** Тексты документов копируются с mpstats.academy без изменений (кроме оферты — свой документ)
- **D-03:** Домен в cookies-политике и privacy policy остаётся `mpstats.academy` (покрывает поддомены)

### Страницы
- **D-04:** 5 legal-страниц:
  - `/legal/offer` — Оферта (из `docs/Оферта платформа академия, финал.docx`)
  - `/legal/pdn` — Согласие на обработку ПДн (текст с mpstats.academy/legal/pdn)
  - `/legal/adv` — Согласие на рекламную рассылку (текст с mpstats.academy/legal/adv)
  - `/legal/cookies` — Политика обработки cookies (текст с mpstats.academy/legal/cookies)
  - `/policy` — Политика конфиденциальности (текст с mpstats.academy/policy)
- **D-05:** Страницы — статический контент (не SSR, не из БД), simple Next.js pages

### Чекбоксы на форме регистрации
- **D-06:** 3 чекбокса на `/register`:
  1. "Я принимаю условия [оферты](/legal/offer)" — **обязательный**
  2. "Я согласен на [обработку персональных данных](/legal/pdn)" — **обязательный**
  3. "Я согласен на получение [рекламных материалов](/legal/adv)" — **опциональный**
- **D-07:** Кнопка "Зарегистрироваться" disabled пока обязательные чекбоксы не отмечены
- **D-08:** Состояние чекбокса рекламной рассылки можно сохранить в UserProfile (для CQ `pa_adv_consent`)

### Cookie Consent баннер
- **D-09:** Баннер внизу экрана при первом визите (без auth, на всех страницах)
- **D-10:** Кнопки: "Принять" / "Настроить"
- **D-11:** Выбор сохраняется в localStorage (`cookie_consent`)
- **D-12:** "Настроить" — категории: необходимые (всегда вкл), аналитика (Яндекс Метрика), маркетинг (CQ)

### Footer
- **D-13:** В footer добавить секцию "Правовая информация" со ссылками на все 5 legal-страниц

### Claude's Discretion
- Дизайн cookie consent баннера (стиль mp-blue, позиция)
- Layout legal-страниц (простой текст с заголовком, или с sidebar навигацией)
- Точный текст чекбоксов (формулировки на усмотрение, но суть: оферта, ПДн, рассылка)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Оферта (свой документ)
- `docs/Оферта платформа академия, финал.docx` — заполненная оферта с URL и 24ч дедлайном

### Тексты с основного сайта (для копирования)
- `https://mpstats.academy/legal/pdn` — Согласие на обработку ПДн (7 пунктов)
- `https://mpstats.academy/legal/adv` — Согласие на рекламную рассылку (4 пункта)
- `https://mpstats.academy/legal/cookies` — Политика cookies (5 разделов)
- `https://mpstats.academy/policy` — Политика конфиденциальности (~24K символов, 10 разделов)

### Форма регистрации (для модификации)
- `apps/web/src/app/(auth)/register/page.tsx` — текущая форма регистрации

### Footer
- `apps/web/src/app/page.tsx` — Landing footer
- `apps/web/src/components/shared/Sidebar.tsx` — Sidebar footer в main layout

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Landing page footer уже имеет секцию ссылок — добавить legal links
- Sidebar footer — "Поддержка" ссылка, можно добавить "Правовая информация"
- Auth layout `(auth)/layout.tsx` — обёртка для login/register

### Established Patterns
- Static pages: `app/page.tsx` формат, без API вызовов
- Tailwind prose class для длинных текстов (`prose prose-sm`)
- mp-gray цвета для secondary content

### Integration Points
- `register/page.tsx` — добавить чекбоксы перед кнопкой submit
- `layout.tsx` (root) — cookie consent баннер (рядом с CQ widget)
- Landing footer — ссылки на legal

</code_context>

<specifics>
## Specific Ideas

### Реквизиты компании (из документов)
- ООО «МПСТАТС ПРОДВИЖЕНИЕ»
- ИНН 7 804 713 205
- ОГРН 1 257 800 005 781
- Адрес: 195 257, Санкт-Петербург, Гражданский пр-кт, д. 100, стр. 1, пом. 5
- Email: clients@mpstats.academy

### Оферта — ключевые моменты
- URL размещения: https://platform.mpstats.academy/legal/offer
- Срок отключения автопродления: 24 часа
- НДС: 22%
- AI disclaimer включён в текст
- Штраф за нарушение IP: 1 000 000 руб

</specifics>

<deferred>
## Deferred Ideas

- Granular cookie preferences (per-service toggle) — для v2
- GDPR compliance (если будут EU пользователи)
- Версионирование legal-документов (diff между версиями)

</deferred>

---

*Phase: 25-legal-cookie-consent*
*Context gathered: 2026-03-25*
