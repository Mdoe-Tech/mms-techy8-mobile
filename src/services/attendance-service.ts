import { apiRequest } from '@/api/client';

export type AttendanceRecord = {
  meetingId: string;
  meetingTitle?: string | null;
  meetingDate?: string | null;
  attended: boolean;
};

export type MemberAttendance = {
  memberId: string;
  memberName?: string | null;
  memberEmail?: string | null;
  membershipNumber?: string | null;
  totalMeetings?: number | null;
  meetingsAttended?: number | null;
  meetingsMissed?: number | null;
  attendanceRate?: number | null;
  attendanceRecords?: AttendanceRecord[] | null;
};

export type MeetingSummary = {
  meetingId: string;
  meetingTitle: string;
  meetingDate?: string | null;
  totalMembers: number;
  presentCount: number;
  absentCount: number;
};

export type AttendanceRequest = {
  memberId: string;
  attended: boolean;
};

export type MeetingRequest = {
  title: string;
  meetingDate: string;
  description?: string;
  notifyMembers?: boolean;
};

export type MeetingResponse = {
  id: string;
  title?: string | null;
  meetingDate?: string | null;
  associationId?: string | null;
  description?: string | null;
};

export type FineGenerationResult = {
  associationId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  totalMeetingsScheduled?: number | null;
  memberFines?: MemberFineDetail[] | null;
};

export type MemberFineDetail = {
  memberId?: string | null;
  memberName?: string | null;
  memberEmail?: string | null;
  meetingsMissed?: number | null;
  fineAmount?: number | null;
  fineDate?: string | null;
  dueDate?: string | null;
  missedMeetings?: {
    meetingId?: string | null;
    meetingTitle?: string | null;
    meetingDate?: string | null;
  }[] | null;
};

export async function getMembersWithAttendance(
  associationId: string,
  params: { startDate: string; endDate: string },
) {
  const query = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const rows = await apiRequest<MemberAttendance[]>(
    `/meeting-attendance/associations/${associationId}?${query.toString()}`,
  );
  return normalizeAttendanceRows(rows);
}

export async function updateMeetingAttendance(meetingId: string, memberId: string, attended: boolean) {
  const query = new URLSearchParams({ attended: String(attended) });
  return apiRequest<unknown>(`/meeting-attendance/meetings/${meetingId}/members/${memberId}?${query.toString()}`, {
    method: 'PUT',
  });
}

export async function deleteMeetingWithAttendance(meetingId: string) {
  return apiRequest<void>(`/meeting-attendance/meetings/${meetingId}`, {
    method: 'DELETE',
  });
}

export async function createMeeting(associationId: string, payload: MeetingRequest) {
  return apiRequest<MeetingResponse>(`/meeting-attendance/associations/${associationId}/meetings`, {
    method: 'POST',
    body: payload,
  });
}

export async function batchRecordAttendance(meetingId: string, records: AttendanceRequest[]) {
  return apiRequest<void>(`/meeting-attendance/meetings/${meetingId}/batch-record`, {
    method: 'POST',
    body: records,
  });
}

export async function generateMeetingFines(
  associationId: string,
  params: {
    checkDate: string;
    checkMode?: 'LAST_FREQUENCY' | 'EXACT_DATE' | 'DATE_RANGE';
    startDate?: string;
    endDate?: string;
  },
) {
  const query = new URLSearchParams({
    checkDate: params.checkDate,
    checkMode: params.checkMode || 'LAST_FREQUENCY',
  });
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);

  return apiRequest<FineGenerationResult>(`/meeting-attendance/associations/${associationId}/generate-fines?${query.toString()}`, {
    method: 'POST',
    body: {},
  });
}

export function buildMeetingSummaries(rows: MemberAttendance[]): MeetingSummary[] {
  const meetings = new Map<string, MeetingSummary>();

  rows.forEach((member) => {
    (member.attendanceRecords || []).forEach((record) => {
      if (!record.meetingId) return;
      const current = meetings.get(record.meetingId) || {
        meetingId: record.meetingId,
        meetingTitle: record.meetingTitle || 'Untitled meeting',
        meetingDate: record.meetingDate,
        totalMembers: 0,
        presentCount: 0,
        absentCount: 0,
      };
      current.totalMembers += 1;
      if (record.attended) current.presentCount += 1;
      else current.absentCount += 1;
      meetings.set(record.meetingId, current);
    });
  });

  return Array.from(meetings.values()).sort((left, right) => {
    const leftTime = new Date(left.meetingDate || '').getTime() || 0;
    const rightTime = new Date(right.meetingDate || '').getTime() || 0;
    return rightTime - leftTime;
  });
}

export function attendanceBand(rate?: number | null) {
  const value = Number(rate || 0);
  if (value >= 90) return 'excellent';
  if (value >= 75) return 'good';
  if (value >= 50) return 'watch';
  return 'low';
}

function normalizeAttendanceRows(rows?: MemberAttendance[] | null) {
  return (rows || []).map((row) => {
    const records = row.attendanceRecords || [];
    const meetingsAttended = Number(row.meetingsAttended ?? records.filter((record) => record.attended).length);
    const totalMeetings = Number(row.totalMeetings ?? records.length);
    const meetingsMissed = Number(row.meetingsMissed ?? Math.max(totalMeetings - meetingsAttended, 0));
    const attendanceRate = Number(row.attendanceRate ?? (totalMeetings > 0 ? (meetingsAttended * 100) / totalMeetings : 0));

    return {
      ...row,
      memberName: row.memberName || 'Unknown member',
      memberEmail: row.memberEmail || '',
      membershipNumber: row.membershipNumber || '',
      totalMeetings,
      meetingsAttended,
      meetingsMissed,
      attendanceRate,
      attendanceRecords: records,
    };
  });
}
