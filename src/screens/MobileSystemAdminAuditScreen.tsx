import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Download,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Timer,
  User,
  XCircle,
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
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { listSystemAdminAuditEvents, type SystemAdminAuditEvent } from '@/services/system-admin-audit-service';
import { type KpiTone, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatPercent, initialsFromName } from '@/utils/format';

type AuditTab = 'ALL' | 'SUCCESS' | 'FAILED';
type AuditMode = 'detail';

type MobileSystemAdminAuditScreenProps = {
  initialStatus?: AuditTab;
  initialMode?: AuditMode;
};

const tabs: { value: AuditTab; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILED', label: 'Failed' },
];

export default function MobileSystemAdminAuditScreen({
  initialStatus = 'ALL',
  initialMode,
}: MobileSystemAdminAuditScreenProps = {}) {
  const { activeView, user } = useAuth();
  const [activeTab, setActiveTab] = useState<AuditTab>(initialStatus);
  const [rows, setRows] = useState<SystemAdminAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<SystemAdminAuditEvent | null>(null);
  const handledInitialModeRef = useRef(false);

  const loadAudit = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      const nextRows = await listSystemAdminAuditEvents(200);
      setRows(nextRows);
      if (mode === 'refresh') setNotice('Audit trail refreshed.');
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      if (mode === 'initial') setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (activeView !== 'SYSTEM_ADMIN') return undefined;
    const timer = setTimeout(() => {
      void loadAudit('initial');
    }, 0);
    return () => clearTimeout(timer);
  }, [activeView, loadAudit]);

  useEffect(() => {
    if (handledInitialModeRef.current || loading || !rows.length) return undefined;
    handledInitialModeRef.current = true;
    const timer = setTimeout(() => {
      if (initialMode === 'detail') setSelectedEvent(rows[0]);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialMode, loading, rows]);

  const stats = useMemo(() => aggregateAudit(rows), [rows]);
  const visibleRows = useMemo(() => filterRows(rows, activeTab, searchTerm), [activeTab, rows, searchTerm]);
  const listItems = useMemo<MobileDataListItem[]>(() => visibleRows.map(eventListItem), [visibleRows]);
  const health = auditHealth(stats);
  const statusTabs = useMemo(
    () =>
      tabs.map((tab) => ({
        value: tab.value,
        label: tab.label,
        count: countForTab(tab.value, stats),
      })),
    [stats],
  );

  if (activeView !== 'SYSTEM_ADMIN') {
    return <AccessDeniedScreen title="System audit" description="Platform audit events are available only to system administrators." />;
  }

  if (loading && rows.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading audit trail" />;
  }

  if (error && rows.length === 0) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Platform operations"
          title="Audit trail"
          subtitle="Recent super-admin activity"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadAudit('refresh')} />}
        />
        <MobileErrorState title="Audit unavailable" description={error} retryLabel="Retry" onRetry={() => void loadAudit('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Platform security"
        title="Audit trail"
        subtitle={user?.fullName ? `${user.fullName} · recent activity` : 'Recent super-admin activity'}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh audit" variant="secondary" disabled={refreshing} onPress={() => void loadAudit('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Audit trail" description={notice} tone="success" /> : null}

      <MobileSummaryPanel
        title={health.title}
        value={formatPercent(stats.successRate)}
        description={`${formatNumber(stats.total)} events · ${formatNumber(stats.failed)} failed · avg ${formatDuration(stats.averageDurationMs)}`}
        tone={health.tone}
        icon={ShieldCheck}
        footer={<MobileProgressBar value={stats.successRate} tone={health.tone} label="Successful operations" />}
      />

      <MobileStatusTabs tabs={statusTabs} value={activeTab} onChange={(value) => setActiveTab(value as AuditTab)} />
      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Find user, role, or method" />

      <View style={styles.actionsRow}>
        <MobileButton label="Export" icon={Download} size="sm" variant="secondary" loading={exporting} disabled={!visibleRows.length} onPress={() => void exportRows()} />
      </View>

      {listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const event = visibleRows.find((row) => row.id === item.id);
            if (event) setSelectedEvent(event);
          }}
        />
      ) : (
        <MobileEmptyState
          title="No audit events found"
          description={searchTerm || activeTab !== 'ALL' ? 'Adjust search or status filters.' : 'Super-admin requests will appear here after audited activity.'}
          actionLabel={searchTerm || activeTab !== 'ALL' ? 'Reset filters' : undefined}
          onAction={searchTerm || activeTab !== 'ALL' ? resetFilters : undefined}
        />
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Events" value={formatNumber(stats.total)} description="Recent audit rows" tone="blue" icon={Activity} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Successful" value={formatNumber(stats.successful)} description={`${formatPercent(stats.successRate)} success`} tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Failed" value={formatNumber(stats.failed)} description="Needs review" tone={stats.failed ? 'red' : 'slate'} icon={XCircle} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Users" value={formatNumber(stats.uniqueUsers)} description={`${formatNumber(stats.uniqueRoles)} roles`} tone="purple" icon={User} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {renderDetailSheet()}
    </MobileScreen>
  );

  function renderDetailSheet() {
    const event = selectedEvent;
    return (
      <MobileSheet visible={Boolean(event)} title="Audit event" description={event?.method ? shortMethod(event.method) : 'Request details'} onClose={() => setSelectedEvent(null)}>
        {event ? (
          <>
            <MobileInfoRow label="Method" value={shortMethod(event.method)} helper={event.method || 'No method signature reported'} icon={methodIcon(event.method)} status={event.success ? 'Success' : 'Failed'} />
            <MobileInfoRow label="User" value={event.userEmail || 'Unknown user'} helper={event.systemRole || 'No role reported'} icon={User} />
            <MobileInfoRow label="Time" value={formatDate(event.timestamp)} helper={event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : 'No timestamp reported'} icon={Clock3} />
            <MobileInfoRow label="Duration" value={formatDuration(event.durationMs)} helper="Controller execution time" icon={Timer} />
            <MobileInfoRow label="HTTP context" value={event.httpMethod || event.path || 'Not captured'} helper={event.path || event.clientIp || 'The current audit aspect did not capture path/client IP.'} icon={KeyRound} />
            {event.error ? (
              <MobileInfoRow label="Error" value={event.error} helper="Review the related controller logs if repeated." icon={XCircle} status="Failed" />
            ) : (
              <MobileInfoRow label="Error" value="No errors reported" helper="The audited controller completed successfully." icon={CheckCircle2} status="Success" />
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
      const fileUri = `${FileSystem.cacheDirectory || ''}system-admin-audit-events-${new Date().toISOString().slice(0, 10)}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export audit events' });
      } else {
        setNotice(`CSV saved to ${fileUri}`);
      }
    } catch (exportError) {
      setError(getApiErrorMessage(exportError));
    } finally {
      setExporting(false);
    }
  }

  function resetFilters() {
    setSearchTerm('');
    setActiveTab('ALL');
  }
}

function aggregateAudit(rows: SystemAdminAuditEvent[]) {
  const total = rows.length;
  const successful = rows.filter((row) => row.success).length;
  const failed = total - successful;
  const uniqueUsers = new Set(rows.map((row) => row.userEmail).filter(Boolean)).size;
  const uniqueRoles = new Set(rows.map((row) => row.systemRole).filter(Boolean)).size;
  const averageDurationMs = total ? Math.round(rows.reduce((sum, row) => sum + row.durationMs, 0) / total) : 0;
  return {
    total,
    successful,
    failed,
    uniqueUsers,
    uniqueRoles,
    averageDurationMs,
    successRate: total ? Math.round((successful / total) * 100) : 0,
  };
}

function auditHealth(stats: ReturnType<typeof aggregateAudit>): { title: string; tone: KpiTone } {
  if (!stats.total) return { title: 'No audit activity yet', tone: 'slate' };
  if (stats.failed) return { title: 'Audit has failed operations', tone: 'red' };
  return { title: 'Audit activity healthy', tone: 'green' };
}

function countForTab(tab: AuditTab, stats: ReturnType<typeof aggregateAudit>) {
  if (tab === 'ALL') return stats.total;
  if (tab === 'SUCCESS') return stats.successful;
  if (tab === 'FAILED') return stats.failed;
  return 0;
}

function filterRows(rows: SystemAdminAuditEvent[], tab: AuditTab, query: string) {
  const normalized = query.trim().toLowerCase();
  return rows.filter((event) => {
    const tabMatch = tab === 'ALL' || (tab === 'SUCCESS' && event.success) || (tab === 'FAILED' && !event.success);
    if (!tabMatch) return false;
    if (!normalized) return true;
    return [event.userEmail, event.systemRole, event.method, event.error, event.httpMethod, event.path, event.clientIp]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized));
  });
}

function eventListItem(event: SystemAdminAuditEvent): MobileDataListItem {
  const method = shortMethod(event.method);
  const tone = event.success ? methodTone(event.method) : 'danger';
  return {
    id: event.id,
    title: method,
    subtitle: event.userEmail || 'Unknown user',
    meta: `${event.systemRole || 'No role'} · ${formatDuration(event.durationMs)} · ${formatDate(event.timestamp)}`,
    amount: event.error ? 'Error' : undefined,
    status: event.success ? 'Success' : 'Failed',
    statusLabel: event.success ? 'Success' : 'Failed',
    statusTone: event.success ? 'success' : 'danger',
    initials: initialsFromName(method),
    accent: tone,
  };
}

function shortMethod(method?: string | null) {
  if (!method) return 'Unknown method';
  return method.replace(/\(\.\.\)/g, '').replace(/^.*\./, '');
}

function methodTone(method?: string | null): StatusTone {
  const text = String(method || '').toLowerCase();
  if (text.includes('delete') || text.includes('disable') || text.includes('reject')) return 'danger';
  if (text.includes('create') || text.includes('post') || text.includes('save')) return 'success';
  if (text.includes('update') || text.includes('patch') || text.includes('put')) return 'warning';
  if (text.includes('impersonate')) return 'review';
  return 'primary';
}

function methodIcon(method?: string | null) {
  const text = String(method || '').toLowerCase();
  if (text.includes('get') || text.includes('list')) return Activity;
  if (text.includes('impersonate')) return KeyRound;
  if (text.includes('delete') || text.includes('reject')) return XCircle;
  if (text.includes('update') || text.includes('create')) return Zap;
  return ShieldCheck;
}

function formatDuration(ms?: number | null) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) return 'N/A';
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

function toCsv(rows: SystemAdminAuditEvent[]) {
  const header = ['Timestamp', 'User Email', 'System Role', 'Method', 'Success', 'Duration Ms', 'Error', 'HTTP Method', 'Path', 'Client IP'];
  return [
    header,
    ...rows.map((row) => [
      row.timestamp || '',
      row.userEmail || '',
      row.systemRole || '',
      row.method || '',
      String(row.success),
      String(row.durationMs),
      row.error || '',
      row.httpMethod || '',
      row.path || '',
      row.clientIp || '',
    ]),
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}

function csvCell(value: string) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
});
