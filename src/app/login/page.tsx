'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalLoading, swalError, swalClose } from '@/lib/swal';
import LanguageSelector from '@/components/shared/i18n/LanguageSelector';
import { APP_NAME } from '@/lib/branding';

export default function LoginPage() {
const router = useRouter();
const [username, setUsername] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(false);
// A synchronous guard alongside `loading` - `disabled={loading}` alone
// still leaves a few-millisecond window (before React re-renders) where a
// fast double Enter/double click could fire onSubmit twice.
const submittingRef = useRef(false);

async function onSubmit(e: React.FormEvent) {
e.preventDefault();
if (submittingRef.current) return;
submittingRef.current = true;
setLoading(true);
swalLoading('กำลังเข้าสู่ระบบ...');
try {
const json = await fetchJson<{ ok: boolean; error?: string }>('/api/auth/login', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ username, password }),
});
if (!json.ok) {
swalClose();
swalError(json.error || 'เข้าสู่ระบบไม่สำเร็จ');
return;
}
swalClose();
router.push('/dashboard');
router.refresh();
} catch (err: any) {
swalClose();
const msg = err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED'
? 'เซสชันหมดอายุ กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง'
: err?.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่';
swalError(msg);
} finally {
submittingRef.current = false;
setLoading(false);
}
}

return (
<div className="min-h-screen flex items-center justify-center bg-gradient-dark px-4">
<form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-card-hover w-full max-w-sm p-8 relative">
<div className="absolute top-4 right-4">
  <LanguageSelector variant="card" />
</div>
<h1 className="text-xl font-bold text-brand-red mb-1">{APP_NAME}</h1>
<p className="text-sm text-gray-500 mb-6">เข้าสู่ระบบเพื่อใช้งาน</p>

<label className="block text-sm font-medium mb-1">ชื่อผู้ใช้</label>
<input
className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
value={username}
onChange={(e) => setUsername(e.target.value)}
autoComplete="username"
autoFocus
required
/>

<label className="block text-sm font-medium mb-1">รหัสผ่าน</label>
<input
type="password"
className="w-full border border-gray-300 rounded px-3 py-2 mb-6"
value={password}
onChange={(e) => setPassword(e.target.value)}
autoComplete="current-password"
required
/>

<button disabled={loading} className="btn-primary w-full">
{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
</button>

<Link href="/forgot-password" className="block text-center text-sm text-gray-500 hover:underline mt-4">
ลืมรหัสผ่าน?
</Link>
</form>
</div>
);
}
