import { apiRequest } from '@/api/client';

export type AssociationDashboardData = {
  associationName?: string;
  totalMembers?: number;
  activeMembers?: number;
  inactiveMembers?: number;
  partiallyCompletedRegistrations?: number;
  averageRegistrationProgress?: number;
  fullyCompliantMembers?: number;
  membersWithRequiredDocuments?: number;
  newMembersLast30Days?: number;
  totalCollectedAmount?: number;
  totalExpenses?: number;
  totalRevenue?: number;
  monthlyRevenue?: number;
  quarterlyRevenue?: number;
  annualRevenue?: number;
  totalCollectedAmountCurrentYear?: number;
  totalExpensesCurrentYear?: number;
  profitLossCurrentYear?: number;
  memberStatusCounts?: Record<string, number>;
  totalPackages?: number;
  packageSubscriptions?: {
    packageName?: string;
    activeSubscriptions?: number;
    totalSubscriptions?: number;
    revenue?: number;
    pendingSubscriptions?: number;
    monthlyAmount?: number;
    annualAmount?: number;
    active?: boolean;
  }[];
  subscriptionTrends?: { date?: string; subscriptionCount?: number; revenue?: number }[];
  recentMembers?: {
    fullLegalName?: string;
    businessName?: string;
    status?: string;
    createdAt?: string;
    registrationProgress?: number;
    packageName?: string;
    email?: string;
  }[];
  timestamp?: string;
};

export type UnionTrendPoint = {
  month?: string;
  totalDeductions?: number;
};

export type UnionContributor = {
  memberId?: string;
  memberFullLegalName?: string;
  membershipNumber?: string;
  totalAmount?: number;
};

export type UnionDashboardData = {
  totalCollectedAmount?: number;
  totalActiveMembers?: number;
  totalInactiveMembers?: number;
  totalExpenses?: number;
  totalRevenue?: number;
  totalDeductionsThisMonth?: number;
  averageMonthlyContribution?: number;
  newMembersThisMonth?: number;
  deactivatedMembersThisMonth?: number;
  monthlyDeductionTrends?: UnionTrendPoint[];
  memberRetentionTrends?: UnionTrendPoint[];
  topContributors?: UnionContributor[];
};

export type UnionDeduction = {
  id: string;
  amount?: number;
  deductionPeriod?: string;
  createdAt?: string;
  member?: {
    id?: string;
    fullLegalName?: string;
    membershipNumber?: string;
  };
};

export type MemberDashboardData = {
  memberName?: string;
  associationName?: string;
  membershipNumber?: string;
  status?: string;
  registrationProgress?: number;
  totalContributions?: number;
  totalLoans?: number;
  activeLoanBalance?: number;
  totalPaid?: number;
  monthlyContribution?: number;
  totalTransactions?: number;
  activeSubscriptions?: number;
  recentTransactions?: Record<string, number>;
  memberSince?: string;
  lastUpdated?: string;
  timestamp?: string;
  associationType?: string;
  totalLoansCount?: number;
  pendingLoansCount?: number;
  approvedLoansCount?: number;
  disbursedLoansCount?: number;
  activeLoansCount?: number;
  completedLoansCount?: number;
  defaultedLoansCount?: number;
  rejectedLoansCount?: number;
  totalDisbursedAmount?: number;
  totalCompletedAmount?: number;
  totalDefaultedAmount?: number;
  totalSharesBought?: number;
  totalShareValue?: number;
  totalSocialContributions?: number;
  totalSharePurchases?: number;
  subscribedPackages?: {
    id: string;
    name: string;
    description?: string;
    price?: number;
    status: string;
    subscribedAt?: string;
  }[];
  unionContributions?: {
    totalAmount?: number;
    contributionCount?: number;
    lastContribution?: string;
  };
};

export type SystemAdminAssociationMetricsRow = {
  schemaName?: string | null;
  associationId: string;
  associationName: string;
  associationType?: string | null;
  adminEmail?: string | null;
  totalUsers: number;
  totalMembers: number;
  activeMembers: number;
  totalPackages: number;
  activeLoans: number;
  overdueLoans: number;
  revenueTransactions: number;
  paidTransactions: number;
  pendingTransactions: number;
  overdueTransactions: number;
  currentWebsocketConnections: number;
  computedAtEpochMs: number;
  newMembers7d: number;
  newMembers30d: number;
  inactiveMembers: number;
  incompleteRegistrations: number;
  nextDueLoans7d: number;
  loansOutstandingAmount: number;
  loansOverdueOutstandingAmount: number;
  revenuePaidAmount30d: number;
  revenuePaidAmountTotal: number;
  revenuePendingAmount30d: number;
  revenueOverdueAmount30d: number;
  expenseAmount30d: number;
  expenseAmountMtd: number;
  campaignsCompleted7d: number;
  campaignsFailed7d: number;
  messagesDelivered7d: number;
  messagesFailed7d: number;
  activeUsers: number;
  adminUsers: number;
  lastLoginActive7d: number;
  accountStatus?: string | null;
  accountStatusReason?: string | null;
  accountStatusUpdatedAt?: string | null;
  accountStatusUpdatedBy?: string | null;
};

export type SystemAdminAssociationMetricsPage = {
  content: SystemAdminAssociationMetricsRow[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
};

export type SystemAdminAssociationMetricsResponse = {
  page: SystemAdminAssociationMetricsPage;
  totalActiveWebsocketConnections: number;
};

export type SystemAdminAssociationMetricsParams = {
  page?: number;
  size?: number;
  search?: string;
  type?: string;
};

export type SystemAdminImpersonationResponse = {
  accessToken: string;
  refreshToken: string;
  email: string;
  fullName?: string;
  id?: string;
  associationId?: string;
  associationRole?: string;
  associationType?: string;
  systemRole?: string;
  schema?: string;
  isTechy8Admin?: boolean;
  firstLogin?: boolean;
};

export function getAssociationDashboard(associationId: string) {
  return apiRequest<AssociationDashboardData>(`/dashboard/association-admin?associationId=${encodeURIComponent(associationId)}`);
}

export function getUnionDashboard(associationId: string) {
  return apiRequest<UnionDashboardData>(`/unions/${encodeURIComponent(associationId)}/dashboard`);
}

export function getUnionDeductions(associationId: string) {
  return apiRequest<UnionDeduction[]>(`/unions/${encodeURIComponent(associationId)}/deductions`);
}

export function getMemberDashboard() {
  return apiRequest<MemberDashboardData>('/dashboard/member');
}

export async function getSystemAdminAssociationMetricsPage(params: SystemAdminAssociationMetricsParams = {}) {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 0));
  query.set('size', String(params.size ?? 100));
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.type?.trim()) query.set('type', params.type.trim());

  const response = await apiRequest<SystemAdminAssociationMetricsResponse>(
    `/super-admin/overview/associations-metrics?${query.toString()}`,
  );
  return normalizeSystemAdminMetricsResponse(response);
}

export async function getAllSystemAdminAssociationMetrics(params: Omit<SystemAdminAssociationMetricsParams, 'page'> = {}) {
  const size = params.size ?? 100;
  const firstPage = await getSystemAdminAssociationMetricsPage({ ...params, page: 0, size });
  const rows = [...firstPage.page.content];
  const totalPages = Math.max(1, firstPage.page.totalPages || 1);
  let totalActiveWebsocketConnections = firstPage.totalActiveWebsocketConnections;

  for (let page = 1; page < totalPages; page += 1) {
    const nextPage = await getSystemAdminAssociationMetricsPage({ ...params, page, size });
    rows.push(...nextPage.page.content);
    totalActiveWebsocketConnections = Math.max(
      totalActiveWebsocketConnections,
      nextPage.totalActiveWebsocketConnections,
    );
  }

  return {
    rows,
    totalElements: firstPage.page.totalElements,
    totalActiveWebsocketConnections,
  };
}

export async function updateAssociationAccountStatus(
  associationId: string,
  payload: { status: 'ACTIVE' | 'DISABLED'; reason?: string },
) {
  return apiRequest<{
    id: string;
    accountStatus?: string | null;
    accountStatusReason?: string | null;
    accountStatusUpdatedAt?: string | null;
    accountStatusUpdatedBy?: string | null;
  }>(`/associations/${encodeURIComponent(associationId)}/account-status`, {
    method: 'PATCH',
    body: payload,
  });
}

export function impersonateAssociationAdmin(schemaName: string) {
  return apiRequest<SystemAdminImpersonationResponse>('/super-admin/impersonate-as-admin', {
    method: 'POST',
    body: { schemaName },
  });
}

export function impersonateAssociationUser(email: string, schemaName: string) {
  return apiRequest<SystemAdminImpersonationResponse>('/super-admin/impersonate', {
    method: 'POST',
    body: { email, schemaName },
  });
}

function normalizeSystemAdminMetricsResponse(
  response: Partial<SystemAdminAssociationMetricsResponse> | null | undefined,
): SystemAdminAssociationMetricsResponse {
  const page: Partial<SystemAdminAssociationMetricsPage> = response?.page || {};
  const content = Array.isArray(page.content) ? page.content : [];

  return {
    page: {
      content: content.map(normalizeSystemAdminAssociationMetricsRow).filter((row) => Boolean(row.associationId)),
      totalElements: toNumber(page.totalElements),
      totalPages: toNumber(page.totalPages),
      page: toNumber(page.page),
      size: toNumber(page.size),
    },
    totalActiveWebsocketConnections: toNumber(response?.totalActiveWebsocketConnections),
  };
}

function normalizeSystemAdminAssociationMetricsRow(
  row: Partial<SystemAdminAssociationMetricsRow> | null | undefined,
): SystemAdminAssociationMetricsRow {
  return {
    schemaName: row?.schemaName || null,
    associationId: String(row?.associationId || ''),
    associationName: row?.associationName || 'Unnamed association',
    associationType: row?.associationType || null,
    adminEmail: row?.adminEmail || null,
    totalUsers: toNumber(row?.totalUsers),
    totalMembers: toNumber(row?.totalMembers),
    activeMembers: toNumber(row?.activeMembers),
    totalPackages: toNumber(row?.totalPackages),
    activeLoans: toNumber(row?.activeLoans),
    overdueLoans: toNumber(row?.overdueLoans),
    revenueTransactions: toNumber(row?.revenueTransactions),
    paidTransactions: toNumber(row?.paidTransactions),
    pendingTransactions: toNumber(row?.pendingTransactions),
    overdueTransactions: toNumber(row?.overdueTransactions),
    currentWebsocketConnections: toNumber(row?.currentWebsocketConnections),
    computedAtEpochMs: toNumber(row?.computedAtEpochMs),
    newMembers7d: toNumber(row?.newMembers7d),
    newMembers30d: toNumber(row?.newMembers30d),
    inactiveMembers: toNumber(row?.inactiveMembers),
    incompleteRegistrations: toNumber(row?.incompleteRegistrations),
    nextDueLoans7d: toNumber(row?.nextDueLoans7d),
    loansOutstandingAmount: toNumber(row?.loansOutstandingAmount),
    loansOverdueOutstandingAmount: toNumber(row?.loansOverdueOutstandingAmount),
    revenuePaidAmount30d: toNumber(row?.revenuePaidAmount30d),
    revenuePaidAmountTotal: toNumber(row?.revenuePaidAmountTotal),
    revenuePendingAmount30d: toNumber(row?.revenuePendingAmount30d),
    revenueOverdueAmount30d: toNumber(row?.revenueOverdueAmount30d),
    expenseAmount30d: toNumber(row?.expenseAmount30d),
    expenseAmountMtd: toNumber(row?.expenseAmountMtd),
    campaignsCompleted7d: toNumber(row?.campaignsCompleted7d),
    campaignsFailed7d: toNumber(row?.campaignsFailed7d),
    messagesDelivered7d: toNumber(row?.messagesDelivered7d),
    messagesFailed7d: toNumber(row?.messagesFailed7d),
    activeUsers: toNumber(row?.activeUsers),
    adminUsers: toNumber(row?.adminUsers),
    lastLoginActive7d: toNumber(row?.lastLoginActive7d),
    accountStatus: row?.accountStatus || null,
    accountStatusReason: row?.accountStatusReason || null,
    accountStatusUpdatedAt: row?.accountStatusUpdatedAt || null,
    accountStatusUpdatedBy: row?.accountStatusUpdatedBy || null,
  };
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
