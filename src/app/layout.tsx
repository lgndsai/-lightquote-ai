import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LightQuote AI',
  description: 'Design, visualize and sell permanent exterior lighting in under five minutes.',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'LightQuote' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // The canvas and photo screens break if the page itself can pinch-zoom.
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0B0F19',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
