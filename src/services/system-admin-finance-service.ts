import { apiBinaryRequest, apiRequest } from '@/api/client';

export type SystemAdminFinanceTransaction = {
  id: string;
  transactionDate?: string | null;
  associationId?: string | null;
  associationName?: string | null;
  memberId?: string | null;
  memberName?: string | null;
  membershipNumber?: string | null;
  paymentStatus?: string | null;
  fineCategory?: string | null;
  schema?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  description?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  zenoInternalRef?: string | null;
  zenoStatus?: string | null;
  paymentMethod?: string | null;
};

export type SystemAdminFinancePage = {
  content: SystemAdminFinanceTransaction[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
};

export type SystemAdminFinanceFilters = {
  page?: number;
  size?: number;
  q?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
};

export async function listSystemAdminFinanceTransactions(filters: SystemAdminFinanceFilters = {}) {
  const query = buildQuery(filters);
  const page = await apiRequest<SystemAdminFinancePage>(`/super-admin/finance/transactions${query}`);
  return normalizeFinancePage(page, filters);
}

export async function exportSystemAdminFinanceTransactionsCsv(filters: Omit<SystemAdminFinanceFilters, 'page' | 'size'> = {}) {
  const query = buildQuery(filters);
  const response = await apiBinaryRequest(`/super-admin/finance/transactions/export${query}`);
  return decodeArrayBuffer(response.data);
}

function buildQuery(filters: SystemAdminFinanceFilters) {
  const params = new URLSearchParams();
  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.size !== undefined) params.set('size', String(filters.size));
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.status?.trim() && filters.status !== 'ALL') params.set('status', filters.status.trim());
  if (filters.type?.trim()) params.set('type', filters.type.trim());
  if (filters.from?.trim()) params.set('from', filters.from.trim());
  if (filters.to?.trim()) params.set('to', filters.to.trim());
  const query = params.toString();
  return query ? `?${query}` : '';
}

function normalizeFinancePage(page: Partial<SystemAdminFinancePage> | null | undefined, filters: SystemAdminFinanceFilters): SystemAdminFinancePage {
  const content = Array.isArray(page?.content) ? page.content.map(normalizeFinanceTransaction).filter((row) => Boolean(row.id)) : [];
  return {
    content,
    totalElements: toNumber(page?.totalElements ?? content.length),
    totalPages: toNumber(page?.totalPages ?? 1),
    page: toNumber(page?.page ?? filters.page ?? 0),
    size: toNumber(page?.size ?? filters.size ?? content.length),
  };
}

function normalizeFinanceTransaction(row: Partial<SystemAdminFinanceTransaction> | null | undefined): SystemAdminFinanceTransaction {
  return {
    id: String(row?.id || ''),
    transactionDate: stringify(row?.transactionDate),
    associationId: stringify(row?.associationId),
    associationName: row?.associationName || null,
    memberId: stringify(row?.memberId),
    memberName: row?.memberName || null,
    membershipNumber: row?.membershipNumber || null,
    paymentStatus: row?.paymentStatus || 'UNKNOWN',
    fineCategory: row?.fineCategory || null,
    schema: row?.schema || null,
    amount: row?.amount ?? 0,
    currency: row?.currency || 'TZS',
    description: row?.description || null,
    referenceId: stringify(row?.referenceId),
    referenceType: row?.referenceType || null,
    zenoInternalRef: row?.zenoInternalRef || null,
    zenoStatus: row?.zenoStatus || null,
    paymentMethod: row?.paymentMethod || null,
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

function decodeArrayBuffer(buffer: ArrayBuffer) {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(buffer);
  }
  return Array.from(new Uint8Array(buffer))
    .map((byte) => String.fromCharCode(byte))
    .join('');
}
