# Mobile Export Inventory

Updated: 2026-07-07

## Shared Export System

All migrated local mobile reports use:

- `src/utils/mobile-report-export.ts`
- `src/components/mobile/MobileReportExportButton.tsx`

Supported formats:

- PDF report
- Excel spreadsheet
- CSV data

Each shared report supports report title, association/platform name, purpose, generated time, record count, metrics, filters, and aligned table columns.

Export delivery behavior:

- Share opens the native share sheet.
- Save to device writes Android reports to `Downloads/Nane Reports` and shows a system notification when notification permission is granted.
- Save to device on iOS opens the native Save to Files/share flow, which is the platform-standard way to persist generated local files.

## Migrated Screens

- Association members
- Clients
- Events
- Attendance
- Expenses
- Expense categories
- Revenue
- Revenue categories
- Revenue transactions
- Loans
- Member statements
- Association wallet withdrawals
- Withdrawal approvals
- Wallet disbursements
- Association invoices
- VEFD receipts
- Membership packages
- Association subscriptions
- Share fines
- Share reconciliation
- Scheduled meeting fine results
- Member deductions
- Member subscription history
- Union deduction reports
- Association users
- Governance structure
- Governance compliance
- Governance elections
- Governance documents list export
- CRM campaigns
- Community posts/jobs

## Intentionally Kept As Backend Or Raw Export Workflows

These routes already download backend-generated files or intentionally expose raw export formats. They were not converted to the local report renderer in this pass:

- SMS report export: backend provides Excel/PDF exports.
- Member voice export: backend provides Excel/PDF exports.
- Revenue transaction export route: backend provides Excel workbook export.
- Loan export route: dedicated raw CSV/JSON export route.
- Member certificates, tenders, profile/association documents, dividends, year-end close, fine-management downloads: backend-generated binary files.
- Platform-admin finance/billing exports: backend-generated CSV/report workflow.
- Platform-admin invoices/jobs/audit/messaging/withdrawals/disbursements: remaining platform-admin local CSV exports, recommended next migration batch.

## Design Notes

- Association logos use contained image frames so large uploaded logos fit without spilling.
- Association admin home now uses the cleaner summary-panel style for year-to-date collections instead of a KPI card.
- Empty generation results still export a summary row so files are not blank.
