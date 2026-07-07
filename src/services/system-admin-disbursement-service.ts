import { apiRequest } from '@/api/client';

export type SystemAdminDisbursementStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED'
  | string;

export type SystemAdminDisbursementType = 'MEMBER_PAYOUT' | 'ASSOCIATION_WITHDRAWAL' | string;

export type SystemAdminDisbursementRequest = {
  id: string;
  referenceNumber?: string | null;
  associationId?: string | null;
  associationName?: string | null;
  memberId?: string | null;
  memberName?: string | null;
  membershipNumber?: string | null;
  disbursementType?: SystemAdminDisbursementType | null;
  amount?: number | string | null;
  status?: SystemAdminDisbursementStatus | null;
  requestReason?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  branchName?: string | null;
  swiftCode?: string | null;
  adminNotes?: string | null;
  rejectionReason?: string | null;
  bankTransactionReference?: string | null;
  requestedByName?: string | null;
  processedByName?: string | null;
  requestedAt?: string | null;
  approvedAt?: string | null;
  processedAt?: string | null;
  completedAt?: string | null;
  statusDisplayText?: string | null;
};

export type SystemAdminDisbursementStats = {
  pendingCount?: number | string | null;
  approvedCount?: number | string | null;
  processingCount?: number | string | null;
  completedCount?: number | string | null;
  rejectedCount?: number | string | null;
  recentRequestsCount?: number | string | null;
};

export type SystemAdminDisbursementAction =
  | 'approve'
  | 'reject'
  | 'processing'
  | 'complete'
  | 'fail';

export type SystemAdminDisbursementActionPayload = {
  adminNotes?: string;
  rejectionReason?: string;
  bankTransactionReference?: string;
};

export function getSystemAdminDisbursementStats() {
  return apiRequest<SystemAdminDisbursementStats>('/admin/disbursements/stats');
}

export async function listSystemAdminDisbursements(status?: string) {
  const suffix = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
  const rows = await apiRequest<SystemAdminDisbursementRequest[]>(`/admin/disbursements${suffix}`);
  return Array.isArray(rows) ? rows.map(normalizeDisbursementRequest).filter((row) => Boolean(row.id)) : [];
}

export function processSystemAdminDisbursement(
  requestId: string,
  action: SystemAdminDisbursementAction,
  payload: SystemAdminDisbursementActionPayload,
) {
  return apiRequest<SystemAdminDisbursementRequest>(
    `/admin/disbursements/${encodeURIComponent(requestId)}/${action}`,
    { method: 'POST', body: payload },
  ).then(normalizeDisbursementRequest);
}

function normalizeDisbursementRequest(row: Partial<SystemAdminDisbursementRequest> | null | undefined): SystemAdminDisbursementRequest {
  return {
    id: String(row?.id || ''),
    referenceNumber: row?.referenceNumber || null,
    associationId: row?.associationId || null,
    associationName: row?.associationName || null,
    memberId: row?.memberId || null,
    memberName: row?.memberName || null,
    membershipNumber: row?.membershipNumber || null,
    disbursementType: row?.disbursementType || null,
    amount: row?.amount ?? 0,
    status: row?.status || 'PENDING',
    requestReason: row?.requestReason || null,
    bankName: row?.bankName || null,
    accountNumber: row?.accountNumber || null,
    accountName: row?.accountName || null,
    branchName: row?.branchName || null,
    swiftCode: row?.swiftCode || null,
    adminNotes: row?.adminNotes || null,
    rejectionReason: row?.rejectionReason || null,
    bankTransactionReference: row?.bankTransactionReference || null,
    requestedByName: row?.requestedByName || null,
    processedByName: row?.processedByName || null,
    requestedAt: row?.requestedAt || null,
    approvedAt: row?.approvedAt || null,
    processedAt: row?.processedAt || null,
    completedAt: row?.completedAt || null,
    statusDisplayText: row?.statusDisplayText || row?.status || 'Pending',
  };
}
