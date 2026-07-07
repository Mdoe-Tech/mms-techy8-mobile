import { router } from 'expo-router';
import {
  CheckCircle2,
  RefreshCw,
  Save,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileCheckboxRow,
  MobileConfirmSheet,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  batchRecordAttendance,
  createMeeting,
  type AttendanceRequest,
} from '@/services/attendance-service';
import { getAssociationMembers, type AssociationMember } from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatPercent } from '@/utils/format';

type AttendanceState = Record<string, boolean>;

export default function MobileRecordAttendanceScreen() {
  const { activeView, associationId } = useAuth();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMembers = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before recording attendance.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);

      try {
        const page = await getAssociationMembers(associationId, { size: 500, sort: 'membershipNumber,asc' });
        const activeMembers = (page.content || [])
          .filter((member) => String(member.status || '').toUpperCase() === 'ACTIVE')
          .sort((left, right) => String(left.membershipNumber || left.fullLegalName || '').localeCompare(String(right.membershipNumber || right.fullLegalName || ''), undefined, { numeric: true }));
        setMembers(activeMembers);
        setAttendance((current) => {
          const next: AttendanceState = {};
          activeMembers.forEach((member) => {
            next[member.id] = Boolean(current[member.id]);
          });
          return next;
        });
      } catch (loadError) {
        setMembers([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadMembers();
    });
    return () => {
      active = false;
    };
  }, [loadMembers]);

  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const haystack = [
        member.fullLegalName,
        member.membershipNumber,
        member.contactInfo?.email,
        member.contactInfo?.phoneNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [members, searchTerm]);

  const presentCount = useMemo(
    () => members.reduce((count, member) => count + (attendance[member.id] ? 1 : 0), 0),
    [attendance, members],
  );
  const absentCount = Math.max(members.length - presentCount, 0);
  const attendanceRate = members.length > 0 ? (presentCount * 100) / members.length : 0;
  const readyToSubmit = Boolean(meetingDate && description.trim() && presentCount > 0 && !submitting);
  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Attendance capture is available from the association admin workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message="Loading active members" />;
  }

  const setMemberAttendance = (memberId: string, attended: boolean) => {
    setAttendance((current) => ({ ...current, [memberId]: attended }));
  };

  const setVisibleAttendance = (attended: boolean) => {
    setAttendance((current) => {
      const next = { ...current };
      filteredMembers.forEach((member) => {
        next[member.id] = attended;
      });
      return next;
    });
  };

  const buildRecords = (): AttendanceRequest[] => (
    members.map((member) => ({
      memberId: member.id,
      attended: Boolean(attendance[member.id]),
    }))
  );

  const validateAndConfirm = () => {
    setError(null);
    if (!meetingDate) {
      setError('Meeting date is required.');
      return;
    }
    if (!description.trim()) {
      setError('Meeting description is required so the record can be audited later.');
      return;
    }
    if (presentCount === 0) {
      setError('Mark at least one member present before submitting attendance.');
      return;
    }
    setConfirmOpen(true);
  };

  const submitAttendance = async () => {
    if (!associationId) return;
    setSubmitting(true);
    setConfirmOpen(false);
    setError(null);
    setNotice(null);

    try {
      const meeting = await createMeeting(associationId, {
        title: `Meeting on ${formatDate(meetingDate)}`,
        meetingDate: `${meetingDate}T12:00:00`,
        description: description.trim(),
        notifyMembers: false,
      });
      await batchRecordAttendance(meeting.id, buildRecords());
      setNotice(`Attendance recorded for ${formatNumber(presentCount)} present members.`);
      const attendanceRoute = getRouteByPath('/associations/attendance');
      if (attendanceRoute) {
        router.replace({ pathname: '/work/route-preview', params: { routeId: attendanceRoute.id } } as never);
      }
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Record Attendance"
        eyebrow="Community"
        subtitle="Capture one meeting and mark members present."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh members" onPress={() => void loadMembers('refresh')} disabled={refreshing || submitting} />}
      />

      {notice ? (
        <MobileCard compact accent="green">
          <MobileText variant="small" weight="bold">
            {notice}
          </MobileText>
        </MobileCard>
      ) : null}

      {error ? <MobileErrorState title="Attendance cannot be submitted" description={error} onRetry={() => setError(null)} retryLabel="Dismiss" /> : null}

      <MobileCard compact>
        <View style={styles.formGrid}>
          <MobileTextInput label="Meeting date" value={meetingDate} onChangeText={setMeetingDate} placeholder="YYYY-MM-DD" disabled={submitting} />
          <MobileTextInput
            label="Meeting description"
            value={description}
            onChangeText={setDescription}
            placeholder="Agenda, minutes, or topic"
            helperText="Use clear wording so corrections can be audited later."
            disabled={submitting}
          />
        </View>
      </MobileCard>

      <View style={styles.toolbar}>
        <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search active members..." />
        <View style={styles.actions}>
          <MobileButton label="Mark All" variant="secondary" size="sm" onPress={() => setVisibleAttendance(true)} disabled={filteredMembers.length === 0 || submitting} />
          <MobileButton label="Clear" variant="secondary" size="sm" onPress={() => setVisibleAttendance(false)} disabled={filteredMembers.length === 0 || submitting} />
        </View>
      </View>

      {filteredMembers.length === 0 ? (
        <MobileEmptyState
          title={members.length === 0 ? 'No active members found' : 'No matching members'}
          description={members.length === 0 ? 'Add active members before recording attendance.' : 'Adjust the search term to find members.'}
          actionLabel="Refresh"
          onAction={() => void loadMembers('refresh')}
        />
      ) : (
        <View style={styles.memberList}>
          {filteredMembers.map((member) => (
            <MobileCheckboxRow
              key={member.id}
              label={member.fullLegalName || 'Unknown member'}
              description={`${member.membershipNumber || 'No member number'} · ${member.contactInfo?.email || member.contactInfo?.phoneNumber || 'No contact'}`}
              checked={Boolean(attendance[member.id])}
              onChange={(checked) => setMemberAttendance(member.id, checked)}
              disabled={submitting}
            />
          ))}
        </View>
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active Members" value={formatNumber(members.length)} description="Loaded for capture" icon={Users} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Present" value={formatNumber(presentCount)} description="Marked attended" icon={UserCheck} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Absent" value={formatNumber(absentCount)} description="Will be saved absent" icon={UserX} tone={absentCount > 0 ? 'red' : 'slate'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Rate" value={formatPercent(attendanceRate)} description="Present percentage" icon={CheckCircle2} tone="purple" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact accent={readyToSubmit ? 'green' : 'blue'}>
        <View style={styles.submitHeader}>
          <View style={styles.submitText}>
            <MobileText variant="body" weight="bold">
              {readyToSubmit ? 'Ready to record' : 'Complete meeting details'}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {readyToSubmit
                ? `${formatNumber(presentCount)} present, ${formatNumber(absentCount)} absent for ${formatDate(meetingDate)}.`
                : 'Enter a date, description, and mark at least one member present.'}
            </MobileText>
          </View>
          <MobileStatusBadge status={readyToSubmit ? 'ready' : 'pending'} label={readyToSubmit ? 'Ready' : 'Draft'} tone={readyToSubmit ? 'success' : 'warning'} />
        </View>
        <MobileButton label="Record Attendance" icon={Save} loading={submitting} disabled={!readyToSubmit} fullWidth onPress={validateAndConfirm} />
      </MobileCard>

      <MobileConfirmSheet
        visible={confirmOpen}
        title="Confirm attendance recording"
        description={`Record ${formatNumber(presentCount)} present and ${formatNumber(absentCount)} absent members for ${formatDate(meetingDate)}?`}
        confirmLabel="Record"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={submitAttendance}
      />
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  submitHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  submitText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  formGrid: {
    gap: 12,
  },
  toolbar: {
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberList: {
    gap: 10,
  },
});
