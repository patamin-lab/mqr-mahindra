import { MachineService } from '@/features/machine';
import MachineKnowledgePanel from '../MachineKnowledgePanel';

const machineService = new MachineService();

/** Machine Digital Passport v1.4 - Knowledge section, backed by
 *  `MachineService.getMachineKnowledgeSummary()` (Published Knowledge
 *  Cases only - see ADR-018). Same Suspense-per-section shape as
 *  Warranty/PM/Quality above; the Knowledge tile never had one before
 *  (it rendered synchronously with no data). */
export default async function MachineKnowledgeSection({ serial }: { serial: string }) {
  const knownIssues = await machineService.getMachineKnowledgeSummary(serial);
  return <MachineKnowledgePanel knownIssues={knownIssues} />;
}
