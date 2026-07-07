# Nane Mobile Phase One Design Foundation

Created: 2026-07-04

## Purpose

Phase one is not a full product rebuild. It creates the native mobile design foundation for iOS review first.

The app must feel like a native financial operations product for SACCOs, associations, cooperatives, NGOs, and member payments. It should not feel like a generic admin dashboard squeezed into a phone.

## Product Direction

Mobile screens should be organized around real work:

- Money position
- Attention queues
- Fast actions
- Native record lists
- Detail and approval flows
- Compact forms
- Bottom-sheet decisions
- Record detail review screens
- Timeline and document evidence

Avoid desktop patterns:

- No compressed desktop tables on phone.
- No generic KPI wall as the first screen.
- No oversized empty headers.
- No random gray cards.
- No placeholder-style generic app skeletons.

## Design Rules

- White-first surfaces in light mode.
- Deep navy featured financial cards.
- Solid status colors with readable foregrounds.
- Compact KPI cards for secondary metrics.
- One featured KPI when money or member position matters.
- Native lists replace tables.
- Filters, sorting, confirmations, and selects use bottom sheets.
- Touch targets stay at least 44px high.
- Quicksand is loaded globally to match the Nane web system.
- iOS safe areas are respected.
- Android is intentionally not reviewed in this phase.

## Hardened Foundation Rules

These rules are mandatory before real screen migration starts.

### Surfaces

- Light mode app background, cards, forms, lists, inputs, dialogs, and detail panels stay white.
- Use light tinted surfaces only for icon wells, upload dropzones, skeletons, disabled controls, selected rows, and subtle hover/press states.
- Do not create gray page backgrounds or gray cards.
- Use `MobileCard`, `MobileSummaryPanel`, `MobileFormSection`, `MobileDataList`, and `MobileSheet` instead of hand-built containers.

### Typography

- `title` is reserved for page-level or record-detail names.
- `section` is for section headers and card headings.
- `body` is for primary row values and normal copy.
- `small` is the minimum for helper text that explains money, status, due dates, validation, or user action.
- `tiny` is allowed only for compact labels, count badges, status badges, short KPI chips, and uppercase metadata.
- Avoid pairing `tiny` with `muted` for meaningful information.
- Use `secondary` for readable supporting text. Use `muted` only for low-priority visual hints.

### Helpers And Labels

- Form helper text uses `small + secondary`.
- Error text uses `small` with the danger status color.
- Detail-row labels use `tiny + secondary + bold`.
- Detail-row helpers use `small + secondary`.
- Timeline timestamps use `small + secondary + bold`.
- List metadata uses `small + secondary`.

### Color And Contrast

- Text colors come from theme tokens, not local hex values.
- Solid status colors use readable foreground text through `MobileStatusBadge`.
- Icons on solid colored surfaces use `theme.colors.onPrimary`.
- Tinted icon wells must not replace actual status badges.
- Active tabs and selected controls must remain immediately visible in both light and dark mode.

### Actions

- Each screen section should have one obvious primary action.
- Secondary actions use `secondary` buttons or icon buttons.
- Destructive actions use `danger` and must route through confirmation when attached to real data.
- Long-running actions should expose loading or progress states through shared components.

### Details

- Every real detail page should start with `MobileDetailHeader`.
- The most important amount/count/status goes into `MobileSummaryPanel`.
- Record attributes use `MobileInfoRow`, not ad-hoc label/value layouts.
- Record history uses `MobileTimeline`.
- Evidence/documents use `MobileDocumentCard` and `MobileFileUpload`.
- Secondary actions belong in `MobileActionSheet`.

### Mobile QA

- Every new component or page must be reviewed in iOS light mode.
- Any component using `surface`, `secondary`, `muted`, or status colors must also be checked in dark mode.
- Android review remains deferred until the iOS foundation is approved.

## Loading And Skeleton System

Loading must be handled by shared components. Do not add ad-hoc spinners, gray blocks, or page-specific skeleton layouts.

### Components

- `MobileSpinner`: branded Nane spinner for inline, card, modal, and page-loading states.
- `MobileSkeleton`: primitive pulsing block for custom compositions.
- `MobileSkeletonCard`: generic card skeleton for summaries and content cards.
- `MobileSkeletonKpiGrid`: KPI grid skeleton for dashboard and management metrics.
- `MobileSkeletonList`: native record-list skeleton for payments, members, approvals, loans, events, and invoices.
- `MobileDetailSkeleton`: record detail skeleton for member, transaction, loan, approval, event, and invoice screens.
- `MobileFormSkeleton`: form skeleton for data entry, filters, settings, and payment screens.
- `MobilePageLoadingState`: full route/page loading experience. Use `kind="dashboard"`, `kind="list"`, `kind="detail"`, or `kind="form"` depending on the destination page.
- `MobileLoadingState`: compact local loading wrapper for small sections or widgets.

### Rules

- Route-level loading uses `MobilePageLoadingState`.
- Detail pages use `MobileDetailSkeleton` while the main record is loading.
- Long forms use `MobileFormSkeleton` until field metadata and select options are ready.
- List pages use `MobileSkeletonList` plus KPI/filter skeletons where needed.
- Dashboard pages use `MobileSkeletonKpiGrid`, `MobileSkeletonCard`, and `MobileSkeletonList`.
- Inline widgets use `MobileLoadingState compact` or `MobileSpinner`.
- Button-level actions use the existing `loading` prop on `MobileButton`.
- Empty and error are not loading states. Use `MobileEmptyState` and `MobileErrorState` after data resolves.
- Skeletons use theme tokens and must remain visible in light and dark mode.
- Animation should stay subtle. Avoid aggressive shimmer or distracting movement.

## Core Components Implemented

- `MobileScreen`
- `MobilePageHeader`
- `MobileKpiCard`
- `MobileKpiGrid`
- `MobileCard`
- `MobileStatusBadge`
- `MobileButton`
- `MobileIconButton`
- `MobileDataList`
- `MobileSearchToolbar`
- `MobileStatusTabs`
- `MobileFilterSheet`
- `MobileSortSheet`
- `MobileFormSection`
- `MobileTextInput`
- `MobileSelect`
- `MobileDatePicker`
- `MobileAmountInput`
- `MobileConfirmSheet`
- `MobileEmptyState`
- `MobileLoadingState`
- `MobileErrorState`
- `MobileSpinner`
- `MobileSkeleton`
- `MobileSkeletonCard`
- `MobileSkeletonList`
- `MobileSkeletonKpiGrid`
- `MobilePageLoadingState`
- `MobileDetailSkeleton`
- `MobileFormSkeleton`
- `MobileAvatar`
- `MobileDetailHeader`
- `MobileInfoRow`
- `MobileSummaryPanel`
- `MobileProgressBar`
- `MobileTimeline`
- `MobileDocumentCard`
- `MobileFileUpload`
- `MobileActionSheet`
- `MobileToast`
- `MobileChartCard`
- `MobileCheckboxRow`

## Detail Record System

The mobile detail foundation is built for record review instead of desktop-style detail tables.

Implemented preview patterns:

- Member profile detail with net shares, information rows, documents, and share activity.
- Transaction receipt detail with payment summary, payment rows, and timeline.
- Loan detail with outstanding balance, repayment progress, terms, and recent movements.
- Approval detail with decision actions, PIN reminder feedback, and request checks.
- Event detail with registration summary, venue details, pricing, and upload zone.
- Invoice/payment detail with amount due, invoice lines, status, and payment actions.

The detail screen contract is:

- `MobileDetailHeader` identifies the record, status, avatar, and action menu.
- `MobileSummaryPanel` carries the main number or decision value.
- `MobileInfoRow` replaces compact table rows on mobile details.
- `MobileTimeline` shows record lifecycle, verification, and receipt events.
- `MobileDocumentCard` and `MobileFileUpload` handle evidence/document workflows.
- `MobileActionSheet` keeps secondary and destructive actions in one native sheet.
- `MobileToast` provides inline feedback for record-specific warnings and confirmations.

## Preview Routes

- `Association`: association officer home concept.
- `Member`: member portal home concept.
- `Components`: isolated component review surface.
- `Records`: detail and record-review preview surface.

The `Records` preview supports direct QA links using `record`:

- `/records?record=member`
- `/records?record=transaction`
- `/records?record=loan`
- `/records?record=approval`
- `/records?record=event`
- `/records?record=invoice`

The `Components` preview supports direct loading QA links using `section`:

- `/components?section=loading`
- `/components?section=loading-detail`

## Acceptance Bar

A component is not accepted just because it renders. It must be checked against:

- Does it make money, membership, approval, or record state clearer?
- Does it reduce mobile scrolling and cognitive load?
- Does the primary action stand out without making every action blue?
- Does the screen feel native rather than web-wrapped?
- Does the component survive long TZS values and long member names?
- Does dark mode keep enough contrast?
- Does the iOS simulator show correct safe-area spacing?

## Deferred

- Real API integration.
- Auth/session persistence.
- Push notifications.
- Offline queue.
- Android review.
- Store signing assets.
- Full screen-by-screen route migration.
