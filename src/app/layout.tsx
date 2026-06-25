import type { Metadata } from 'next';
import './globals.css';
import LanguageToggle from './language-toggle';

export const metadata: Metadata = {
  title: 'Market Quality Report',
  description: 'ระบบรายงานปัญหาคุณภาพสำหรับรถในระยะรับประกัน',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="bg-gray-100 text-gray-900 antialiased">
        <LanguageToggle />
        {children}
      </body>
    </html>
  );
}
