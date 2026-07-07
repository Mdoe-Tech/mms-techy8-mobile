import { apiRequest } from '@/api/client';

export type SystemAdminJobStatus = {
  name: string;
  lastRun?: string | null;
  nextRun?: string | null;
  healthy: boolean;
  lastDurationMs: number;
  lastError?: string | null;
};

export type SystemAdminJobPage = {
  content: SystemAdminJobStatus[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export async function listSystemAdminJobs(params: { page?: number; size?: number } = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 50),
  });
  const payload = await apiRequest<unknown>(`/super-admin/jobs?${query.toString()}`);
  return normalizeJobPage(payload, params.size ?? 50);
}

function normalizeJobPage(payload: unknown, fallbackSize: number): SystemAdminJobPage {
  const record = toRecord(payload);
  const data = toRecord(record.data);
  const pageRecord = toRecord(record.page);
  const dataPageRecord = toRecord(data.page);
  const content =
    arrayValue(record.content) ||
    arrayValue(data.content) ||
    arrayValue(pageRecord.content) ||
    arrayValue(dataPageRecord.content) ||
    [];

  return {
    content: content.map((row) => normalizeJob(row as Partial<SystemAdminJobStatus>)).filter((job) => Boolean(job.name)),
    page: toNumber(record.page ?? data.page ?? pageRecord.number ?? dataPageRecord.number ?? 0),
    size: toNumber(record.size ?? data.size ?? pageRecord.size ?? dataPageRecord.size ?? fallbackSize),
    totalElements: toNumber(record.totalElements ?? data.totalElements ?? content.length),
    totalPages: toNumber(record.totalPages ?? data.totalPages ?? 1),
  };
}

function normalizeJob(job: Partial<SystemAdminJobStatus>): SystemAdminJobStatus {
  return {
    name: String(job.name || ''),
    lastRun: job.lastRun || null,
    nextRun: job.nextRun || null,
    healthy: Boolean(job.healthy),
    lastDurationMs: toNumber(job.lastDurationMs),
    lastError: job.lastError || null,
  };
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
