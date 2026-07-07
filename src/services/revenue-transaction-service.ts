import { apiBinaryRequest, apiEnvelopeRequest, apiRequest } from '@/api/client';

export type RevenuePaymentStatus = 'PAID' | 'UNPAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED' | 'PARTIALLY_PAID' | 'FAILED';

export type RevenueTransaction = {
  id: string;
  memberId?: string | null;
  memberEmail?: string | null;
  memberName?: string | null;
  membershipNumber?: string | null;
  memberFullName?: string | null;
  loanId?: string | null;
  associationId?: string | null;
  transactionDate?: string | null;
  paymentDetails?: Record<string, number | string | null | undefined> | null;
  fineCategory?: string | null;
  description?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  paymentStatus?: RevenuePaymentStatus | string | null;
  dueDate?: string | null;
  metadata?: Record<string, string | null | undefined> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version?: number | null;
  shareCount?: number | null;
  totalShareValue?: number | string | null;
};

export type RevenueTransactionPage = {
  content: RevenueTransaction[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type RevenueTransactionFilters = {
  associationId: string;
  paymentType?: string;
  fineCategory?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  size?: number;
  sort?: string;
};

export type RevenueTransactionExportFilters = {
  associationId: string;
  paymentType?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
};

export type RevenueTransactionCreatePayload = {
  memberId: string;
  paymentDetails: Record<string, number>;
  paymentStatus?: RevenuePaymentStatus | string;
  description?: string;
  transactionDate?: string;
  dueDate?: string;
  referenceId?: string;
  fineCategory?: string;
  loanId?: string;
};

export type ShareMonthlyDistributionPayload = {
  memberId: string;
  year: number;
  month: number;
  totalShareCount?: number;
  totalAmount?: number;
  selectedWeeks?: number[];
  includeSocial?: boolean;
  socialAmountPerWeek?: number;
};

export type ShareFineScopeParams = {
  checkDate?: string;
  checkMode?: 'exact' | 'period' | 'range';
  startDate?: string;
  endDate?: string;
};

export type ShareReconciliationResult = Record<string, string>;

export type DividendDistributionResult = {
  totalDistributed?: number | string | null;
  dividendTransactions?: RevenueTransaction[] | null;
  overdueTransactions?: RevenueTransaction[] | null;
  dividendExcelReportPath?: string | null;
  dividendPdfReportPath?: string | null;
  overdueExcelReportPath?: string | null;
  overduePdfReportPath?: string | null;
};

export type MarkFinesDueResult = {
  overdueTransactions?: RevenueTransaction[] | null;
  excelReportPath?: string | null;
  pdfReportPath?: string | null;
  totalOverdueAmount?: number | string | null;
};

export type FinancialYearCloseResult = {
  previousFinancialYearEndDate?: string | null;
  newFinancialYearEndDate?: string | null;
  rolledFinancialYear?: {
    newStart?: string | null;
    newEnd?: string | null;
  } | null;
  closedFinancialYear?: {
    start?: string | null;
    end?: string | null;
    closedAt?: string | null;
  } | null;
  reportPaths?: Record<string, string | null | undefined> | null;
  dividendResult?: DividendDistributionResult | null;
  overdueResult?: MarkFinesDueResult | null;
};

export type RevenueTransactionBulkUpdatePayload = {
  transactionId: string;
  paymentDetails?: Record<string, number>;
  paymentStatus?: RevenuePaymentStatus | string;
  description?: string;
  transactionDate?: string;
  referenceId?: string;
  referenceType?: string;
};

export type RevenueImportFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

export type RevenueTransactionStatistics = {
  totalRevenue?: number | string | null;
  pendingAmount?: number | string | null;
  overdueFines?: number | string | null;
  overduePenalties?: number | string | null;
};

export type RevenueTransactionAnalytics = {
  statusCounts?: Record<string, number | string | null | undefined> | null;
  typeTotals?: Record<string, number | string | null | undefined> | null;
  dailyTotals?: Record<string, number | string | null | undefined> | null;
};

export type RevenueOverdueResponse = {
  totals?: {
    totalOverduePayments?: number | string | null;
    totalOverdueFines?: number | string | null;
    totalOverduePenalties?: number | string | null;
  } | null;
  details?: {
    overduePayments?: RevenueTransaction[] | null;
    overdueFines?: RevenueTransaction[] | null;
    overduePenalties?: RevenueTransaction[] | null;
  } | null;
  associationId?: string | null;
  timestamp?: string | null;
  count?: number | string | null;
};

export type RevenueCalendarTransaction = {
  date?: string | null;
  dayOfWeek?: string | null;
  description?: string | null;
  dueDate?: string | null;
  paymentStatus?: string | null;
  paymentDetails?: Record<string, number | string | null | undefined> | null;
  metadata?: Record<string, string | null | undefined> | null;
};

export type RevenueCalendarWeek = {
  totalSocialContribution?: number | string | null;
  totalSharePurchase?: number | string | null;
  totalDisbursement?: number | string | null;
  totalLoanRepayment?: number | string | null;
  totalFine?: number | string | null;
  totalPenalty?: number | string | null;
  transactions?: RevenueCalendarTransaction[] | null;
};

export type RevenueContributionCalendar = {
  memberId?: string | null;
  memberName?: string | null;
  year?: number | string | null;
  calendarData?: Record<string, Record<string, RevenueCalendarWeek> | null | undefined> | null;
  totalShares?: number | string | null;
  totalShareValue?: number | string | null;
  socialFrequency?: string | null;
  shareFrequency?: string | null;
  socialAmount?: number | string | null;
  shareAmount?: number | string | null;
};

export async function getAssociationRevenueTransactionsPage(filters: RevenueTransactionFilters) {
  const query = buildRevenueQuery({
    ...filters,
    page: filters.page ?? 0,
    size: filters.size ?? 50,
    sort: filters.sort ?? 'transactionDate,desc',
  });
  const response = await apiEnvelopeRequest<RevenueTransaction[]>(`/revenue-transactions?${query}`);

  return {
    content: response.data || [],
    totalElements: Number(response.totalElements || response.data?.length || 0),
    totalPages: Number(response.totalPages || 1),
    number: Number(response.page || 0),
    size: Number(response.size || filters.size || 50),
  } satisfies RevenueTransactionPage;
}

export async function getAllAssociationRevenueTransactions(
  filters: Omit<RevenueTransactionFilters, 'page'>,
  options: { maxPages?: number } = {},
) {
  const size = filters.size ?? 250;
  const transactions: RevenueTransaction[] = [];
  let page = 0;
  let totalPages = 1;
  let totalElements = 0;

  while (page < totalPages && page < (options.maxPages ?? 40)) {
    const response = await getAssociationRevenueTransactionsPage({
      ...filters,
      page,
      size,
    });

    transactions.push(...response.content);
    totalPages = Math.max(1, response.totalPages);
    totalElements = response.totalElements || transactions.length;
    page += 1;
  }

  return {
    content: transactions,
    totalElements: totalElements || transactions.length,
    totalPages,
    pagesFetched: page,
  };
}

export function getAssociationRevenueStatistics(associationId: string) {
  return apiRequest<RevenueTransactionStatistics>(`/revenue-transactions/associations/${encodeURIComponent(associationId)}/statistics`);
}

export function getAssociationRevenueAnalytics(associationId: string, startDate?: string, endDate?: string) {
  const query = buildRevenueQuery({ startDate, endDate });
  const suffix = query ? `?${query}` : '';
  return apiRequest<RevenueTransactionAnalytics>(`/revenue-transactions/associations/${encodeURIComponent(associationId)}/analytics${suffix}`);
}

export function getAssociationOverdueTransactions(associationId: string, includeDetails = true) {
  const query = buildRevenueQuery({ associationId, includeDetails: String(includeDetails) });
  return apiRequest<RevenueOverdueResponse>(`/revenue-transactions/overdue?${query}`);
}

export function getMemberContributionCalendar(memberId: string, year: number) {
  return apiRequest<RevenueContributionCalendar>(`/revenue-transactions/members/${encodeURIComponent(memberId)}/contributions/${encodeURIComponent(String(year))}`);
}

export function getMemberTransactionHistory(
  memberId: string,
  filters: { startDate?: string; endDate?: string; paymentType?: string; paymentStatus?: string } = {},
) {
  const query = buildRevenueQuery(filters);
  const suffix = query ? `?${query}` : '';
  return apiRequest<RevenueTransaction[]>(`/revenue-transactions/members/${encodeURIComponent(memberId)}/history${suffix}`);
}

export function getRevenueTransaction(transactionId: string) {
  return apiRequest<RevenueTransaction>(`/revenue-transactions/${encodeURIComponent(transactionId)}`);
}

export function getMemberRevenueTransaction(transactionId: string) {
  return apiRequest<RevenueTransaction>(`/revenue-transactions/member/${encodeURIComponent(transactionId)}`);
}

export function exportRevenueTransactions(filters: RevenueTransactionExportFilters) {
  const query = buildRevenueQuery(filters);
  return apiBinaryRequest(`/revenue-transactions/export?${query}`);
}

export function createRevenueTransaction(payload: RevenueTransactionCreatePayload) {
  return apiRequest<RevenueTransaction>('/revenue-transactions', {
    method: 'POST',
    body: payload,
  });
}

export function distributeMonthlySharesToWeekly(payload: ShareMonthlyDistributionPayload) {
  return apiRequest<string>('/shares/distribute/monthly-to-weekly', {
    method: 'POST',
    body: payload,
  });
}

export function generateManualShareFines(associationId: string, params: ShareFineScopeParams) {
  const query = buildRevenueQuery(params);
  const suffix = query ? `?${query}` : '';
  return apiRequest<RevenueTransaction[]>(`/revenue-transactions/associations/${encodeURIComponent(associationId)}/generate-manual-share-fines${suffix}`, {
    method: 'POST',
    body: {},
  });
}

export function cancelGeneratedShareFines(associationId: string, params: ShareFineScopeParams) {
  const query = buildRevenueQuery(params);
  const suffix = query ? `?${query}` : '';
  return apiRequest<RevenueTransaction[]>(`/revenue-transactions/associations/${encodeURIComponent(associationId)}/share-fines/cancel-generated${suffix}`, {
    method: 'POST',
    body: {},
  });
}

export function previewShareReconciliation(associationId: string) {
  return apiRequest<ShareReconciliationResult>(`/shares/reconcile/association/${encodeURIComponent(associationId)}/preview`);
}

export function applyShareReconciliation(associationId: string) {
  return apiRequest<ShareReconciliationResult>(`/shares/reconcile/association/${encodeURIComponent(associationId)}`, {
    method: 'POST',
  });
}

export function distributeDividends(associationId: string, checkDate?: string) {
  const query = buildRevenueQuery({ checkDate: checkDate ? `${checkDate}T00:00:00` : undefined });
  const suffix = query ? `?${query}` : '';
  return apiRequest<DividendDistributionResult>(`/revenue-transactions/associations/${encodeURIComponent(associationId)}/dividends/distribute${suffix}`, {
    method: 'POST',
    body: {},
  });
}

export function markFinesDueAtFinancialYearEnd(associationId: string, checkDate: string) {
  const query = buildRevenueQuery({ checkDate: `${checkDate}T00:00:00` });
  return apiRequest<MarkFinesDueResult>(`/revenue-transactions/associations/${encodeURIComponent(associationId)}/fines/mark-due?${query}`, {
    method: 'POST',
    body: {},
  });
}

export function deductMemberFinesFromDividend(associationId: string, memberId: string, dividendAmount: number) {
  const query = buildRevenueQuery({ dividendAmount });
  return apiRequest<number | string>(`/revenue-transactions/associations/${encodeURIComponent(associationId)}/members/${encodeURIComponent(memberId)}/fines/deduct?${query}`, {
    method: 'POST',
    body: {},
  });
}

export function closeFinancialYear(associationId: string, checkDate: string) {
  const query = buildRevenueQuery({ checkDate: `${checkDate}T00:00:00` });
  return apiRequest<FinancialYearCloseResult>(`/group-configs/associations/${encodeURIComponent(associationId)}/financial-year/close?${query}`, {
    method: 'POST',
    body: {},
  });
}

export async function downloadRevenueReport(type: 'excel' | 'pdf', reportPath: string) {
  const filename = reportPath.split('/').pop() || reportPath;
  const response = await apiBinaryRequest(`/revenue-transactions/download-report/${type}/${encodeURIComponent(filename)}`);
  return {
    filename,
    data: response.data,
  };
}

export function deleteRevenueTransaction(transactionId: string) {
  return apiRequest<void>(`/revenue-transactions/${encodeURIComponent(transactionId)}`, {
    method: 'DELETE',
  });
}

export function createBulkRevenueTransactions(transactions: RevenueTransactionCreatePayload[]) {
  return apiRequest<RevenueTransaction[]>('/revenue-transactions/bulk', {
    method: 'POST',
    body: { transactions },
  });
}

export function updateBulkRevenueTransactions(updates: RevenueTransactionBulkUpdatePayload[]) {
  return apiRequest<RevenueTransaction[]>('/revenue-transactions/bulk/update', {
    method: 'PUT',
    body: updates,
  });
}

export function importRevenueTransactionsFromFile(associationId: string, file: RevenueImportFile) {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } as unknown as Blob);
  formData.append('associationId', associationId);

  return apiRequest<RevenueTransaction[]>('/revenue-transactions/import', {
    method: 'POST',
    body: formData,
  });
}

export function importBulkRevenueTransactionsForMember(associationId: string, memberEmail: string, file: RevenueImportFile) {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } as unknown as Blob);
  formData.append('memberEmail', memberEmail);
  formData.append('associationId', associationId);

  return apiRequest<RevenueTransaction[]>('/revenue-transactions/import/bulk', {
    method: 'POST',
    body: formData,
  });
}

export function getRevenueTransactionTotal(transaction: RevenueTransaction) {
  const paymentDetails = transaction.paymentDetails || {};
  const detailTotal = Object.values(paymentDetails).reduce<number>((sum, value) => sum + Number(value || 0), 0);
  return detailTotal || Number(transaction.totalShareValue || 0);
}

export function formatRevenuePaymentTypes(transaction: RevenueTransaction) {
  const keys = Object.keys(transaction.paymentDetails || {});
  if (!keys.length) return 'No payment type';
  return keys.map(labelFromPaymentType).join(' + ');
}

export function labelFromPaymentType(value?: string | null) {
  return String(value || 'Unknown')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildRevenueQuery(params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  return query.toString();
}
