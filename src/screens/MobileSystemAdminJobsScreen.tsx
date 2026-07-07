import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Gauge,
  RefreshCw,
  SlidersHorizontal,
  Timer,
  Zap,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
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
  MobilePageLoadingState,
  MobileProgressBar,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { listSystemAdminJobs, type SystemAdminJobStatus } from '@/services/system-admin-job-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, initialsFromName } from '@/utils/format';
import { type KpiTone, type StatusTone } from '@/theme/tokens';

type JobTab = 'ALL' | 'HEALTHY' | 'ISSUES' | 'NEVER_RUN' | 'SLOW';
type JobSort = 'name-asc' | 'last-run-desc' | 'duration-desc' | 'duration-asc' | 'status';
type JobMode = 'detail';

type MobileSystemAdminJobsScreenProps = {
  initialStatus?: JobTab;
  initialMode?: JobMode;
};

const jobTabs: { value: JobTab; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'HEALTHY', label: 'Healthy' },
  { value: 'ISSUES', label: 'Issues' },
  { value: 'NEVER_RUN', label: 'Never' },
  { value: 'SLOW', label: 'Slow' },
];

const sortOptions = [
  { value: 'status', label: 'Health first', description: 'Jobs with issues, never-run jobs, then healthy jobs.' },
  { value: 'last-run-desc', label: 'Recently run', description: 'Most recent job execution first.' },
  { value: 'duration-desc', label: 'Slowest first', description: 'Longest runtime first.' },
  { value: 'duration-asc', label: 'Fastest first', description: 'Shortest runtime first.' },
  { value: 'name-asc', label: 'Name A-Z', description: 'Alphabetical job name.' },
];

export default function MobileSystemAdminJobsScreen({
  initialStatus = 'ALL',
  initialMode,
}: MobileSystemAdminJobsScreenProps = {}) {
  const { activeView, user } = useAuth();
  const [activeTab, setActiveTab] = useState<JobTab>(initialStatus);
  const [rows, setRows] = useState<SystemAdminJobStatus[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [sortValue, setSortValue] = useState<JobSort>('status');
  const [selectedJob, setSelectedJob] = useState<SystemAdminJobStatus | null>(null);
  const handledInitialModeRef = useRef(false);

  const loadJobs = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      const page = await listSystemAdminJobs({ page: 0, size: 50 });
      setRows(page.content);
      setTotalElements(Math.max(page.totalElements, page.content.length));
      if (mode === 'refresh') setNotice('Scheduled jobs refreshed.');
    } catch (err) {
      setError(getApiErrorMessage(err));
      if (mode === 'initial') {
        setRows([]);
        setTotalElements(0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (activeView !== 'SYSTEM_ADMIN') return undefined;
    const timer = setTimeout(() => {
      void loadJobs('initial');
    }, 0);
    return () => clearTimeout(timer);
  }, [activeView, loadJobs]);

  useEffect(() => {
    if (handledInitialModeRef.current || loading || !rows.length) return undefined;
    handledInitialModeRef.current = true;
    const timer = setTimeout(() => {
      if (initialMode === 'detail') setSelectedJob(rows[0]);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialMode, loading, rows]);

  const stats = useMemo(() => aggregateJobs(rows), [rows]);
  const filteredRows = useMemo(() => filterJobs(rows, activeTab, searchTerm), [activeTab, rows, searchTerm]);
  const visibleRows = useMemo(() => sortJobs(filteredRows, sortValue), [filteredRows, sortValue]);
  const listItems = useMemo<MobileDataListItem[]>(() => visibleRows.map(jobListItem), [visibleRows]);
  const healthRate = stats.total ? Math.round((stats.healthy / stats.total) * 100) : 0;
  const health = jobHealth(stats);
  const tabs = useMemo(
    () =>
      jobTabs.map((tab) => ({
        value: tab.value,
        label: tab.label,
        count: countForTab(tab.value, stats),
      })),
    [stats],
  );

  if (activeView !== 'SYSTEM_ADMIN') {
    return <AccessDeniedScreen title="Scheduled jobs" description="Platform job monitoring is available only to system administrators." />;
  }

  if (loading && rows.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading scheduled jobs" />;
  }

  if (error && rows.length === 0) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Platform operations"
          title="Scheduled jobs"
          subtitle="Cron and background task health"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadJobs('refresh')} />}
        />
        <MobileErrorState title="Jobs unavailable" description={error} retryLabel="Retry" onRetry={() => void loadJobs('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Platform operations"
        title="Scheduled jobs"
        subtitle={user?.fullName ? `${user.fullName} · monitor` : 'Cron and background task health'}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh jobs" variant="secondary" disabled={refreshing} onPress={() => void loadJobs('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Scheduled jobs" description={notice} tone="success" /> : null}

      <MobileSummaryPanel
        title={health.title}
        value={`${healthRate}%`}
        description={`${formatNumber(rows.length)} of ${formatNumber(totalElements)} loaded · ${formatNumber(stats.issues)} issues · avg ${formatDuration(stats.averageDurationMs)}`}
        tone={health.tone}
        icon={Activity}
        footer={<MobileProgressBar value={healthRate} tone={health.tone} label="Healthy jobs" />}
      />

      <MobileStatusTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as JobTab)} />
      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Find jobs" />

      <View style={styles.actionsRow}>
        <MobileButton label="Sort" icon={SlidersHorizontal} size="sm" variant="secondary" onPress={() => setSortSheetOpen(true)} />
        <MobileButton label="Export" icon={Download} size="sm" variant="secondary" loading={exporting} disabled={!visibleRows.length} onPress={() => void exportRows()} />
      </View>

      {listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const job = visibleRows.find((row) => row.name === item.id);
            if (job) setSelectedJob(job);
          }}
        />
      ) : (
        <MobileEmptyState
          title="No scheduled jobs found"
          description={searchTerm || activeTab !== 'ALL' ? 'Adjust search or health filters.' : 'Scheduled job health will appear here once the platform monitor returns records.'}
          actionLabel={searchTerm || activeTab !== 'ALL' ? 'Reset filters' : undefined}
          onAction={searchTerm || activeTab !== 'ALL' ? resetFilters : undefined}
        />
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total jobs" value={formatNumber(stats.total)} description="Monitored tasks" tone="blue" icon={Zap} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Healthy" value={formatNumber(stats.healthy)} description={`${healthRate}% success rate`} tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Issues" value={formatNumber(stats.issues)} description="Need attention" tone={stats.issues ? 'red' : 'slate'} icon={AlertTriangle} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Avg duration" value={formatDuration(stats.averageDurationMs)} description={`${formatNumber(stats.slow)} slow jobs`} tone={stats.slow ? 'orange' : 'slate'} icon={Timer} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {renderDetailSheet()}
      <MobileSortSheet visible={sortSheetOpen} value={sortValue} options={sortOptions} onChange={(value) => setSortValue(value as JobSort)} onClose={() => setSortSheetOpen(false)} />
    </MobileScreen>
  );

  function renderDetailSheet() {
    const job = selectedJob;
    return (
      <MobileSheet visible={Boolean(job)} title="Scheduled job" description={job?.name || 'Job details'} onClose={() => setSelectedJob(null)}>
        {job ? (
          <>
            <MobileInfoRow label="Job name" value={shortJobName(job.name)} helper={jobGroup(job.name)} icon={Zap} status={jobStatusLabel(job)} />
            <MobileInfoRow label="Last run" value={formatDate(job.lastRun)} helper={relativeRun(job.lastRun)} icon={CalendarDays} />
            <MobileInfoRow label="Next run" value={formatDate(job.nextRun)} helper={job.nextRun ? 'Scheduled by backend monitor' : 'No next run reported'} icon={Clock3} />
            <MobileInfoRow label="Duration" value={formatDuration(job.lastDurationMs)} helper={durationHealth(job.lastDurationMs)} icon={Gauge} />
            {job.lastError ? (
              <MobileInfoRow label="Last error" value={job.lastError} helper="Investigate scheduler logs and related tenant jobs." icon={AlertTriangle} status="Failed" />
            ) : (
              <MobileInfoRow label="Last error" value="No errors reported" helper="Backend monitor reports this job as clean." icon={CheckCircle2} status="Healthy" />
            )}
          </>
        ) : null}
      </MobileSheet>
    );
  }

  async function exportRows() {
    if (!visibleRows.length) return;
    setExporting(true);
    setNotice(null);
    try {
      const csv = toCsv(visibleRows);
      const fileUri = `${FileSystem.cacheDirectory || ''}system-admin-scheduled-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export scheduled jobs' });
      } else {
        setNotice(`CSV saved to ${fileUri}`);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  function resetFilters() {
    setSearchTerm('');
    setActiveTab('ALL');
  }
}

function aggregateJobs(rows: SystemAdminJobStatus[]) {
  const totalDuration = rows.reduce((sum, row) => sum + toNumber(row.lastDurationMs), 0);
  return {
    total: rows.length,
    healthy: rows.filter((row) => row.healthy).length,
    issues: rows.filter((row) => !row.healthy).length,
    neverRun: rows.filter((row) => !row.lastRun).length,
    slow: rows.filter((row) => toNumber(row.lastDurationMs) >= 5000).length,
    averageDurationMs: rows.length ? Math.round(totalDuration / rows.length) : 0,
  };
}

function jobHealth(stats: ReturnType<typeof aggregateJobs>): { title: string; tone: KpiTone } {
  if (stats.issues) return { title: 'Jobs need attention', tone: 'red' };
  if (stats.neverRun === stats.total && stats.total) return { title: 'Jobs registered, awaiting run', tone: 'blue' };
  if (stats.slow) return { title: 'Jobs healthy with slow runs', tone: 'orange' };
  if (stats.total) return { title: 'Jobs healthy', tone: 'green' };
  return { title: 'No jobs loaded', tone: 'slate' };
}

function countForTab(tab: JobTab, stats: ReturnType<typeof aggregateJobs>) {
  if (tab === 'ALL') return stats.total;
  if (tab === 'HEALTHY') return stats.healthy;
  if (tab === 'ISSUES') return stats.issues;
  if (tab === 'NEVER_RUN') return stats.neverRun;
  if (tab === 'SLOW') return stats.slow;
  return 0;
}

function filterJobs(rows: SystemAdminJobStatus[], tab: JobTab, query: string) {
  const normalized = query.trim().toLowerCase();
  return rows.filter((job) => {
    const tabMatch =
      tab === 'ALL' ||
      (tab === 'HEALTHY' && job.healthy) ||
      (tab === 'ISSUES' && !job.healthy) ||
      (tab === 'NEVER_RUN' && !job.lastRun) ||
      (tab === 'SLOW' && toNumber(job.lastDurationMs) >= 5000);
    if (!tabMatch) return false;
    if (!normalized) return true;
    return [job.name, job.lastError, jobGroup(job.name)].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized));
  });
}

function sortJobs(rows: SystemAdminJobStatus[], sort: JobSort) {
  const jobs = [...rows];
  if (sort === 'name-asc') return jobs.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'last-run-desc') return jobs.sort((a, b) => dateValue(b.lastRun) - dateValue(a.lastRun));
  if (sort === 'duration-desc') return jobs.sort((a, b) => toNumber(b.lastDurationMs) - toNumber(a.lastDurationMs));
  if (sort === 'duration-asc') return jobs.sort((a, b) => toNumber(a.lastDurationMs) - toNumber(b.lastDurationMs));
  return jobs.sort((a, b) => jobPriority(a) - jobPriority(b));
}

function jobListItem(job: SystemAdminJobStatus): MobileDataListItem {
  const tone = jobTone(job);
  const statusLabel = jobStatusLabel(job);
  return {
    id: job.name,
    title: shortJobName(job.name),
    subtitle: jobGroup(job.name),
    meta: `${job.lastRun ? `Last ${formatDate(job.lastRun)}` : 'Never run'} · ${formatDuration(job.lastDurationMs)}`,
    amount: job.lastError ? 'Error' : undefined,
    status: statusLabel,
    statusTone: tone,
    statusLabel,
    initials: initialsFromName(shortJobName(job.name)),
    accent: tone,
  };
}

function jobTone(job: SystemAdminJobStatus): StatusTone {
  if (!job.healthy) return 'danger';
  if (!job.lastRun) return 'info';
  if (toNumber(job.lastDurationMs) >= 5000) return 'warning';
  return 'success';
}

function jobStatusLabel(job: SystemAdminJobStatus) {
  if (!job.healthy) return 'Issue';
  if (!job.lastRun) return 'Registered';
  if (toNumber(job.lastDurationMs) >= 5000) return 'Slow';
  return 'Healthy';
}

function jobPriority(job: SystemAdminJobStatus) {
  if (!job.healthy) return 0;
  if (!job.lastRun) return 1;
  if (toNumber(job.lastDurationMs) >= 5000) return 2;
  return 3;
}

function shortJobName(name: string) {
  const parts = name.split('.');
  return parts[parts.length - 1] || name;
}

function jobGroup(name: string) {
  const parts = name.split('.');
  return parts.length > 1 ? parts.slice(0, -1).join('.') : 'Platform scheduler';
}

function relativeRun(value?: string | null) {
  if (!value) return 'This job has not reported a run yet.';
  const diffMs = Date.now() - dateValue(value);
  const hours = diffMs / 36e5;
  if (hours < 1) return 'Ran within the last hour.';
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  if (hours < 168) return `${Math.floor(hours / 24)}d ago`;
  return `${Math.floor(hours / 168)}w ago`;
}

function durationHealth(ms?: number | null) {
  const value = toNumber(ms);
  if (!value) return 'No duration reported.';
  if (value < 1000) return 'Fast execution.';
  if (value < 5000) return 'Normal execution.';
  return 'Slow execution, review if repeated.';
}

function formatDuration(ms?: number | null) {
  const value = toNumber(ms);
  if (!value) return 'N/A';
  if (value < 1000) return `${value}ms`;
  if (value < 60000) return `${(value / 1000).toFixed(1)}s`;
  return `${(value / 60000).toFixed(1)}m`;
}

function toCsv(rows: SystemAdminJobStatus[]) {
  const header = ['Job Name', 'Group', 'Healthy', 'Last Run', 'Next Run', 'Duration Ms', 'Last Error'];
  return [header, ...rows.map((job) => [job.name, jobGroup(job.name), String(job.healthy), job.lastRun || '', job.nextRun || '', String(toNumber(job.lastDurationMs)), job.lastError || ''])]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}

function csvCell(value: string) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
});
