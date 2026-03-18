import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/shared/sidebar';
import { MobileNav } from '@/components/shared/mobile-nav';
import { UserNav } from '@/components/shared/user-nav';
import { LogoMark } from '@/components/shared/Logo';

export const metadata: Metadata = {
  title: 'Личный кабинет',
  description: 'Ваш персональный кабинет MPSTATS Academy: диагностика навыков, обучение, прогресс.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-mp-gray-50">
      {/* Sidebar - fixed on desktop */}
      <Sidebar />

      {/* Main content area */}
      <div className="md:ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 border-b border-mp-gray-200 bg-white/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="h-full px-4 md:px-6 flex items-center justify-between">
            {/* Mobile logo */}
            <div className="md:hidden">
              <LogoMark size="md" />
            </div>
            {/* Spacer for desktop */}
            <div className="hidden md:block" />
            {/* User nav */}
            <UserNav user={user} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Mobile navigation */}
      <MobileNav />
    </div>
  );
}
