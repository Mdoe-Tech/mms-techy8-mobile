import { apiEnvelopeRequest, apiRequest } from '@/api/client';

export type WalletSummary = {
  associationId?: string | null;
  associationName?: string | null;
  currency?: string | null;
  totalCollected?: number | string | null;
  totalWithdrawn?: number | string | null;
  pendingWithdrawals?: number | string | null;
  availableBalance?: number | string | null;
};

export type AssociationWithdrawal = {
  id: string;
  associationId?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  status?: string | null;
  requestNotes?: string | null;
  notes?: string | null;
  requestedByUserId?: string | null;
  requestedByName?: string | null;
  requestedByEmail?: string | null;
  requestedByPhone?: string | null;
  memberId?: string | null;
  bankAccountId?: string | null;
  processedByUserId?: string | null;
  processedByName?: string | null;
  processedAt?: string | null;
  adminNotes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type WalletWithdrawalPage = {
  content: AssociationWithdrawal[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type BankAccount = {
  id: string;
  accountName?: string | null;
  accountNumber?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  isPrimary?: boolean | null;
  primary?: boolean | null;
  associationId?: string | null;
};

export type BankAccountPayload = {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankBranch: string;
  isPrimary: boolean;
};

export function isBankAccountPrimary(account?: BankAccount | null) {
  return Boolean(account?.isPrimary ?? account?.primary);
}

export type AssociationWalletWithdrawalPayload = {
  amount: number;
  currency?: string;
  notes?: string;
  memberId?: string;
  bankAccountId?: string;
};

export type AssociationWalletWithdrawalResult = {
  id: string;
  status?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  createdAt?: string | null;
};

export type MemberWithdrawalStatus =
  | 'PENDING'
  | 'FIRST_APPROVED'
  | 'APPROVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED';

export type MemberWithdrawalRequest = {
  id: string;
  memberId?: string | null;
  memberName?: string | null;
  membershipNumber?: string | null;
  amount?: number | string | null;
  withdrawalMethod?: 'MOBILE_MONEY' | 'BANK_TRANSFER' | string | null;
  destinationNumber?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  status?: MemberWithdrawalStatus | string | null;
  requestNotes?: string | null;
  rejectionReason?: string | null;
  firstApproverId?: string | null;
  firstApproverName?: string | null;
  firstApprovedAt?: string | null;
  firstApproverNotes?: string | null;
  secondApproverId?: string | null;
  secondApproverName?: string | null;
  secondApprovedAt?: string | null;
  secondApproverNotes?: string | null;
  rejectedById?: string | null;
  rejectedByName?: string | null;
  rejectedAt?: string | null;
  processedAt?: string | null;
  processedById?: string | null;
  zenoPayReference?: string | null;
  disbursementStatus?: string | null;
  disbursementError?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type MemberWithdrawalPage = {
  content: MemberWithdrawalRequest[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type WithdrawalStats = {
  totalPending?: number | string | null;
  totalPendingAmount?: number | string | null;
  totalFirstApproved?: number | string | null;
  totalFirstApprovedAmount?: number | string | null;
  totalApproved?: number | string | null;
  totalApprovedAmount?: number | string | null;
  totalProcessing?: number | string | null;
  totalProcessingAmount?: number | string | null;
  totalCompleted?: number | string | null;
  totalCompletedAmount?: number | string | null;
  totalRejected?: number | string | null;
  totalRejectedAmount?: number | string | null;
  totalFailed?: number | string | null;
  totalFailedAmount?: number | string | null;
};

export type DisbursementStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type DisbursementType = 'MEMBER_PAYOUT' | 'ASSOCIATION_WITHDRAWAL';

export type DisbursementRequest = {
  id: string;
  referenceNumber?: string | null;
  associationId?: string | null;
  associationName?: string | null;
  memberId?: string | null;
  memberName?: string | null;
  membershipNumber?: string | null;
  disbursementType?: DisbursementType | string | null;
  amount?: number | string | null;
  status?: DisbursementStatus | string | null;
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
  processingTimeEstimate?: string | null;
};

export type DisbursementPage = {
  content: DisbursementRequest[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type DisbursementWalletStatus = {
  availableBalance?: number | string | null;
  pendingDisbursements?: number | string | null;
};

export type MemberPayoutReference = {
  id: string;
  fullLegalName?: string | null;
  membershipNumber?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankBranch?: string | null;
};

export type DisbursementCreatePayload = {
  disbursementType: DisbursementType;
  memberId?: string | null;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  branchName?: string | null;
  swiftCode?: string | null;
  requestReason?: string | null;
};

export type MemberWalletBalance = {
  balance: number;
  currency: string;
};

export type MemberWalletTransactionType =
  | 'TOP_UP'
  | 'PAYMENT'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | string;

export type MemberWalletTransaction = {
  id: string;
  transactionType?: MemberWalletTransactionType | null;
  amount?: number | string | null;
  balanceBefore?: number | string | null;
  balanceAfter?: number | string | null;
  currency?: string | null;
  description?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  paymentReference?: string | null;
  success?: boolean | null;
  createdAt?: string | null;
  memberName?: string | null;
  membershipNumber?: string | null;
};

export type MemberWalletWithdrawalPayload = {
  amount: number;
  withdrawalMethod: 'MOBILE_MONEY' | 'BANK_TRANSFER';
  destinationNumber?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  requestNotes?: string;
};

type WalletWithdrawalFilters = {
  page?: number;
  size?: number;
  sort?: string;
};

export function getAssociationWalletSummary() {
  return apiRequest<WalletSummary>('/associations/wallet/summary');
}

export async function getAssociationWalletWithdrawals(filters: WalletWithdrawalFilters = {}) {
  const query = buildQuery({
    page: filters.page ?? 0,
    size: filters.size ?? 100,
    sort: filters.sort ?? 'createdAt,desc',
  });
  const response = await apiEnvelopeRequest<unknown>(`/associations/wallet/withdrawals?${query}`);
  return normalizeWalletPage(response.data, filters.size ?? 100);
}

export function getAssociationBankAccounts(associationId: string) {
  return apiRequest<BankAccount[]>(`/bank-accounts/association/${encodeURIComponent(associationId)}`);
}

export function createAssociationBankAccount(associationId: string, payload: BankAccountPayload) {
  return apiRequest<BankAccount>(`/bank-accounts/association/${encodeURIComponent(associationId)}`, {
    method: 'POST',
    body: payload,
  });
}

export function updateAssociationBankAccount(accountId: string, payload: BankAccountPayload) {
  return apiRequest<BankAccount>(`/bank-accounts/${encodeURIComponent(accountId)}`, {
    method: 'PUT',
    body: payload,
  });
}

export function setAssociationBankAccountPrimary(accountId: string) {
  return apiRequest<BankAccount>(`/bank-accounts/${encodeURIComponent(accountId)}/set-primary`, {
    method: 'PATCH',
  });
}

export function deleteAssociationBankAccount(accountId: string) {
  return apiRequest<void>(`/bank-accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  });
}

export function createAssociationWalletWithdrawal(payload: AssociationWalletWithdrawalPayload, idempotencyKey: string) {
  return apiRequest<AssociationWalletWithdrawalResult>('/associations/wallet/withdrawals', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: payload,
  });
}

export async function getPendingWithdrawalApprovals(associationId: string, filters: WalletWithdrawalFilters = {}) {
  const query = buildQuery({
    associationId,
    page: filters.page ?? 0,
    size: filters.size ?? 100,
    sort: filters.sort ?? 'createdAt,asc',
  });
  const response = await apiEnvelopeRequest<MemberWithdrawalRequest[]>(`/withdrawals/pending?${query}`);
  return normalizeMemberWithdrawalPage(response, filters.size ?? 100);
}

export async function getMemberWithdrawalRequests(associationId: string, filters: WalletWithdrawalFilters & { status?: string } = {}) {
  const query = buildQuery({
    associationId,
    status: filters.status,
    page: filters.page ?? 0,
    size: filters.size ?? 100,
    sort: filters.sort ?? 'createdAt,desc',
  });
  const response = await apiEnvelopeRequest<MemberWithdrawalRequest[]>(`/withdrawals?${query}`);
  return normalizeMemberWithdrawalPage(response, filters.size ?? 100);
}

export function getWithdrawalStatistics(associationId: string) {
  return apiRequest<WithdrawalStats>(`/withdrawals/statistics?associationId=${encodeURIComponent(associationId)}`);
}

export function approveWithdrawalRequest(withdrawalId: string, associationId: string, approverId: string, approverNotes?: string) {
  const query = buildQuery({ associationId, approverId });
  return apiRequest<MemberWithdrawalRequest>(`/withdrawals/${encodeURIComponent(withdrawalId)}/approve?${query}`, {
    method: 'POST',
    body: { approverNotes },
  });
}

export function rejectWithdrawalRequest(withdrawalId: string, associationId: string, approverId: string, rejectionReason: string) {
  const query = buildQuery({ associationId, approverId });
  return apiRequest<MemberWithdrawalRequest>(`/withdrawals/${encodeURIComponent(withdrawalId)}/reject?${query}`, {
    method: 'POST',
    body: { rejectionReason },
  });
}

export async function getAssociationDisbursements(
  associationId: string,
  filters: WalletWithdrawalFilters & { status?: string } = {},
) {
  const query = buildQuery({
    status: filters.status,
    page: filters.page ?? 0,
    size: filters.size ?? 100,
    sort: filters.sort ?? 'requestedAt,desc',
  });
  const response = await apiEnvelopeRequest<DisbursementRequest[]>(
    `/associations/${encodeURIComponent(associationId)}/disbursements?${query}`,
  );
  return {
    content: response.data || [],
    totalElements: Number(response.totalElements ?? response.data?.length ?? 0),
    totalPages: Number(response.totalPages ?? 1),
    number: Number(response.page ?? 0),
    size: Number(response.size ?? filters.size ?? 100),
  } satisfies DisbursementPage;
}

export function getAssociationDisbursementWalletStatus(associationId: string) {
  return apiRequest<DisbursementWalletStatus>(`/associations/${encodeURIComponent(associationId)}/disbursements/wallet-status`);
}

export async function getMemberWalletBalance(memberId: string, associationId: string): Promise<MemberWalletBalance> {
  const query = buildQuery({ memberId, associationId });
  const response = await apiEnvelopeRequest<unknown>(`/wallets/balance?${query}`);
  const raw = response as unknown as {
    balance?: number | string | null;
    currency?: string | null;
    data?: { balance?: number | string | null; currency?: string | null } | null;
  };
  return {
    balance: Number(raw.data?.balance ?? raw.balance ?? 0),
    currency: raw.data?.currency || raw.currency || 'TZS',
  };
}

export async function getMemberWalletTransactions(memberId: string, associationId: string): Promise<MemberWalletTransaction[]> {
  const query = buildQuery({ memberId, associationId });
  const response = await apiEnvelopeRequest<MemberWalletTransaction[]>(`/wallets/transactions?${query}`);
  return Array.isArray(response.data) ? response.data : [];
}

export async function getMyMemberWithdrawalRequests(memberId: string, filters: WalletWithdrawalFilters = {}) {
  const query = buildQuery({
    memberId,
    page: filters.page ?? 0,
    size: filters.size ?? 100,
    sort: filters.sort ?? 'createdAt,desc',
  });
  const response = await apiEnvelopeRequest<MemberWithdrawalRequest[]>(`/withdrawals/my-requests?${query}`);
  return normalizeMemberWithdrawalPage(response, filters.size ?? 100);
}

export function createMemberWithdrawalRequest(memberId: string, associationId: string, payload: MemberWalletWithdrawalPayload) {
  const query = buildQuery({ memberId, associationId });
  return apiEnvelopeRequest<MemberWithdrawalRequest>(`/withdrawals/request?${query}`, {
    method: 'POST',
    body: payload,
  });
}

export async function getMemberPayoutReferences(associationId: string, filters: WalletWithdrawalFilters & { query?: string } = {}) {
  const query = buildQuery({
    query: filters.query,
    page: filters.page ?? 0,
    size: filters.size ?? 100,
    sort: filters.sort ?? 'fullLegalName,asc',
  });
  const response = await apiEnvelopeRequest<unknown>(
    `/associations/${encodeURIComponent(associationId)}/disbursements/member-payout-references?${query}`,
  );
  return normalizeMemberPayoutPage(response.data, filters.size ?? 100);
}

export function createDisbursementRequest(associationId: string, payload: DisbursementCreatePayload) {
  return apiRequest<DisbursementRequest>(`/associations/${encodeURIComponent(associationId)}/disbursements`, {
    method: 'POST',
    body: payload,
  });
}

export function cancelDisbursementRequest(associationId: string, requestId: string) {
  return apiRequest<DisbursementRequest>(
    `/associations/${encodeURIComponent(associationId)}/disbursements/${encodeURIComponent(requestId)}/cancel`,
    { method: 'POST' },
  );
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

function normalizeMemberPayoutPage(data: unknown, fallbackSize: number) {
  if (Array.isArray(data)) {
    return {
      content: data as MemberPayoutReference[],
      totalElements: data.length,
      totalPages: 1,
      number: 0,
      size: fallbackSize,
    };
  }
  const page = data as {
    content?: MemberPayoutReference[];
    totalElements?: number | string;
    totalPages?: number | string;
    number?: number | string;
    size?: number | string;
    page?: {
      totalElements?: number | string;
      totalPages?: number | string;
      number?: number | string;
      size?: number | string;
    };
  } | null;
  const content = Array.isArray(page?.content) ? page.content : [];
  const metadata = page?.page;
  return {
    content,
    totalElements: Number(metadata?.totalElements ?? page?.totalElements ?? content.length),
    totalPages: Number(metadata?.totalPages ?? page?.totalPages ?? 1),
    number: Number(metadata?.number ?? page?.number ?? 0),
    size: Number(metadata?.size ?? page?.size ?? fallbackSize),
  };
}

function normalizeMemberWithdrawalPage(response: {
  data?: MemberWithdrawalRequest[] | null;
  totalElements?: number | string;
  totalItems?: number | string;
  totalPages?: number | string;
  currentPage?: number | string;
  page?: number | string;
  size?: number | string;
}, fallbackSize: number): MemberWithdrawalPage {
  const content = Array.isArray(response.data) ? response.data : [];
  return {
    content,
    totalElements: Number(response.totalElements ?? response.totalItems ?? content.length),
    totalPages: Number(response.totalPages ?? 1),
    number: Number(response.currentPage ?? response.page ?? 0),
    size: Number(response.size ?? fallbackSize),
  };
}

function normalizeWalletPage(data: unknown, fallbackSize: number): WalletWithdrawalPage {
  if (Array.isArray(data)) {
    return {
      content: data as AssociationWithdrawal[],
      totalElements: data.length,
      totalPages: 1,
      number: 0,
      size: fallbackSize,
    };
  }

  const page = data as {
    content?: AssociationWithdrawal[];
    totalElements?: number | string;
    totalPages?: number | string;
    number?: number | string;
    size?: number | string;
    page?: {
      totalElements?: number | string;
      totalPages?: number | string;
      number?: number | string;
      size?: number | string;
    };
  } | null;
  const content = Array.isArray(page?.content) ? page.content : [];
  const metadata = page?.page;

  return {
    content,
    totalElements: Number(metadata?.totalElements ?? page?.totalElements ?? content.length),
    totalPages: Number(metadata?.totalPages ?? page?.totalPages ?? 1),
    number: Number(metadata?.number ?? page?.number ?? 0),
    size: Number(metadata?.size ?? page?.size ?? fallbackSize),
  };
}
