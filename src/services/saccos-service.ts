import { apiRequest } from '@/api/client';

export type SaccosSavingsMemberRow = {
  memberId: string;
  membershipNumber?: string | null;
  memberName?: string | null;
  shareCount?: number | string | null;
  shareValue?: number | string | null;
  savingsInPeriod?: number | string | null;
  totalSavingsAsOfEndDate?: number | string | null;
};

export type SaccosSavingsReport = {
  associationId: string;
  associationName?: string | null;
  startDate: string;
  endDate: string;
  totalSavingsInPeriod?: number | string | null;
  totalSavingsAsOfEndDate?: number | string | null;
  totalShareCount?: number | string | null;
  totalShareValue?: number | string | null;
  members?: SaccosSavingsMemberRow[] | null;
};

export function getSaccosSavingsReport(associationId: string, startDate: string, endDate: string) {
  const query = new URLSearchParams({ associationId, startDate, endDate });
  return apiRequest<SaccosSavingsReport>(`/saccos-savings/report?${query.toString()}`);
}
