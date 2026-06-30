import { getSession } from '@/lib/auth';

/**
 * PM Record — placeholder route (Sprint 10.1: route structure only).
 *
 * Only checks that a session exists, matching every other (app) page's
 * convention. No RBAC gate beyond that yet - which roles should see PM
 * Records is a permission decision this sprint has no requirements to
 * make. No UI is implemented; this exists so the route resolves and the
 * folder structure matches src/app/(app)/admin/* conventions.
 */
export default async function PmRecordsPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-dark">PM Record</h1>
      <p className="text-sm text-gray-500">Foundation only - not yet implemented.</p>
    </div>
  );
}
