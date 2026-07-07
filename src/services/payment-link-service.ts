import { apiEnvelopeRequest } from '@/api/client';

export type SmsPaymentLinkPayload = {
  associationId: string;
  memberId: string;
  amount: string;
  currency: 'TZS' | 'KES' | 'USD' | 'NGN';
  description?: string;
  ttlMinutes?: string;
};

export type SmsPaymentLinkResult = {
  link: string;
  success: boolean;
  message?: string | null;
};

export async function sendSmsPaymentLink(payload: SmsPaymentLinkPayload): Promise<SmsPaymentLinkResult> {
  const response = await apiEnvelopeRequest<Record<string, unknown>>('/pay/sms/send-link', {
    method: 'POST',
    body: payload,
  });
  const raw = response as typeof response & { link?: string; data?: { link?: string } };
  return {
    success: Boolean(response.success),
    message: response.message,
    link: raw.link || raw.data?.link || '',
  };
}
