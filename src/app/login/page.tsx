'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalLoading, swalError, swalClose } from '@/lib/swal';

export default function LoginPage() {
const router = useRouter();
const [username, setUsername] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(false);

async function onSubmit(e: React.FormEvent) {
e.preventDefault();
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
setLoading(false);
}
}

return (
<div className="min-h-screen flex items-center justify-center bg-gradient-dark px-4">
<form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-card-hover w-full max-w-sm p-8">
<h1 className="text-xl font-bold text-brand-red mb-1">Market Quality Report</h1>
<p className="text-sm text-gray-500 mb-6">เข้าสู่ระบบเพื่อใช้งาน</p>

<label className="block text-sm font-medium mb-1">ชื่อผู้ใช้</label>
<input
className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
value={username}
onChange={(e) => setUsername(e.target.value)}
autoComplete="username"
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
</form>
</div>
);
}
