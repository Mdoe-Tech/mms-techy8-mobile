import { apiEnvelopeRequest } from '@/api/client';

export type PaymentPurpose =
  | 'SHARE_PURCHASE'
  | 'SOCIAL_CONTRIBUTION'
  | 'SHARED_SOCIAL'
  | 'FINE'
  | 'PENALTY'
  | 'LOAN_REPAYMENT'
  | 'WALLET_TOP_UP'
  | 'SUBSCRIPTION'
  | 'REGISTRATION_FEE';

export type PaymentMethod = 'mobile_money' | 'card' | 'bank_transfer' | 'ussd' | 'account' | 'airpay' | 'wallet';

export type GenericPaymentInitiatePayload = {
  associationId: string;
  membershipNumber: string;
  amount: number;
  currency: string;
  purpose: PaymentPurpose;
  paymentMethod: PaymentMethod;
  useWallet?: boolean;
  isMemberView?: boolean;
  paymentDetails?: Record<string, unknown>;
};

export type ZenoCheckoutPayload = {
  memberId: string;
  associationId: string;
  amount: number;
  buyerPhone: string;
  buyerName: string;
  buyerEmail: string;
  description: string;
  entityId: string;
  entityType: PaymentPurpose;
};

export type GenericPaymentResult = {
  success: boolean;
  message?: string | null;
  reference?: string | null;
  data?: Record<string, unknown> | null;
};

export async function initiateGenericPayment(payload: GenericPaymentInitiatePayload): Promise<GenericPaymentResult> {
  return normalizePlainPaymentResponse(
    await apiEnvelopeRequest<Record<string, unknown>>('/pay/generic/initiate', {
      method: 'POST',
      body: payload,
    }),
  );
}

export async function initiateZenoCheckout(payload: ZenoCheckoutPayload): Promise<GenericPaymentResult> {
  return normalizePlainPaymentResponse(
    await apiEnvelopeRequest<Record<string, unknown>>('/zenopay/checkout', {
      method: 'POST',
      body: payload,
    }),
  );
}

function normalizePlainPaymentResponse(response: unknown): GenericPaymentResult {
  const raw = response as {
    success?: boolean;
    message?: string;
    reference?: string;
    data?: Record<string, unknown>;
  };
  return {
    success: Boolean(raw.success),
    message: raw.message,
    reference: raw.reference || asString(raw.data?.transactionReference) || asString(raw.data?.internalReference) || asString(raw.data?.orderId),
    data: raw.data || null,
  };
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null;
}
