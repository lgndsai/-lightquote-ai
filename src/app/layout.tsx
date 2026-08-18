import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LumaGlow',
  description: 'Design, visualize and sell permanent exterior lighting in under five minutes.',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'LumaGlow' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // The canvas and photo screens break if the page itself can pinch-zoom.
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#170F26',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
