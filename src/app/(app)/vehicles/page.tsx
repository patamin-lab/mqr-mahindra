import { redirect } from 'next/navigation';

/** Vehicle 360 consolidation (ADR-030): forwards to the one vehicle-lookup
 *  landing page (`/machines`) instead of rendering a second search box. */
export default function VehiclesIndexRedirectPage() {
  redirect('/machines');
}
