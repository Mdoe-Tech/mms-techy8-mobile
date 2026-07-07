# Nane Mobile

Native iOS and Android app for the Nane association management system.

This app is built with Expo, React Native, Expo Router, TypeScript, and the shared Nane mobile design system. It is intended to become a fully native companion to the Nane web platform, not a WebView wrapper.

## What This App Covers

The mobile app supports the main Nane workspaces:

- Association Admin
- Member Portal
- System Admin

Current foundations include:

- Secure login with multi-association selection.
- Admin/member mode selection where one account can use both views.
- Secure token storage and refresh.
- Role-aware route access.
- Billing entitlement-aware module visibility foundation.
- Shared mobile navigation.
- Shared mobile UI components.
- Light and dark theme support.
- Native launch and splash branding.
- Push notification client foundation.
- Biometric unlock for saved sessions.
- Native report export/download foundation.
- Android release APK build support.

## Tech Stack

- Expo SDK 57
- React Native 0.86
- React 19
- Expo Router
- TypeScript
- Expo Secure Store
- Expo Local Authentication
- Expo Notifications
- Expo File System
- Expo Sharing
- Lucide React Native
- Quicksand font family

## Repository Structure

```text
mms-techy8-mobile/
  app.json
  package.json
  assets/
  docs/
  plugins/
  src/
    app/
    api/
    auth/
    components/mobile/
    config/
    navigation/
    screens/
    services/
    theme/
    types/
    utils/
```

Important folders:

- `src/app`: Expo Router route shell.
- `src/screens`: Native mobile screens.
- `src/components/mobile`: Shared Nane mobile UI components.
- `src/auth`: Session, RBAC, workspace, biometric, and auth state.
- `src/services`: API services by business module.
- `src/navigation`: Route registry and mobile access helpers.
- `plugins`: Native Expo config plugins used by the app.
- `docs`: Mobile design, production, export, navigation, and roadmap notes.

## Prerequisites

Install:

- Node.js
- npm
- Expo CLI via `npx expo`
- Xcode for iOS simulator/builds
- Android Studio for Android emulator/builds
- Java/JDK compatible with the generated Android project

Then install dependencies:

```bash
npm install
```

## Environment

The app reads the API base URL in this order:

1. `EXPO_PUBLIC_NANE_API_BASE_URL`
2. `EXPO_PUBLIC_API_BASE_URL`
3. `expo.extra.naneApiBaseUrl` in `app.json`
4. Fallback from `src/config/env.ts`

Current `app.json` points to:

```text
https://test-app.nane.co.tz/api/v1
```

Example local override:

```bash
EXPO_PUBLIC_NANE_API_BASE_URL=http://127.0.0.1:8585/api/v1 npx expo start
```

Push registration paths are configured through:

```text
EXPO_PUBLIC_NANE_PUSH_DEVICE_REGISTRATION_PATH
EXPO_PUBLIC_NANE_PUSH_DEVICE_UNREGISTRATION_PATH
```

or through `app.json` extra values:

```text
nanePushDeviceRegistrationPath
nanePushDeviceUnregistrationPath
```

## Run Locally

Start Expo:

```bash
npx expo start
```

Run on iOS:

```bash
npm run ios
```

Run on Android:

```bash
npm run android
```

Run web preview:

```bash
npm run web
```

## Native Prebuild

The app uses native modules and config plugins. Regenerate native projects with:

```bash
npx expo prebuild --platform all
```

For Android only:

```bash
npx expo prebuild --platform android
```

For iOS only:

```bash
npx expo prebuild --platform ios
```

The generated `ios/` and `android/` folders are ignored by Git in this repo.

## Build Android APK

After prebuild:

```bash
cd android
./gradlew assembleRelease
```

APK output:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Local convenience copy:

```bash
cp android/app/build/outputs/apk/release/app-release.apk ~/Desktop/Nane.apk
```

## Quality Checks

Run TypeScript:

```bash
npx tsc --noEmit
```

Run lint:

```bash
npm run lint
```

Recommended before release:

```bash
npx tsc --noEmit
npm run lint
npx expo prebuild --platform all
cd android && ./gradlew assembleRelease
```

## Authentication Behavior

The app supports:

- Email/password login.
- Multiple association selection.
- Association admin/member mode selection.
- Secure access and refresh token storage.
- Automatic refresh when allowed.
- Session expiry cleanup.
- Push device cleanup on logout/session expiry.
- Optional biometric unlock for saved sessions.

Biometric unlock does not replace password login. It only unlocks an existing saved session. If the saved session expires or becomes invalid, the user must log in with email and password again.

## Push Notifications

Mobile push foundation includes:

- Expo push token creation.
- Permission checks.
- Device metadata collection.
- Optional backend device registration.
- Foreground notification feedback.
- Notification tap routing.
- Local cleanup on logout and session expiry.

Production push still requires infrastructure:

- Expo/EAS project ID.
- APNs setup for iOS.
- FCM setup for Android.
- Optional Expo access token if push delivery is protected.
- Backend deployment of push device endpoints and notification delivery service.

See:

```text
docs/mobile-production-foundation.md
```

## Native Export And Downloads

The app includes native report export/download foundations for:

- PDF
- CSV
- Excel

Exported files should be saved using native file handling and surfaced through the platform share/download flow.

See:

```text
docs/mobile-export-inventory.md
```

## Design System

All pages should use the shared mobile components in:

```text
src/components/mobile
```

Core components include:

- `MobileScreen`
- `MobilePageHeader`
- `MobileKpiCard`
- `MobileKpiGrid`
- `MobileCard`
- `MobileDataList`
- `MobileSearchToolbar`
- `MobileStatusTabs`
- `MobileStatusBadge`
- `MobileFormSection`
- `MobileTextInput`
- `MobileSelect`
- `MobileAmountInput`
- `MobileConfirmSheet`
- `MobileEmptyState`
- `MobileLoadingState`
- `MobileErrorState`

Do not create route-specific UI patterns when a shared mobile component already exists.

## Route Migration Rule

Every native page should be completed one route or one tightly connected route group at a time.

Definition of done:

- Uses shared mobile components.
- Uses real backend APIs.
- Preserves permissions, RBAC, billing/module access, and existing business rules.
- Has loading, empty, error, and success states.
- Handles small screens and long text/amounts.
- Avoids fake data.
- Is verified with screenshots before marking complete.
- Passes TypeScript and lint.

Full roadmap:

```text
docs/mobile-full-product-roadmap.md
```

## Useful Docs

- `docs/mobile-production-foundation.md`
- `docs/mobile-navigation-foundation.md`
- `docs/mobile-phase-one-design-foundation.md`
- `docs/mobile-export-inventory.md`
- `docs/mobile-full-product-roadmap.md`

## Git Workflow

Main branch:

```text
main
```

Remote:

```text
https://github.com/Mdoe-Tech/mms-techy8-mobile.git
```

Commit normally:

```bash
git status
git add -A
git commit -m "Describe the mobile change"
git push
```

## Production Release Checklist

Before store release:

- Configure EAS project ID.
- Configure iOS bundle signing.
- Configure Android signing.
- Configure APNs.
- Configure FCM.
- Verify production API URL.
- Verify push backend deployment.
- Verify biometric login on real iOS and Android devices.
- Verify exports/downloads on real iOS and Android devices.
- Verify dark mode and light mode.
- Verify RBAC and billing visibility with real tenant accounts.
- Build release artifacts through the approved release pipeline.
