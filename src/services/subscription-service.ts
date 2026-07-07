import { apiEnvelopeRequest, apiRequest } from '@/api/client';
import type { AssociationMember, PageResponse } from '@/services/member-service';

export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
export type BillingCycle = 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'FREE';

export type SubscriptionPackageResponse = {
  id: string;
  name?: string | null;
  weeklyAmount?: number | string | null;
  biWeeklyAmount?: number | string | null;
  monthlyAmount?: number | string | null;
  quarterlyAmount?: number | string | null;
  semiAnnualAmount?: number | string | null;
  annualAmount?: number | string | null;
  currency?: string | null;
  active?: boolean | null;
};

export type MemberSubscription = {
  id: string;
  memberId?: string | null;
  packageResponse?: SubscriptionPackageResponse | null;
  membershipPackage?: SubscriptionPackageResponse | null;
  billingCycle?: BillingCycle | string | null;
  amount?: number | string | null;
  status?: SubscriptionStatus | string | null;
  createdAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type SubscriptionImportFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export type SubscriptionImportResult = {
  importedRows?: number | string | null;
  skippedRows?: number | string | null;
  failedRows?: number | string | null;
  imported?: number | string | null;
  skipped?: number | string | null;
  failed?: number | string | null;
  errors?: string[] | null;
};

export type BulkStatusUpdateResponse = {
  operationDescription?: string | null;
  targetStatus?: SubscriptionStatus | string | null;
  totalConsidered?: number | string | null;
  successfullyUpdated?: number | string | null;
  failedUpdates?: number | string | null;
  errors?: string[] | null;
};

export type BulkSubscriptionResponse = {
  associationId?: string | null;
  packageId?: string | null;
  totalMembersConsidered?: number | string | null;
  successfullySubscribed?: number | string | null;
  skippedAlreadySubscribed?: number | string | null;
  failedSubscriptions?: number | string | null;
  errors?: string[] | null;
};

export type SubscriptionListFilters = {
  page?: number;
  size?: number;
  sort?: string;
  search?: string;
  status?: string;
};

export type SubscriptionPage = PageResponse<MemberSubscription>;

export type GenericPaymentLinkPayload = {
  memberId: string;
  associationId: string;
  amount: number;
  currency?: string | null;
  purpose: 'SUBSCRIPTION';
  description?: string | null;
  ttlMinutes?: number;
};

export type GenericPaymentLinkResponse = {
  token?: string | null;
  url?: string | null;
  memberId?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  purpose?: string | null;
  description?: string | null;
  invoiceId?: string | null;
};

export function getAssociationSubscriptionsPage(associationId: string, filters: SubscriptionListFilters = {}) {
  const query = new URLSearchParams();
  query.set('associationId', associationId);
  query.set('page', String(filters.page ?? 0));
  query.set('size', String(filters.size ?? 100));
  query.set('sort', filters.sort || 'createdAt,desc');
  if (filters.search?.trim()) query.set('search', filters.search.trim());
  if (filters.status && filters.status !== 'ALL') query.set('status', filters.status);

  return apiEnvelopeRequest<unknown>(`/members/subscriptions/list?${query.toString()}`).then((response) =>
    normalizeSubscriptionPage(response.data, filters.size ?? 100),
  );
}

export function getCurrentMemberSubscriptions(associationId: string, filters: Omit<SubscriptionListFilters, 'search' | 'status' | 'sort'> = {}) {
  const query = new URLSearchParams();
  query.set('associationId', associationId);
  query.set('page', String(filters.page ?? 0));
  query.set('size', String(filters.size ?? 100));

  return apiEnvelopeRequest<unknown>(`/members/subscriptions?${query.toString()}`).then((response) =>
    normalizeMemberSubscriptionsResponse(response.data, filters.size ?? 100),
  );
}

export function subscribeCurrentMember(packageId: string, billingCycle: BillingCycle) {
  const query = new URLSearchParams({ packageId, billingCycle });
  return apiRequest<AssociationMember>(`/members/subscribe?${query.toString()}`, {
    method: 'POST',
  });
}

export async function importSubscriptionHistory(associationId: string, file: SubscriptionImportFile) {
  const formData = new FormData();
  formData.append('associationId', associationId);
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as unknown as Blob);

  const response = await apiEnvelopeRequest<SubscriptionImportResult>('/members/subscriptions/import', {
    method: 'POST',
    body: formData,
  });
  return response.data;
}

export async function createSubscriptionPaymentLink(payload: GenericPaymentLinkPayload) {
  const response = await apiEnvelopeRequest<GenericPaymentLinkResponse>('/pay/generic/create-link', {
    method: 'POST',
    body: {
      ...payload,
      currency: payload.currency || 'TZS',
      ttlMinutes: payload.ttlMinutes ?? 43200,
    },
  });
  return response.data;
}

export async function getAllAssociationSubscriptions(
  associationId: string,
  filters: Omit<SubscriptionListFilters, 'page'> = {},
  options: { maxPages?: number } = {},
) {
  const size = filters.size ?? 200;
  const subscriptions: MemberSubscription[] = [];
  let page = 0;
  let totalPages = 1;
  let totalElements = 0;

  while (page < totalPages && page < (options.maxPages ?? 25)) {
    const response = await getAssociationSubscriptionsPage(associationId, {
      ...filters,
      page,
      size,
    });

    subscriptions.push(...(response.content || []));
    totalPages = Math.max(1, Number(response.totalPages || 1));
    totalElements = Number(response.totalElements || subscriptions.length);
    page += 1;
  }

  return {
    content: subscriptions,
    totalElements: totalElements || subscriptions.length,
    totalPages,
    pagesFetched: page,
  };
}

export function updateSubscriptionStatus(subscriptionId: string, status: SubscriptionStatus) {
  const query = new URLSearchParams({ status });
  return apiRequest<MemberSubscription>(`/members/subscriptions/${encodeURIComponent(subscriptionId)}/status?${query.toString()}`, {
    method: 'PUT',
  });
}

export function updateMultipleSubscriptionStatuses(subscriptionIds: string[], newStatus: SubscriptionStatus) {
  const query = new URLSearchParams({ newStatus });
  return apiRequest<BulkStatusUpdateResponse>(`/members/subscriptions/bulk-update-status?${query.toString()}`, {
    method: 'PUT',
    body: subscriptionIds,
  });
}

export function updateAllAssociationSubscriptionStatuses(
  associationId: string,
  newStatus: SubscriptionStatus,
  currentStatusFilter: SubscriptionStatus,
) {
  const query = new URLSearchParams({ newStatus, currentStatusFilter });
  return apiRequest<BulkStatusUpdateResponse>(
    `/members/associations/${encodeURIComponent(associationId)}/subscriptions/bulk-update-status?${query.toString()}`,
    { method: 'PUT' },
  );
}

export function updateSubscriptionBillingCycle(subscriptionId: string, billingCycle: BillingCycle, isFree: boolean) {
  const query = new URLSearchParams({ billingCycle, isFree: String(isFree) });
  return apiRequest<MemberSubscription>(`/members/subscriptions/${encodeURIComponent(subscriptionId)}/billing-cycle?${query.toString()}`, {
    method: 'PUT',
  });
}

export function subscribeMemberAdminEnhanced(memberId: string, packageId: string, billingCycle: BillingCycle, startDate?: string, isFree = false) {
  const query = new URLSearchParams({ memberId, packageId, billingCycle, isFree: String(isFree) });
  if (startDate?.trim()) query.set('startDate', startDate.trim());
  return apiRequest<AssociationMember>(`/members/admin/subscribe/enhanced?${query.toString()}`, {
    method: 'POST',
  });
}

export function subscribeMultipleMembers(memberIds: string[], packageId: string, billingCycle: BillingCycle) {
  const query = new URLSearchParams({ packageId, billingCycle });
  return apiRequest<AssociationMember[]>(`/members/bulk-subscribe?${query.toString()}`, {
    method: 'POST',
    body: memberIds,
  });
}

export function subscribeAllMembers(
  associationId: string,
  packageId: string,
  billingCycle: BillingCycle,
  startDate?: string,
  isFree = false,
) {
  const query = new URLSearchParams({ associationId, packageId, billingCycle, isFree: String(isFree) });
  if (startDate?.trim()) query.set('startDate', startDate.trim());
  return apiRequest<BulkSubscriptionResponse>(`/members/bulk-subscribe-all?${query.toString()}`, {
    method: 'POST',
  });
}

function normalizeSubscriptionPage(data: unknown, fallbackSize: number): SubscriptionPage {
  if (Array.isArray(data)) {
    return {
      content: data as MemberSubscription[],
      totalElements: data.length,
      totalPages: data.length > 0 ? 1 : 0,
      number: 0,
      size: fallbackSize,
    };
  }

  const payload = data as {
    content?: MemberSubscription[];
    totalElements?: number | string | null;
    totalPages?: number | string | null;
    number?: number | string | null;
    size?: number | string | null;
    page?: {
      totalElements?: number | string | null;
      totalPages?: number | string | null;
      number?: number | string | null;
      size?: number | string | null;
    } | null;
  } | null;

  const content = Array.isArray(payload?.content) ? payload.content : [];
  return {
    content,
    totalElements: Number(payload?.totalElements ?? payload?.page?.totalElements ?? content.length),
    totalPages: Number(payload?.totalPages ?? payload?.page?.totalPages ?? (content.length > 0 ? 1 : 0)),
    number: Number(payload?.number ?? payload?.page?.number ?? 0),
    size: Number(payload?.size ?? payload?.page?.size ?? fallbackSize),
  };
}

function normalizeMemberSubscriptionsResponse(data: unknown, fallbackSize: number): SubscriptionPage {
  const payload = data as {
    subscriptions?: unknown;
    content?: MemberSubscription[];
  } | null;

  if (payload?.subscriptions) {
    return normalizeSubscriptionPage(payload.subscriptions, fallbackSize);
  }

  return normalizeSubscriptionPage(data, fallbackSize);
}
