# Nane Mobile Navigation Foundation

Date: 2026-07-04

## Scope

This document tracks the first native mobile navigation foundation. It is not real page migration yet.

The goal is to make the React Native app ready for 100+ association admin routes, member routes, and system admin routes without overloading bottom navigation.

## Sources Scanned

- Prior inventory: `docs/system-inventory/FRONTEND_INVENTORY.md`
- Association frontend routes: `mms-techy8-frontend/app/(protected)/associations/**/page.tsx`
- Member portal frontend routes: `mms-techy8-frontend/app/(protected)/member/**/page.tsx`
- System admin frontend routes: `mms-techy8-frontend/app/(protected)/admin/**/page.tsx`
- Association sidebar: `mms-techy8-frontend/components/layout/app-sidebar.tsx`
- Member sidebar: `mms-techy8-frontend/components/layout/member-sidebar.tsx`
- Super admin sidebar: `mms-techy8-frontend/components/layout/super-admin-sidebar.tsx`

## Route Counts

- Association admin: 102 protected pages
- Member portal: 32 protected pages
- System admin: 19 protected pages
- Total protected pages inventoried: 153

The older route inventory was useful but not complete. The actual route tree also includes routes such as association notifications, association billing settings, association roles, association offline settings, member voting, member offline support, admin billing, and admin offline support.

The full native migration sequence and completion checklist are tracked in:

- `docs/mobile-full-product-roadmap.md`

## Mobile Navigation Rules

- Bottom tabs stay stable and short: Home, Work, Search, More.
- Home remains the current association preview until real native pages replace it.
- Work is the role-aware command hub for modules and primary routes.
- Search is global route search across route title, module, role, and path.
- More contains the module directory and temporary design-preview links.
- Dynamic detail routes, such as `/associations/members/:memberId`, must not pretend to open before record context exists.
- Every route must have role, module, title, dynamic/static status, primary/secondary status, and searchable keywords.
- Real page migration should replace the route preview placeholder one route at a time.

## Shared Registry

The mobile registry lives in:

`src/navigation/route-registry.ts`

It provides:

- `mobileRouteRegistry`
- `mobileRouteInventoryCounts`
- `getRoutesForRole`
- `getModuleSummariesForRole`
- `getRoutesForModule`
- `searchMobileRoutes`
- `getRouteById`
- `getRouteStatus`
- `getRouteIcon`

## Association Admin Routes

- `/associations/all-dashboard`
- `/associations/attendance`
- `/associations/attendance/record-attendance`
- `/associations/attendance/schedule-fine`
- `/associations/clients`
- `/associations/configurations/notifications`
- `/associations/configurations/reminders`
- `/associations/crm`
- `/associations/dashboard`
- `/associations/dashboard/union`
- `/associations/disbursements`
- `/associations/events/add`
- `/associations/events/manage`
- `/associations/expenses/:id`
- `/associations/expenses/categories`
- `/associations/expenses/edit/:id`
- `/associations/expenses/manage`
- `/associations/expenses/new`
- `/associations/governance/compliance`
- `/associations/governance/documents`
- `/associations/governance/elections`
- `/associations/governance/structure`
- `/associations/group-config/:id`
- `/associations/group-config/create`
- `/associations/group-config/edit/:id`
- `/associations/group-config`
- `/associations/invoices/:id`
- `/associations/invoices`
- `/associations/jobs/add`
- `/associations/jobs/manage`
- `/associations/loans/batch-upload`
- `/associations/loans/export`
- `/associations/loans`
- `/associations/loans/request`
- `/associations/members-voice`
- `/associations/members/:memberId/documents`
- `/associations/members/:memberId/edit`
- `/associations/members/:memberId/invoices`
- `/associations/members/:memberId`
- `/associations/members/import`
- `/associations/members/new`
- `/associations/members`
- `/associations/members/union/deduction-upload`
- `/associations/my-associations`
- `/associations/packages/new`
- `/associations/packages`
- `/associations/pay/generic`
- `/associations/posts/add`
- `/associations/posts/manage`
- `/associations/profile/edit`
- `/associations/profile`
- `/associations/reports/income-statement`
- `/associations/reports/sms`
- `/associations/reports/statistics`
- `/associations/revenue-transactions/:id`
- `/associations/revenue-transactions/batch-create`
- `/associations/revenue-transactions/bulk/import`
- `/associations/revenue-transactions/bulk`
- `/associations/revenue-transactions/calender`
- `/associations/revenue-transactions/create`
- `/associations/revenue-transactions/dividends`
- `/associations/revenue-transactions/export`
- `/associations/revenue-transactions/fine-management`
- `/associations/revenue-transactions/import`
- `/associations/revenue-transactions/magic-link`
- `/associations/revenue-transactions/member-page`
- `/associations/revenue-transactions/over-due`
- `/associations/revenue-transactions`
- `/associations/revenue-transactions/revenue-tracking`
- `/associations/revenue-transactions/share-distribution`
- `/associations/revenue-transactions/share-fines`
- `/associations/revenue-transactions/share-reconciliation`
- `/associations/revenue/:id/edit`
- `/associations/revenue/:id/view`
- `/associations/revenue/categories`
- `/associations/revenue/manage`
- `/associations/revenue/new`
- `/associations/settings/associations/assoc-conf`
- `/associations/settings/associations/config`
- `/associations/settings/bank-accounts`
- `/associations/settings/billing`
- `/associations/settings/business-types`
- `/associations/settings/document-categories`
- `/associations/settings/membership-number`
- `/associations/settings/offline`
- `/associations/settings/profile-picture`
- `/associations/settings/registration-integration`
- `/associations/settings/roles`
- `/associations/settings/sms-sender-config`
- `/associations/settings/union-settings`
- `/associations/statements/:memberId`
- `/associations/statements`
- `/associations/subscriptions`
- `/associations/subscriptions/subscribe-member`
- `/associations/transactions/reconcile`
- `/associations/union/reports`
- `/associations/users/new`
- `/associations/users`
- `/associations/vefd-receipts`
- `/associations/wallet/approve-withdrawals`
- `/associations/wallet`
- `/associations/year-end-close`

## Member Portal Routes

- `/member/:memberId/edit`
- `/member/certificates`
- `/member/dashboard`
- `/member/deductions/calendar`
- `/member/deductions`
- `/member/directory`
- `/member/events`
- `/member/invoices/:id`
- `/member/invoices`
- `/member/job-posts`
- `/member/loans/:loanId`
- `/member/loans`
- `/member/loans/request`
- `/member/news`
- `/member/notifications`
- `/member/offline`
- `/member/packages`
- `/member/packages/subscribe/:packageId`
- `/member/pay/generic`
- `/member/profile`
- `/member/profile/security`
- `/member/registration/complete`
- `/member/registration/status/:memberId`
- `/member/revenue-transactions/:id`
- `/member/revenue-transactions/calender`
- `/member/revenue-transactions`
- `/member/subscription-history`
- `/member/subscription`
- `/member/tenders`
- `/member/upload-document/:memberId/documents`
- `/member/voting`
- `/member/wallet`

## System Admin Routes

- `/admin/associations/new`
- `/admin/associations`
- `/admin/audit`
- `/admin/billing`
- `/admin/clients`
- `/admin/dashboard`
- `/admin/disbursements`
- `/admin/finance`
- `/admin/finance/withdrawals`
- `/admin/impersonate/handoff`
- `/admin/invoices`
- `/admin/jobs`
- `/admin/messaging`
- `/admin/offline`
- `/admin/password-reset`
- `/admin/profile-picture`
- `/admin/reports/overview`
- `/admin/reports`
- `/admin/system`

## Current Mobile Screens Added

- `src/app/work.tsx`
- `src/app/search.tsx`
- `src/app/more.tsx`
- `src/app/module.tsx`
- `src/app/route-preview.tsx`
- `src/screens/WorkHubScreen.tsx`
- `src/screens/RouteSearchScreen.tsx`
- `src/screens/MoreMenuScreen.tsx`
- `src/screens/ModuleRoutesScreen.tsx`
- `src/screens/RoutePreviewScreen.tsx`

## Next Page Migration Rule

When native page migration starts, migrate one page at a time:

1. Pick one source route from `mobileRouteRegistry`.
2. Build the native screen using shared mobile components only.
3. Keep API behavior equivalent to the web route.
4. Verify iOS light and dark screenshots.
5. Replace the route preview placeholder with the real native screen.
6. Mark the route as migrated in this document or a follow-up migration tracker.
