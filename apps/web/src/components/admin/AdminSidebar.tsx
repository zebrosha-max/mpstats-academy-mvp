'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LogoMark } from '@/components/shared/Logo';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart3,
  ArrowLeft,
} from 'lucide-react';

const navItems = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: Users,
  },
  {
    title: 'Content',
    href: '/admin/content',
    icon: BookOpen,
  },
  {
    title: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-mp-gray-200 bg-white hidden md:flex flex-col fixed top-0 left-0 h-screen z-30">
      {/* Logo + Admin badge */}
      <div className="h-16 flex items-center px-4 border-b border-mp-gray-200 gap-2">
        <LogoMark size="sm" href="/admin" />
        <span className="text-heading-sm text-mp-gray-900 font-semibold">Academy</span>
        <span className="ml-auto text-xs font-medium bg-mp-blue-100 text-mp-blue-700 px-2 py-0.5 rounded-full">
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(item.href + '/'));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-mp-blue-50 text-mp-blue-600 shadow-mp-sm'
                  : 'text-mp-gray-600 hover:bg-mp-gray-100 hover:text-mp-gray-900',
              )}
            >
              <item.icon
                className={cn(
                  'w-5 h-5 transition-colors',
                  isActive ? 'text-mp-blue-500' : 'text-mp-gray-400',
                )}
              />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* Footer — back to app */}
      <div className="p-4 border-t border-mp-gray-200">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-body-sm font-medium text-mp-gray-500 hover:bg-mp-gray-100 hover:text-mp-gray-900 transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to app
        </Link>
      </div>
    </aside>
  );
}
