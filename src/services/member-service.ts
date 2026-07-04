import { apiRequest } from '@/api/client';

export type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
};

export type MemberContactInfo = {
  physicalAddress?: string | null;
  postalAddress?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  website?: string | null;
};

export type AssociationMember = {
  id: string;
  memberType?: string | null;
  membershipNumber?: string | null;
  employeeId?: string | null;
  fullLegalName?: string | null;
  contactInfo?: MemberContactInfo | null;
  associationId?: string | null;
  associationName?: string | null;
  packageId?: string | null;
  packageName?: string | null;
  userId?: string | null;
  associationRole?: string | null;
  systemRole?: string | null;
  status?: string | null;
  registrationProgress?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  firstRegistrationDate?: string | null;
  dateOfBirth?: string | null;
  customAttributes?: Record<string, unknown> | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankBranch?: string | null;
  shares?: MemberShare[];
  documents?: MemberDocument[];
};

export type MemberShare = {
  id?: string;
  shareCount?: number;
  totalShareValue?: number;
  currentShareValue?: number;
  shareValue?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type MemberDocument = {
  id: string;
  documentType?: string | null;
  type?: string | null;
  documentName?: string | null;
  fileName?: string | null;
  originalFileName?: string | null;
  status?: string | null;
  uploadedAt?: string | null;
  createdAt?: string | null;
};

export type MemberRevenueSummary = {
  paidCount?: number;
  pendingCount?: number;
  overdueCount?: number;
  paidFinesTotal?: number;
  pendingFinesTotal?: number;
  overdueFinesTotal?: number;
  paidPenaltiesTotal?: number;
  pendingPenaltiesTotal?: number;
  overduePenaltiesTotal?: number;
  totalShares?: number;
  totalShareValue?: number;
};

export type MemberRevenueTransaction = {
  id: string;
  transactionDate?: string | null;
  paymentStatus?: string | null;
  paymentDetails?: Record<string, number> | null;
  description?: string | null;
  dueDate?: string | null;
  totalShareValue?: number | null;
  shareCount?: number | null;
};

export type MemberLoan = {
  id: string;
  status?: string | null;
  purpose?: string | null;
  requestedAmount?: number | null;
  disbursedAmount?: number | null;
  remainingBalance?: number | null;
  totalPaid?: number | null;
  requestDate?: string | null;
  nextPaymentDueDate?: string | null;
  isOverdue?: boolean | null;
};

type GetMembersOptions = {
  page?: number;
  size?: number;
  sort?: string;
  asOf?: string;
};

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

export function getAssociationMembers(associationId: string, options: GetMembersOptions = {}) {
  const query = buildQuery({
    associationId,
    page: options.page ?? 0,
    size: options.size ?? 250,
    sort: options.sort ?? 'membershipNumber,asc',
    asOf: options.asOf,
  });

  return apiRequest<PageResponse<AssociationMember>>(`/members?${query}`);
}

export function getAssociationMember(memberId: string) {
  return apiRequest<AssociationMember>(`/members/${encodeURIComponent(memberId)}`);
}

export function getAssociationMemberDocuments(memberId: string) {
  return apiRequest<MemberDocument[]>(`/members/${encodeURIComponent(memberId)}/documents`);
}

export function getAssociationMemberRevenueSummary(memberId: string) {
  return apiRequest<MemberRevenueSummary>(`/revenue-transactions/members/${encodeURIComponent(memberId)}/summary`);
}

export function getAssociationMemberRevenueTransactions(memberId: string) {
  return apiRequest<MemberRevenueTransaction[]>(`/revenue-transactions/members/${encodeURIComponent(memberId)}`);
}

export function getAssociationMemberLoans(memberId: string) {
  return apiRequest<MemberLoan[]>(`/loans/members/${encodeURIComponent(memberId)}`);
}

export async function getAllAssociationMembers(associationId: string, options: Omit<GetMembersOptions, 'page'> = {}) {
  const size = options.size ?? 250;
  const sort = options.sort ?? 'membershipNumber,asc';
  const members: AssociationMember[] = [];
  let page = 0;
  let totalPages = 1;
  let totalElements = 0;

  while (page < totalPages) {
    const response = await getAssociationMembers(associationId, {
      ...options,
      page,
      size,
      sort,
    });

    members.push(...(response.content || []));
    totalPages = Number(response.totalPages || 1);
    totalElements = Number(response.totalElements || members.length);
    page += 1;
  }

  return {
    content: members,
    totalElements: totalElements || members.length,
    totalPages,
    pagesFetched: page,
  };
}
