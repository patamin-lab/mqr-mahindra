import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Sidebar from './sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar session={session} />
      <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">{children}</main>
    </div>
  );
}
