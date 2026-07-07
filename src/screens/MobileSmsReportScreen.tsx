import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileFormSection,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import {
  exportAssociationSmsReport,
  getAllAssociationSmsReportRows,
  type SmsReportExportFormat,
  type SmsReportRow,
} from '@/services/report-service';
import { labelFromStatus, statusToneFor, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type DateFilterErrors = {
  startDate?: string;
  endDate?: string;
};

const INITIAL_VISIBLE_COUNT = 18;
const LOAD_MORE_COUNT = 18;
const FETCH_SIZE = 200;
const MAX_FETCH_PAGES = 25;

const sortOptions = [
  { value: 'createdAt,desc', label: 'Newest first', description: 'Recently created SMS logs first.' },
  { value: 'createdAt,asc', label: 'Oldest first', description: 'Earliest SMS logs first.' },
  { value: 'smsUnits,desc', label: 'Most SMS units', description: 'Messages split into the most SMSes first.' },
  { value: 'status,asc', label: 'Status', description: 'Group logs by delivery status.' },
  { value: 'recipient,asc', label: 'Recipient', description: 'Sort by phone number.' },
];

export default function MobileSmsReportScreen() {
  const { activeView, associationId, user } = useAuth();
  const [rows, setRows] = useState<SmsReportRow[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pagesFetched, setPagesFetched] = useState(0);
  const [historicalTotals, setHistoricalTotals] = useState<Record<string, number>>({});
  const [historicalSmsUnits, setHistoricalSmsUnits] = useState<Record<string, number>>({});
  const [totalSmsUnits, setTotalSmsUnits] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [formErrors, setFormErrors] = useState<DateFilterErrors>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<SmsReportExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; description?: string; tone?: StatusTone } | null>(null);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('createdAt,desc');
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [selectedRow, setSelectedRow] = useState<SmsReportRow | null>(null);

  const validateDates = useCallback(() => {
    const nextErrors: DateFilterErrors = {};
    const hasStart = Boolean(startDate.trim());
    const hasEnd = Boolean(endDate.trim());
    const startValid = !hasStart || isIsoDate(startDate);
    const endValid = !hasEnd || isIsoDate(endDate);

    if (hasStart && !startValid) nextErrors.startDate = 'Use YYYY-MM-DD.';
    if (hasEnd && !endValid) nextErrors.endDate = 'Use YYYY-MM-DD.';
    if (startValid && endValid && hasStart && hasEnd && new Date(`${startDate}T00:00:00`).getTime() > new Date(`${endDate}T00:00:00`).getTime()) {
      nextErrors.endDate = 'End date must be after start date.';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [endDate, startDate]);

  const loadReport = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading SMS reports.');
        return;
      }

      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const response = await getAllAssociationSmsReportRows(
          associationId,
          {
            size: FETCH_SIZE,
            startDate: appliedStartDate,
            endDate: appliedEndDate,
          },
          { maxPages: MAX_FETCH_PAGES },
        );
        setRows(response.rows);
        setTotalElements(response.totalElements);
        setTotalPages(response.totalPages);
        setPagesFetched(response.pagesFetched);
        setHistoricalTotals(response.historicalTotals);
        setHistoricalSmsUnits(response.historicalSmsUnits);
        setTotalSmsUnits(response.totalSmsUnits);
        setVisibleCount(INITIAL_VISIBLE_COUNT);
        setActiveStatus('ALL');
      } catch (loadError) {
        if (!rows.length) {
          setRows([]);
          setTotalElements(0);
          setTotalPages(0);
          setPagesFetched(0);
          setHistoricalTotals({});
          setHistoricalSmsUnits({});
          setTotalSmsUnits(0);
        }
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedEndDate, appliedStartDate, associationId, rows.length],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadReport('initial'));
  }, [loadReport]);

  const periodLabel = useMemo(() => buildPeriodLabel(appliedStartDate, appliedEndDate), [appliedEndDate, appliedStartDate]);
  const statusUnitEntries = useMemo(() => buildStatusEntries(Object.keys(historicalSmsUnits).length ? historicalSmsUnits : historicalTotals), [historicalSmsUnits, historicalTotals]);
  const successfulUnits = useMemo(() => sumStatuses(statusUnitEntries, ['SENT', 'DELIVERED']), [statusUnitEntries]);
  const pendingUnits = useMemo(() => sumStatuses(statusUnitEntries, ['PENDING', 'QUEUED']), [statusUnitEntries]);
  const failedUnits = useMemo(() => sumStatuses(statusUnitEntries, ['FAILED', 'ERROR']), [statusUnitEntries]);

  const statusTabs = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const label = labelFromStatus(row.status);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [
      { value: 'ALL', label: 'All', count: rows.length },
      ...Array.from(counts.entries()).map(([label, count]) => ({ value: label, label, count })),
    ];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => activeStatus === 'ALL' || labelFromStatus(row.status) === activeStatus)
      .filter((row) => {
        if (!query) return true;
        return [
          row.recipient,
          row.sourceCategory,
          row.messageBody,
          row.status,
          row.providerResponse,
          row.failureReason,
        ].some((value) => String(value || '').toLowerCase().includes(query));
      })
      .sort((left, right) => compareRows(left, right, sortBy));
  }, [activeStatus, rows, search, sortBy]);

  const visibleRows = filteredRows.slice(0, visibleCount);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleRows.map((row) => ({
        id: row.id,
        title: row.recipient || 'Unknown recipient',
        subtitle: `${row.sourceCategory || 'SMS'} · ${truncate(row.messageBody || 'No message body', 58)}`,
        meta: `${formatDate(row.createdAt || row.sentAt)} · ${row.smsUnits} SMS ${row.smsUnits === 1 ? 'unit' : 'units'}`,
        amount: `${row.smsUnits} SMS`,
        status: labelFromStatus(row.status),
        statusTone: statusToneFor(row.status),
        accent: statusToneFor(row.status),
        initials: initialsFromName(row.sourceCategory || 'SMS'),
      })),
    [visibleRows],
  );

  const applyFilters = () => {
    if (!validateDates()) return;
    setAppliedStartDate(startDate.trim());
    setAppliedEndDate(endDate.trim());
    setToast({ title: 'Filters applied', description: buildPeriodLabel(startDate.trim(), endDate.trim()), tone: 'success' });
  };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setFormErrors({});
    setSearch('');
    setActiveStatus('ALL');
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  };

  const handleExport = async (format: SmsReportExportFormat) => {
    if (!associationId) return;

    setExporting(format);
    setToast(null);
    try {
      const response = await exportAssociationSmsReport(associationId, {
        format,
        startDate: appliedStartDate,
        endDate: appliedEndDate,
      });
      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      const mimeType = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const fileName = `sms_report_${appliedStartDate && appliedEndDate ? `${appliedStartDate}_to_${appliedEndDate}` : 'all'}.${extension}`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, arrayBufferToBase64(response.data), {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType,
          dialogTitle: `Share ${format === 'pdf' ? 'PDF' : 'Excel'} SMS report`,
          UTI: format === 'pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet',
        });
      }
      setToast({ title: 'Export ready', description: fileName, tone: 'success' });
    } catch (exportError) {
      setToast({ title: 'Export failed', description: getApiErrorMessage(exportError), tone: 'danger' });
    } finally {
      setExporting(null);
    }
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="SMS report"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading && !rows.length) {
    return <MobilePageLoadingState kind="list" message="Loading SMS report" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Reports" title="SMS report" subtitle="Association context unavailable" />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before opening reports." />
      </MobileScreen>
    );
  }

  if (error && !rows.length) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Reports"
          title="SMS report"
          subtitle={periodLabel}
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadReport('refresh')} />}
        />
        <FilterForm
          startDate={startDate}
          endDate={endDate}
          errors={formErrors}
          loading={refreshing}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onApply={applyFilters}
          onReset={resetFilters}
        />
        <MobileErrorState title="SMS report could not load" description={error} retryLabel="Retry" onRetry={() => void loadReport('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Reports"
        title="SMS report"
        subtitle={`${user?.associationName || 'Association report'} · ${periodLabel}`}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh report"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadReport('refresh')}
          />
        }
      />

      {toast ? <MobileToast title={toast.title} description={toast.description} tone={toast.tone} /> : null}
      {error ? <MobileToast title="Report refresh failed" description={error} tone="warning" /> : null}

      <FilterForm
        startDate={startDate}
        endDate={endDate}
        errors={formErrors}
        loading={refreshing}
        onStartDateChange={(value) => {
          setStartDate(value);
          setFormErrors((current) => ({ ...current, startDate: undefined }));
        }}
        onEndDateChange={(value) => {
          setEndDate(value);
          setFormErrors((current) => ({ ...current, endDate: undefined }));
        }}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="SMS units" value={formatNumber(totalSmsUnits)} description="Actual charged/split SMSes" tone="blue" icon={BarChart3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Log entries" value={formatNumber(totalElements)} description={`Loaded ${formatNumber(rows.length)} records`} tone="teal" icon={MessageSquare} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending" value={formatNumber(pendingUnits)} description="Queued or waiting units" tone="orange" icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Failed" value={formatNumber(failedUnits)} description={`${formatNumber(successfulUnits)} successful units`} tone="red" icon={XCircle} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact accent="blue">
        <View style={styles.reportHeader}>
          <View style={styles.titleBlock}>
            <MobileText variant="tiny" tone="secondary" weight="bold" style={styles.uppercase}>
              SMS delivery report
            </MobileText>
            <MobileText variant="section" weight="bold">
              {user?.associationName || 'Association'}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {periodLabel} · SMS units are calculated from message length, not only log entries.
            </MobileText>
          </View>
          <MobileStatusBadge status="Units" label={formatNumber(totalSmsUnits)} tone="primary" />
        </View>
        <View style={styles.breakdown}>
          {statusUnitEntries.length ? (
            statusUnitEntries.map((entry) => (
              <MobileStatusBadge
                key={entry.status}
                status={labelFromStatus(entry.status)}
                label={`${labelFromStatus(entry.status)}: ${formatNumber(entry.count)}`}
                tone={statusToneFor(entry.status)}
              />
            ))
          ) : (
            <MobileStatusBadge status="No units" tone="neutral" />
          )}
        </View>
      </MobileCard>

      <View style={styles.actions}>
        <MobileButton
          label="Excel"
          icon={FileSpreadsheet}
          variant="secondary"
          loading={exporting === 'excel'}
          disabled={Boolean(exporting)}
          onPress={() => void handleExport('excel')}
          style={styles.flexButton}
        />
        <MobileButton
          label="PDF"
          icon={Download}
          loading={exporting === 'pdf'}
          disabled={Boolean(exporting)}
          onPress={() => void handleExport('pdf')}
          style={styles.flexButton}
        />
      </View>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.titleBlock}>
            <MobileText variant="body" weight="bold">
              SMS logs
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Showing {formatNumber(filteredRows.length)} matching loaded rows from {formatNumber(totalElements)} server records.
            </MobileText>
          </View>
          <MobileStatusBadge status="Loaded" label={`${pagesFetched}/${totalPages} pages`} tone={rows.length < totalElements ? 'warning' : 'success'} />
        </View>
      </MobileCard>

      <MobileSearchToolbar
        value={search}
        onChange={(value) => {
          setSearch(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        placeholder="Search recipient, status, message..."
        onFilterPress={() => setSortOpen(true)}
        filterLabel="Sort"
      />
      <MobileStatusTabs
        tabs={statusTabs}
        value={activeStatus}
        onChange={(value) => {
          setActiveStatus(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
      />

      {filteredRows.length ? (
        <>
          <MobileDataList
            items={listItems}
            onPressItem={(item) => {
              const row = rows.find((record) => record.id === item.id);
              if (row) setSelectedRow(row);
            }}
          />
          {visibleCount < filteredRows.length ? (
            <MobileButton
              label={`Load ${Math.min(LOAD_MORE_COUNT, filteredRows.length - visibleCount)} more`}
              variant="secondary"
              fullWidth
              onPress={() => setVisibleCount((count) => count + LOAD_MORE_COUNT)}
            />
          ) : null}
        </>
      ) : (
        <MobileEmptyState
          title="No SMS logs match"
          description={rows.length ? 'Change the search or status filter to see more logs.' : 'No SMS logs were returned for this period.'}
        />
      )}

      <MobileSortSheet
        visible={sortOpen}
        value={sortBy}
        options={sortOptions}
        onChange={(value) => {
          setSortBy(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onClose={() => setSortOpen(false)}
      />

      <MobileSheet
        visible={Boolean(selectedRow)}
        title={selectedRow?.recipient || 'SMS log'}
        description={selectedRow ? `${selectedRow.smsUnits} SMS units · ${formatDate(selectedRow.createdAt || selectedRow.sentAt)}` : undefined}
        onClose={() => setSelectedRow(null)}
      >
        {selectedRow ? (
          <View style={styles.sheetContent}>
            <MobileInfoRow label="Status" value={labelFromStatus(selectedRow.status)} icon={CheckCircle2} status={labelFromStatus(selectedRow.status)} />
            <MobileInfoRow label="Category" value={selectedRow.sourceCategory || 'Not available'} icon={Send} />
            <MobileInfoRow label="SMS units" value={formatNumber(selectedRow.smsUnits)} helper="Calculated from the message body length." icon={BarChart3} status="Units" />
            <MobileInfoRow label="Sent at" value={formatDate(selectedRow.sentAt)} helper={`Created ${formatDate(selectedRow.createdAt)}`} icon={CalendarDays} />
            <MobileCard compact>
              <MobileText variant="tiny" weight="bold" tone="secondary" style={styles.uppercase}>
                Message
              </MobileText>
              <MobileText variant="body" tone="secondary">
                {selectedRow.messageBody || 'No message body saved.'}
              </MobileText>
            </MobileCard>
            <MobileCard compact>
              <MobileText variant="tiny" weight="bold" tone="secondary" style={styles.uppercase}>
                Remarks
              </MobileText>
              <MobileText variant="body" tone="secondary">
                {selectedRow.failureReason || selectedRow.providerResponse || 'No provider remarks.'}
              </MobileText>
            </MobileCard>
          </View>
        ) : null}
      </MobileSheet>
    </MobileScreen>
  );
}

type FilterFormProps = {
  startDate: string;
  endDate: string;
  errors: DateFilterErrors;
  loading: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
};

function FilterForm({
  startDate,
  endDate,
  errors,
  loading,
  onStartDateChange,
  onEndDateChange,
  onApply,
  onReset,
}: FilterFormProps) {
  return (
    <MobileFormSection title="Report controls" description="Filter by creation date or leave both dates empty for all SMS logs.">
      <View style={styles.dateGrid}>
        <View style={styles.dateField}>
          <MobileTextInput
            label="Start date"
            value={startDate}
            onChangeText={onStartDateChange}
            placeholder="YYYY-MM-DD"
            icon={CalendarDays}
            autoCapitalize="none"
            error={errors.startDate}
            disabled={loading}
          />
        </View>
        <View style={styles.dateField}>
          <MobileTextInput
            label="End date"
            value={endDate}
            onChangeText={onEndDateChange}
            placeholder="YYYY-MM-DD"
            icon={CalendarDays}
            autoCapitalize="none"
            error={errors.endDate}
            disabled={loading}
          />
        </View>
      </View>
      <View style={styles.actions}>
        <MobileButton label="Reset" icon={RotateCcw} variant="secondary" disabled={loading} onPress={onReset} style={styles.flexButton} />
        <MobileButton label="Apply" icon={FileText} loading={loading} onPress={onApply} style={styles.flexButton} />
      </View>
    </MobileFormSection>
  );
}

function buildStatusEntries(totals: Record<string, number>) {
  return Object.entries(totals)
    .map(([status, count]) => ({ status, count }))
    .sort((left, right) => right.count - left.count || left.status.localeCompare(right.status));
}

function sumStatuses(entries: { status: string; count: number }[], statuses: string[]) {
  const set = new Set(statuses.map((status) => status.toUpperCase()));
  return entries.filter((entry) => set.has(entry.status.toUpperCase())).reduce((sum, entry) => sum + entry.count, 0);
}

function compareRows(left: SmsReportRow, right: SmsReportRow, sortBy: string) {
  if (sortBy === 'createdAt,asc') return toTime(left.createdAt || left.sentAt) - toTime(right.createdAt || right.sentAt);
  if (sortBy === 'smsUnits,desc') return right.smsUnits - left.smsUnits;
  if (sortBy === 'status,asc') return labelFromStatus(left.status).localeCompare(labelFromStatus(right.status));
  if (sortBy === 'recipient,asc') return String(left.recipient || '').localeCompare(String(right.recipient || ''));
  return toTime(right.createdAt || right.sentAt) - toTime(left.createdAt || left.sentAt);
}

function toTime(value?: string | null) {
  const date = value ? new Date(value) : null;
  const time = date?.getTime();
  return typeof time === 'number' && Number.isFinite(time) ? time : 0;
}

function buildPeriodLabel(startDate: string, endDate: string) {
  if (startDate && endDate) return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  if (startDate) return `From ${formatDate(startDate)}`;
  if (endDate) return `Until ${formatDate(endDate)}`;
  return 'All time';
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return value === `${year}-${month}-${day}`;
}

function truncate(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit - 1)}...` : value;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

const styles = StyleSheet.create({
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dateField: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 150,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  uppercase: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  breakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetContent: {
    gap: 10,
  },
});
