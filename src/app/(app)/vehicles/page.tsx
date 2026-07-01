import VehicleSearchBox from '@/features/vehicle-360/vehicle-search-box';

export default function VehiclesIndexPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-brand-dark">Vehicle 360</h1>
        <p className="text-sm text-gray-500">ค้นหารถด้วยหมายเลขซีเรียลเพื่อดูข้อมูลรถและประวัติทั้งหมด (Vehicle Life Cycle)</p>
      </div>
      <VehicleSearchBox />
    </div>
  );
}
