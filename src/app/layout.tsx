import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { QueryProvider } from '@/components/providers/QueryProvider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'AurumIQ',
  description: 'AI-Powered Financial Analysis Platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
