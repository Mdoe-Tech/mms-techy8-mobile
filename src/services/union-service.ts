import { apiBinaryRequest, apiRequest } from '@/api/client';
import { getPublicAssociationConfig, updateAssociationConfig, type AssociationConfig } from '@/services/association-service';

export type UnionDeductionMember = {
  id: string;
  fullLegalName?: string | null;
  membershipNumber?: string | null;
};

export type UnionDeduction = {
  id: string;
  member?: UnionDeductionMember | null;
  amount: number;
  deductionPeriod?: string | null;
  createdAt?: string | null;
};

export type UnionDeductionCalendar = {
  memberId: string;
  memberName?: string | null;
  year: number;
  calendarData: Record<string, number>;
  totalDeductions: number;
};

export type UnionMemberStatusAtPeriod = {
  memberId: string;
  fullLegalName?: string | null;
  membershipNumber?: string | null;
  statusAtMonth?: string | null;
  currentStatus?: string | null;
};

export type UnionSettings = {
  enabled: boolean;
  rate: number;
  rawSettings: Record<string, unknown>;
  config?: AssociationConfig | null;
};

export type UnionSettingsPayload = {
  enabled: boolean;
  rate: number;
};

export type UnionDeductionUploadFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export type UnionDeductionUploadHistory = {
  id: string;
  status: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errorDetails?: string | null;
  startTime?: string | null;
  completionTime?: string | null;
  originalFilename?: string | null;
  periodYear?: number | null;
  periodMonth?: number | null;
};

export const UNION_DEDUCTION_ENABLED_KEY = 'union.deduction.percent.enabled';
export const UNION_DEDUCTION_RATE_KEY = 'union.deduction.percent.rate';

export async function getUnionSettings(associationId: string): Promise<UnionSettings> {
  const config = await getPublicAssociationConfig(associationId);
  const rawSettings = normalizeInnerSettings(config?.settings);
  return {
    enabled: toBoolean(rawSettings[UNION_DEDUCTION_ENABLED_KEY]),
    rate: toAmount(rawSettings[UNION_DEDUCTION_RATE_KEY]),
    rawSettings,
    config,
  };
}

export async function updateUnionSettings(
  associationId: string,
  currentSettings: Record<string, unknown>,
  payload: UnionSettingsPayload,
) {
  const nextSettings = {
    ...currentSettings,
    [UNION_DEDUCTION_ENABLED_KEY]: String(payload.enabled),
    [UNION_DEDUCTION_RATE_KEY]: payload.rate,
  };
  await updateAssociationConfig(associationId, { settings: nextSettings });
  return {
    enabled: payload.enabled,
    rate: payload.rate,
    rawSettings: nextSettings,
  } satisfies UnionSettings;
}

export async function getUnionDeductions(associationId: string) {
  const rows = await apiRequest<UnionDeduction[]>(`/unions/${encodeURIComponent(associationId)}/deductions`);
  return (rows || []).map(normalizeUnionDeduction);
}

export async function getUnionDeductionUploadHistory(associationId: string) {
  const rows = await apiRequest<UnionDeductionUploadHistory[]>(`/unions/${encodeURIComponent(associationId)}/upload-history`);
  return (rows || []).map(normalizeUploadHistory);
}

export async function getUnionDeductionUploadStatus(associationId: string, uploadId: string) {
  const row = await apiRequest<UnionDeductionUploadHistory>(
    `/unions/${encodeURIComponent(associationId)}/upload/${encodeURIComponent(uploadId)}/status`,
  );
  return normalizeUploadHistory(row, 0);
}

export async function uploadUnionDeductionFile(
  associationId: string,
  payload: { file: UnionDeductionUploadFile; year: number; month: number; override?: boolean },
) {
  const formData = new FormData();
  formData.append('file', {
    uri: payload.file.uri,
    name: payload.file.name,
    type: payload.file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } as unknown as Blob);
  formData.append('year', String(payload.year));
  formData.append('month', String(payload.month));
  formData.append('override', String(Boolean(payload.override)));

  return apiRequest<string>(`/unions/${encodeURIComponent(associationId)}/upload-deductions`, {
    method: 'POST',
    body: formData,
  });
}

export function downloadUnionDeductionUploadRecords(
  associationId: string,
  uploadId: string,
  kind: 'failed' | 'successful',
  format: 'excel' | 'pdf' = 'excel',
) {
  const segment = kind === 'failed' ? 'failed-records' : 'successful-records';
  return apiBinaryRequest(
    `/unions/${encodeURIComponent(associationId)}/upload/${encodeURIComponent(uploadId)}/${segment}?format=${encodeURIComponent(format)}`,
  );
}

export async function getMemberUnionDeductions(memberId: string) {
  const rows = await apiRequest<UnionDeduction[]>(`/unions/members/${encodeURIComponent(memberId)}/deductions`);
  return (rows || []).map(normalizeUnionDeduction);
}

export async function getMemberUnionDeductionCalendar(memberId: string, year: number) {
  const calendar = await apiRequest<UnionDeductionCalendar>(
    `/unions/members/${encodeURIComponent(memberId)}/calendar-deductions?year=${encodeURIComponent(String(year))}`,
  );
  return normalizeUnionDeductionCalendar(calendar, memberId, year);
}

export async function getUnionMemberStatusAtPeriod(associationId: string, period: string) {
  const rows = await apiRequest<UnionMemberStatusAtPeriod[]>(
    `/unions/${encodeURIComponent(associationId)}/member-status?period=${encodeURIComponent(period)}`,
  );
  return (rows || []).map(normalizeMemberStatusAtPeriod);
}

export async function disableUnionDeductions(associationId: string, deductionIds: string[]) {
  return apiRequest<string>(`/unions/${encodeURIComponent(associationId)}/deductions/disable`, {
    method: 'POST',
    body: deductionIds,
  });
}

export async function deleteUnionDeductions(associationId: string, deductionIds: string[]) {
  return apiRequest<string>(`/unions/${encodeURIComponent(associationId)}/deductions/delete`, {
    method: 'POST',
    body: deductionIds,
  });
}

function normalizeUnionDeduction(row: Partial<UnionDeduction> | null | undefined, index: number): UnionDeduction {
  return {
    id: String(row?.id || `union-deduction-${index}`),
    member: row?.member
      ? {
          id: String(row.member.id || ''),
          fullLegalName: row.member.fullLegalName || null,
          membershipNumber: row.member.membershipNumber || null,
        }
      : null,
    amount: toAmount(row?.amount),
    deductionPeriod: row?.deductionPeriod || null,
    createdAt: row?.createdAt || null,
  };
}

function normalizeUploadHistory(
  row: Partial<UnionDeductionUploadHistory> | null | undefined,
  index: number,
): UnionDeductionUploadHistory {
  return {
    id: String(row?.id || `upload-${index}`),
    status: String(row?.status || 'UNKNOWN'),
    totalRecords: toAmount(row?.totalRecords),
    successfulRecords: toAmount(row?.successfulRecords),
    failedRecords: toAmount(row?.failedRecords),
    errorDetails: row?.errorDetails || null,
    startTime: row?.startTime || null,
    completionTime: row?.completionTime || null,
    originalFilename: row?.originalFilename || null,
    periodYear: row?.periodYear === null || row?.periodYear === undefined ? null : toAmount(row.periodYear),
    periodMonth: row?.periodMonth === null || row?.periodMonth === undefined ? null : toAmount(row.periodMonth),
  };
}

function normalizeUnionDeductionCalendar(
  row: Partial<UnionDeductionCalendar> | null | undefined,
  memberId: string,
  year: number,
): UnionDeductionCalendar {
  const calendarData = Object.entries(row?.calendarData || {}).reduce<Record<string, number>>((acc, [date, amount]) => {
    acc[date] = toAmount(amount);
    return acc;
  }, {});
  return {
    memberId: String(row?.memberId || memberId),
    memberName: row?.memberName || null,
    year: Number(row?.year || year),
    calendarData,
    totalDeductions: toAmount(row?.totalDeductions),
  };
}

function normalizeMemberStatusAtPeriod(row: Partial<UnionMemberStatusAtPeriod> | null | undefined): UnionMemberStatusAtPeriod {
  return {
    memberId: String(row?.memberId || ''),
    fullLegalName: row?.fullLegalName || null,
    membershipNumber: row?.membershipNumber || null,
    statusAtMonth: row?.statusAtMonth || null,
    currentStatus: row?.currentStatus || null,
  };
}

function toAmount(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeInnerSettings(settings?: Record<string, unknown> | null): Record<string, unknown> {
  if (!settings || typeof settings !== 'object') return {};
  const nested = settings.settings;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return settings;
}

function toBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  return String(value ?? 'false').toLowerCase() === 'true';
}
