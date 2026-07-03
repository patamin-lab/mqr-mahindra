import type { Metadata } from 'next';
import './globals.css';
import LanguageToggle from './language-toggle';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { getServerLocale } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Market Quality Report',
  description: 'ระบบรายงานปัญหาคุณภาพสำหรับรถในระยะรับประกัน',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getServerLocale();
  return (
    <html lang={locale}>
      <body className="bg-gray-100 text-gray-900 antialiased">
        <LocaleProvider initialLocale={locale}>
          <LanguageToggle />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
