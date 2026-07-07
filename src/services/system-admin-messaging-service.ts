import { apiRequest } from '@/api/client';

export type SystemAdminEmailBreakdown = Record<string, number>;

export type SystemAdminEmailEvent = {
  id: string;
  recipientAddress: string;
  status: string;
  providerMessageId?: string | null;
  createdAt?: string | null;
  templateId?: string | null;
  associationId?: string | null;
};

export type SystemAdminEmailEventPage = {
  content: SystemAdminEmailEvent[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
};

export type SystemAdminMessagingAttachment = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export type SystemAdminBroadcastResult = {
  channel: 'EMAIL' | 'SMS';
  sent: number;
  attachments?: number;
};

export async function getSystemAdminEmailBreakdown(params: { from?: string; to?: string } = {}) {
  const query = buildQuery(params);
  const data = await apiRequest<Record<string, unknown>>(`/super-admin/messaging/email/breakdown${query}`);
  return normalizeBreakdown(data);
}

export async function listSystemAdminEmailEvents(params: { status?: string; page?: number; size?: number } = {}) {
  const query = buildQuery(params);
  const data = await apiRequest<Partial<SystemAdminEmailEventPage>>(`/super-admin/messaging/email/events${query}`);
  return normalizeEventPage(data, params);
}

export async function broadcastSystemAdminEmail(payload: {
  subject: string;
  htmlBody: string;
  attachments?: SystemAdminMessagingAttachment[];
}) {
  const attachments = payload.attachments || [];
  const subject = payload.subject.trim();
  const htmlBody = payload.htmlBody.trim();

  if (attachments.length) {
    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('htmlBody', htmlBody);
    attachments.forEach((attachment) => {
      formData.append('attachments', {
        uri: attachment.uri,
        name: attachment.name,
        type: attachment.mimeType || 'application/octet-stream',
      } as unknown as Blob);
    });
    const data = await apiRequest<Record<string, unknown>>('/super-admin/messaging/broadcast', {
      method: 'POST',
      body: formData,
    });
    return {
      channel: 'EMAIL',
      sent: toNumber(data.emailsSent),
      attachments: toNumber(data.attachments ?? attachments.length),
    } satisfies SystemAdminBroadcastResult;
  }

  const data = await apiRequest<Record<string, unknown>>('/super-admin/messaging/broadcast', {
    method: 'POST',
    body: { subject, htmlBody },
  });
  return {
    channel: 'EMAIL',
    sent: toNumber(data.emailsSent),
    attachments: 0,
  } satisfies SystemAdminBroadcastResult;
}

export async function broadcastSystemAdminSms(messageBody: string) {
  const data = await apiRequest<Record<string, unknown>>('/super-admin/messaging/broadcast/sms', {
    method: 'POST',
    body: { messageBody: messageBody.trim() },
  });
  return {
    channel: 'SMS',
    sent: toNumber(data.smsSent),
  } satisfies SystemAdminBroadcastResult;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

function normalizeBreakdown(data: Record<string, unknown> | null | undefined): SystemAdminEmailBreakdown {
  return Object.fromEntries(
    Object.entries(data || {})
      .map(([status, value]) => [status, toNumber(value)] as const)
      .filter(([status]) => Boolean(status)),
  );
}

function normalizeEventPage(
  data: Partial<SystemAdminEmailEventPage> | null | undefined,
  params: { page?: number; size?: number },
): SystemAdminEmailEventPage {
  const content = Array.isArray(data?.content) ? data.content.map(normalizeEvent).filter((event) => Boolean(event.id)) : [];
  return {
    content,
    totalElements: toNumber(data?.totalElements ?? content.length),
    totalPages: toNumber(data?.totalPages ?? 1),
    page: toNumber(data?.page ?? params.page ?? 0),
    size: toNumber(data?.size ?? params.size ?? content.length),
  };
}

function normalizeEvent(row: Partial<SystemAdminEmailEvent> | null | undefined): SystemAdminEmailEvent {
  const id = stringify(row?.id) || `${row?.recipientAddress || 'event'}-${row?.createdAt || 'unknown'}-${row?.status || 'status'}`;
  return {
    id,
    recipientAddress: row?.recipientAddress || 'Unknown recipient',
    status: row?.status || 'UNKNOWN',
    providerMessageId: stringify(row?.providerMessageId),
    createdAt: stringify(row?.createdAt),
    templateId: stringify(row?.templateId),
    associationId: stringify(row?.associationId),
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
