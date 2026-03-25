import Link from 'next/link';
import { Logo, LogoMark } from '@/components/shared/Logo';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-mp-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-mp-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-mp-gray-600 hover:text-mp-gray-900 transition-colors shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-body-sm">На главную</span>
          </Link>
          <div className="hidden sm:block">
            <Logo size="sm" />
          </div>
          <div className="sm:hidden">
            <LogoMark size="sm" />
          </div>
          <div className="w-24 shrink-0" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-xl border border-mp-gray-200 shadow-sm p-6 sm:p-10">
          <h1 className="text-xl sm:text-2xl font-bold text-mp-gray-900 mb-2">{title}</h1>
          {lastUpdated && (
            <p className="text-sm text-mp-gray-400 mb-6">
              Последнее обновление: {lastUpdated}
            </p>
          )}
          {!lastUpdated && <div className="mb-6" />}

          {/* Legal content with prose-like styling */}
          <div className="legal-prose text-sm text-mp-gray-700 leading-relaxed space-y-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-mp-gray-900 [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-mp-gray-800 [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1.5 [&_a]:text-mp-blue-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-mp-blue-700 [&_table]:w-full [&_table]:border-collapse [&_th]:text-left [&_th]:p-2 [&_th]:border-b [&_th]:border-mp-gray-200 [&_th]:text-mp-gray-900 [&_th]:font-medium [&_td]:p-2 [&_td]:border-b [&_td]:border-mp-gray-100 [&_strong]:font-semibold [&_strong]:text-mp-gray-800">
            {children}
          </div>
        </div>

        {/* Footer navigation */}
        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 justify-center text-xs text-mp-gray-400">
          <Link href="/legal/offer" className="hover:text-mp-gray-600 transition-colors">Оферта</Link>
          <Link href="/legal/pdn" className="hover:text-mp-gray-600 transition-colors">Обработка ПДн</Link>
          <Link href="/legal/adv" className="hover:text-mp-gray-600 transition-colors">Рассылка</Link>
          <Link href="/legal/cookies" className="hover:text-mp-gray-600 transition-colors">Cookies</Link>
          <Link href="/policy" className="hover:text-mp-gray-600 transition-colors">Конфиденциальность</Link>
        </nav>
      </main>
    </div>
  );
}
