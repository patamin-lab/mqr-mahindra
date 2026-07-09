import type { Metadata } from 'next';
import './globals.css';
import GoogleTranslateBridge from '@/components/shared/i18n/GoogleTranslateBridge';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { getServerLocale } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'MSEAL DMS',
  description: 'ระบบรายงานปัญหาคุณภาพสำหรับรถในระยะรับประกัน',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getServerLocale();
  return (
    <html lang={locale}>
      <body className="bg-gray-100 text-gray-900 antialiased">
        <LocaleProvider initialLocale={locale}>
          <GoogleTranslateBridge />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
