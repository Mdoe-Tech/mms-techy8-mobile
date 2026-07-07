import { apiRequest } from '@/api/client';

export type SystemAdminAuditEvent = {
  id: string;
  timestamp?: string | null;
  userEmail?: string | null;
  systemRole?: string | null;
  method?: string | null;
  path?: string | null;
  httpMethod?: string | null;
  durationMs: number;
  success: boolean;
  error?: string | null;
  clientIp?: string | null;
};

export async function listSystemAdminAuditEvents(limit = 200) {
  const boundedLimit = Math.max(1, Math.min(1000, Math.round(limit)));
  const rows = await apiRequest<Partial<SystemAdminAuditEvent>[]>(`/super-admin/audit/events?limit=${boundedLimit}`);
  return Array.isArray(rows) ? rows.map(normalizeAuditEvent).filter((event) => Boolean(event.id)) : [];
}

function normalizeAuditEvent(row: Partial<SystemAdminAuditEvent> | null | undefined, index: number): SystemAdminAuditEvent {
  const timestamp = stringify(row?.timestamp);
  const method = stringify(row?.method);
  const userEmail = stringify(row?.userEmail);
  return {
    id: `${timestamp || 'time'}-${method || 'method'}-${userEmail || 'user'}-${index}`,
    timestamp,
    userEmail,
    systemRole: stringify(row?.systemRole),
    method,
    path: stringify(row?.path),
    httpMethod: stringify(row?.httpMethod),
    durationMs: toNumber(row?.durationMs),
    success: row?.success === true,
    error: stringify(row?.error),
    clientIp: stringify(row?.clientIp),
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
