import StatusPill from '@/components/shared/status/StatusPill';
import type { KnowledgeConfidenceLevel } from '../types';

/** Takes an already-translated `label` - see `MaturityPill.tsx`'s doc
 *  comment for why (this component is rendered from both Server and
 *  Client Components, so it must not import the server-only `t()`). */
const CONFIDENCE_COLOR: Record<KnowledgeConfidenceLevel, string> = {
  VeryLow: 'bg-red-100 text-red-700',
  Low: 'bg-orange-100 text-orange-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-blue-100 text-blue-700',
  Verified: 'bg-green-100 text-green-700',
};

export default function ConfidencePill({ confidence, label }: { confidence: KnowledgeConfidenceLevel; label: string }) {
  return <StatusPill colorClassName={CONFIDENCE_COLOR[confidence]}>{label}</StatusPill>;
}
