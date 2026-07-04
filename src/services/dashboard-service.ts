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

export function getAssociationDashboard(associationId: string) {
  return apiRequest<AssociationDashboardData>(`/dashboard/association-admin?associationId=${encodeURIComponent(associationId)}`);
}

export function getMemberDashboard() {
  return apiRequest<MemberDashboardData>('/dashboard/member');
}
