import type { Metadata, Viewport } from 'next';
import { BackgroundStage } from '@/components/BackgroundStage';
import './globals.css';

export const metadata: Metadata = {
  title: 'MVP Culture — Quiz Party',
  description:
    'Le quiz de culture générale multijoueur en salons privés. Sans compte, entre amis, en un clic.',
  openGraph: {
    title: 'MVP Culture — Quiz Party',
    description: 'Quiz multijoueur, dark mode, entre amis. Aucun compte requis.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0612',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <BackgroundStage intensity="full" />
        <div className="app-root">{children}</div>
      </body>
    </html>
  );
}
