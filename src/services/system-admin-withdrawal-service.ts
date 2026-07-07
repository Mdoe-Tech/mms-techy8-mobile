import { apiRequest } from '@/api/client';

export type SystemAdminWithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | string;

export type SystemAdminWithdrawal = {
  id: string;
  associationId?: string | null;
  associationName?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  status?: SystemAdminWithdrawalStatus | null;
  requestNotes?: string | null;
  requestedByUserId?: string | null;
  requestedByName?: string | null;
  requestedByEmail?: string | null;
  requestedByPhone?: string | null;
  processedByUserId?: string | null;
  processedByName?: string | null;
  processedAt?: string | null;
  adminNotes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  schema?: string | null;
};

export type SystemAdminWithdrawalPage = {
  content: SystemAdminWithdrawal[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
};

export type SystemAdminWithdrawalFilters = {
  page?: number;
  size?: number;
  status?: string;
  from?: string;
  to?: string;
};

export type SystemAdminWithdrawalUpdatePayload = {
  status: 'APPROVED' | 'REJECTED' | 'COMPLETED';
  adminNotes?: string;
};

export async function listSystemAdminWithdrawals(filters: SystemAdminWithdrawalFilters = {}) {
  const query = buildQuery(filters);
  const page = await apiRequest<SystemAdminWithdrawalPage>(`/super-admin/finance/withdrawals${query}`);
  return normalizeWithdrawalPage(page, filters);
}

export function updateSystemAdminWithdrawalStatus(schema: string, id: string, payload: SystemAdminWithdrawalUpdatePayload) {
  return apiRequest<SystemAdminWithdrawal>(
    `/super-admin/finance/withdrawals/${encodeURIComponent(schema)}/${encodeURIComponent(id)}/status`,
    { method: 'POST', body: payload },
  ).then(normalizeWithdrawal);
}

function buildQuery(filters: SystemAdminWithdrawalFilters) {
  const params = new URLSearchParams();
  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.size !== undefined) params.set('size', String(filters.size));
  if (filters.status?.trim() && filters.status !== 'ALL') params.set('status', filters.status.trim());
  if (filters.from?.trim()) params.set('from', filters.from.trim());
  if (filters.to?.trim()) params.set('to', filters.to.trim());
  const query = params.toString();
  return query ? `?${query}` : '';
}

function normalizeWithdrawalPage(page: Partial<SystemAdminWithdrawalPage> | null | undefined, filters: SystemAdminWithdrawalFilters): SystemAdminWithdrawalPage {
  const content = Array.isArray(page?.content) ? page.content.map(normalizeWithdrawal).filter((row) => Boolean(row.id)) : [];
  return {
    content,
    totalElements: toNumber(page?.totalElements ?? content.length),
    totalPages: toNumber(page?.totalPages ?? 1),
    page: toNumber(page?.page ?? filters.page ?? 0),
    size: toNumber(page?.size ?? filters.size ?? content.length),
  };
}

function normalizeWithdrawal(row: Partial<SystemAdminWithdrawal> | null | undefined): SystemAdminWithdrawal {
  return {
    id: String(row?.id || ''),
    associationId: stringify(row?.associationId),
    associationName: row?.associationName || null,
    amount: row?.amount ?? 0,
    currency: row?.currency || 'TZS',
    status: row?.status || 'PENDING',
    requestNotes: row?.requestNotes || null,
    requestedByUserId: stringify(row?.requestedByUserId),
    requestedByName: row?.requestedByName || null,
    requestedByEmail: row?.requestedByEmail || null,
    requestedByPhone: row?.requestedByPhone || null,
    processedByUserId: stringify(row?.processedByUserId),
    processedByName: row?.processedByName || null,
    processedAt: stringify(row?.processedAt),
    adminNotes: row?.adminNotes || null,
    createdAt: stringify(row?.createdAt),
    updatedAt: stringify(row?.updatedAt),
    schema: row?.schema || null,
  };
}

function stringify(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}
