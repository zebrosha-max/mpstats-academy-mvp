import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { TRPCProvider } from '@/lib/trpc/provider';
import { LandingThemeProvider } from '@/components/shared/ThemeProvider';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'MPSTATS Academy',
  description: 'Образовательная платформа для селлеров маркетплейсов',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" data-landing-theme="light" suppressHydrationWarning>
      <head>
        {/* Prevent FOUC: apply saved landing theme before React hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('landing-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-landing-theme',t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className={inter.className}>
        <LandingThemeProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </LandingThemeProvider>
      </body>
    </html>
  );
}
