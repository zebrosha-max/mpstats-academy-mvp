import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@mpstats/db';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check isAdmin flag in UserProfile
  const profile = await prisma.userProfile.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!profile || !profile.isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-mp-gray-50">
      {/* Admin Sidebar — fixed on desktop */}
      <AdminSidebar />

      {/* Main content area */}
      <div className="md:ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 border-b border-mp-gray-200 bg-white/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="h-full px-4 md:px-6 flex items-center justify-between">
            <h1 className="text-heading-sm font-semibold text-mp-gray-900">
              Admin Panel
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-body-sm text-mp-gray-500">
                {user.email}
              </span>
              <div className="w-8 h-8 rounded-full bg-mp-blue-100 flex items-center justify-center">
                <span className="text-xs font-medium text-mp-blue-700">
                  {(user.email?.[0] || 'A').toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
