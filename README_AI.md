# GrowPitch: AI Development README

This file provides a comprehensive overview of the **GrowPitch** project (formerly Coach Field) to assist AI models in understanding, maintaining, and extending the codebase.

## Project Purpose
GrowPitch is a mobile-first PWA designed for youth football (soccer) coaches. It focuses on the high-pressure environment of the field, enabling coaches to manage:
- Training sessions & timers.
- Attendance & team adaptation.
- Player development & qualitative assessments.
- Match management.
- Quick, offline-first notes (including voice notes).

The UI is built for speed: touch-friendly, bottom-sheet heavy, high contrast, and minimal friction.

## Current Architecture (V5A Foundation)
GrowPitch is a hybrid: a robust client-side PWA with a Supabase cloud foundation for multi-tenancy and permissions.

### Technology Stack
- **Framework**: React 19, TypeScript, Vite.
- **Routing**: `react-router-dom` (BrowserRouter).
- **Data Persistence**: 
  - **Local**: IndexedDB (Version 5) for sports data (players, sessions, observations, etc.).
  - **Cloud**: Supabase (Auth, RLS, Organisations, Groups, Memberships, Permissions).
- **Styling**: Tailwind CSS, CSS Custom Properties (Theme System).
- **PWA**: `vite-plugin-pwa` for offline caching.

### Core Architecture Principles
1. **Repository Layer Pattern**: **NEVER access IndexedDB directly**. All data operations must go through the repository layer (e.g., `playersRepository.ts`, `sessionsRepository.ts`).
2. **Offline-First**: IndexedDB is the primary runtime store for local group workflows. Supabase is currently for Auth, Org, and Group management, not yet for sports data sync (V5B feature).
3. **Group Isolation**: Every action in the app (`/app/:groupId/...`) must be scoped to the active `groupId` from `GroupProvider`.
4. **Permissions**: Always wrap sensitive pages or actions with `PermissionGuard` and `hasPermission(...)` from `src/auth/`.
5. **Mobile-First UX**: Design and implementation must prioritize touch targets, bottom sheets, and minimal, clear UI flows.

## Repository Structure
- `src/`:
  - `auth/`: AuthProvider, Guard components, permission definitions.
  - `groups/`: GroupProvider, multi-group context.
  - `db/`: IndexedDB schema, migrations, and repository layer.
  - `cloud/`: Cloud repositories (staff, cloud identity foundation).
  - `pages/`: React components for routes.
  - `components/`: Reusable UI components (bottom sheets, modals, recorder).
  - `utils/`: Calculation logic, adaptations, formatting.
  - `data/`: Seed data (initial roses/sessions).
  - `types/`: Domain models.
- `docs/`: Extensive technical documentation (Architecture, Data Model, Roadmap, etc.).
- `supabase/`: SQL migrations and RLS policies.

## Development Rules for AI
1. **Repository First**: For any data task, identify the correct repository in `src/db/` and implement the change there.
2. **Respect Guards**: Do not bypass `ProtectedRoute`, `GroupAccessGuard`, or `PermissionGuard`.
3. **Maintain Consistency**: Follow existing patterns (e.g., repository signatures, error handling, CSS theme variables).
4. **Offline Resilience**: Ensure changes don't break offline functionality.
5. **Typescript**: Maintain strict typing and adhere to existing domain models.
6. **Testing**: Use `npm run lint`, `npm test`, and `npx playwright test` to verify changes.

## Important Commands
- `npm run dev`: Start local development.
- `npm run build`: Build for production.
- `npm run lint`: Lint the codebase.
- `npm test`: Run unit/integration tests with Vitest.
- `npm run test:e2e`: Run Playwright E2E smoke tests.
