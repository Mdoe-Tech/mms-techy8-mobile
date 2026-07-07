import { apiEnvelopeRequest, apiRequest } from '@/api/client';

export type RevenueCategory = {
  id: string;
  name: string;
  description?: string | null;
  associationId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version?: number | null;
};

export type GeneralRevenueUserSummary = {
  id?: string | null;
  username?: string | null;
  fullName?: string | null;
};

export type GeneralRevenue = {
  id: string;
  associationId?: string | null;
  revenueCategory?: RevenueCategory | null;
  sourceName?: string | null;
  transactionDate: string;
  amount: number;
  description?: string | null;
  notes?: string | null;
  receiptPath?: string | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  recordedBy?: GeneralRevenueUserSummary | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version?: number | null;
};

export type GeneralRevenuePayload = {
  revenueCategoryId: string;
  sourceName?: string | null;
  transactionDate: string;
  amount: number;
  description?: string | null;
  notes?: string | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  recordedById?: string | null;
};

export type GeneralRevenuePage = {
  revenues: GeneralRevenue[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type GeneralRevenueListFilters = {
  page?: number;
  size?: number;
  sort?: string;
  startDate?: string;
  endDate?: string;
};

export async function getAssociationGeneralRevenues(
  associationId: string,
  filters: GeneralRevenueListFilters = {},
): Promise<GeneralRevenuePage> {
  const query = new URLSearchParams();
  query.set('page', String(filters.page ?? 0));
  query.set('size', String(filters.size ?? 100));
  query.set('sort', filters.sort || 'transactionDate,desc');
  if (filters.startDate) query.set('startDate', filters.startDate);
  if (filters.endDate) query.set('endDate', filters.endDate);

  const response = await apiEnvelopeRequest<GeneralRevenue[]>(
    `/associations/${encodeURIComponent(associationId)}/revenues?${query.toString()}`,
  );
  return normalizeGeneralRevenuePage(response, filters.size ?? 100);
}

export async function getAllAssociationGeneralRevenues(
  associationId: string,
  filters: Omit<GeneralRevenueListFilters, 'page'> = {},
  options: { maxPages?: number } = {},
) {
  const size = filters.size ?? 250;
  const revenues: GeneralRevenue[] = [];
  let page = 0;
  let totalPages = 1;
  let totalElements = 0;

  while (page < totalPages && page < (options.maxPages ?? 40)) {
    const response = await getAssociationGeneralRevenues(associationId, {
      ...filters,
      page,
      size,
    });
    revenues.push(...response.revenues);
    totalPages = Math.max(1, response.totalPages);
    totalElements = response.totalElements || revenues.length;
    page += 1;
  }

  return {
    revenues,
    totalElements: totalElements || revenues.length,
    totalPages,
    pagesFetched: page,
  };
}

export async function getAssociationGeneralRevenue(associationId: string, revenueId: string) {
  const revenue = await apiRequest<GeneralRevenue>(
    `/associations/${encodeURIComponent(associationId)}/revenues/${encodeURIComponent(revenueId)}`,
  );
  return normalizeGeneralRevenue(revenue);
}

export async function createAssociationGeneralRevenue(associationId: string, payload: GeneralRevenuePayload) {
  const revenue = await apiRequest<GeneralRevenue>(`/associations/${encodeURIComponent(associationId)}/revenues`, {
    method: 'POST',
    body: normalizeGeneralRevenuePayload(payload),
  });
  return normalizeGeneralRevenue(revenue);
}

export async function updateAssociationGeneralRevenue(
  associationId: string,
  revenueId: string,
  payload: GeneralRevenuePayload,
) {
  const revenue = await apiRequest<GeneralRevenue>(
    `/associations/${encodeURIComponent(associationId)}/revenues/${encodeURIComponent(revenueId)}`,
    {
      method: 'PUT',
      body: normalizeGeneralRevenuePayload(payload),
    },
  );
  return normalizeGeneralRevenue(revenue);
}

export function deleteAssociationGeneralRevenue(associationId: string, revenueId: string) {
  return apiRequest<void>(
    `/associations/${encodeURIComponent(associationId)}/revenues/${encodeURIComponent(revenueId)}`,
    { method: 'DELETE' },
  );
}

export async function getAssociationRevenueCategories(associationId: string) {
  const categories = await apiRequest<RevenueCategory[]>(
    `/associations/${encodeURIComponent(associationId)}/revenue-categories`,
  );
  return (categories || []).map(normalizeRevenueCategory);
}

export async function createAssociationRevenueCategory(
  associationId: string,
  payload: { name: string; description?: string | null },
) {
  const category = await apiRequest<RevenueCategory>(
    `/associations/${encodeURIComponent(associationId)}/revenue-categories`,
    {
      method: 'POST',
      body: {
        name: payload.name.trim(),
        description: textOrNull(payload.description),
      },
    },
  );
  return normalizeRevenueCategory(category);
}

export async function updateAssociationRevenueCategory(
  associationId: string,
  categoryId: string,
  payload: { name: string; description?: string | null },
) {
  const category = await apiRequest<RevenueCategory>(
    `/associations/${encodeURIComponent(associationId)}/revenue-categories/${encodeURIComponent(categoryId)}`,
    {
      method: 'PUT',
      body: {
        name: payload.name.trim(),
        description: textOrNull(payload.description),
      },
    },
  );
  return normalizeRevenueCategory(category);
}

export function deleteAssociationRevenueCategory(associationId: string, categoryId: string) {
  return apiRequest<void>(
    `/associations/${encodeURIComponent(associationId)}/revenue-categories/${encodeURIComponent(categoryId)}`,
    { method: 'DELETE' },
  );
}

function normalizeGeneralRevenuePage(
  envelope: {
    data?: GeneralRevenue[] | { content?: GeneralRevenue[] } | null;
    page?: number | string | null;
    size?: number | string | null;
    totalElements?: number | string | null;
    totalPages?: number | string | null;
  },
  fallbackSize: number,
): GeneralRevenuePage {
  const payload = envelope.data;
  const revenues = (Array.isArray(payload) ? payload : Array.isArray(payload?.content) ? payload.content : []).map(normalizeGeneralRevenue);

  return {
    revenues,
    page: Number(envelope.page ?? 0),
    size: Number(envelope.size ?? fallbackSize),
    totalElements: Number(envelope.totalElements ?? revenues.length),
    totalPages: Number(envelope.totalPages ?? 1),
  };
}

function normalizeGeneralRevenue(revenue: GeneralRevenue): GeneralRevenue {
  return {
    ...revenue,
    amount: toNumber(revenue?.amount),
    transactionDate: revenue?.transactionDate || '',
    revenueCategory: revenue?.revenueCategory ? normalizeRevenueCategory(revenue.revenueCategory) : null,
  };
}

function normalizeRevenueCategory(category: RevenueCategory): RevenueCategory {
  return {
    ...category,
    name: category?.name || 'Uncategorized',
  };
}

function normalizeGeneralRevenuePayload(payload: GeneralRevenuePayload) {
  return {
    revenueCategoryId: payload.revenueCategoryId,
    sourceName: textOrNull(payload.sourceName),
    transactionDate: payload.transactionDate,
    amount: toNumber(payload.amount),
    description: textOrNull(payload.description),
    notes: textOrNull(payload.notes),
    paymentMethod: textOrNull(payload.paymentMethod),
    referenceNumber: textOrNull(payload.referenceNumber),
    recordedById: textOrNull(payload.recordedById),
  };
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function textOrNull(value?: string | null) {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed : null;
}
