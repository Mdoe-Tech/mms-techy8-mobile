import { router } from 'expo-router';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  RefreshCw,
  Server,
  Wifi,
  XCircle,
  Zap,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileCard,
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
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getSystemAdminHealth,
  getSystemAdminWebsocketStats,
  type SystemAdminHealth,
  type SystemAdminWebsocketStats,
} from '@/services/system-admin-system-service';
import { type KpiTone, type StatusTone, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber } from '@/utils/format';

type SystemTab = 'overview' | 'database' | 'websocket' | 'diagnostics';

type MobileSystemAdminSystemScreenProps = {
  initialTab?: SystemTab;
};

const tabLabels: { value: SystemTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'database', label: 'Database' },
  { value: 'websocket', label: 'Socket' },
  { value: 'diagnostics', label: 'Diagnostics' },
];

export default function MobileSystemAdminSystemScreen({ initialTab = 'overview' }: MobileSystemAdminSystemScreenProps = {}) {
  const theme = useNaneTheme();
  const { activeView, user } = useAuth();
  const [tab, setTab] = useState<SystemTab>(initialTab);
  const [health, setHealth] = useState<SystemAdminHealth | null>(null);
  const [websocket, setWebsocket] = useState<SystemAdminWebsocketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSystem = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      const [nextHealth, nextWebsocket] = await Promise.all([getSystemAdminHealth(), getSystemAdminWebsocketStats()]);
      setHealth(nextHealth);
      setWebsocket(nextWebsocket);
      if (mode === 'refresh') setNotice('System health refreshed.');
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      if (mode === 'initial') {
        setHealth(null);
        setWebsocket(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (activeView !== 'SYSTEM_ADMIN') return undefined;
    const timer = setTimeout(() => {
      void loadSystem();
    }, 0);
    return () => clearTimeout(timer);
  }, [activeView, loadSystem]);

  const systemStatus = useMemo(() => evaluateStatus(health), [health]);
  const dbUsagePercent = connectionUsage(health);
  const activeAssociationConnections = associationConnectionRows(websocket);
  const overviewItems = useMemo(() => buildOverviewItems(health, websocket, systemStatus), [health, systemStatus, websocket]);
  const tabs = useMemo(
    () =>
      tabLabels.map((item) => ({
        ...item,
        count:
          item.value === 'database'
            ? health?.hikari.maximumPoolSize || 0
            : item.value === 'websocket'
              ? websocket?.totalOpenConnections || 0
              : item.value === 'diagnostics'
                ? Object.keys(health?.raw || {}).length + Object.keys(websocket?.raw || {}).length
                : overviewItems.length,
      })),
    [health, overviewItems.length, websocket],
  );

  if (activeView !== 'SYSTEM_ADMIN') {
    return <AccessDeniedScreen title="System health" description="Platform system monitoring is available only to system administrators." />;
  }

  if (loading && !health && !websocket) {
    return <MobilePageLoadingState kind="dashboard" message="Loading system health" />;
  }

  if (error && !health && !websocket) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Platform operations"
          title="System health"
          subtitle="Database, Redis, and realtime connections"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadSystem('refresh')} />}
        />
        <MobileErrorState title="System health unavailable" description={error} retryLabel="Retry" onRetry={() => void loadSystem('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Platform operations"
        title="System health"
        subtitle={user?.fullName ? `${user.fullName} · live infrastructure` : 'Database, Redis, and realtime connections'}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh system health" variant="secondary" disabled={refreshing} onPress={() => void loadSystem('refresh')} />}
      />

      {error ? <MobileToast title="System health issue" description={error} tone="danger" /> : null}
      {notice ? <MobileToast title="System health" description={notice} tone="success" /> : null}

      <MobileSummaryPanel
        title="Overall system health"
        value={systemStatus.label}
        description={`${formatNumber(healthyCount(health))} of 3 core checks healthy · ${formatNumber(websocket?.totalOpenConnections || 0)} realtime connections`}
        tone={systemStatus.tone}
        icon={systemStatus.icon}
        footer={<MobileProgressBar value={healthScore(health)} tone={systemStatus.tone} label="Core check score" />}
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Database" value={health?.dbOk ? 'Connected' : 'Issue'} description="PostgreSQL health" tone={health?.dbOk ? 'green' : 'red'} icon={Database} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Redis" value={health?.redisOk ? 'Connected' : 'Issue'} description="Cache health" tone={health?.redisOk ? 'green' : 'red'} icon={Zap} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="DB pool"
            value={`${formatNumber(health?.hikari.activeConnections || 0)}/${formatNumber(health?.hikari.maximumPoolSize || 0)}`}
            description={`${formatNumber(health?.hikari.idleConnections || 0)} idle`}
            tone={dbUsagePercent > 80 ? 'red' : dbUsagePercent > 50 ? 'orange' : 'blue'}
            icon={Server}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="WebSocket" value={formatNumber(websocket?.totalOpenConnections || 0)} description={`${formatNumber(activeAssociationConnections.length)} associations`} tone="teal" icon={Wifi} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs tabs={tabs} value={tab} onChange={(value) => setTab(value as SystemTab)} />

      {tab === 'overview' ? <MobileDataList items={overviewItems} showChevron={false} /> : null}

      {tab === 'database' ? (
        <>
          <MobileCard accent={dbUsagePercent > 80 ? 'red' : dbUsagePercent > 50 ? 'orange' : 'blue'}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitle}>
                <MobileText variant="section" weight="bold">
                  Database connection pool
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Active, idle, and waiting Hikari connections.
                </MobileText>
              </View>
              <MobileStatusBadge status={poolStatus(health)} tone={poolTone(health)} />
            </View>
            <MobileProgressBar value={dbUsagePercent} tone={dbUsagePercent > 80 ? 'red' : dbUsagePercent > 50 ? 'orange' : 'blue'} label="Active connection usage" />
            <MobileInfoRow icon={Activity} label="Active connections" value={formatNumber(health?.hikari.activeConnections || 0)} helper="Currently checked out from the pool." />
            <MobileInfoRow icon={CheckCircle2} label="Idle connections" value={formatNumber(health?.hikari.idleConnections || 0)} helper="Ready for incoming requests." />
            <MobileInfoRow icon={AlertTriangle} label="Awaiting threads" value={formatNumber(health?.hikari.threadsAwaitingConnections || 0)} helper="Requests waiting for a database connection." />
            <MobileInfoRow icon={Server} label="Maximum pool size" value={formatNumber(health?.hikari.maximumPoolSize || 0)} helper={health?.hikari.poolName || 'Hikari connection pool'} />
          </MobileCard>

          <MobileCard compact>
            <MobileInfoRow icon={Clock3} label="Idle timeout" value={formatDurationMs(health?.hikari.idleTimeoutMs)} helper="How long idle connections can remain open." />
            <MobileInfoRow icon={Database} label="Database host" value={jdbcHost(health?.hikari.jdbcUrl)} helper="Connection URL host only; full JDBC URL is hidden on mobile." />
          </MobileCard>
        </>
      ) : null}

      {tab === 'websocket' ? (
        <>
          <MobileCard accent="teal">
            <View style={styles.cardHeader}>
              <View style={styles.cardTitle}>
                <MobileText variant="section" weight="bold">
                  Realtime connections
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Current websocket load across active association sessions.
                </MobileText>
              </View>
              <MobileStatusBadge status={websocket?.totalOpenConnections ? 'Active' : 'Idle'} tone={websocket?.totalOpenConnections ? 'success' : 'neutral'} />
            </View>
            <MobileInfoRow icon={Wifi} label="Open connections" value={formatNumber(websocket?.totalOpenConnections || 0)} helper="Currently connected realtime clients." />
            <MobileInfoRow icon={Server} label="Associations connected" value={formatNumber(activeAssociationConnections.length)} helper="Associations with at least one realtime session." />
          </MobileCard>

          {activeAssociationConnections.length ? (
            <MobileDataList items={activeAssociationConnections} showChevron={false} />
          ) : (
            <MobileEmptyState title="No realtime clients connected" description="WebSocket sessions will appear here when association users are online." />
          )}
        </>
      ) : null}

      {tab === 'diagnostics' ? (
        <>
          <RawDataCard title="Health response" rows={health?.raw || {}} color={theme.colors.kpi.blue} />
          <RawDataCard title="Realtime response" rows={websocket?.raw || {}} color={theme.colors.kpi.teal} />
        </>
      ) : null}
    </MobileScreen>
  );
}

function evaluateStatus(health: SystemAdminHealth | null): { label: string; tone: KpiTone; icon: typeof CheckCircle2 } {
  if (!health) return { label: 'Unknown', tone: 'slate', icon: AlertTriangle };
  if (health.dbOk && health.redisOk && health.hikari.threadsAwaitingConnections === 0) return { label: 'Healthy', tone: 'green', icon: CheckCircle2 };
  if (health.dbOk || health.redisOk) return { label: 'Degraded', tone: 'orange', icon: AlertTriangle };
  return { label: 'Critical', tone: 'red', icon: XCircle };
}

function healthyCount(health: SystemAdminHealth | null) {
  if (!health) return 0;
  return [health.dbOk, health.redisOk, health.hikari.threadsAwaitingConnections === 0].filter(Boolean).length;
}

function healthScore(health: SystemAdminHealth | null) {
  return Math.round((healthyCount(health) / 3) * 100);
}

function connectionUsage(health: SystemAdminHealth | null) {
  const max = health?.hikari.maximumPoolSize || 0;
  if (!max) return 0;
  return Math.round(((health?.hikari.activeConnections || 0) / max) * 100);
}

function poolStatus(health: SystemAdminHealth | null) {
  if (!health) return 'Unknown';
  if (health.hikari.threadsAwaitingConnections > 0) return 'Waiting';
  if (connectionUsage(health) > 80) return 'High load';
  return 'Healthy';
}

function poolTone(health: SystemAdminHealth | null): StatusTone {
  if (!health) return 'neutral';
  if (health.hikari.threadsAwaitingConnections > 0 || connectionUsage(health) > 80) return 'warning';
  return 'success';
}

function buildOverviewItems(health: SystemAdminHealth | null, websocket: SystemAdminWebsocketStats | null, systemStatus: { label: string }): MobileDataListItem[] {
  return [
    {
      id: 'overall',
      title: 'Overall system health',
      subtitle: `${formatNumber(healthyCount(health))} of 3 core checks healthy`,
      meta: 'Database, Redis, connection queue',
      status: systemStatus.label,
      statusTone: statusToneForLabel(systemStatus.label),
      accent: statusToneForLabel(systemStatus.label),
    },
    {
      id: 'database',
      title: 'Database service',
      subtitle: health?.dbOk ? 'PostgreSQL is reachable' : 'Database health check failed',
      meta: `${formatNumber(health?.hikari.activeConnections || 0)} active · ${formatNumber(health?.hikari.idleConnections || 0)} idle`,
      status: health?.dbOk ? 'Healthy' : 'Issue',
      statusTone: health?.dbOk ? 'success' : 'danger',
      accent: health?.dbOk ? 'success' : 'danger',
    },
    {
      id: 'redis',
      title: 'Redis cache',
      subtitle: health?.redisOk ? 'Cache service is reachable' : 'Cache health check failed',
      meta: 'Session and background support',
      status: health?.redisOk ? 'Healthy' : 'Issue',
      statusTone: health?.redisOk ? 'success' : 'danger',
      accent: health?.redisOk ? 'success' : 'danger',
    },
    {
      id: 'websocket',
      title: 'Realtime gateway',
      subtitle: `${formatNumber(websocket?.totalOpenConnections || 0)} open connection${websocket?.totalOpenConnections === 1 ? '' : 's'}`,
      meta: `${formatNumber(Object.keys(websocket?.associationConnections || {}).length)} tracked associations`,
      status: websocket?.totalOpenConnections ? 'Active' : 'Idle',
      statusTone: websocket?.totalOpenConnections ? 'success' : 'neutral',
      accent: websocket?.totalOpenConnections ? 'success' : 'info',
    },
  ];
}

function statusToneForLabel(label: string): StatusTone {
  if (label === 'Healthy') return 'success';
  if (label === 'Degraded') return 'warning';
  if (label === 'Critical') return 'danger';
  return 'neutral';
}

function associationConnectionRows(websocket: SystemAdminWebsocketStats | null): MobileDataListItem[] {
  return Object.entries(websocket?.associationConnections || {})
    .filter(([, count]) => count > 0)
    .sort(([, left], [, right]) => right - left)
    .map(([associationId, count]) => ({
      id: associationId,
      title: shortId(associationId),
      subtitle: associationId,
      meta: 'Association realtime sessions',
      amount: formatNumber(count),
      status: count > 0 ? 'Active' : 'Idle',
      statusTone: count > 0 ? 'success' : 'neutral',
      accent: count > 0 ? 'success' : 'info',
    }));
}

function RawDataCard({ title, rows, color }: { title: string; rows: Record<string, unknown>; color: string }) {
  const entries = Object.entries(rows);
  return (
    <MobileCard>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitle}>
          <MobileText variant="section" weight="bold">
            {title}
          </MobileText>
          <MobileText variant="small" tone="secondary">
            Read-only diagnostic fields returned by Nane services.
          </MobileText>
        </View>
        <View style={[styles.rawDot, { backgroundColor: color }]} />
      </View>
      {entries.length ? (
        entries.map(([key, value]) => <MobileInfoRow key={key} label={key} value={rawValue(value)} />)
      ) : (
        <MobileEmptyState title="No diagnostic fields" description="Nane did not return extra diagnostic details for this section." />
      )}
    </MobileCard>
  );
}

function rawValue(value: unknown) {
  if (value == null) return 'N/A';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatDurationMs(value?: number | null) {
  if (!value) return 'N/A';
  if (value < 1000) return `${formatNumber(value)} ms`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${formatNumber(seconds)} sec`;
  const minutes = Math.round(seconds / 60);
  return `${formatNumber(minutes)} min`;
}

function jdbcHost(url?: string | null) {
  if (!url) return 'Not provided';
  const match = url.match(/jdbc:postgresql:\/\/([^/?]+)/);
  return match?.[1] || 'Configured';
}

function shortId(value: string) {
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rawDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    marginTop: 4,
  },
});
