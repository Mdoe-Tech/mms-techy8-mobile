import { router } from 'expo-router';
import {
  BarChart3,
  CalendarDays,
  ListChecks,
  RefreshCw,
  Trash2,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileFilterControls,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileReportExportButton,
  MobileScreen,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  attendanceBand,
  buildMeetingSummaries,
  deleteMeetingWithAttendance,
  getMembersWithAttendance,
  updateMeetingAttendance,
  type AttendanceRecord,
  type MeetingSummary,
  type MemberAttendance,
} from '@/services/attendance-service';
import { getRouteByPath } from '@/navigation/route-registry';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatPercent, initialsFromName } from '@/utils/format';

type ViewMode = 'members' | 'meetings';
type AttendanceFilter = 'all' | 'excellent' | 'good' | 'watch' | 'low';
type SortOption = 'memberAsc' | 'rateDesc' | 'rateAsc' | 'missedDesc' | 'meetingsDesc' | 'meetingDateDesc' | 'meetingDateAsc';
type AttendanceExportRow = {
  recordType: string;
  name: string;
  reference: string;
  totalRecords: number;
  present: number;
  absent: number;
  attendanceRate: string;
};

type PendingUpdate = {
  member: MemberAttendance;
  record: AttendanceRecord;
  nextAttended: boolean;
};

const sortOptions = [
  { value: 'memberAsc', label: 'Member number', description: 'Sort members by membership number.' },
  { value: 'rateDesc', label: 'Highest attendance', description: 'Best attendance rates first.' },
  { value: 'rateAsc', label: 'Lowest attendance', description: 'Members needing attention first.' },
  { value: 'missedDesc', label: 'Most missed', description: 'Highest missed meeting count first.' },
  { value: 'meetingsDesc', label: 'Most records', description: 'Members with the most captured records first.' },
  { value: 'meetingDateDesc', label: 'Newest meeting', description: 'Latest captured meetings first.' },
  { value: 'meetingDateAsc', label: 'Oldest meeting', description: 'Earliest captured meetings first.' },
];

export default function MobileAttendanceScreen() {
  const { activeView, associationId, user } = useAuth();
  const [members, setMembers] = useState<MemberAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('members');
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('all');
  const [sortValue, setSortValue] = useState<SortOption>('memberAsc');
  const [sortOpen, setSortOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => getDateOffset(-30));
  const [endDate, setEndDate] = useState(() => getDateOffset(0));
  const [appliedRange, setAppliedRange] = useState(() => ({ startDate: getDateOffset(-30), endDate: getDateOffset(0) }));
  const [selectedMember, setSelectedMember] = useState<MemberAttendance | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingSummary | null>(null);
  const [meetingToDelete, setMeetingToDelete] = useState<MeetingSummary | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);

  const loadAttendance = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial', range = appliedRange) => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading attendance.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);

      try {
        const rows = await getMembersWithAttendance(associationId, range);
        setMembers(rows);
      } catch (loadError) {
        setMembers([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedRange, associationId],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadAttendance();
    });
    return () => {
      active = false;
    };
  }, [loadAttendance]);

  const meetings = useMemo(() => sortMeetings(buildMeetingSummaries(members), sortValue), [members, sortValue]);
  const totalMembers = members.length;
  const averageRate = totalMembers > 0 ? members.reduce((sum, member) => sum + toNumber(member.attendanceRate), 0) / totalMembers : 0;
  const perfectAttendance = members.filter((member) => toNumber(member.attendanceRate) === 100).length;
  const lowAttendance = members.filter((member) => toNumber(member.attendanceRate) < 50).length;
  const totalPresent = members.reduce((sum, member) => sum + toNumber(member.meetingsAttended), 0);
  const totalMissed = members.reduce((sum, member) => sum + toNumber(member.meetingsMissed), 0);

  const bandCounts = useMemo(() => {
    const counts = { excellent: 0, good: 0, watch: 0, low: 0 };
    members.forEach((member) => {
      counts[attendanceBand(member.attendanceRate) as keyof typeof counts] += 1;
    });
    return counts;
  }, [members]);

  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = members.filter((member) => {
      const matchesBand = attendanceFilter === 'all' || attendanceBand(member.attendanceRate) === attendanceFilter;
      const haystack = [member.memberName, member.memberEmail, member.membershipNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesBand && (!query || haystack.includes(query));
    });
    return sortMembers(rows, sortValue);
  }, [attendanceFilter, members, searchTerm, sortValue]);

  const filteredMeetings = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return meetings.filter((meeting) => {
      const haystack = [meeting.meetingTitle, formatDate(meeting.meetingDate), String(meeting.presentCount), String(meeting.absentCount)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [meetings, searchTerm]);

  const currentItems = useMemo<MobileDataListItem[]>(() => {
    if (viewMode === 'meetings') {
      return filteredMeetings.map((meeting) => {
        const rate = meeting.totalMembers > 0 ? (meeting.presentCount * 100) / meeting.totalMembers : 0;
        return {
          id: meeting.meetingId,
          title: meeting.meetingTitle,
          subtitle: `${formatDate(meeting.meetingDate)} · ${meeting.totalMembers} member records`,
          meta: `${meeting.presentCount} present · ${meeting.absentCount} absent`,
          amount: formatPercent(rate),
          status: meeting.absentCount > 0 ? 'Needs review' : 'Complete',
          statusTone: meeting.absentCount > 0 ? 'warning' : 'success',
          initials: 'MT',
          accent: meeting.absentCount > 0 ? 'warning' : 'success',
        };
      });
    }

    return filteredMembers.map((member) => {
      const rate = toNumber(member.attendanceRate);
      const band = attendanceBand(rate);
      return {
        id: member.memberId,
        title: member.memberName || 'Unknown member',
        subtitle: `${member.membershipNumber || 'No member number'} · ${member.memberEmail || 'No email'}`,
        meta: `${toNumber(member.meetingsAttended)} present · ${toNumber(member.meetingsMissed)} missed`,
        amount: formatPercent(rate),
        status: bandLabel(band),
        statusTone: toneForBand(band),
        initials: initialsFromName(member.memberName || 'Member'),
        accent: toneForBand(band),
      };
    });
  }, [filteredMeetings, filteredMembers, viewMode]);

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: members.length },
      { value: 'excellent', label: 'Excellent', count: bandCounts.excellent },
      { value: 'good', label: 'Good', count: bandCounts.good },
      { value: 'watch', label: 'Watch', count: bandCounts.watch },
      { value: 'low', label: 'Low', count: bandCounts.low },
    ],
    [bandCounts, members.length],
  );

  const applyDateRange = () => {
    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before end date.');
      return;
    }
    const nextRange = { startDate, endDate };
    setAppliedRange(nextRange);
    void loadAttendance('refresh', nextRange);
  };

  const refresh = () => {
    void loadAttendance('refresh');
  };

  const onPressItem = (item: MobileDataListItem) => {
    if (viewMode === 'meetings') {
      setSelectedMeeting(meetings.find((meeting) => meeting.meetingId === item.id) || null);
      return;
    }
    setSelectedMember(members.find((member) => member.memberId === item.id) || null);
  };

  const confirmAttendanceUpdate = (member: MemberAttendance, record: AttendanceRecord) => {
    setPendingUpdate({
      member,
      record,
      nextAttended: !record.attended,
    });
  };

  const applyAttendanceUpdate = async () => {
    if (!pendingUpdate) return;
    const { member, record, nextAttended } = pendingUpdate;
    const key = `${member.memberId}:${record.meetingId}`;
    setUpdatingKey(key);
    setNotice(null);

    try {
      await updateMeetingAttendance(record.meetingId, member.memberId, nextAttended);
      setMembers((current) => applyAttendancePatch(current, member.memberId, record.meetingId, nextAttended));
      setSelectedMember((current) => {
        if (!current || current.memberId !== member.memberId) return current;
        return applyAttendancePatch([current], member.memberId, record.meetingId, nextAttended)[0] || current;
      });
      setNotice(`${member.memberName || 'Member'} marked ${nextAttended ? 'present' : 'absent'} for ${record.meetingTitle || 'the meeting'}.`);
      setPendingUpdate(null);
    } catch (updateError) {
      setError(getApiErrorMessage(updateError));
    } finally {
      setUpdatingKey(null);
    }
  };

  const applyMeetingDelete = async () => {
    if (!meetingToDelete) return;
    setDeletingMeetingId(meetingToDelete.meetingId);
    setNotice(null);
    try {
      await deleteMeetingWithAttendance(meetingToDelete.meetingId);
      setMembers((current) => removeMeetingFromRows(current, meetingToDelete.meetingId));
      setNotice(`${meetingToDelete.meetingTitle} was deleted and can be recorded again.`);
      setMeetingToDelete(null);
      setSelectedMeeting(null);
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setDeletingMeetingId(null);
    }
  };

  const goToRecordAttendance = () => {
    const route = getRouteByPath('/associations/attendance/record-attendance');
    if (route) {
      router.push({ pathname: '/work/route-preview', params: { routeId: route.id } } as never);
    }
  };

  const attendanceReportRows = useMemo<AttendanceExportRow[]>(
    () =>
      viewMode === 'meetings'
        ? filteredMeetings.map((meeting) => {
          const rate = meeting.totalMembers > 0 ? (meeting.presentCount * 100) / meeting.totalMembers : 0;
          return {
            recordType: 'Meeting',
            name: meeting.meetingTitle,
            reference: formatDate(meeting.meetingDate),
            totalRecords: meeting.totalMembers,
            present: meeting.presentCount,
            absent: meeting.absentCount,
            attendanceRate: formatPercent(rate),
          };
        })
        : filteredMembers.map((member) => ({
          recordType: 'Member',
          name: member.memberName || 'Unknown member',
          reference: member.membershipNumber || member.memberEmail || '-',
          totalRecords: toNumber(member.totalMeetings),
          present: toNumber(member.meetingsAttended),
          absent: toNumber(member.meetingsMissed),
          attendanceRate: formatPercent(toNumber(member.attendanceRate)),
        })),
    [filteredMeetings, filteredMembers, viewMode],
  );

  const attendanceReportOptions = useMemo(
    () => ({
      title: viewMode === 'meetings' ? 'Meeting Attendance Report' : 'Member Attendance Report',
      associationName: user?.associationName || 'Association',
      purpose: 'A filtered attendance report for the selected period, including attendance counts and attendance rate.',
      rows: attendanceReportRows,
      fileName: `nane-attendance-${viewMode}`,
      metrics: [
        { label: 'Members', value: formatNumber(totalMembers), helper: 'With attendance records' },
        { label: 'Average rate', value: formatPercent(averageRate), helper: 'Selected period' },
        { label: 'Meetings', value: formatNumber(meetings.length), helper: 'Captured meetings' },
        { label: 'Low attendance', value: formatNumber(lowAttendance), helper: 'Below 50%' },
      ],
      filters: [
        { label: 'Period', value: `${formatDate(appliedRange.startDate)} - ${formatDate(appliedRange.endDate)}` },
        { label: 'View', value: viewMode === 'meetings' ? 'Meetings' : 'Members' },
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Attendance band', value: attendanceFilter === 'all' ? 'All' : bandLabel(attendanceFilter) },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: AttendanceExportRow, index: number) => index + 1 },
        { key: 'recordType', label: 'Type', width: '10%' },
        { key: 'name', label: 'Name', width: '24%' },
        { key: 'reference', label: viewMode === 'meetings' ? 'Meeting Date' : 'Member Ref', width: '18%' },
        { key: 'totalRecords', label: 'Total', align: 'right' as const, width: '10%' },
        { key: 'present', label: 'Present', align: 'right' as const, width: '10%' },
        { key: 'absent', label: 'Absent', align: 'right' as const, width: '10%' },
        { key: 'attendanceRate', label: 'Rate', align: 'right' as const, width: '13%' },
      ],
    }),
    [appliedRange.endDate, appliedRange.startDate, attendanceFilter, attendanceReportRows, averageRate, lowAttendance, meetings.length, searchTerm, sortValue, totalMembers, user?.associationName, viewMode],
  );

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Attendance management is available from the association admin workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading attendance records" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Attendance"
        eyebrow="Community"
        subtitle={`${formatDate(appliedRange.startDate)} - ${formatDate(appliedRange.endDate)}`}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh attendance" onPress={refresh} disabled={refreshing} />}
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members" value={formatNumber(totalMembers)} description="With attendance records" icon={Users} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Average Rate" value={formatPercent(averageRate)} description="Selected period" icon={BarChart3} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Meetings" value={formatNumber(meetings.length)} description="Captured meetings" icon={CalendarDays} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Low Attendance" value={formatNumber(lowAttendance)} description="Below 50%" icon={UserX} tone={lowAttendance > 0 ? 'red' : 'slate'} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {notice ? (
        <MobileCard compact accent="green">
          <MobileText variant="small" weight="bold">
            {notice}
          </MobileText>
        </MobileCard>
      ) : null}

      {error ? <MobileErrorState title="Attendance issue" description={error} onRetry={refresh} retryLabel="Reload" /> : null}

      <MobileCard compact>
        <View style={styles.modeHeader}>
          <MobileStatusTabs
            value={viewMode}
            onChange={(value) => setViewMode(value as ViewMode)}
            tabs={[
              { value: 'members', label: 'Members', count: filteredMembers.length },
              { value: 'meetings', label: 'Meetings', count: filteredMeetings.length },
            ]}
          />
          <MobileButton label="Record" size="sm" onPress={goToRecordAttendance} />
        </View>
      </MobileCard>

      <MobileFilterControls
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={viewMode === 'meetings' ? 'Search meetings...' : 'Search members...'}
        onFilterPress={() => setSortOpen(true)}
        filterLabel="Sort"
        tabs={viewMode === 'members' ? statusTabs : undefined}
        value={attendanceFilter}
        onChange={(value) => setAttendanceFilter(value as AttendanceFilter)}
        actionSlot={<MobileReportExportButton fullWidth options={attendanceReportOptions} onError={(exportError) => setError(getApiErrorMessage(exportError))} />}
      />

      {currentItems.length === 0 ? (
        <MobileEmptyState
          title={viewMode === 'meetings' ? 'No meetings found' : 'No attendance records'}
          description={
            searchTerm || attendanceFilter !== 'all'
              ? 'Adjust search, status, or date range to see records.'
              : 'No meeting attendance has been captured in this period yet.'
          }
          actionLabel="Record attendance"
          onAction={goToRecordAttendance}
        />
      ) : (
        <MobileDataList items={currentItems} onPressItem={onPressItem} />
      )}

      <MobileCard compact accent={viewMode === 'members' ? 'blue' : 'purple'}>
        <View style={styles.summaryRow}>
          <SummaryMetric label="Present" value={formatNumber(totalPresent)} tone="success" />
          <SummaryMetric label="Missed" value={formatNumber(totalMissed)} tone={totalMissed > 0 ? 'danger' : 'neutral'} />
          <SummaryMetric label="Perfect" value={formatNumber(perfectAttendance)} tone="info" />
        </View>
      </MobileCard>

      <MobileCard compact>
        <View style={styles.dateGrid}>
          <View style={styles.dateField}>
            <MobileTextInput label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
          </View>
          <View style={styles.dateField}>
            <MobileTextInput label="End date" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
          </View>
        </View>
        <View style={styles.actionRow}>
          <MobileButton label="Last 7 days" variant="secondary" size="sm" onPress={() => setQuickRange(7, setStartDate, setEndDate)} />
          <MobileButton label="Last 30 days" variant="secondary" size="sm" onPress={() => setQuickRange(30, setStartDate, setEndDate)} />
          <MobileButton label="Apply" size="sm" loading={refreshing} onPress={applyDateRange} />
        </View>
      </MobileCard>

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={viewMode === 'meetings' ? sortOptions.filter((option) => option.value.startsWith('meeting')) : sortOptions.filter((option) => !option.value.startsWith('meeting'))}
        onChange={(value) => setSortValue(value as SortOption)}
        onClose={() => setSortOpen(false)}
      />

      <MobileSheet
        visible={Boolean(selectedMember)}
        title={selectedMember?.memberName || 'Member attendance'}
        description={selectedMember?.membershipNumber || 'Review and correct meeting records'}
        onClose={() => setSelectedMember(null)}
      >
        {selectedMember ? (
          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.sheetContent}>
              <MobileKpiGrid>
                <MobileKpiGridItem>
                  <MobileKpiCard title="Rate" value={formatPercent(toNumber(selectedMember.attendanceRate))} description="Attendance rate" icon={BarChart3} tone="green" />
                </MobileKpiGridItem>
                <MobileKpiGridItem>
                  <MobileKpiCard title="Missed" value={formatNumber(toNumber(selectedMember.meetingsMissed))} description="Absent records" icon={UserX} tone={toNumber(selectedMember.meetingsMissed) > 0 ? 'red' : 'slate'} />
                </MobileKpiGridItem>
              </MobileKpiGrid>
              <MobileInfoRow label="Email" value={selectedMember.memberEmail || 'Not provided'} />
              <MobileInfoRow label="Captured records" value={`${formatNumber(toNumber(selectedMember.totalMeetings))} meetings`} helper={`${formatNumber(toNumber(selectedMember.meetingsAttended))} present, ${formatNumber(toNumber(selectedMember.meetingsMissed))} missed`} />

              {(selectedMember.attendanceRecords || []).length === 0 ? (
                <MobileEmptyState title="No meeting records" description="This member has no captured attendance in the selected period." />
              ) : (
                <View style={styles.recordList}>
                  {(selectedMember.attendanceRecords || []).map((record) => {
                    const key = `${selectedMember.memberId}:${record.meetingId}`;
                    return (
                      <MobileCard key={record.meetingId} compact accent={record.attended ? 'green' : 'red'}>
                        <View style={styles.recordHeader}>
                          <View style={styles.recordText}>
                            <MobileText variant="body" weight="bold" numberOfLines={2}>
                              {record.meetingTitle || 'Untitled meeting'}
                            </MobileText>
                            <MobileText variant="small" tone="secondary">
                              {formatDate(record.meetingDate)}
                            </MobileText>
                          </View>
                          <MobileStatusBadge status={record.attended ? 'present' : 'absent'} />
                        </View>
                        <MobileButton
                          label={record.attended ? 'Mark Absent' : 'Mark Present'}
                          variant={record.attended ? 'danger' : 'primary'}
                          size="sm"
                          loading={updatingKey === key}
                          onPress={() => confirmAttendanceUpdate(selectedMember, record)}
                        />
                      </MobileCard>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        ) : null}
      </MobileSheet>

      <MobileSheet
        visible={Boolean(selectedMeeting)}
        title={selectedMeeting?.meetingTitle || 'Meeting'}
        description={selectedMeeting ? formatDate(selectedMeeting.meetingDate) : undefined}
        onClose={() => setSelectedMeeting(null)}
      >
        {selectedMeeting ? (
          <>
            <MobileInfoRow label="Total records" value={formatNumber(selectedMeeting.totalMembers)} icon={ListChecks} />
            <MobileInfoRow label="Present" value={formatNumber(selectedMeeting.presentCount)} icon={UserCheck} status="present" />
            <MobileInfoRow label="Absent" value={formatNumber(selectedMeeting.absentCount)} icon={UserX} status={selectedMeeting.absentCount > 0 ? 'absent' : 'completed'} />
            <MobileCard compact accent="red">
              <MobileText variant="body" weight="bold">
                Delete wrongly captured meeting
              </MobileText>
              <MobileText variant="small" tone="secondary">
                This removes the full meeting attendance and cancels unpaid attendance fines tied to it.
              </MobileText>
              <MobileButton
                label="Delete meeting"
                variant="danger"
                icon={Trash2}
                loading={deletingMeetingId === selectedMeeting.meetingId}
                onPress={() => setMeetingToDelete(selectedMeeting)}
              />
            </MobileCard>
          </>
        ) : null}
      </MobileSheet>

      <MobileConfirmSheet
        visible={Boolean(meetingToDelete)}
        title="Delete meeting attendance?"
        description={
          meetingToDelete
            ? `Delete ${meetingToDelete.meetingTitle} and all captured attendance records? Unpaid attendance fines tied to this meeting will be cancelled.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setMeetingToDelete(null)}
        onConfirm={applyMeetingDelete}
      />

      <MobileConfirmSheet
        visible={Boolean(pendingUpdate)}
        title="Update attendance?"
        description={
          pendingUpdate
            ? `Mark ${pendingUpdate.member.memberName || 'this member'} ${pendingUpdate.nextAttended ? 'present' : 'absent'} for ${pendingUpdate.record.meetingTitle || 'this meeting'}?`
            : ''
        }
        confirmLabel="Update"
        destructive={pendingUpdate ? !pendingUpdate.nextAttended : false}
        onCancel={() => setPendingUpdate(null)}
        onConfirm={applyAttendanceUpdate}
      />
    </MobileScreen>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: string; tone: StatusTone }) {
  return (
    <View style={styles.summaryMetric}>
      <MobileStatusBadge label={label} tone={tone} showDot={false} />
      <MobileText variant="section" weight="bold">
        {value}
      </MobileText>
    </View>
  );
}

function getDateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function setQuickRange(days: number, setStartDate: (date: string) => void, setEndDate: (date: string) => void) {
  setStartDate(getDateOffset(-days));
  setEndDate(getDateOffset(0));
}

function toNumber(value?: number | null) {
  return Number(value || 0);
}

function bandLabel(band: string) {
  if (band === 'excellent') return 'Excellent';
  if (band === 'good') return 'Good';
  if (band === 'watch') return 'Watch';
  return 'Low';
}

function toneForBand(band: string): StatusTone {
  if (band === 'excellent') return 'success';
  if (band === 'good') return 'info';
  if (band === 'watch') return 'warning';
  return 'danger';
}

function sortMembers(rows: MemberAttendance[], sortValue: SortOption) {
  const sorted = [...rows];
  sorted.sort((left, right) => {
    if (sortValue === 'rateDesc') return toNumber(right.attendanceRate) - toNumber(left.attendanceRate);
    if (sortValue === 'rateAsc') return toNumber(left.attendanceRate) - toNumber(right.attendanceRate);
    if (sortValue === 'missedDesc') return toNumber(right.meetingsMissed) - toNumber(left.meetingsMissed);
    if (sortValue === 'meetingsDesc') return toNumber(right.totalMeetings) - toNumber(left.totalMeetings);
    return String(left.membershipNumber || left.memberName || '').localeCompare(String(right.membershipNumber || right.memberName || ''), undefined, { numeric: true });
  });
  return sorted;
}

function sortMeetings(rows: MeetingSummary[], sortValue: SortOption) {
  const sorted = [...rows];
  sorted.sort((left, right) => {
    const leftTime = new Date(left.meetingDate || '').getTime() || 0;
    const rightTime = new Date(right.meetingDate || '').getTime() || 0;
    return sortValue === 'meetingDateAsc' ? leftTime - rightTime : rightTime - leftTime;
  });
  return sorted;
}

function applyAttendancePatch(rows: MemberAttendance[], memberId: string, meetingId: string, attended: boolean) {
  return rows.map((member) => {
    if (member.memberId !== memberId) return member;
    const records = (member.attendanceRecords || []).map((record) => (
      record.meetingId === meetingId ? { ...record, attended } : record
    ));
    const meetingsAttended = records.filter((record) => record.attended).length;
    const totalMeetings = records.length;
    const meetingsMissed = Math.max(totalMeetings - meetingsAttended, 0);
    return {
      ...member,
      attendanceRecords: records,
      totalMeetings,
      meetingsAttended,
      meetingsMissed,
      attendanceRate: totalMeetings > 0 ? (meetingsAttended * 100) / totalMeetings : 0,
    };
  });
}

function removeMeetingFromRows(rows: MemberAttendance[], meetingId: string) {
  return rows.map((member) => {
    const records = (member.attendanceRecords || []).filter((record) => record.meetingId !== meetingId);
    const meetingsAttended = records.filter((record) => record.attended).length;
    const totalMeetings = records.length;
    const meetingsMissed = Math.max(totalMeetings - meetingsAttended, 0);
    return {
      ...member,
      attendanceRecords: records,
      totalMeetings,
      meetingsAttended,
      meetingsMissed,
      attendanceRate: totalMeetings > 0 ? (meetingsAttended * 100) / totalMeetings : 0,
    };
  });
}

const styles = StyleSheet.create({
  modeHeader: {
    gap: 12,
  },
  dateGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  dateField: {
    flex: 1,
    minWidth: 0,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryMetric: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  sheetScroll: {
    maxHeight: 560,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 12,
  },
  recordList: {
    gap: 10,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  recordText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
