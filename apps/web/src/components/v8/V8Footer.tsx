import Link from 'next/link';
import { Logo } from '@/components/shared/Logo';

const DARK = '#0F172A';
const BLUE = '#2C4FF8';

const TELEGRAM_URL =
  'https://t.me/academy_mpstats?from=platform.mpstats.academy.footer.blog_link';

type FooterLink = { label: string; href: string; external?: boolean };

const COLS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Платформа',
    links: [
      { label: 'Главная', href: '/' },
      { label: 'Каталог', href: '/courses' },
      { label: 'Диагностика', href: '/skill-test' },
      { label: 'Тарифы', href: '/pricing' },
    ],
  },
  {
    title: 'Компания',
    links: [
      { label: 'О нас', href: '/about' },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'Блог', href: TELEGRAM_URL, external: true },
      { label: 'Поддержка', href: '/support' },
    ],
  },
  {
    title: 'Юридическое',
    links: [
      { label: 'Оферта', href: '/legal/offer' },
      { label: 'Политика ПДн', href: '/legal/pdn' },
      { label: 'Cookies', href: '/legal/cookies' },
    ],
  },
];

interface V8FooterProps {
  /** Цвет секции над футером. Нужен для корректного перехода через rounded-t-[40px]. */
  wrapperBg?: 'dark' | 'blue';
}

export function V8Footer({ wrapperBg = 'dark' }: V8FooterProps) {
  const wrapperColor = wrapperBg === 'blue' ? BLUE : DARK;

  return (
    <div style={{ backgroundColor: wrapperColor }}>
      <footer className="bg-[#0a0f1e] rounded-t-[40px] pt-12 sm:pt-16 pb-8 px-4 sm:px-6 md:px-10 lg:px-0">
        <div className="max-w-[1160px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 pb-10 sm:pb-12 border-b border-white/10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Logo size="sm" variant="white" href="/" />
              <p className="mt-3 text-[13px] sm:text-[14px] text-white/40 leading-relaxed">
                Платформа адаптивного обучения для селлеров маркетплейсов
              </p>
            </div>

            {/* Nav columns */}
            {COLS.map((col) => (
              <div key={col.title}>
                <span className="text-[13px] font-medium text-white/40 uppercase tracking-wider">
                  {col.title}
                </span>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[14px] text-white/60 hover:text-white transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-[14px] text-white/60 hover:text-white transition-colors"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-white/30">
            <span>
              &copy; {new Date().getFullYear()} MPSTATS Academy. Все права защищены.
            </span>
            <span>Платформа адаптивного обучения</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
