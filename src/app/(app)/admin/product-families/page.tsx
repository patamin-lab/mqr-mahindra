import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listAllProductFamiliesAdmin } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import ProductFamiliesTable from './product-families-table';

export default async function ProductFamiliesAdminPage() {
  const session = await getSession();
  if (!session) return null;
  if (!seesAllDealers(session.role)) redirect('/dashboard');

  const productFamilies = await listAllProductFamiliesAdmin();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-dark">กลุ่มผลิตภัณฑ์ (Product Family)</h1>
      <p className="text-sm text-gray-500">
        ใช้ทุกดีลเลอร์ร่วมกัน — พฤติกรรมการบำรุงรักษาจะสืบทอดผ่านกลุ่มผลิตภัณฑ์นี้ ไม่ใช่จากรุ่นรถโดยตรง
      </p>
      <ProductFamiliesTable initial={productFamilies} />
    </div>
  );
}
