import { apiBinaryRequest, apiRequest } from '@/api/client';

export type IncomeStatementLineItem = {
  category: string;
  amount: number;
};

export type IncomeStatement = {
  startDate: string;
  endDate: string;
  revenues: IncomeStatementLineItem[];
  expenses: IncomeStatementLineItem[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
};

export type IncomeStatementFilters = {
  startDate: string;
  endDate: string;
};

export type AssociationStatisticsReport = {
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  inactiveMembers: number;
  totalPackages: number;
  membershipDistribution: Record<string, number>;
  potentialMonthlyRevenue: number;
  potentialAnnualRevenue: number;
  averageRegistrationProgress: number;
  newMembersLast30Days: number;
  updatedMembersLast30Days: number;
  completedRegistrations: number;
  compliantMembers: number;
  membersWithDocuments: number;
};

export type SmsReportRow = {
  id: string;
  associationId?: string | null;
  recipient?: string | null;
  sourceCategory?: string | null;
  messageBody?: string | null;
  status?: string | null;
  providerResponse?: string | null;
  failureReason?: string | null;
  smsUnits: number;
  sentAt?: string | null;
  createdAt?: string | null;
};

export type SmsReportPage = {
  content: SmsReportRow[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  historicalTotals: Record<string, number>;
  historicalSmsUnits: Record<string, number>;
  totalSmsUnits: number;
};

export type SmsReportFilters = {
  page?: number;
  size?: number;
  startDate?: string;
  endDate?: string;
};

export type SmsReportExportFormat = 'excel' | 'pdf';

export async function getAssociationStatisticsReport(associationId: string): Promise<AssociationStatisticsReport> {
  const report = await apiRequest<AssociationStatisticsReport>(`/reports/association/${encodeURIComponent(associationId)}`);
  return normalizeAssociationStatisticsReport(report);
}

export async function getAssociationIncomeStatement(
  associationId: string,
  filters: IncomeStatementFilters,
): Promise<IncomeStatement> {
  const query = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });

  const statement = await apiRequest<IncomeStatement>(
    `/reports/association/${encodeURIComponent(associationId)}/income-statement?${query.toString()}`,
  );

  return normalizeIncomeStatement(statement, filters);
}

export async function getAssociationSmsReportPage(
  associationId: string,
  filters: SmsReportFilters = {},
): Promise<SmsReportPage> {
  const query = buildSmsReportQuery(filters);
  const page = await apiRequest<SmsReportPage>(
    `/associations/${encodeURIComponent(associationId)}/sms-reports?${query.toString()}`,
  );
  return normalizeSmsReportPage(page, filters);
}

export async function getAllAssociationSmsReportRows(
  associationId: string,
  filters: Omit<SmsReportFilters, 'page'> = {},
  options: { maxPages?: number } = {},
) {
  const size = Math.min(Math.max(filters.size ?? 200, 1), 200);
  const rows: SmsReportRow[] = [];
  let page = 0;
  let totalPages = 1;
  let totalElements = 0;
  let historicalTotals: Record<string, number> = {};
  let historicalSmsUnits: Record<string, number> = {};
  let totalSmsUnits = 0;

  while (page < totalPages && page < (options.maxPages ?? 25)) {
    const response = await getAssociationSmsReportPage(associationId, {
      ...filters,
      page,
      size,
    });
    rows.push(...response.content);
    totalPages = Math.max(1, response.totalPages);
    totalElements = response.totalElements || rows.length;
    historicalTotals = response.historicalTotals;
    historicalSmsUnits = response.historicalSmsUnits;
    totalSmsUnits = response.totalSmsUnits;
    page += 1;
  }

  return {
    rows,
    totalElements: totalElements || rows.length,
    totalPages,
    pagesFetched: page,
    historicalTotals,
    historicalSmsUnits,
    totalSmsUnits,
  };
}

export function exportAssociationSmsReport(
  associationId: string,
  filters: Omit<SmsReportFilters, 'page' | 'size'> & { format: SmsReportExportFormat },
) {
  const query = buildSmsReportQuery(filters);
  query.set('format', filters.format);
  return apiBinaryRequest(`/associations/${encodeURIComponent(associationId)}/sms-reports/export?${query.toString()}`);
}

function normalizeIncomeStatement(
  statement: Partial<IncomeStatement> | null | undefined,
  filters: IncomeStatementFilters,
): IncomeStatement {
  return {
    startDate: String(statement?.startDate || filters.startDate),
    endDate: String(statement?.endDate || filters.endDate),
    revenues: normalizeLineItems(statement?.revenues),
    expenses: normalizeLineItems(statement?.expenses),
    totalRevenue: toAmount(statement?.totalRevenue),
    totalExpenses: toAmount(statement?.totalExpenses),
    netIncome: toAmount(statement?.netIncome),
  };
}

function normalizeAssociationStatisticsReport(
  report: Partial<AssociationStatisticsReport> | null | undefined,
): AssociationStatisticsReport {
  return {
    totalMembers: toAmount(report?.totalMembers),
    activeMembers: toAmount(report?.activeMembers),
    pendingMembers: toAmount(report?.pendingMembers),
    inactiveMembers: toAmount(report?.inactiveMembers),
    totalPackages: toAmount(report?.totalPackages),
    membershipDistribution: normalizeNumberMap(report?.membershipDistribution),
    potentialMonthlyRevenue: toAmount(report?.potentialMonthlyRevenue),
    potentialAnnualRevenue: toAmount(report?.potentialAnnualRevenue),
    averageRegistrationProgress: toAmount(report?.averageRegistrationProgress),
    newMembersLast30Days: toAmount(report?.newMembersLast30Days),
    updatedMembersLast30Days: toAmount(report?.updatedMembersLast30Days),
    completedRegistrations: toAmount(report?.completedRegistrations),
    compliantMembers: toAmount(report?.compliantMembers),
    membersWithDocuments: toAmount(report?.membersWithDocuments),
  };
}

function normalizeLineItems(items: IncomeStatementLineItem[] | null | undefined) {
  return (items || [])
    .map((item, index) => ({
      category: String(item?.category || `Line item ${index + 1}`),
      amount: toAmount(item?.amount),
    }))
    .sort((left, right) => right.amount - left.amount);
}

function buildSmsReportQuery(filters: SmsReportFilters) {
  const query = new URLSearchParams();
  if (typeof filters.page === 'number') query.set('page', String(filters.page));
  if (typeof filters.size === 'number') query.set('size', String(filters.size));
  if (filters.startDate) query.set('startDate', filters.startDate);
  if (filters.endDate) query.set('endDate', filters.endDate);
  return query;
}

function normalizeSmsReportPage(page: Partial<SmsReportPage> | null | undefined, filters: SmsReportFilters): SmsReportPage {
  return {
    content: (page?.content || []).map(normalizeSmsReportRow),
    totalElements: toAmount(page?.totalElements),
    totalPages: toAmount(page?.totalPages) || 1,
    page: toAmount(page?.page ?? filters.page),
    size: toAmount(page?.size ?? filters.size ?? 50),
    historicalTotals: normalizeNumberMap(page?.historicalTotals),
    historicalSmsUnits: normalizeNumberMap(page?.historicalSmsUnits),
    totalSmsUnits: toAmount(page?.totalSmsUnits),
  };
}

function normalizeSmsReportRow(row: Partial<SmsReportRow> | null | undefined, index: number): SmsReportRow {
  return {
    id: String(row?.id || `sms-row-${index}`),
    associationId: row?.associationId || null,
    recipient: row?.recipient || null,
    sourceCategory: row?.sourceCategory || null,
    messageBody: row?.messageBody || null,
    status: row?.status || 'UNKNOWN',
    providerResponse: row?.providerResponse || null,
    failureReason: row?.failureReason || null,
    smsUnits: toAmount(row?.smsUnits),
    sentAt: row?.sentAt || null,
    createdAt: row?.createdAt || null,
  };
}

function normalizeNumberMap(value: Record<string, unknown> | null | undefined) {
  return Object.fromEntries(
    Object.entries(value || {}).map(([key, amount]) => [key.toUpperCase(), toAmount(amount)]),
  );
}

function toAmount(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}
