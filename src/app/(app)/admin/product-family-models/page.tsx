import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listProductFamilyModelMap, listActiveProductFamilies } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import ProductFamilyModelsTable from './product-family-models-table';

export default async function ProductFamilyModelsAdminPage() {
  const session = await getSession();
  if (!session) return null;
  if (!seesAllDealers(session.role)) redirect('/dashboard');

  const [modelMap, productFamilies] = await Promise.all([listProductFamilyModelMap(), listActiveProductFamilies()]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-dark">ผูกรุ่นรถกับกลุ่มผลิตภัณฑ์</h1>
      <p className="text-sm text-gray-500">
        รุ่นรถแทรกเตอร์ทุกรุ่นต้องผูกกับกลุ่มผลิตภัณฑ์หนึ่งกลุ่ม (รุ่นรถใช้เพื่อระบุตัวตนเท่านั้น
        ตรรกะการบำรุงรักษาจะไม่ขึ้นกับรุ่นรถโดยตรงอีกต่อไป)
      </p>
      <ProductFamilyModelsTable initial={modelMap} productFamilies={productFamilies} />
    </div>
  );
}
