'use client';

import Link from 'next/link';
import { Logo, LogoMark } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { useTheme } from '@/components/shared/ThemeProvider';

/* -- Data ------------------------------------------------ */

const skills = [
  { name: 'Аналитика', value: 87, color: '#6366F1' },
  { name: 'Маркетинг', value: 72, color: '#2C4FF8' },
  { name: 'Контент', value: 65, color: '#10B981' },
  { name: 'Операции', value: 91, color: '#F59E0B' },
  { name: 'Финансы', value: 58, color: '#EC4899' },
];

/* -- Radar chart geometry -------------------------------- */
const RD = 200;
const RC = RD / 2;
const RR = 70;
const RA = skills.map((_, i) => (Math.PI * 2 * i) / skills.length - Math.PI / 2);
const rPt = (a: number, r: number): [number, number] => [RC + r * Math.cos(a), RC + r * Math.sin(a)];
const rPoly = (pct: number) => RA.map(a => rPt(a, RR * pct).map(v => v.toFixed(1)).join(',')).join(' ');
const skillsPoly = skills.map((s, i) => rPt(RA[i], RR * s.value / 100).map(v => v.toFixed(1)).join(',')).join(' ');

const bentoFeatures = [
  {
    title: 'AI-диагностика навыков',
    desc: 'Адаптивный тест из 15-20 вопросов. Сложность подстраивается в реальном времени на основе IRT-модели. Результат — объективная карта компетенций по 5 направлениям.',
    accentLight: 'from-indigo-50 to-blue-50/50',
    accentDark: 'from-[#2C4FF8]/20 to-[#818CF8]/10',
    iconColor: 'text-indigo-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    title: 'Персональный трек обучения',
    desc: 'Система анализирует ваши сильные и слабые стороны, формирует индивидуальный маршрут и скрывает контент, который вам не нужен. Экономия до 60% времени.',
    accentLight: 'from-emerald-50 to-teal-50/50',
    accentDark: 'from-[#87F50F]/20 to-[#34D399]/10',
    iconColor: 'text-emerald-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    title: 'AI-ассистент по урокам',
    desc: 'Отвечает строго по материалу курса — без фантазий и галлюцинаций. Задайте вопрос по любому уроку и получите ответ с точными цитатами и таймкодами из видео.',
    accentLight: 'from-pink-50 to-rose-50/50',
    accentDark: 'from-[#FF168A]/20 to-[#F472B6]/10',
    iconColor: 'text-pink-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    title: 'Радар навыков',
    desc: 'Визуальная диаграмма прогресса по пяти осям: аналитика, маркетинг, контент, операции и финансы. Отслеживайте рост после каждого пройденного урока.',
    accentLight: 'from-amber-50 to-yellow-50/50',
    accentDark: 'from-[#FBBF24]/20 to-[#F59E0B]/10',
    iconColor: 'text-amber-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth="1.5">
        <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
        <polygon points="12,6 18,9.5 18,14.5 12,18 6,14.5 6,9.5" />
      </svg>
    ),
  },
  {
    title: '405+ видеоуроков',
    desc: '6 полноценных курсов — от аналитики данных и рекламы до экспресс-старта на Ozon. Более 200 часов образовательного контента в одном месте.',
    accentLight: 'from-blue-50 to-indigo-50/50',
    accentDark: 'from-[#2C4FF8]/15 to-[#87F50F]/10',
    iconColor: 'text-blue-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth="1.5">
        <polygon points="5,3 19,12 5,21" />
      </svg>
    ),
  },
  {
    title: 'Wildberries + Ozon',
    desc: 'Контент заточен под два крупнейших маркетплейса России. Реальные кейсы, актуальные стратегии, практические инструменты.',
    accentLight: 'from-violet-50 to-purple-50/50',
    accentDark: 'from-[#A78BFA]/15 to-[#818CF8]/10',
    iconColor: 'text-violet-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
];

const stats = [
  { value: '405+', label: 'Видеоуроков' },
  { value: '6', label: 'Курсов' },
  { value: '5', label: 'Осей навыков' },
  { value: '200+', label: 'Часов контента' },
];

const timeline = [
  { step: '01', title: 'Пройдите диагностику', desc: '15-20 адаптивных вопросов для точной оценки текущего уровня по 5 направлениям. Сложность подстраивается под вас.' },
  { step: '02', title: 'Получите персональный трек', desc: 'AI построит персональный маршрут обучения, скрыв материал, который вам не нужен.' },
  { step: '03', title: 'Учитесь с AI-поддержкой', desc: '405+ видеоуроков с AI-ассистентом, который отвечает с точными таймкодами и цитатами из видео.' },
];

const ticker = ['Аналитика', 'Маркетинг', 'Контент', 'Операции', 'Финансы', 'Wildberries', 'Ozon', 'SEO', 'Unit-экономика', 'PPC'];

/* -- Component ------------------------------------------- */

export default function HomePage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)] selection:bg-[var(--landing-selection-bg)] overflow-hidden transition-colors duration-300">
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes glow-pulse { 0%, 100% { box-shadow: var(--landing-glow-box-shadow); } 50% { box-shadow: var(--landing-glow-box-shadow-active); } }
        @keyframes gradient-x { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-glow { animation: glow-pulse 3s ease-in-out infinite; }
        .animate-gradient-x { background-size: 200% 200%; animation: gradient-x 6s ease infinite; }
        .animate-ticker { animation: ticker-scroll 30s linear infinite; }
        .animate-fade-up { animation: fade-up 0.6s ease-out both; }
      `}</style>

      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-300px] left-[-200px] w-[700px] h-[700px] bg-[var(--landing-glow-primary)] rounded-full blur-[180px]" />
        <div className="absolute bottom-[-300px] right-[-200px] w-[600px] h-[600px] bg-[var(--landing-glow-secondary)] rounded-full blur-[180px]" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-[var(--landing-nav-bg)] border-b border-[var(--landing-border)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="md" variant={isDark ? 'white' : 'default'} />
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/login" className="text-sm text-[var(--landing-text-muted)] hover:text-[var(--landing-text)] transition-colors">
              Войти
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-[#2C4FF8] hover:bg-[#2338C5] text-white rounded-lg px-5 shadow-lg shadow-[#2C4FF8]/20">
                Начать бесплатно
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left -- Text */}
          <div className="animate-fade-up">
            <Badge className="bg-[var(--landing-badge-bg)] text-[var(--landing-badge-text)] border border-[var(--landing-badge-border)] hover:opacity-80 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-green)] inline-block mr-2 animate-pulse" />
              AI-powered обучение
            </Badge>
            <h1 className="text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight mb-6">
              Учитесь продавать на маркетплейсах{' '}
              <span className={`bg-gradient-to-r from-[#2C4FF8] via-[var(--landing-gradient-text-via)] to-[var(--landing-gradient-text-to)] bg-clip-text text-transparent animate-gradient-x`}>
                осмысленно
              </span>
            </h1>
            <p className="text-lg text-[var(--landing-text-muted)] leading-relaxed mb-10 max-w-lg">
              AI определит ваш текущий уровень и построит персональный трек. Не&nbsp;тратьте время на&nbsp;материал, который вам не&nbsp;нужен.
            </p>
            <div className="flex gap-4">
              <Link href="/register">
                <Button size="lg" className="bg-[#2C4FF8] hover:bg-[#2338C5] text-white px-8 h-12 rounded-xl shadow-xl shadow-[#2C4FF8]/25 hover:shadow-[#2C4FF8]/40 transition-all">
                  Пройти диагностику
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="ghost" className="text-[var(--landing-ghost-text)] hover:text-[var(--landing-ghost-text-hover)] hover:bg-[var(--landing-ghost-hover-bg)] px-8 h-12 rounded-xl">
                  Как это работает
                </Button>
              </Link>
            </div>
          </div>

          {/* Right -- Bento Preview */}
          <div className="animate-fade-up grid grid-cols-3 gap-3" style={{ animationDelay: '0.15s' }}>
            {/* Skill Radar card */}
            <div className="col-span-2 row-span-2 bg-[var(--landing-card-bg)] border border-[var(--landing-card-border)] rounded-2xl p-5 shadow-xl shadow-[var(--landing-card-shadow)] animate-glow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--landing-text-muted)] font-mono uppercase tracking-wider">Skill Radar</span>
                <span className="w-2 h-2 rounded-full bg-[var(--landing-green)] animate-pulse" />
              </div>
              {/* SVG Radar Chart */}
              <div className="flex justify-center">
                <svg viewBox="0 0 200 200" className="w-full max-w-[220px]">
                  {/* Grid pentagons */}
                  {[1, 0.66, 0.33].map(p => (
                    <polygon key={p} points={rPoly(p)} fill="none" stroke="var(--landing-radar-grid)" strokeWidth="0.7" />
                  ))}
                  {/* Axis lines */}
                  {RA.map((a, i) => {
                    const [x2, y2] = rPt(a, RR);
                    return <line key={i} x1={RC} y1={RC} x2={x2} y2={y2} stroke="var(--landing-radar-axis)" strokeWidth="0.5" />;
                  })}
                  {/* Data fill */}
                  <polygon points={skillsPoly} fill="var(--landing-radar-fill)" stroke="var(--landing-radar-stroke)" strokeWidth="2" strokeLinejoin="round" />
                  {/* Data dots */}
                  {skills.map((s, i) => {
                    const [x, y] = rPt(RA[i], RR * s.value / 100);
                    return <circle key={i} cx={x} cy={y} r="4" fill={s.color} stroke="var(--landing-radar-dot-stroke)" strokeWidth={isDark ? '1' : '2'} />;
                  })}
                  {/* Labels */}
                  {skills.map((s, i) => {
                    const [x, y] = rPt(RA[i], RR + 22);
                    return (
                      <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="var(--landing-radar-label)" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="500">
                        {s.name}
                      </text>
                    );
                  })}
                </svg>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-2xl font-bold font-mono">74.6</span>
                <span className="text-xs text-[var(--landing-green)] font-medium">+12.3 за неделю</span>
              </div>
            </div>

            {/* Metric cards */}
            <div className="bg-[var(--landing-card-bg)] border border-[var(--landing-card-border)] rounded-2xl p-4 flex flex-col justify-between shadow-lg shadow-[var(--landing-card-shadow)] animate-float" style={{ animationDelay: '0.5s' }}>
              <span className="text-[10px] text-[var(--landing-text-muted)] font-mono uppercase">Уроков</span>
              <span className="text-3xl font-bold font-mono text-[var(--landing-metric-blue)]">405</span>
            </div>
            <div className="bg-[var(--landing-card-bg)] border border-[var(--landing-card-border)] rounded-2xl p-4 flex flex-col justify-between shadow-lg shadow-[var(--landing-card-shadow)] animate-float" style={{ animationDelay: '1s' }}>
              <span className="text-[10px] text-[var(--landing-text-muted)] font-mono uppercase">Курсов</span>
              <span className="text-3xl font-bold font-mono text-[var(--landing-green)]">6</span>
            </div>

            {/* Progress bar */}
            <div className="col-span-3 bg-[var(--landing-card-bg)] border border-[var(--landing-card-border)] rounded-2xl p-4 shadow-lg shadow-[var(--landing-card-shadow)]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-[var(--landing-text-muted)] font-mono uppercase">Прогресс обучения</span>
                <span className="text-xs font-mono text-[var(--landing-text-muted)]">67%</span>
              </div>
              <div className="w-full h-2 bg-[var(--landing-progress-bg)] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#2C4FF8] to-[var(--landing-green)] w-[67%]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker */}
      <div className="relative z-10 border-y border-[var(--landing-border)] py-4 overflow-hidden">
        <div className="flex animate-ticker whitespace-nowrap">
          {[...ticker, ...ticker].map((item, i) => (
            <span key={i} className="text-sm text-[var(--landing-text-faint)] font-mono uppercase tracking-widest mx-8 flex items-center gap-3">
              <span className="w-1 h-1 rounded-full bg-[var(--landing-ticker-dot)]" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((n, i) => (
            <div key={n.label} className="text-center animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="text-4xl md:text-5xl font-bold font-mono mb-2 bg-gradient-to-b from-[var(--landing-stats-gradient-from)] to-[var(--landing-stats-gradient-to)] bg-clip-text text-transparent">
                {n.value}
              </div>
              <div className="text-sm text-[var(--landing-text-faint)] uppercase tracking-wider">{n.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bento Features */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="animate-fade-up mb-12">
          <Badge className="bg-[var(--landing-section-badge-bg)] text-[var(--landing-section-badge-text)] border border-[var(--landing-section-badge-border)] hover:opacity-80 mb-4">
            Возможности
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Платформа, которая учит{' '}
            <span className="text-[#2C4FF8]">именно вас</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bentoFeatures.map((f, i) => (
            <div
              key={f.title}
              className={`bg-gradient-to-br ${isDark ? f.accentDark : f.accentLight} border border-[var(--landing-card-border)] rounded-2xl p-6 flex flex-col justify-between ${isDark ? 'hover:border-white/15' : 'hover:shadow-lg hover:-translate-y-0.5'} transition-all duration-300 group animate-fade-up min-h-[180px]`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className={`${isDark ? 'text-white/40 group-hover:text-white/70' : `${f.iconColor} opacity-50 group-hover:opacity-100`} transition-all mb-4`}>
                {f.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--landing-text-muted)] leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="animate-fade-up mb-16">
          <Badge className="bg-[var(--landing-section-badge-bg)] text-[var(--landing-section-badge-text)] border border-[var(--landing-section-badge-border)] hover:opacity-80 mb-4">
            Процесс
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Как это работает</h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-12">
          {/* Connector line */}
          <div className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-[var(--landing-timeline-from)] via-[var(--landing-timeline-via)] to-[var(--landing-timeline-to)]" />

          {timeline.map((item, i) => (
            <div key={item.step} className="relative animate-fade-up" style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="w-16 h-16 rounded-2xl bg-[#2C4FF8]/10 border border-[#2C4FF8]/20 flex items-center justify-center mb-6 relative">
                <span className="text-xl font-mono font-bold text-[#2C4FF8]">{item.step}</span>
                <div className="absolute inset-0 rounded-2xl animate-glow" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
              <p className="text-sm text-[var(--landing-text-muted)] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pull Quote */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-center">
        <div className="animate-fade-up">
          <p className="text-2xl md:text-3xl font-bold leading-snug tracking-tight text-[var(--landing-quote-text)] mb-4">
            &laquo;Не тратьте время на то, что вы уже знаете.
            <br />
            Пусть AI определит, что важно именно для вас.&raquo;
          </p>
          <span className="text-sm text-[var(--landing-text-faint)]">Философия MPSTATS Academy</span>
        </div>
      </section>

      {/* CTA -- always dark */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="relative rounded-3xl overflow-hidden border border-gray-900 p-16 text-center bg-[#0A0F25]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#2C4FF8]/15 via-transparent to-[#10B981]/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#2C4FF8]/5 to-[#10B981]/5 animate-gradient-x" />
          <div className="relative z-10">
            <LogoMark size="xl" variant="white" href={undefined} className="mx-auto mb-6 opacity-30" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Готовы узнать свой уровень?</h2>
            <p className="text-white/40 text-lg mb-8 max-w-md mx-auto">
              Бесплатная диагностика за 10 минут. Персональный трек — сразу после.
            </p>
            <Link href="/register">
              <Button size="lg" className="bg-[#2C4FF8] hover:bg-[#2338C5] text-white px-10 h-14 rounded-xl text-lg shadow-[0_0_40px_rgba(44,79,248,0.4)] hover:shadow-[0_0_60px_rgba(44,79,248,0.6)] transition-all">
                Начать бесплатно
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--landing-border)] py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Logo size="sm" variant={isDark ? 'white' : 'default'} />
          <p className="text-xs text-[var(--landing-text-faint)]">&copy; 2026 MPSTATS Academy. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
}
