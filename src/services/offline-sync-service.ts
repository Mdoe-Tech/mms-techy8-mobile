import { apiRequest } from '@/api/client';

export type OfflineCapabilityStatus = 'auto-replay' | 'review-only' | 'blocked';

export type OfflineCapabilityFeature = {
  feature: string;
  entityType?: string;
  module: string;
  routeArea: string;
  apiTarget?: string;
  status: OfflineCapabilityStatus;
  reason: string;
};

export type OfflineSyncPushResult = {
  operationId: string;
  serverOperationId?: string | null;
  status: 'ACCEPTED' | 'APPLIED' | 'REJECTED' | 'DUPLICATE' | string;
  message?: string | null;
  errorCode?: string | null;
  retryable?: boolean;
};

export type OfflineSyncServerStatus = {
  serverTime: string;
  accepted: number;
  rejected: number;
  total: number;
  retentionDays: number;
  recentOperations: OfflineSyncPushResult[];
};

export type OfflineSyncPullResponse = {
  serverTime: string;
  checkpoint?: string | null;
  changes: Record<string, unknown>[];
};

export type OfflineSyncMaintenanceResponse = {
  serverTime: string;
  cutoff: string;
  retentionDays: number;
  deletedOperations: number;
};

export const offlineAppShellContract = [
  {
    label: 'Native shell',
    value: 'Expo React Native',
    helper: 'The mobile app uses native screens instead of the web service worker shell.',
  },
  {
    label: 'Server status',
    value: '/sync/status',
    helper: 'Association-scoped audit counts and recent sync operation outcomes.',
  },
  {
    label: 'Server replay',
    value: '/sync/push',
    helper: 'Offline domain commands must still pass server validation after reconnect.',
  },
  {
    label: 'Pull checkpoint',
    value: '/sync/pull',
    helper: 'Read-side checkpoint endpoint for future native cache refreshes.',
  },
  {
    label: 'Cleanup scope',
    value: 'Audit only',
    helper: 'Cleanup deletes old sync audit rows only, not members, money, payments, or documents.',
  },
] as const;

export const offlineAutoReplayFeatures: OfflineCapabilityFeature[] = [
  {
    feature: 'Meeting attendance command',
    entityType: 'meeting-attendance',
    module: 'Community',
    routeArea: '/associations/attendance/record-attendance',
    apiTarget: '/sync/push',
    status: 'auto-replay',
    reason: 'Attendance is queued as one server-validated command that creates the meeting and records the batch through the existing attendance service after reconnect.',
  },
  {
    feature: 'VIKOBA contribution command',
    entityType: 'vikoba-contribution',
    module: 'Finance',
    routeArea: '/associations/revenue-transactions/create, /associations/revenue-transactions/bulk',
    apiTarget: '/sync/push',
    status: 'auto-replay',
    reason: 'Only single-entry share, social, and fine contributions plus manual bulk share or social rows replay through a server-validated domain command.',
  },
  {
    feature: 'Governance structure',
    entityType: 'governance-structure',
    module: 'Governance',
    routeArea: '/associations/governance/structure',
    apiTarget: '/associations/{associationId}/governance/structure',
    status: 'auto-replay',
    reason: 'Low-risk JSON structure data with idempotent replay headers.',
  },
  {
    feature: 'Governance compliance task',
    entityType: 'governance-compliance-task',
    module: 'Governance',
    routeArea: '/associations/governance/compliance',
    apiTarget: '/associations/{associationId}/governance/compliance',
    status: 'auto-replay',
    reason: 'Low-risk compliance schedule data with conflict review.',
  },
  {
    feature: 'Governance election poll',
    entityType: 'governance-poll',
    module: 'Governance',
    routeArea: '/associations/governance/elections',
    apiTarget: '/associations/{associationId}/governance/polls',
    status: 'auto-replay',
    reason: 'Poll setup can replay; actual member votes remain online-sensitive.',
  },
  {
    feature: 'Governance document category',
    entityType: 'governance-document-category',
    module: 'Governance',
    routeArea: '/associations/settings/document-categories',
    apiTarget: '/associations/{associationId}/governance/document-categories',
    status: 'auto-replay',
    reason: 'Category metadata only; no document files are replayed silently.',
  },
  {
    feature: 'Community event draft metadata',
    entityType: 'community-event',
    module: 'Community',
    routeArea: '/associations/events',
    apiTarget: '/associations/{associationId}/events',
    status: 'auto-replay',
    reason: 'Draft-only event metadata can replay; publish, notify, registrations, payments, and file uploads remain online-only.',
  },
  {
    feature: 'Community post draft metadata',
    entityType: 'community-post',
    module: 'Community',
    routeArea: '/associations/posts',
    apiTarget: '/associations/{associationId}/posts',
    status: 'auto-replay',
    reason: 'Draft-only job and tender metadata can replay; active publish, notify, and attachments remain review-only.',
  },
  {
    feature: 'Revenue category',
    entityType: 'revenue-category',
    module: 'Associations',
    routeArea: '/associations/revenue/categories',
    apiTarget: '/associations/{associationId}/revenue-categories',
    status: 'auto-replay',
    reason: 'Category metadata only; no financial posting is performed.',
  },
  {
    feature: 'Expense category',
    entityType: 'expense-category',
    module: 'Associations',
    routeArea: '/associations/expenses/categories',
    apiTarget: '/associations/{associationId}/expense-categories',
    status: 'auto-replay',
    reason: 'Category metadata only; no expense record is posted.',
  },
  {
    feature: 'Business type',
    entityType: 'business-type',
    module: 'Associations',
    routeArea: '/associations/settings/business-types',
    apiTarget: '/business-types',
    status: 'auto-replay',
    reason: 'Directory classification metadata with stable replay behavior.',
  },
  {
    feature: 'Reminder configuration',
    entityType: 'reminder-config',
    module: 'Associations',
    routeArea: '/associations/configurations/reminders',
    apiTarget: '/associations/current/reminder-config',
    status: 'auto-replay',
    reason: 'Configuration state can replay with idempotency and later job consumption.',
  },
  {
    feature: 'SMS sender configuration',
    entityType: 'sms-sender-config',
    module: 'Associations',
    routeArea: '/associations/settings/sms-sender-config',
    apiTarget: '/sms-sender-configs/association/{associationId}',
    status: 'auto-replay',
    reason: 'Provider sender configuration metadata; no outbound SMS is sent by replay.',
  },
  {
    feature: 'Union settings',
    entityType: 'union-settings',
    module: 'Associations',
    routeArea: '/associations/settings/union-settings',
    apiTarget: '/associations/{associationId}/config',
    status: 'auto-replay',
    reason: 'Configuration metadata only; deduction posting remains blocked offline.',
  },
];

export const offlineReviewOnlyFeatures: OfflineCapabilityFeature[] = [
  {
    feature: 'Governance document upload',
    module: 'Governance',
    routeArea: '/associations/governance/documents',
    status: 'review-only',
    reason: 'Files cannot be safely persisted and replayed without user reselection.',
  },
  {
    feature: 'Community events and posts that publish, notify, register, collect payment, or include attachments',
    module: 'Community',
    routeArea: '/associations/events, /associations/posts, /member/events, /member/news',
    status: 'review-only',
    reason: 'Only draft metadata can replay automatically; user-visible publishing, notifications, event registration, payment, and attachments require online review.',
  },
  {
    feature: 'CRM campaign compose',
    module: 'CRM',
    routeArea: '/associations/crm',
    status: 'review-only',
    reason: 'Campaigns can trigger real messages, so users must review before sending.',
  },
  {
    feature: 'Member registration and import',
    module: 'Members',
    routeArea: '/associations/members/new, /associations/members/import',
    status: 'review-only',
    reason: 'Identity lifecycle changes need live validation and duplicate checks.',
  },
  {
    feature: 'Bank account changes',
    module: 'Associations',
    routeArea: '/associations/settings/bank-accounts',
    status: 'review-only',
    reason: 'Sensitive values are encrypted locally and replay only after unlock and confirmation.',
  },
];

export const offlineBlockedDomains: OfflineCapabilityFeature[] = [
  {
    feature: 'Financial posting',
    module: 'Finance',
    routeArea: '/associations/revenue-transactions, /member/revenue-transactions, /associations/revenue, /associations/expenses, /associations/statements',
    status: 'blocked',
    reason: 'Ledger state, balances, and audit trails must be live and idempotent by domain.',
  },
  {
    feature: 'Loans',
    module: 'Loans',
    routeArea: '/associations/loans, /member/loans',
    status: 'blocked',
    reason: 'Balances, approval state, and repayment schedules require server conflict rules.',
  },
  {
    feature: 'Payments and wallets',
    module: 'Wallets and payments',
    routeArea: '/associations/pay, /member/pay, /associations/wallet, /member/wallet, /associations/disbursements, /admin/disbursements, /associations/transactions/reconcile',
    status: 'blocked',
    reason: 'External provider state and wallet balances cannot be guessed offline.',
  },
  {
    feature: 'Billing and VFD',
    module: 'Billing',
    routeArea: '/associations/invoices, /member/invoices, /admin/invoices, /associations/vefd-receipts',
    status: 'blocked',
    reason: 'Tax and payment records must not be created from stale local state.',
  },
  {
    feature: 'Subscriptions activation and payments',
    module: 'Subscriptions',
    routeArea: '/associations/subscriptions, /member/subscription, /member/subscription-history, /associations/packages, /member/packages',
    status: 'blocked',
    reason: 'Membership status depends on payment and package state.',
  },
  {
    feature: 'Member deletion and access changes',
    module: 'Members',
    routeArea: '/associations/members, /associations/users, /member/registration/complete',
    status: 'blocked',
    reason: 'Security and audit-sensitive lifecycle actions need live backend enforcement.',
  },
];

export const offlineVerificationCommands = [
  'pnpm check:offline',
  'pnpm typecheck',
  'pnpm build',
  './mvnw -q -Dtest=OfflineSyncServiceImplTest,OfflineSyncControllerSecurityTest,ApiIdempotencyFilterTest,ApiIdempotencyCleanupJobTest test',
];

export function getOfflineSyncStatus() {
  return apiRequest<OfflineSyncServerStatus>('/sync/status');
}

export function pullOfflineSyncChanges(checkpoint?: string | null) {
  const query = checkpoint ? `?checkpoint=${encodeURIComponent(checkpoint)}` : '';
  return apiRequest<OfflineSyncPullResponse>(`/sync/pull${query}`);
}

export function cleanupOfflineServerAudit(olderThanDays: number) {
  const safeDays = Math.max(7, Math.min(365, Math.trunc(olderThanDays) || 30));
  return apiRequest<OfflineSyncMaintenanceResponse>(`/sync/maintenance/cleanup?olderThanDays=${safeDays}`, {
    method: 'POST',
  });
}
