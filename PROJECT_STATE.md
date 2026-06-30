Current Sprint: Sprint 10
Current Branch: main
Current Module: PM Record
Current Milestone: Sprint 10.1 Complete — Foundation
Current Status: Complete

Architecture: Frozen
Documentation: Frozen
ADR: 7 Approved

Sprint 10.1 Deliverables (Complete):
- src/features/pm-record/ — types, schemas (Zod), repository interface, service skeleton, Supabase repository stub, validation utilities, README
- src/app/api/pm-records/ — GET, POST collection route (501 stubs, auth-gated)
- src/app/api/pm-records/[id]/ — GET, PATCH, DELETE item route (501 stubs, auth-gated)
- src/app/(app)/pm-records/page.tsx — placeholder page (session-gated)
- src/components/shared/admin/ — AdminCrudTable, ActionButtons, EmptyState, LoadingState
- src/components/shared/status/ — StatusBadge
- src/components/shared/forms/ — TextField, SelectField
- src/app/(app)/admin/problem-codes/problem-codes-table.tsx — migrated to shared components

Next Milestone: Sprint 10.2
Next Tasks:
- pm_records database migration (table, RLS, indexes)
- Master Data Integration (dealers, branches, technicians lookup)
- PM Record CRUD implementation
- RBAC permission gates on routes and page
- Dealer isolation in service + repository

Current Blockers:
None

Legacy Naming (tracked, not yet renamed — pending ADR):
- SESSION_COOKIE = 'mqr_session' (lib/auth.ts)
- STORAGE_BUCKET = 'mqr-files' (lib/supabase.ts)
- MqrRecord interface (lib/types.ts)
- Sidebar display name 'Market Quality Report' (sidebar.tsx)
