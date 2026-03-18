import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { TRPCProvider } from '@/lib/trpc/provider';
import { LandingThemeProvider } from '@/components/shared/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: 'MPSTATS Academy — образовательная платформа для селлеров',
    template: '%s | MPSTATS Academy',
  },
  description: 'Образовательная платформа для селлеров маркетплейсов. AI-диагностика навыков, персонализированный трек обучения, 400+ видеоуроков.',
  metadataBase: new URL('https://platform.mpstats.academy'),
  verification: {
    yandex: 'ca2450fe5fe87a68',
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'MPSTATS Academy',
    title: 'MPSTATS Academy — образовательная платформа для селлеров',
    description: 'AI-диагностика навыков, персонализированный трек обучения, 400+ видеоуроков для селлеров маркетплейсов.',
    url: 'https://platform.mpstats.academy',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'MPSTATS Academy',
      },
    ],
  },
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
        {/* Carrot Quest widget */}
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(){function t(t,e){return function(){window.carrotquestasync.push(t,arguments)}}if("undefined"==typeof carrotquest){var e=document.createElement("script");e.type="text/javascript",e.async=!0,e.src="https://cdn.carrotquest.app/api.min.js",document.getElementsByTagName("head")[0].appendChild(e),window.carrotquest={},window.carrotquestasync=[],carrotquest.settings={};for(var n=["connect","track","identify","auth","onReady","addCallback","removeCallback","trackMessageInteraction"],a=0;a<n.length;a++)carrotquest[n[a]]=t(n[a])}}(),carrotquest.connect("57576-5a5343ec7aac68d788dabb2569");`,
          }}
        />
      </head>
      <body className={inter.className}>
        <LandingThemeProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </LandingThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
