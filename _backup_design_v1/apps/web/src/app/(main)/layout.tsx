import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/shared/sidebar';
import { MobileNav } from '@/components/shared/mobile-nav';
import { UserNav } from '@/components/shared/user-nav';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="h-16 border-b bg-white sticky top-0 z-40">
        <div className="h-full px-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-blue-600">
            MPSTATS Academy
          </Link>
          <UserNav user={user} />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile navigation */}
      <MobileNav />
    </div>
  );
}
