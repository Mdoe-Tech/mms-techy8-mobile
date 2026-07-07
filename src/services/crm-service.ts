import { apiEnvelopeRequest, apiRequest } from '@/api/client';

export type CampaignType = 'EMAIL' | 'SMS' | 'WHATSAPP' | string;
export type CampaignStatus = 'DRAFT' | 'SENDING' | 'COMPLETED' | 'FAILED' | string;

export type CrmCampaign = {
  id: string;
  name: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  targetCriteria?: string | null;
  emailSubject?: string | null;
  emailHtmlBody?: string | null;
  smsMessageBody?: string | null;
  associationId?: string | null;
  associationName?: string | null;
  totalRecipientsCalculated?: number | null;
  totalSent?: number | null;
  totalFailed?: number | null;
  createdById?: string | null;
  createdByFullName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  scheduledAt?: string | null;
  scheduleTimezone?: string | null;
  quietHoursEnabled?: boolean | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
};

export type CrmCampaignPayload = {
  name: string;
  campaignType: CampaignType;
  associationId: string;
  targetCriteriaString: string;
  targetCriteriaJson?: string | null;
  selectedMemberIds?: string[];
  excludedMemberIds?: string[];
  scheduledAt?: string | null;
  scheduleTimezone?: string | null;
  emailSubject?: string | null;
  emailHtmlBody?: string | null;
  smsMessageBody?: string | null;
  quietHoursEnabled?: boolean | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
};

export type CrmCampaignPage = {
  campaigns: CrmCampaign[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type CrmCampaignReport = {
  totalLogs: number;
  delivered: number;
  bounced: number;
  failedToSend: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  deferred: number;
};

export type CrmMemberPreview = {
  id: string;
  fullLegalName: string;
  membershipNumber?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
};

export async function getCrmCampaigns(
  associationId: string,
  filters: { page?: number; size?: number; status?: string; search?: string; sort?: string } = {},
): Promise<CrmCampaignPage> {
  const query = new URLSearchParams();
  query.set('page', String(filters.page ?? 0));
  query.set('size', String(filters.size ?? 25));
  query.set('sort', filters.sort || 'createdAt,desc');
  if (filters.status && filters.status !== 'ALL') query.set('status', filters.status);
  if (filters.search?.trim()) query.set('search', filters.search.trim());

  const response = await apiEnvelopeRequest<unknown>(`/crm/campaigns/association/${associationId}?${query.toString()}`);
  const payload = response as unknown as {
    data?: unknown;
    page?: number;
    size?: number;
    totalElements?: number;
    totalPages?: number;
  };
  const campaigns = extractList<CrmCampaign>(payload.data).map(normalizeCampaign);
  return {
    campaigns,
    page: Number(payload.page ?? filters.page ?? 0),
    size: Number(payload.size ?? filters.size ?? campaigns.length),
    totalElements: Number(payload.totalElements ?? campaigns.length),
    totalPages: Number(payload.totalPages ?? 1),
  };
}

export async function getCrmCampaign(campaignId: string) {
  const campaign = await apiRequest<CrmCampaign>(`/crm/campaigns/${campaignId}`);
  return normalizeCampaign(campaign);
}

export async function createCrmCampaign(payload: CrmCampaignPayload) {
  const campaign = await apiRequest<CrmCampaign>('/crm/campaigns', {
    method: 'POST',
    body: payload,
  });
  return normalizeCampaign(campaign);
}

export async function updateCrmCampaign(campaignId: string, payload: CrmCampaignPayload) {
  const campaign = await apiRequest<CrmCampaign>(`/crm/campaigns/${campaignId}`, {
    method: 'PUT',
    body: payload,
  });
  return normalizeCampaign(campaign);
}

export function deleteCrmCampaign(campaignId: string) {
  return apiRequest<void>(`/crm/campaigns/${campaignId}`, {
    method: 'DELETE',
  });
}

export async function launchCrmCampaign(campaignId: string) {
  const campaign = await apiRequest<CrmCampaign>(`/crm/campaigns/${campaignId}/launch`, {
    method: 'POST',
  });
  return normalizeCampaign(campaign);
}

export async function stopCrmCampaign(campaignId: string) {
  const campaign = await apiRequest<CrmCampaign>(`/crm/campaigns/${campaignId}/stop`, {
    method: 'POST',
  });
  return normalizeCampaign(campaign);
}

export async function relaunchCrmCampaign(campaignId: string) {
  const campaign = await apiRequest<CrmCampaign>(`/crm/campaigns/${campaignId}/relaunch`, {
    method: 'POST',
  });
  return normalizeCampaign(campaign);
}

export function getCrmCampaignReport(campaignId: string) {
  return apiRequest<CrmCampaignReport>(`/crm/campaigns/${campaignId}/report`);
}

export async function previewCrmCampaignTargets(payload: CrmCampaignPayload, page = 0, size = 10) {
  const response = await apiEnvelopeRequest<unknown>(`/crm/campaigns/preview?page=${page}&size=${size}`, {
    method: 'POST',
    body: payload,
  });
  const envelope = response as unknown as { data?: unknown; totalElements?: number };
  return {
    members: extractList<CrmMemberPreview>(envelope.data),
    totalElements: Number(envelope.totalElements ?? extractList<CrmMemberPreview>(envelope.data).length),
  };
}

function normalizeCampaign(campaign: CrmCampaign): CrmCampaign {
  return {
    ...campaign,
    name: campaign.name || 'Untitled campaign',
    campaignType: campaign.campaignType || 'SMS',
    status: campaign.status || 'DRAFT',
    targetCriteria: campaign.targetCriteria || 'ALL_IN_ASSOCIATION:true',
    totalRecipientsCalculated: toNumber(campaign.totalRecipientsCalculated),
    totalSent: toNumber(campaign.totalSent),
    totalFailed: toNumber(campaign.totalFailed),
  };
}

function toNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return 0;
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function extractList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const data = payload as {
    content?: T[];
    data?: T[] | { content?: T[] };
  } | null;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.content)) return data.data.content;
  return [];
}
