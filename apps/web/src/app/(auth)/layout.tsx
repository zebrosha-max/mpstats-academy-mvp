import { Logo } from '@/components/shared/Logo';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-mp-gray-50">
      {/* Header */}
      <header className="border-b border-mp-gray-200 bg-white">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Logo size="md" />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-caption text-mp-gray-500 bg-white border-t border-mp-gray-200">
        &copy; 2025 MPSTATS Academy
      </footer>
    </div>
  );
}
