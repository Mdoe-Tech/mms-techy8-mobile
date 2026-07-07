import { apiRequest } from '@/api/client';

export type SmsSenderTestStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'NOT_TESTED' | string;

export type SmsSenderConfig = {
  id?: string | null;
  associationId?: string | null;
  associationName?: string | null;
  senderName?: string | null;
  fallbackSenderName?: string | null;
  enabled?: boolean | null;
  description?: string | null;
  attendancePresentTemplate?: string | null;
  attendanceAbsentTemplate?: string | null;
  lastTested?: string | null;
  testStatus?: SmsSenderTestStatus | null;
  effectiveSenderName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SmsSenderConfigPayload = {
  senderName: string;
  fallbackSenderName?: string | null;
  enabled?: boolean | null;
  description?: string | null;
  attendancePresentTemplate?: string | null;
  attendanceAbsentTemplate?: string | null;
};

export const DEFAULT_ATTENDANCE_PRESENT_TEMPLATE =
  'Dear {memberName}, your attendance for {meetingTitle} on {meetingDate} was recorded as PRESENT. Thank you. {associationName}';

export const DEFAULT_ATTENDANCE_ABSENT_TEMPLATE =
  'Dear {memberName}, your attendance for {meetingTitle} on {meetingDate} was recorded as ABSENT. A fine of {fineAmount} has been logged to your file. {associationName}';

export function getSmsSenderConfig(associationId: string) {
  return apiRequest<SmsSenderConfig>(`/sms-sender-configs/association/${encodeURIComponent(associationId)}`);
}

export function createSmsSenderConfig(associationId: string, payload: SmsSenderConfigPayload) {
  return apiRequest<SmsSenderConfig>(`/sms-sender-configs/association/${encodeURIComponent(associationId)}`, {
    method: 'POST',
    body: payload,
  });
}

export function updateSmsSenderConfig(associationId: string, payload: SmsSenderConfigPayload) {
  return apiRequest<SmsSenderConfig>(`/sms-sender-configs/association/${encodeURIComponent(associationId)}`, {
    method: 'PUT',
    body: payload,
  });
}

export function deleteSmsSenderConfig(associationId: string) {
  return apiRequest<void>(`/sms-sender-configs/association/${encodeURIComponent(associationId)}`, {
    method: 'DELETE',
  });
}

export function testSmsSenderConfig(associationId: string, testPhoneNumber: string, testMessage?: string | null) {
  const query = new URLSearchParams({
    testPhoneNumber,
    testMessage: testMessage?.trim() || 'Test message from your association',
  });
  return apiRequest<SmsSenderConfig>(`/sms-sender-configs/association/${encodeURIComponent(associationId)}/test?${query.toString()}`, {
    method: 'POST',
  });
}

export function getEffectiveSmsSenderName(associationId: string) {
  return apiRequest<string>(`/sms-sender-configs/association/${encodeURIComponent(associationId)}/effective-sender`);
}
