'use client';

import { useEffect } from 'react';

/**
 * Root Error Boundary (Next.js `global-error.tsx` convention) - the
 * last-resort net when even the root layout itself throws. Must render
 * its own `<html>`/`<body>` and cannot depend on any context provider
 * (`LocaleProvider` included) since this replaces the tree that would
 * normally provide it - hence the plain bilingual copy instead of the
 * `useTranslation()` hook every other error/empty state in this app uses.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Root render error', error);
  }, [error]);

  return (
    <html lang="th">
      <body className="bg-gray-100 text-gray-900 antialiased">
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }} aria-hidden="true">⚠️</div>
            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>เกิดข้อผิดพลาด / Something went wrong</p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
              แอปพลิเคชันเกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง
              <br />
              The application hit an unexpected error. Please try again.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{ borderRadius: '0.375rem', backgroundColor: '#b91c1c', color: 'white', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              ลองใหม่ / Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
