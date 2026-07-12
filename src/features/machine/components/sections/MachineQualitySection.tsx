import { SessionUser } from '@/lib/types';
import { MachineService } from '@/features/machine';
import MachineQualityPanel from '../MachineQualityPanel';

const machineService = new MachineService();

export default async function MachineQualitySection({ serial, session }: { serial: string; session: SessionUser }) {
  const quality = await machineService.getMachineQualitySummary(serial, session);
  return <MachineQualityPanel quality={quality} />;
}
