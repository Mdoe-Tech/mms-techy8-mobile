# Nane Mobile Production Foundation

Date: 2026-07-04

## Scope

This foundation prepares the React Native app for real native page migration. It does not migrate every web page yet.

Completed in this pass:

- Shared mobile environment config
- Shared API client
- Secure session storage
- JWT role decoding
- Access token refresh handling
- Session expiry handling
- Login and multi-association selection
- Route guard for protected mobile screens
- Association dashboard using the real backend dashboard API
- Member dashboard using the real backend dashboard API
- Role-aware route inventory defaults

## Environment

The mobile app reads the API base URL from:

- `EXPO_PUBLIC_NANE_API_BASE_URL`
- `EXPO_PUBLIC_API_BASE_URL`
- Expo `extra.naneApiBaseUrl`

Default:

```text
https://app.nane.co.tz/api/v1
```

## Backend Contracts Used

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/login/association`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/dashboard/association-admin?associationId=<id>`
- `GET /api/v1/dashboard/member`

Authenticated requests send:

- `Authorization: Bearer <token>`
- `X-Association-Id`
- `X-Association-Mode`

## Shared Files

- `src/config/env.ts`
- `src/api/client.ts`
- `src/auth/auth-context.tsx`
- `src/auth/jwt.ts`
- `src/auth/session-store.ts`
- `src/auth/RequireAuth.tsx`
- `src/services/auth-service.ts`
- `src/services/dashboard-service.ts`
- `src/types/api.ts`
- `src/types/auth.ts`

## Screens Added or Updated

- `src/screens/LoginScreen.tsx`
- `src/screens/AccessDeniedScreen.tsx`
- `src/screens/HomeDashboardScreen.tsx`
- `src/screens/AssociationHomeScreen.tsx`
- `src/screens/MemberHomeScreen.tsx`
- `src/screens/WorkHubScreen.tsx`
- `src/screens/RouteSearchScreen.tsx`
- `src/screens/MoreMenuScreen.tsx`
- `src/screens/ModuleRoutesScreen.tsx`
- `src/screens/AssociationMembersScreen.tsx`

## Migrated Native Routes

- `/associations/members`

The members route now opens a real native screen from the route inventory instead of the placeholder. It uses the existing `/members` backend contract and fetches all paginated member pages so mobile search, status tabs, KPI counts, sorting, and visible list counts apply to the complete returned member registry.

## Migration Rule Going Forward

Every native page migration should use this foundation:

1. Add route access through `RequireAuth`.
2. Use `apiRequest` through a feature service file.
3. Keep tenant headers automatic through the session store.
4. Use the shared mobile UI components only.
5. Avoid fake data.
6. Verify light and dark iOS screenshots.
