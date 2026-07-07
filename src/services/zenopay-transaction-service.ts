import { apiEnvelopeRequest } from '@/api/client';

export type ZenoPayTransaction = {
  id: string;
  internalReference?: string | null;
  orderId?: string | null;
  reference?: string | null;
  status?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  paymentMethod?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  memberId?: string | null;
  associationId?: string | null;
  description?: string | null;
  isReconciled?: boolean | null;
  reconciledAt?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
};

export type ZenoPayTransactionPage = {
  content: ZenoPayTransaction[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export async function getUnreconciledZenoPayTransactions(associationId: string) {
  const query = new URLSearchParams({ associationId });
  const response = await apiEnvelopeRequest<ZenoPayTransaction[]>(`/zenopay/transactions/unreconciled?${query.toString()}`);
  return response.data || [];
}

export async function getAssociationZenoPayTransactions(associationId: string, page = 0, size = 20) {
  const query = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: 'createdAt,desc',
  });
  const response = await apiEnvelopeRequest<ZenoPayTransactionPage | { content?: ZenoPayTransaction[]; totalElements?: number; totalPages?: number; number?: number; size?: number }>(
    `/zenopay/transactions/association/${associationId}?${query.toString()}`,
  );
  const data = response.data || {};
  const content = Array.isArray(data.content) ? data.content : [];

  return {
    content,
    totalElements: Number(data.totalElements || content.length || 0),
    totalPages: Number(data.totalPages || 1),
    number: Number(data.number || page),
    size: Number(data.size || size),
  } satisfies ZenoPayTransactionPage;
}

export async function reconcileZenoPayTransaction(transaction: ZenoPayTransaction) {
  const isLoanRepayment = transaction.entityType === 'LOAN_REPAYMENT';
  const endpoint = isLoanRepayment
    ? `/zenopay/loans/transactions/${transaction.id}/reconcile`
    : `/zenopay/transactions/${transaction.id}/reconcile`;
  const response = await apiEnvelopeRequest<ZenoPayTransaction>(endpoint, { method: 'POST' });
  return response.data;
}
