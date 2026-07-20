import { apiEnvelopeRequest, apiRequest } from '@/api/client';

export type LoanStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSED'
  | 'COMPLETED'
  | 'DEFAULTED'
  | 'CANCELLED'
  | 'PAID'
  | 'OVERDUE'
  | 'PARTIAL';

export type AssociationLoanSummary = {
  id: string;
  memberId?: string | null;
  memberFullName?: string | null;
  memberMembershipNumber?: string | null;
  requestDate?: string | null;
  requestedAmount?: number | string | null;
  repaymentAmount?: number | string | null;
  repaymentPeriod?: number | string | null;
  remainingBalance?: number | string | null;
  nextPaymentDueDate?: string | null;
  status?: string | null;
  isOverdue?: boolean | null;
  interestCalculationMethod?: string | null;
  monthlyPayment?: number | string | null;
  totalInterest?: number | string | null;
};

export type LoanHistoryRecord = {
  id?: string | null;
  action?: string | null;
  details?: string | null;
  actionDate?: string | null;
  createdAt?: string | null;
};

export type LoanRepaymentSchedule = {
  id?: string | null;
  installmentNumber?: number | string | null;
  dueDate?: string | null;
  amountDue?: number | string | null;
  amountPaid?: number | string | null;
  penaltyAmount?: number | string | null;
  status?: string | null;
};

export type LoanRevenueTransaction = {
  id?: string | null;
  transactionDate?: string | null;
  paymentDetails?: Record<string, number | string | null | undefined> | null;
  paymentStatus?: string | null;
  description?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
};

export type LoanCollateral = {
  type: string;
  value: number;
  identification: string;
};

export type LoanGuarantorRequest = {
  memberId: string;
  guaranteedAmount?: number;
};

export type LoanGuarantor = {
  id?: string | null;
  memberId?: string | null;
  memberFullName?: string | null;
  guaranteedAmount?: number | string | null;
  createdAt?: string | null;
};

export type LoanMemberEligibility = {
  id: string;
  associationId?: string | null;
  fullLegalName?: string | null;
  membershipNumber?: string | null;
  status?: string | null;
  associationType?: string | null;
  qualificationBasis?: 'SAVINGS' | 'SHARES' | string | null;
  qualificationBalance?: number | string | null;
  savingsBalance?: number | string | null;
  shares?: {
    id?: string | null;
    shareCount?: number | string | null;
    totalValue?: number | string | null;
  }[] | null;
};

export type LoanDetail = AssociationLoanSummary & {
  membershipNumber?: string | null;
  memberFullName?: string | null;
  approvalDate?: string | null;
  rejectionDate?: string | null;
  rejectionReason?: string | null;
  disbursementDate?: string | null;
  disbursedAmount?: number | string | null;
  totalPaid?: number | string | null;
  lastPaymentDate?: string | null;
  purpose?: string | null;
  interestRate?: number | string | null;
  interestAmount?: number | string | null;
  insuranceFee?: number | string | null;
  installmentCount?: number | string | null;
  penaltyRate?: number | string | null;
  histories?: LoanHistoryRecord[] | null;
  transactions?: LoanRevenueTransaction[] | null;
  repaymentSchedules?: LoanRepaymentSchedule[] | null;
  calculationDescription?: string | null;
  totalPayment?: number | string | null;
  collaterals?: LoanCollateral[] | null;
  guarantors?: LoanGuarantor[] | null;
};

export type LoanRequestPayload = {
  memberId: string;
  requestedAmount: number;
  purpose: string;
  repaymentPeriod?: number;
  installmentCount?: number;
  requestDate?: string;
  disbursementDate?: string;
  interestRate?: number;
  respectGroupConfigRules?: boolean;
  interestCalculationMethod?: 'SIMPLE' | 'COMPOUND';
  collaterals?: LoanCollateral[];
};

export type LoanImportFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export type LoanImportResult = {
  loans?: LoanDetail[] | null;
  errors?: string[] | null;
  successCount?: number | string | null;
  failureCount?: number | string | null;
  hasErrors?: boolean | null;
};

export type LoanPage = {
  content: AssociationLoanSummary[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type AssociationLoanStatistics = {
  totalLoans?: number | string | null;
  totalDisbursedAmount?: number | string | null;
  totalRepaidAmount?: number | string | null;
  totalRemainingBalance?: number | string | null;
  pendingLoansCount?: number | string | null;
  approvedLoansCount?: number | string | null;
  disbursedLoansCount?: number | string | null;
  overdueLoansCount?: number | string | null;
  completedLoansCount?: number | string | null;
  defaultedLoansCount?: number | string | null;
  rejectedLoansCount?: number | string | null;
  paidLoansCount?: number | string | null;
  cancelledLoansCount?: number | string | null;
  averageInterestRate?: number | string | null;
  totalLoanInterestGenerated?: number | string | null;
  totalLoanInsuranceGenerated?: number | string | null;
};

export function getAssociationLoanSummaries(associationId: string) {
  return apiRequest<AssociationLoanSummary[]>(`/loans/associations/${encodeURIComponent(associationId)}`);
}

export function getAssociationLoanStatistics(associationId: string) {
  return apiRequest<AssociationLoanStatistics>(`/loans/associations/${encodeURIComponent(associationId)}/statistics`);
}

export async function getAssociationLoansPage(filters: {
  associationId: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
  sort?: string;
}) {
  const query = buildLoanQuery({
    associationId: filters.associationId,
    status: filters.status,
    startDate: filters.startDate,
    endDate: filters.endDate,
    page: filters.page ?? 0,
    size: filters.size ?? 100,
    sort: filters.sort ?? 'requestDate,desc',
  });
  const response = await apiEnvelopeRequest<LoanPage | { content?: AssociationLoanSummary[]; totalElements?: number; totalPages?: number; number?: number; size?: number }>(
    `/loans?${query}`,
  );
  const data = response.data || {};
  const content = Array.isArray(data.content) ? data.content : [];

  return {
    content,
    totalElements: Number(data.totalElements || content.length || 0),
    totalPages: Number(data.totalPages || 1),
    number: Number(data.number || filters.page || 0),
    size: Number(data.size || filters.size || 100),
  } satisfies LoanPage;
}

export async function getAllAssociationLoans(
  filters: {
    associationId: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    size?: number;
    sort?: string;
  },
  options: { maxPages?: number } = {},
) {
  const loans: AssociationLoanSummary[] = [];
  const size = filters.size ?? 250;
  let page = 0;
  let totalPages = 1;
  let totalElements = 0;

  while (page < totalPages && page < (options.maxPages ?? 40)) {
    const result = await getAssociationLoansPage({ ...filters, page, size });
    loans.push(...result.content);
    totalPages = result.totalPages || 1;
    totalElements = result.totalElements;
    page += 1;
  }

  return {
    content: loans,
    totalElements,
    totalPages,
    number: 0,
    size,
  } satisfies LoanPage;
}

export function getLoanDetails(loanId: string) {
  return apiRequest<LoanDetail>(`/loans/${encodeURIComponent(loanId)}/details`);
}

export function getLoanHistory(loanId: string) {
  return apiRequest<LoanHistoryRecord[]>(`/loans/${encodeURIComponent(loanId)}/history`);
}

export function getMemberLoanEligibility(memberId: string) {
  return apiRequest<LoanMemberEligibility>(`/loans/members/${encodeURIComponent(memberId)}/eligibility`);
}

export function getMemberLoans(memberId: string) {
  return apiRequest<LoanDetail[]>(`/loans/members/${encodeURIComponent(memberId)}`);
}

export function getMemberLoanDetails(loanId: string) {
  return apiRequest<LoanDetail>(`/loans/member/${encodeURIComponent(loanId)}/details`);
}

export function getMemberLoanHistory(loanId: string) {
  return apiRequest<LoanHistoryRecord[]>(`/loans/member/${encodeURIComponent(loanId)}/history`);
}

export async function requestLoan(payload: LoanRequestPayload) {
  const query = buildLoanQuery({
    memberId: payload.memberId,
    requestedAmount: payload.requestedAmount,
    purpose: payload.purpose,
    repaymentPeriod: payload.repaymentPeriod,
    installmentCount: payload.installmentCount,
    requestDate: payload.requestDate,
    disbursementDate: payload.disbursementDate,
    interestRate: payload.interestRate,
    respectGroupConfigRules: payload.respectGroupConfigRules ?? true,
    interestCalculationMethod: payload.interestCalculationMethod,
  });
  return (
    await apiEnvelopeRequest<LoanDetail>(`/loans?${query}`, {
      method: 'POST',
      body: payload.collaterals?.length ? payload.collaterals : null,
    })
  ).data;
}

export async function addLoanGuarantors(loanId: string, guarantors: LoanGuarantorRequest[]) {
  return (
    await apiEnvelopeRequest<LoanGuarantor[]>(`/loans/${encodeURIComponent(loanId)}/guarantors`, {
      method: 'POST',
      body: guarantors,
    })
  ).data || [];
}

export async function deleteNonDisbursedLoan(loanId: string, reason: string) {
  const query = buildLoanQuery({ reason });
  return (
    await apiEnvelopeRequest<string>(`/loans/${encodeURIComponent(loanId)}?${query}`, {
      method: 'DELETE',
    })
  ).data;
}

export function importLoansFromFile(associationId: string, file: LoanImportFile) {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } as unknown as Blob);
  formData.append('associationId', associationId);

  return apiRequest<LoanImportResult>('/loans/bulk/import', {
    method: 'POST',
    body: formData,
  });
}

export function importLoanRepaymentsFromFile(associationId: string, file: LoanImportFile) {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } as unknown as Blob);
  formData.append('associationId', associationId);

  return apiRequest<LoanImportResult>('/loans/bulk/import-repayments', {
    method: 'POST',
    body: formData,
  });
}

export async function approveLoan(loanId: string) {
  return (await apiEnvelopeRequest<LoanDetail>(`/loans/${encodeURIComponent(loanId)}/approve`, { method: 'POST' })).data;
}

export async function rejectLoan(loanId: string, reason: string) {
  const query = buildLoanQuery({ reason });
  return (await apiEnvelopeRequest<LoanDetail>(`/loans/${encodeURIComponent(loanId)}/reject?${query}`, { method: 'POST' })).data;
}

export async function disburseLoan(loanId: string, disbursementDate?: string) {
  const query = buildLoanQuery({ disbursementDate });
  const suffix = query ? `?${query}` : '';
  return (await apiEnvelopeRequest<LoanDetail>(`/loans/${encodeURIComponent(loanId)}/disburse${suffix}`, { method: 'POST' })).data;
}

export async function checkAndUpdateOverdueLoans() {
  return (await apiEnvelopeRequest<LoanDetail[]>('/loans/overdue/check', { method: 'POST' })).data || [];
}

function buildLoanQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      query.set(key, String(value));
    }
  });
  return query.toString();
}
