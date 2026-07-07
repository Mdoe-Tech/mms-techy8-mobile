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
- Push notification client foundation
- Global foreground notification feedback
- Notification tap deep-link routing into the mobile route registry
- Safe push-token cleanup on logout/session expiry
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

Optional push notification backend paths:

- `EXPO_PUBLIC_NANE_PUSH_DEVICE_REGISTRATION_PATH`
- `EXPO_PUBLIC_NANE_PUSH_DEVICE_UNREGISTRATION_PATH`
- Expo `extra.nanePushDeviceRegistrationPath`
- Expo `extra.nanePushDeviceUnregistrationPath`

When these paths are not configured, the app still handles device permission, Expo push-token creation, foreground notifications, and notification tap routing. Server-side push delivery remains pending until the backend can store device tokens.

## Backend Contracts Used

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/login/association`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/dashboard/association-admin?associationId=<id>`
- `GET /api/v1/dashboard/member`
- `POST /api/v1/mobile/push/devices`
- `GET /api/v1/mobile/push/devices/current`
- `POST /api/v1/mobile/push/devices/unregister`

Authenticated requests send:

- `Authorization: Bearer <token>`
- `X-Association-Id`
- `X-Association-Mode`

## Push Notification Foundation

Completed locally:

- Added `expo-notifications`.
- Added the Expo notifications config plugin with the Nane notification icon, primary blue tint, and default Android channel `nane-default`.
- Added `src/services/mobile-push-service.ts` for channel setup, permission checks, Expo push-token creation, local token storage, optional backend registration, and cleanup.
- Added `src/components/mobile/MobilePushNotificationProvider.tsx` at the root layout level for global foreground notification toasts and notification-tap routing.
- Added push readiness controls to `src/screens/MobileMemberNotificationsScreen.tsx`.
- Added local push registration cleanup on logout and session expiry.
- Added backend mobile push-device registration, unregister, and current-device endpoints.
- Added tenant and public `mobile_push_devices` tables.
- Added backend Expo push delivery service foundation with delivery logs.
- Added Push as a first-class notification policy channel beside SMS and email.
- Wired the mobile app to `/mobile/push/devices` and `/mobile/push/devices/unregister`.
- Wired finance receipt notifications to mobile push with deep links to member transaction details.
- Wired loan status, payment, completion, overdue, and repayment reminder notifications to mobile push with deep links to member loan details.

Notification payload routing supports:

- `routeId`
- `mobileRouteId`
- `routePath`
- `path`
- `url`
- `href`
- `deepLink`

Supported destinations include internal paths such as `/member/invoices`, `/associations/members/:memberId`, `nane://member/wallet`, and Nane-hosted HTTPS URLs. Routes are matched against the mobile route registry and opened through the native route-preview flow.

Production items still requiring infrastructure:

- Expo/EAS project ID in app config before production builds.
- APNs key for iOS push delivery.
- FCM credentials for Android push delivery.
- Production Expo access token if the project uses Expo access-token protected push delivery.
- Server-side event integrations for lower-priority community/governance/CRM events that are not yet push-enabled.
- Retry/receipt polling worker for Expo ticket receipts.
- User-level opt-out preferences if product wants per-user push category controls separate from association policy.

Backend push environment:

- `NOTIFICATIONS_PUSH_ENABLED`
- `EXPO_PUSH_BASE_URL`
- `EXPO_PUSH_REQUEST_TIMEOUT_SECONDS`
- `EXPO_ACCESS_TOKEN`

Suggested backend payload for registration:

```json
{
  "expoPushToken": "ExponentPushToken[...]",
  "platform": "ios",
  "associationId": "association-id",
  "activeView": "MEMBER",
  "device": {
    "brand": "Apple",
    "manufacturer": "Apple",
    "modelName": "iPhone",
    "osName": "iOS",
    "osVersion": "26.5",
    "appVersion": "1.0.0",
    "buildNumber": "1"
  }
}
```

## Shared Files

- `src/config/env.ts`
- `src/api/client.ts`
- `src/auth/auth-context.tsx`
- `src/auth/jwt.ts`
- `src/auth/session-store.ts`
- `src/auth/RequireAuth.tsx`
- `src/services/auth-service.ts`
- `src/services/dashboard-service.ts`
- `src/services/mobile-push-service.ts`
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
- `src/screens/MobileMemberNotificationsScreen.tsx`

## Migrated Native Routes

- `/associations/members`
- `/associations/members/:memberId`
- `/associations/members/new`
- `/associations/members/:memberId/edit`
- `/associations/members/:memberId/documents`

The members route now opens a real native screen from the route inventory instead of the placeholder. It uses the existing `/members` backend contract and fetches all paginated member pages so mobile search, status tabs, KPI counts, sorting, and visible list counts apply to the complete returned member registry.

The member detail route opens a native record detail screen with contact, membership, financial overview, documents, transactions, and loans.

The add-member route opens a native multipart-backed form for core admin registration. It was verified against the backend create/detail contract and reviewed with iOS simulator screenshots before being marked complete.

The edit-member route reuses the same native form and multipart contract, pre-fills member details from the backend, supports updating optional banking/contact fields, and was verified with update/restore API checks plus iOS simulator screenshots.

The member documents route opens a native document management screen with member context, document KPIs, file picking, backend upload through the member multipart contract, and document metadata listing. Backend document listing was fixed to return metadata without loading LOB content before the route was marked complete.

## Migration Rule Going Forward

Every native page migration should use this foundation:

1. Add route access through `RequireAuth`.
2. Use `apiRequest` through a feature service file.
3. Keep tenant headers automatic through the session store.
4. Use the shared mobile UI components only.
5. Avoid fake data.
6. Verify light and dark iOS screenshots.

The full route-by-route execution plan is tracked in:

- `docs/mobile-full-product-roadmap.md`
