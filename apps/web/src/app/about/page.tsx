'use client';

import { Onest } from 'next/font/google';
import { V8Header } from '@/components/v8/V8Header';
import { V8Footer } from '@/components/v8/V8Footer';
import { Reveal } from '@/components/v8/Reveal';
import { Counter } from '@/components/v8/Counter';

const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

/* ── Brand tokens ──────────────────────────────────────── */
const BLUE = '#2C4FF8';
const BLUE_HOVER = '#1D39C1';
const ORANGE = '#ff6b16';
const DARK = '#0F172A';
const GRAY_BG = '#f4f4f4';
const TEXT = '#121212';

/* ── Data ──────────────────────────────────────────────── */

const STATS = [
  { end: 3000, suffix: '+',      label: 'выпускников прошли наши курсы',   bg: BLUE,    text: 'white' },
  { end: 94,   suffix: '%',      label: 'учеников довольны результатом',    bg: GRAY_BG, text: TEXT },
  { end: 3,    suffix: ' года',  label: 'обучаем селлеров маркетплейсов',  bg: GRAY_BG, text: TEXT },
  { end: 400,  suffix: '+',      label: 'уроков по 5 осям навыков',         bg: DARK,    text: 'white' },
];

/* Credentials removed — storytelling replaces dry facts */

const ECOSYSTEM = [
  { name: 'Сервис', url: 'mpstats.io', desc: 'Платформа аналитики маркетплейсов', highlighted: false, accent: true },
  { name: 'Academy', url: 'mpstats.academy', desc: 'Курсы и обучение для селлеров', highlighted: true, accent: false },
  { name: 'Consulting', url: '', desc: 'Продвижение и управление бизнесом', highlighted: false, accent: false },
  { name: 'Staff', url: '', desc: 'Подбор специалистов в e-commerce', highlighted: false, accent: false },
  { name: 'Data', url: '', desc: 'Enterprise-решения и аналитические отчёты', highlighted: false, accent: false },
];

const EXPERTS = [
  {
    name: 'Мадина Адигамова',
    photo: '/experts/madina-adigamova.webp',
    color: '#2C4FF8',
    role: 'Аналитик WB и Ozon с 2021 г.',
    stats: '300 консультаций, 100 брендов. Результаты учеников — до 3,5 млн \u20BD/мес',
  },
  {
    name: 'Виталий Филь',
    photo: '/experts/vitaliy-fil.webp',
    color: '#ff6b16',
    role: 'Селлер WB с 2021 г.',
    stats: 'Оборот 150 млн \u20BD/мес, 300 консультаций, 1 000 учеников',
  },
  {
    name: 'Анастасия Усачева',
    photo: '/experts/anastasia-usacheva.webp',
    color: '#10B981',
    role: 'Аналитик WB и Ozon с 2021 г.',
    stats: 'Оборот 250 млн \u20BD/мес. Результаты учеников — до 13 млн \u20BD/мес',
  },
  {
    name: 'Денис Яковлев',
    photo: '/experts/denis-yakovlev.webp',
    color: '#8B5CF6',
    role: 'Селлер WB с 2022 г.',
    stats: 'Оборот 70 млн \u20BD/мес, 1 000 учеников',
  },
];

const PLATFORM_FEATURES = [
  'AI-диагностика определяет уровень',
  'Персональный план скрывает изученное',
  'AI-ассистент отвечает на вопросы в каждом уроке',
];

/* ── Icons (inline SVG) ────────────────────────────────── */

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/* ── Page Component ────────────────────────────────────── */

export default function DesignNewV8About() {
  return (
    <div className={onest.className} style={{ color: TEXT }}>

      <V8Header onDarkHero={true} />

      {/* ── 1. Hero ────────────────────────────────────── */}
      <section style={{ backgroundColor: DARK }} className="pt-[120px] sm:pt-[160px] pb-[80px] sm:pb-[120px] px-4 sm:px-6 md:px-10 lg:px-0">
        <div className="max-w-[1160px] mx-auto text-center">
          <h1 className="text-[32px] sm:text-[44px] md:text-[56px] font-bold leading-[1.1] tracking-tight text-white">
            Первая адаптивная{' '}
            <span className="block">образовательная платформа</span>
            <span className="block">для селлеров</span>
          </h1>
          <p className="mt-5 sm:mt-6 text-[16px] sm:text-[18px] md:text-[20px] leading-relaxed max-w-[680px] mx-auto" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Как Учи.ру для школьников или Duolingo для языков — только для селлеров WB и Ozon. AI определяет твой уровень и собирает программу под твои пробелы.
          </p>
        </div>
      </section>

      {/* ── 2. Stats Bento ─────────────────────────────── */}
      <section className="py-[80px] sm:py-[120px] px-4 sm:px-6 md:px-10 lg:px-0 bg-white">
        <div className="max-w-[1160px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STATS.map((stat, i) => (
              <Reveal
                key={stat.label}
                className="rounded-[40px] p-8 sm:p-10 flex flex-col justify-between min-h-[200px] sm:min-h-[240px] transition-transform duration-300 hover:-translate-y-1"
                style={{ backgroundColor: stat.bg, color: stat.text }}
                delay={i * 80}
              >
                <Counter
                  end={stat.end}
                  suffix={stat.suffix}
                  duration={1600}
                  delay={i * 80}
                  className="text-[48px] sm:text-[64px] font-bold leading-none"
                />
                <p className="mt-4 text-[16px] leading-relaxed" style={{ opacity: stat.bg === GRAY_BG ? 0.7 : 0.8 }}>
                  {stat.label}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Why Trust Us — Storytelling ────────────── */}
      <section className="py-[80px] sm:py-[120px] px-4 sm:px-6 md:px-10 lg:px-0" style={{ backgroundColor: GRAY_BG }}>
        <div className="max-w-[1160px] mx-auto">
          <div className="max-w-[760px]">
            <h2 className="text-[24px] sm:text-[32px] md:text-[40px] font-bold tracking-tight leading-tight">
              Почему нам можно доверять
            </h2>
          </div>

          <div className="mt-10 sm:mt-14 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            {/* Left: The Story */}
            <div className="space-y-6 text-[15px] sm:text-[16px] leading-[1.75]" style={{ color: TEXT, opacity: 0.8 }}>
              <p>
                <strong style={{ opacity: 1 }}>Мы начинали не как школа.</strong> Мы создали MPSTATS — сервис аналитики, которым сегодня пользуются десятки тысяч селлеров на Wildberries и Ozon каждый день. Это наш основной продукт, и он работает с 2020 года.
              </p>
              <p>
                Работая с данными, мы видели одну и ту же картину: селлеры покупали аналитику, но не знали, что с ней делать. Смотрели на графики, но не понимали, какие решения принимать. Покупали курсы за 50–65 тысяч рублей — и всё равно приходили к нам с вопросами.
              </p>
              <p>
                Тогда мы решили: если уж мы лучше всех знаем, как работают маркетплейсы изнутри — через данные, через аналитику, через тысячи кейсов наших клиентов — то мы должны этому учить. Не теоретиков нанимать, а дать слово тем, кто реально торгует.
              </p>
              <p>
                <strong style={{ opacity: 1 }}>Так появилась MPSTATS Academy.</strong> Наши эксперты — это действующие селлеры с оборотами от 70 до 250 миллионов рублей в месяц. Они не пересказывают учебники — они делятся тем, что работает у них прямо сейчас.
              </p>
            </div>

            {/* Right: Trust Signals */}
            <div className="space-y-4">
              <div className="rounded-[40px] bg-white p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: BLUE }} />
                  <h3 className="text-[17px] sm:text-[18px] font-bold" style={{ color: TEXT }}>Экспертиза из данных</h3>
                </div>
                <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: TEXT, opacity: 0.6 }}>
                  Мы видим аналитику тысяч магазинов каждый день. Знаем, какие стратегии работают — не в теории, а в реальных цифрах продаж.
                </p>
              </div>

              <div className="rounded-[40px] bg-white p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10B981' }} />
                  <h3 className="text-[17px] sm:text-[18px] font-bold" style={{ color: TEXT }}>Практики, а не теоретики</h3>
                </div>
                <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: TEXT, opacity: 0.6 }}>
                  Все наши эксперты — действующие селлеры и аналитики с совокупным оборотом более 470 млн ₽ в месяц. Они учат тому, что делают сами.
                </p>
              </div>

              <div className="rounded-[40px] bg-white p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ORANGE }} />
                  <h3 className="text-[17px] sm:text-[18px] font-bold" style={{ color: TEXT }}>3 000 выпускников</h3>
                </div>
                <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: TEXT, opacity: 0.6 }}>
                  За 3 года через наши курсы прошли тысячи селлеров. 94% довольны результатом. Результаты учеников — рост продаж до 13 млн ₽ в месяц.
                </p>
              </div>

              <div className="rounded-[40px] bg-white p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8B5CF6' }} />
                  <h3 className="text-[17px] sm:text-[18px] font-bold" style={{ color: TEXT }}>Государственная лицензия</h3>
                </div>
                <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: TEXT, opacity: 0.6 }}>
                  Мы — официальное образовательное учреждение с государственной лицензией. Не инфобизнес, а системное образование.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Ecosystem ───────────────────────────────── */}
      <section className="py-[80px] sm:py-[120px] px-4 sm:px-6 md:px-10 lg:px-0 bg-white">
        <div className="max-w-[1160px] mx-auto">
          <h2 className="text-[24px] sm:text-[32px] md:text-[40px] font-bold tracking-tight text-center mb-10 sm:mb-14">
            Часть экосистемы MPSTATS
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {ECOSYSTEM.map((item, i) => (
              <Reveal
                key={item.name}
                className="rounded-[40px] p-6 flex flex-col justify-between min-h-[180px] transition-transform duration-300 hover:-translate-y-1"
                style={{
                  backgroundColor: item.highlighted ? BLUE : 'white',
                  color: item.highlighted ? 'white' : TEXT,
                  border: item.highlighted ? 'none' : `1px solid rgba(18,18,18,0.1)`,
                }}
                delay={i * 60}
              >
                <div>
                  <h3 className="text-[17px] sm:text-[18px] font-bold">{item.name}</h3>
                  {item.url && (
                    <span
                      className="text-[12px] mt-1 inline-block"
                      style={{ opacity: item.highlighted ? 0.7 : 0.5 }}
                    >
                      {item.url}
                    </span>
                  )}
                </div>
                <p
                  className="mt-4 text-[13px] sm:text-[14px] leading-relaxed"
                  style={{ opacity: item.highlighted ? 0.85 : 0.6 }}
                >
                  {item.desc}
                </p>
                {item.accent && (
                  <div className="mt-3 w-8 h-1 rounded-full" style={{ backgroundColor: BLUE }} />
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Experts ─────────────────────────────────── */}
      <section className="py-[80px] sm:py-[120px] px-4 sm:px-6 md:px-10 lg:px-0" style={{ backgroundColor: GRAY_BG }}>
        <div className="max-w-[1160px] mx-auto">
          <h2 className="text-[24px] sm:text-[32px] md:text-[40px] font-bold tracking-tight text-center mb-10 sm:mb-14">
            Эксперты-практики
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {EXPERTS.map((expert, i) => (
              <Reveal key={expert.name} className="rounded-[40px] bg-white p-8 transition-transform duration-300 hover:-translate-y-1" delay={i * 70}>
                <div className="flex items-center gap-4 mb-5">
                  <div
                    className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border-2"
                    style={{ borderColor: expert.color }}
                  >
                    <img src={expert.photo} alt={expert.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="text-[17px] sm:text-[18px] font-bold" style={{ color: TEXT }}>{expert.name}</h3>
                    <p className="text-[13px] sm:text-[14px]" style={{ color: TEXT, opacity: 0.6 }}>{expert.role}</p>
                  </div>
                </div>
                <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: TEXT, opacity: 0.7 }}>
                  {expert.stats}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Platform Pitch ──────────────────────────── */}
      <section className="py-[80px] sm:py-[120px] px-4 sm:px-6 md:px-10 lg:px-0 bg-white">
        <div className="max-w-[760px] mx-auto text-center">
          <h2 className="text-[24px] sm:text-[32px] md:text-[40px] font-bold tracking-tight leading-tight">
            Платформа адаптивного обучения
          </h2>
          <p className="mt-4 sm:mt-6 text-[16px] sm:text-[18px] leading-relaxed" style={{ color: TEXT, opacity: 0.7 }}>
            Не просто видеокурсы — умная платформа, которая подстраивается под каждого ученика.
          </p>
          <div className="mt-8 sm:mt-10 flex flex-col gap-4 max-w-[480px] mx-auto text-left">
            {PLATFORM_FEATURES.map((feature) => (
              <div key={feature} className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5" style={{ color: BLUE }}><CheckIcon /></span>
                <span className="text-[15px] sm:text-[16px]" style={{ color: TEXT, opacity: 0.8 }}>{feature}</span>
              </div>
            ))}
          </div>
          <a
            href="/"
            className="mt-10 inline-flex items-center justify-center rounded-full h-[52px] sm:h-[62px] px-10 sm:px-12 text-[15px] sm:text-[16px] font-medium text-white transition-colors"
            style={{ backgroundColor: BLUE }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BLUE_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BLUE)}
          >
            Попробовать платформу
          </a>
        </div>
      </section>

      {/* ── 7. Contacts ────────────────────────────────── */}
      <section className="py-[80px] sm:py-[120px] px-4 sm:px-6 md:px-10 lg:px-0" style={{ backgroundColor: DARK }}>
        <div className="max-w-[1160px] mx-auto">
          <h2 className="text-[28px] sm:text-[36px] md:text-[48px] font-bold text-white text-center mb-10 sm:mb-14">
            Связаться с нами
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[900px] mx-auto">
            {/* Phone */}
            <a href="tel:+79699991728" className="flex items-start gap-4 group">
              <span className="flex-shrink-0 mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}><PhoneIcon /></span>
              <div>
                <span className="text-[20px] sm:text-[24px] font-bold text-white group-hover:opacity-80 transition-opacity">
                  +7 (969) 999-17-28
                </span>
              </div>
            </a>

            {/* Email */}
            <a href="mailto:clients@mpstats.academy" className="flex items-start gap-4 group">
              <span className="flex-shrink-0 mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}><MailIcon /></span>
              <div>
                <span className="text-[16px] sm:text-[18px] font-medium text-white group-hover:opacity-80 transition-opacity">
                  clients@mpstats.academy
                </span>
              </div>
            </a>

            {/* Telegram */}
            <a href="https://t.me/academy_mpstats" target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 group">
              <span className="flex-shrink-0 mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}><SendIcon /></span>
              <div>
                <span className="text-[16px] sm:text-[18px] font-medium text-white group-hover:opacity-80 transition-opacity">
                  @academy_mpstats
                </span>
              </div>
            </a>

            {/* Address */}
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}><MapPinIcon /></span>
              <span className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Санкт-Петербург, Гражданский пр., д. 100, стр. 1, пом. 242
              </span>
            </div>

            {/* Schedule */}
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}><ClockIcon /></span>
              <span className="text-[14px] sm:text-[15px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Ежедневно 09:00–20:00
              </span>
            </div>

            {/* Main site link */}
            <a href="https://mpstats.academy" target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 group">
              <span className="flex-shrink-0 mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}><ExternalLinkIcon /></span>
              <span className="text-[14px] sm:text-[15px] font-medium text-white group-hover:opacity-80 transition-opacity">
                mpstats.academy
              </span>
            </a>
          </div>
        </div>
      </section>

      <V8Footer wrapperBg="dark" />
    </div>
  );
}
