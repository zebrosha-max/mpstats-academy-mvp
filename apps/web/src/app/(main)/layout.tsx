import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createHmac } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@mpstats/db';
import { Sidebar } from '@/components/shared/sidebar';
import { MobileNav } from '@/components/shared/mobile-nav';
import { UserNav } from '@/components/shared/user-nav';
import { LogoMark } from '@/components/shared/Logo';
import { CarrotQuestIdentify } from '@/components/shared/CarrotQuestIdentify';
import { TourProvider } from '@/components/shared/TourProvider';
import { HelpCircleButton } from '@/components/shared/HelpCircleButton';

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

  // Fetch UserProfile for UserNav (single source of truth per D-04, D-05)
  const profile = await prisma.userProfile.findUnique({
    where: { id: user.id },
    select: { name: true, avatarUrl: true },
  });

  // Generate HMAC hash for Carrot Quest user identification
  const cqUserAuthKey = process.env.CARROTQUEST_USER_AUTH_KEY || '';
  const cqHash = cqUserAuthKey
    ? createHmac('sha256', cqUserAuthKey).update(user.id).digest('hex')
    : '';

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
            {/* Help + User nav */}
            <div className="flex items-center gap-2">
              <HelpCircleButton />
              <UserNav user={{
                email: user.email,
                name: profile?.name || user.user_metadata?.full_name || user.user_metadata?.name || null,
                avatarUrl: profile?.avatarUrl || null,
              }} />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-x-hidden">
          <TourProvider>
            {children}
          </TourProvider>
        </main>
      </div>

      {/* Mobile navigation */}
      <MobileNav />

      {/* Carrot Quest user identification */}
      {cqHash && (
        <CarrotQuestIdentify
          userId={user.id}
          hash={cqHash}
          email={user.email}
          name={user.user_metadata?.full_name || user.user_metadata?.name}
        />
      )}
    </div>
  );
}
