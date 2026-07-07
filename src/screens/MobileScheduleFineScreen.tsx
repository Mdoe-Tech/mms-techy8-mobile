import { router } from 'expo-router';
import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobileReportExportButton,
  MobileScreen,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  generateMeetingFines,
  type FineGenerationResult,
  type MemberFineDetail,
} from '@/services/attendance-service';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type CheckMode = 'last' | 'exact' | 'range';
type MeetingFineReportRow = {
  memberName: string;
  memberEmail: string;
  meetingsMissed: number;
  fineAmount: number;
  fineDate: string | null | undefined;
  dueDate: string | null | undefined;
  missedMeetings: string;
};

const modeTabs = [
  { value: 'last', label: 'Last period' },
  { value: 'exact', label: 'Exact date' },
  { value: 'range', label: 'Date range' },
];

export default function MobileScheduleFineScreen() {
  const { activeView, associationId, user } = useAuth();
  const [mode, setMode] = useState<CheckMode>('last');
  const [checkDate, setCheckDate] = useState(() => `${new Date().toISOString().split('T')[0]}T12:00:00`);
  const [exactDate, setExactDate] = useState(() => `${new Date().toISOString().split('T')[0]}T12:00:00`);
  const [startDate, setStartDate] = useState(() => `${new Date().toISOString().split('T')[0]}T00:00:00`);
  const [endDate, setEndDate] = useState(() => `${new Date().toISOString().split('T')[0]}T23:59:00`);
  const [result, setResult] = useState<FineGenerationResult | null>(null);
  const [selectedFine, setSelectedFine] = useState<MemberFineDetail | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVikoba = String(user?.associationType || '').toUpperCase() === 'VIKOBA';
  const fines = useMemo(() => result?.memberFines || [], [result?.memberFines]);
  const totals = useMemo(() => ({
    meetings: Number(result?.totalMeetingsScheduled || 0),
    membersFined: fines.length,
    missedMeetings: fines.reduce((sum, fine) => sum + Number(fine.meetingsMissed || 0), 0),
    totalAmount: fines.reduce((sum, fine) => sum + Number(fine.fineAmount || 0), 0),
  }), [fines, result?.totalMeetingsScheduled]);

  const selectedPeriod = useMemo(() => {
    if (mode === 'range') return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    if (mode === 'exact') return formatDate(exactDate);
    return formatDate(checkDate);
  }, [checkDate, endDate, exactDate, mode, startDate]);

  const validate = () => {
    setError(null);
    if (!associationId) {
      setError('Association context is required before generating meeting fines.');
      return false;
    }
    if (mode === 'last' && !checkDate.trim()) {
      setError('Check date is required.');
      return false;
    }
    if (mode === 'exact' && !exactDate.trim()) {
      setError('Exact meeting date is required.');
      return false;
    }
    if (mode === 'range') {
      if (!startDate.trim() || !endDate.trim()) {
        setError('Start and end date are required.');
        return false;
      }
      if (new Date(startDate) > new Date(endDate)) {
        setError('Start date must be before end date.');
        return false;
      }
    }
    return true;
  };

  const openConfirm = () => {
    if (validate()) setConfirmOpen(true);
  };

  const generateFines = async () => {
    if (!associationId) return;
    setLoading(true);
    setConfirmOpen(false);
    setError(null);
    setResult(null);

    try {
      const params = buildFineParams(mode, { checkDate, exactDate, startDate, endDate });
      const response = await generateMeetingFines(associationId, params);
      setResult(response);
    } catch (generateError) {
      setError(getApiErrorMessage(generateError));
    } finally {
      setLoading(false);
    }
  };

  const fineReportRows = useMemo<MeetingFineReportRow[]>(
    () =>
      fines.length
        ? fines.map((fine) => ({
            memberName: fine.memberName || '-',
            memberEmail: fine.memberEmail || '-',
            meetingsMissed: Number(fine.meetingsMissed || 0),
            fineAmount: Number(fine.fineAmount || 0),
            fineDate: fine.fineDate,
            dueDate: fine.dueDate,
            missedMeetings: (fine.missedMeetings || []).map((meeting) => meeting.meetingTitle || 'Meeting').join('; ') || '-',
          }))
        : result
          ? [{
              memberName: 'No members fined',
              memberEmail: '-',
              meetingsMissed: 0,
              fineAmount: 0,
              fineDate: result.periodStart,
              dueDate: result.periodEnd,
              missedMeetings: 'Generation completed with no member fines.',
            }]
          : [],
    [fines, result],
  );

  const fineReportOptions = useMemo(
    () => ({
      title: 'Meeting Fine Generation Result',
      associationName: user?.associationName || 'Association',
      purpose: 'A report of the selected meeting fine generation result, fined members, missed meetings, and amounts.',
      rows: fineReportRows,
      fileName: 'nane-meeting-fines',
      metadata: [
        { label: 'Selected period', value: selectedPeriod },
        { label: 'Check mode', value: modeTabs.find((tab) => tab.value === mode)?.label || mode },
      ],
      metrics: [
        { label: 'Meetings checked', value: formatNumber(totals.meetings), helper: 'Scheduled records' },
        { label: 'Members fined', value: formatNumber(totals.membersFined), helper: 'Generated member fines' },
        { label: 'Missed meetings', value: formatNumber(totals.missedMeetings), helper: 'Total absences counted' },
        { label: 'Total amount', value: formatCurrency(totals.totalAmount), helper: 'Generated fine value' },
      ],
      columns: [
        { key: 'memberName', label: 'Member', width: '20%', value: (row: MeetingFineReportRow) => row.memberName },
        { key: 'memberEmail', label: 'Email', width: '20%', value: (row: MeetingFineReportRow) => row.memberEmail },
        { key: 'meetingsMissed', label: 'Missed', align: 'right' as const, width: '9%', value: (row: MeetingFineReportRow) => formatNumber(row.meetingsMissed) },
        { key: 'fineAmount', label: 'Fine Amount', align: 'right' as const, width: '13%', value: (row: MeetingFineReportRow) => formatCurrency(row.fineAmount) },
        { key: 'fineDate', label: 'Fine Date', width: '12%', value: (row: MeetingFineReportRow) => formatDate(row.fineDate) },
        { key: 'dueDate', label: 'Due Date', width: '12%', value: (row: MeetingFineReportRow) => formatDate(row.dueDate) },
        { key: 'missedMeetings', label: 'Missed Meetings', width: '24%', value: (row: MeetingFineReportRow) => row.missedMeetings },
      ],
    }),
    [fineReportRows, mode, selectedPeriod, totals, user?.associationName],
  );

  const fineItems = useMemo<MobileDataListItem[]>(() => (
    fines.map((fine) => ({
      id: fine.memberId || `${fine.memberName}-${fine.fineDate}`,
      title: fine.memberName || 'Unknown member',
      subtitle: fine.memberEmail || 'No email',
      meta: `${formatNumber(Number(fine.meetingsMissed || 0))} missed · Due ${formatDate(fine.dueDate)}`,
      amount: formatCurrency(Number(fine.fineAmount || 0)),
      status: 'Generated',
      statusTone: 'danger',
      accent: 'danger',
    }))
  ), [fines]);

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Meeting fine generation is available from the association admin workspace." />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Generate Meeting Fine"
        eyebrow="Community"
        subtitle="Check missed meetings and create attendance fines."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Reset result" onPress={() => setResult(null)} disabled={loading || !result} />}
      />

      {error ? <MobileErrorState title="Fine generation issue" description={error} onRetry={() => setError(null)} retryLabel="Dismiss" /> : null}

      <MobileCard compact accent={isVikoba ? 'green' : 'red'}>
        <View style={styles.eligibilityRow}>
          <View style={styles.eligibilityCopy}>
            <MobileText variant="body" weight="bold">
              {isVikoba ? 'VIKOBA fine workflow' : 'VIKOBA groups only'}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Attendance fines can create financial transactions. Review the period before generating.
            </MobileText>
          </View>
          <MobileStatusBadge label={isVikoba ? 'Eligible' : 'Blocked'} tone={isVikoba ? 'success' : 'danger'} />
        </View>
      </MobileCard>

      <MobileCard compact>
        <MobileStatusTabs tabs={modeTabs} value={mode} onChange={(value) => setMode(value as CheckMode)} />
        {mode === 'last' ? (
          <MobileTextInput label="Check date and time" value={checkDate} onChangeText={setCheckDate} placeholder="YYYY-MM-DDTHH:mm:ss" disabled={loading} helperText="Checks the last configured meeting frequency period." />
        ) : null}
        {mode === 'exact' ? (
          <MobileTextInput label="Exact meeting date" value={exactDate} onChangeText={setExactDate} placeholder="YYYY-MM-DDTHH:mm:ss" disabled={loading} helperText="Checks meetings matching this exact date and time." />
        ) : null}
        {mode === 'range' ? (
          <View style={styles.rangeGrid}>
            <MobileTextInput label="Start date and time" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DDTHH:mm:ss" disabled={loading} />
            <MobileTextInput label="End date and time" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DDTHH:mm:ss" disabled={loading} />
          </View>
        ) : null}
      </MobileCard>

      <MobileCard compact accent="blue">
        <MobileInfoRow label="Selected period" value={selectedPeriod} icon={CalendarClock} helper="The backend will check this period before creating fines." />
        <MobileInfoRow label="Safety" value="Confirmation required" icon={ShieldCheck} helper="Generation runs only after the confirmation sheet." />
        <View style={styles.actions}>
          <MobileButton label="Generate Fines" icon={AlertTriangle} loading={loading} disabled={loading || !isVikoba} onPress={openConfirm} />
          <MobileReportExportButton label="Export result" options={fineReportOptions} disabled={!result} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
        </View>
      </MobileCard>

      {result ? (
        <>
          <MobileKpiGrid>
            <MobileKpiGridItem>
              <MobileKpiCard title="Meetings Checked" value={formatNumber(totals.meetings)} description="Scheduled records" icon={CalendarClock} tone="blue" />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Members Fined" value={formatNumber(totals.membersFined)} description="Members with misses" icon={Users} tone={totals.membersFined > 0 ? 'red' : 'slate'} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Missed Meetings" value={formatNumber(totals.missedMeetings)} description="Total missed records" icon={ListChecks} tone="orange" />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Fine Amount" value={formatCurrency(totals.totalAmount)} description="Generated value" icon={CircleDollarSign} tone="green" />
            </MobileKpiGridItem>
          </MobileKpiGrid>

          {fineItems.length === 0 ? (
            <MobileEmptyState title="No fines generated" description="No members missed meetings for the selected period or no meetings were found." />
          ) : (
            <MobileDataList items={fineItems} onPressItem={(item) => setSelectedFine(fines.find((fine) => (fine.memberId || `${fine.memberName}-${fine.fineDate}`) === item.id) || null)} />
          )}
        </>
      ) : (
        <MobileEmptyState title="No generation result yet" description="Choose a check mode, review the selected period, then generate fines." />
      )}

      <MobileConfirmSheet
        visible={confirmOpen}
        title="Generate attendance fines?"
        description={`Generate meeting fines for ${selectedPeriod}? This can create member fine transactions if missed meetings are found.`}
        confirmLabel="Generate"
        destructive
        onCancel={() => setConfirmOpen(false)}
        onConfirm={generateFines}
      />

      <MobileCard compact accent="orange">
        <View style={styles.warningRow}>
          <AlertTriangle size={18} color="#C2410C" />
          <MobileText variant="small" tone="secondary" style={styles.warningText}>
            Generate fines only after attendance records are reviewed. Wrong fines should be cancelled from fine management.
          </MobileText>
        </View>
      </MobileCard>

      {selectedFine ? (
        <MobileCard compact accent="red">
          <MobileText variant="body" weight="bold">
            {selectedFine.memberName || 'Member fine'}
          </MobileText>
          <MobileText variant="small" tone="secondary">
            {formatCurrency(Number(selectedFine.fineAmount || 0))} for {formatNumber(Number(selectedFine.meetingsMissed || 0))} missed meetings.
          </MobileText>
        </MobileCard>
      ) : null}
    </MobileScreen>
  );
}

function buildFineParams(mode: CheckMode, dates: { checkDate: string; exactDate: string; startDate: string; endDate: string }) {
  if (mode === 'exact') {
    return {
      checkDate: normalizeDateTime(dates.exactDate),
      checkMode: 'EXACT_DATE' as const,
    };
  }
  if (mode === 'range') {
    return {
      checkDate: normalizeDateTime(dates.startDate),
      checkMode: 'DATE_RANGE' as const,
      startDate: normalizeDateTime(dates.startDate),
      endDate: normalizeDateTime(dates.endDate),
    };
  }
  return {
    checkDate: normalizeDateTime(dates.checkDate),
    checkMode: 'LAST_FREQUENCY' as const,
  };
}

function normalizeDateTime(value: string) {
  if (/:\d{2}:\d{2}$/.test(value)) return value;
  if (/T\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  return value;
}

const styles = StyleSheet.create({
  eligibilityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  eligibilityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rangeGrid: {
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningText: {
    flex: 1,
  },
});
