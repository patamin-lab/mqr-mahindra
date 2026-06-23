import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Market Quality Report',
  description: 'ระบบรายงานปัญหาคุณภาพสำหรับรถในระยะรับประกัน',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="bg-gray-100 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
