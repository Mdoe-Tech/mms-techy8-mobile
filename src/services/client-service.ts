import { apiEnvelopeRequest, apiRequest } from '@/api/client';

export type AssociationClient = {
  id: string;
  associationId?: string | null;
  name: string;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  tin?: string | null;
  vrn?: string | null;
  contactPersonName?: string | null;
  notes?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AssociationClientPayload = {
  name: string;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  tin?: string | null;
  vrn?: string | null;
  status?: string | null;
};

export type AssociationClientPage = {
  clients: AssociationClient[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export async function getAssociationClients(
  filters: { page?: number; size?: number; query?: string; sort?: string } = {},
): Promise<AssociationClientPage> {
  const query = new URLSearchParams();
  query.set('page', String(filters.page ?? 0));
  query.set('size', String(filters.size ?? 100));
  query.set('sort', filters.sort || 'name,asc');
  if (filters.query?.trim()) query.set('query', filters.query.trim());

  const response = await apiEnvelopeRequest<unknown>(`/clients?${query.toString()}`);
  return normalizeClientPage(response.data, filters.size ?? 100);
}

export async function createAssociationClient(payload: AssociationClientPayload) {
  const client = await apiRequest<AssociationClient>('/clients', {
    method: 'POST',
    body: payload,
  });
  return normalizeClient(client);
}

export async function updateAssociationClient(clientId: string, payload: AssociationClientPayload) {
  const client = await apiRequest<AssociationClient>(`/clients/${encodeURIComponent(clientId)}`, {
    method: 'PUT',
    body: payload,
  });
  return normalizeClient(client);
}

export function deleteAssociationClient(clientId: string) {
  return apiRequest<void>(`/clients/${encodeURIComponent(clientId)}`, {
    method: 'DELETE',
  });
}

function normalizeClientPage(payload: unknown, fallbackSize: number): AssociationClientPage {
  const page = payload as {
    content?: AssociationClient[];
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

  const clients = (Array.isArray(page?.content) ? page.content : []).map(normalizeClient);
  const metadata = page?.page;
  return {
    clients,
    page: Number(metadata?.number ?? page?.number ?? 0),
    size: Number(metadata?.size ?? page?.size ?? fallbackSize),
    totalElements: Number(metadata?.totalElements ?? page?.totalElements ?? clients.length),
    totalPages: Number(metadata?.totalPages ?? page?.totalPages ?? 1),
  };
}

function normalizeClient(client: AssociationClient): AssociationClient {
  return {
    ...client,
    name: client.name || 'Unnamed client',
    status: client.status || 'ACTIVE',
  };
}
