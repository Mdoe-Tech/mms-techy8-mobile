import { apiEnvelopeRequest, apiRequest } from '@/api/client';
import type { PageResponse } from '@/services/member-service';

export type InvoiceItem = {
  id?: string | null;
  itemCode?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  netAmount?: number | string | null;
  taxAmount?: number | string | null;
  totalAmount?: number | string | null;
  taxCode?: number | null;
};

export type Invoice = {
  id: string;
  associationId?: string | null;
  memberId?: string | null;
  memberIds?: string[] | null;
  subscriptionId?: string | null;
  revenueTransactionId?: string | null;
  invoiceNumber?: string | null;
  status?: string | null;
  type?: string | null;
  currency?: string | null;
  netAmount?: number | string | null;
  taxAmount?: number | string | null;
  totalAmount?: number | string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  items?: InvoiceItem[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  memberName?: string | null;
  membershipNumber?: string | null;
  memberEmail?: string | null;
  memberPhone?: string | null;
  billToName?: string | null;
  billToEmail?: string | null;
  billToPhone?: string | null;
  billToAddress?: string | null;
  isConsolidated?: boolean | null;
  memberCount?: number | null;
  traCode?: string | null;
  traLink?: string | null;
  receiptNumber?: string | null;
  zNum?: string | null;
  associationVrn?: string | null;
  associationName?: string | null;
  associationAddress?: string | null;
  associationEmail?: string | null;
  associationPhone?: string | null;
  associationTin?: string | null;
  billToTin?: string | null;
  billToVrn?: string | null;
};

export type VefdReceipt = {
  id: string;
  associationId?: string | null;
  revenueTransactionId?: string | null;
  invoiceId?: string | null;
  invoiceDate?: string | null;
  status?: string | null;
  code?: number | null;
  link?: string | null;
  receiptNumber?: string | null;
  verificationCode?: string | null;
  receiptTime?: string | null;
  receiptDate?: string | null;
  znum?: string | null;
  vrn?: string | null;
  totalExclOfTax?: number | string | null;
  totalTax?: number | string | null;
  totalInclOfTax?: number | string | null;
  isDemo?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type MembershipPackage = {
  id: string;
  name?: string | null;
  description?: string | null;
  weeklyAmount?: number | string | null;
  biWeeklyAmount?: number | string | null;
  monthlyAmount?: number | string | null;
  quarterlyAmount?: number | string | null;
  semiAnnualAmount?: number | string | null;
  annualAmount?: number | string | null;
  currency?: string | null;
  active?: boolean | null;
};

export type VefdReceiptPage = {
  content: VefdReceipt[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type CurrentAssociationInfo = {
  id?: string | null;
  name?: string | null;
  address?: string | null;
  tin?: string | null;
  vrn?: string | null;
  email?: string | null;
  telephone?: string | null;
};

export type InvoicePage = PageResponse<Invoice>;

export type InvoiceListFilters = {
  page?: number;
  size?: number;
  sort?: string;
};

export type InvoiceCreatePayload = {
  memberId?: string | null;
  memberIds?: string[] | null;
  subscriptionId?: string | null;
  type?: string | null;
  status?: string | null;
  currency?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  items: InvoiceItem[];
  billToName?: string | null;
  billToEmail?: string | null;
  billToPhone?: string | null;
  billToAddress?: string | null;
  billToTin?: string | null;
  billToVrn?: string | null;
  isConsolidated?: boolean | null;
};

export type InvoiceUpdatePayload = {
  dueDate?: string | null;
  notes?: string | null;
  billToName?: string | null;
  billToEmail?: string | null;
  billToPhone?: string | null;
  billToAddress?: string | null;
  billToTin?: string | null;
  billToVrn?: string | null;
  items?: InvoiceItem[] | null;
};

export function getMemberInvoices(memberId: string, size = 100) {
  return apiRequest<PageResponse<Invoice>>(
    `/invoices/member/${encodeURIComponent(memberId)}?size=${size}&sort=createdAt,desc`,
  );
}

export async function getCurrentMemberInvoices(filters: InvoiceListFilters = {}) {
  const query = new URLSearchParams();
  query.set('page', String(filters.page ?? 0));
  query.set('size', String(filters.size ?? 25));
  query.set('sort', filters.sort || 'createdAt,desc');

  const response = await apiEnvelopeRequest<unknown>(`/member/invoices?${query.toString()}`);
  return normalizeInvoicePage(response.data, filters.size ?? 25);
}

export function getCurrentMemberInvoice(invoiceId: string) {
  return apiRequest<Invoice>(`/member/invoices/${encodeURIComponent(invoiceId)}`);
}

export function createCurrentMemberInvoicePaymentLink(invoiceId: string) {
  return apiRequest<{ link?: string }>(`/member/invoices/${encodeURIComponent(invoiceId)}/pay-link`, {
    method: 'POST',
  });
}

export async function getAssociationInvoices(filters: InvoiceListFilters = {}) {
  const query = new URLSearchParams();
  query.set('page', String(filters.page ?? 0));
  query.set('size', String(filters.size ?? 1000));
  query.set('sort', filters.sort || 'createdAt,desc');

  const response = await apiEnvelopeRequest<unknown>(`/invoices?${query.toString()}`);
  return normalizeInvoicePage(response.data, filters.size ?? 1000);
}

export function getInvoice(invoiceId: string) {
  return apiRequest<Invoice>(`/invoices/${encodeURIComponent(invoiceId)}`);
}

export function createAssociationInvoice(payload: InvoiceCreatePayload) {
  return apiRequest<Invoice>('/invoices', {
    method: 'POST',
    body: compactInvoicePayload(payload),
  });
}

export function updateAssociationInvoice(invoiceId: string, payload: InvoiceUpdatePayload) {
  return apiRequest<Invoice>(`/invoices/${encodeURIComponent(invoiceId)}`, {
    method: 'PUT',
    body: compactInvoicePayload(payload),
  });
}

export function issueAssociationInvoice(invoiceId: string) {
  return apiRequest<Invoice>(`/invoices/${encodeURIComponent(invoiceId)}/issue`, {
    method: 'POST',
  });
}

export function cancelAssociationInvoice(invoiceId: string, notes = 'Cancelled from mobile') {
  return apiRequest<Invoice>(`/invoices/${encodeURIComponent(invoiceId)}/cancel`, {
    method: 'POST',
    body: { notes },
  });
}

export function deleteAssociationInvoice(invoiceId: string) {
  return apiRequest<string>(`/invoices/${encodeURIComponent(invoiceId)}`, {
    method: 'DELETE',
  });
}

export function simulateAssociationInvoicePayment(invoiceId: string) {
  return apiRequest<Invoice>(`/invoices/${encodeURIComponent(invoiceId)}/simulate-payment`, {
    method: 'POST',
  });
}

export function createSubscriptionInvoiceForMember(memberId: string) {
  return apiRequest<Invoice>(`/invoices/member/${encodeURIComponent(memberId)}/subscription`, {
    method: 'POST',
  });
}

export function createInvoicePaymentLink(invoiceId: string) {
  return apiRequest<{ link?: string }>(`/invoices/${encodeURIComponent(invoiceId)}/pay-link`, {
    method: 'POST',
  });
}

export function getVefdReceipts(size = 100) {
  return apiRequest<PageResponse<VefdReceipt>>(`/vefd/receipts?size=${size}&sort=createdAt,desc`);
}

export async function getVefdReceiptsPage(size = 100) {
  const response = await apiEnvelopeRequest<unknown>(`/vefd/receipts?size=${size}&sort=createdAt,desc`);
  return normalizeVefdPage(response.data, size);
}

export function generateVefdReceiptForTransaction(transactionId: string) {
  return apiRequest<VefdReceipt>(`/vefd/receipts/transaction/${encodeURIComponent(transactionId)}`, {
    method: 'POST',
  });
}

export function getVefdReceiptForTransaction(transactionId: string) {
  return apiRequest<VefdReceipt>(`/vefd/receipts/transaction/${encodeURIComponent(transactionId)}`);
}

export function generateBulkVefdReceipts(transactionIds: string[]) {
  return apiRequest<{ success?: number; failed?: number; details?: unknown }>(
    '/vefd/receipts/bulk-generate',
    {
      method: 'POST',
      body: transactionIds,
    },
  );
}

export function getMembershipPackage(packageId: string) {
  return apiRequest<MembershipPackage>(`/packages/${encodeURIComponent(packageId)}`);
}

export function getCurrentAssociationInfo() {
  return apiRequest<CurrentAssociationInfo>('/associations/current');
}

function normalizeInvoicePage(data: unknown, fallbackSize: number): InvoicePage {
  if (Array.isArray(data)) {
    return {
      content: data as Invoice[],
      totalElements: data.length,
      totalPages: 1,
      number: 0,
      size: fallbackSize,
    };
  }

  const page = data as {
    content?: Invoice[];
    totalElements?: number | string;
    totalPages?: number | string;
    number?: number | string;
    size?: number | string;
    page?: {
      totalElements?: number | string;
      totalPages?: number | string;
      number?: number | string;
      size?: number | string;
    };
  } | null;

  const content = Array.isArray(page?.content) ? page.content : [];
  const metadata = page?.page;
  return {
    content,
    totalElements: Number(metadata?.totalElements ?? page?.totalElements ?? content.length),
    totalPages: Number(metadata?.totalPages ?? page?.totalPages ?? 1),
    number: Number(metadata?.number ?? page?.number ?? 0),
    size: Number(metadata?.size ?? page?.size ?? fallbackSize),
  };
}

function normalizeVefdPage(data: unknown, fallbackSize: number): VefdReceiptPage {
  if (Array.isArray(data)) {
    return {
      content: data as VefdReceipt[],
      totalElements: data.length,
      totalPages: 1,
      number: 0,
      size: fallbackSize,
    };
  }
  const page = data as {
    content?: VefdReceipt[];
    totalElements?: number | string;
    totalPages?: number | string;
    number?: number | string;
    size?: number | string;
    page?: {
      totalElements?: number | string;
      totalPages?: number | string;
      number?: number | string;
      size?: number | string;
    };
  } | null;
  const content = Array.isArray(page?.content) ? page.content : [];
  const metadata = page?.page;
  return {
    content,
    totalElements: Number(metadata?.totalElements ?? page?.totalElements ?? content.length),
    totalPages: Number(metadata?.totalPages ?? page?.totalPages ?? 1),
    number: Number(metadata?.number ?? page?.number ?? 0),
    size: Number(metadata?.size ?? page?.size ?? fallbackSize),
  };
}

function compactInvoicePayload<T extends InvoiceCreatePayload | InvoiceUpdatePayload>(payload: T) {
  const next: Record<string, unknown> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value) && value.length === 0) return;
    next[key] = value;
  });
  return next;
}
