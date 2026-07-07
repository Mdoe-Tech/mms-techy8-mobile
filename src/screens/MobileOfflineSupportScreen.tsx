import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Database,
  Download,
  FileJson,
  HardDrive,
  LockKeyhole,
  RefreshCw,
  RotateCw,
  Search,
  ServerCog,
  ShieldCheck,
  Trash2,
  Wifi,
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
  MobileFormSection,
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
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  cleanupOfflineServerAudit,
  getOfflineSyncStatus,
  offlineAppShellContract,
  offlineAutoReplayFeatures,
  offlineBlockedDomains,
  offlineReviewOnlyFeatures,
  offlineVerificationCommands,
  pullOfflineSyncChanges,
  type OfflineCapabilityFeature,
  type OfflineCapabilityStatus,
  type OfflineSyncPullResponse,
  type OfflineSyncServerStatus,
} from '@/services/offline-sync-service';
import { type StatusTone, statusToneFor, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber } from '@/utils/format';

type Section = 'overview' | 'capabilities' | 'audit';
type CapabilityFilter = 'all' | OfflineCapabilityStatus;

const allCapabilities = [
  ...offlineAutoReplayFeatures,
  ...offlineReviewOnlyFeatures,
  ...offlineBlockedDomains,
];

const adminSectionTabs = [
  { value: 'overview', label: 'Overview' },
  { value: 'capabilities', label: 'Capabilities' },
  { value: 'audit', label: 'Audit' },
];

const memberSectionTabs = [
  { value: 'overview', label: 'Overview' },
  { value: 'capabilities', label: 'Areas' },
  { value: 'audit', label: 'Activity' },
];

const capabilityTabs = [
  { value: 'all', label: 'All' },
  { value: 'auto-replay', label: 'Auto replay' },
  { value: 'review-only', label: 'Review' },
  { value: 'blocked', label: 'Blocked' },
];

type MobileOfflineSupportScreenProps = {
  audience?: 'admin' | 'member' | 'system-admin';
};

export default function MobileOfflineSupportScreen({ audience = 'admin' }: MobileOfflineSupportScreenProps) {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const memberMode = audience === 'member';
  const systemAdminMode = audience === 'system-admin';
  const previewTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const previewCapability = Array.isArray(params.capability) ? params.capability[0] : params.capability;
  const [section, setSection] = useState<Section>(() => parseSection(previewTab));
  const [status, setStatus] = useState<OfflineSyncServerStatus | null>(null);
  const [pullStatus, setPullStatus] = useState<OfflineSyncPullResponse | null>(null);
  const [loading, setLoading] = useState(!systemAdminMode);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupDays, setCleanupDays] = useState('30');
  const [searchTerm, setSearchTerm] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState<CapabilityFilter>('all');
  const [selectedCapability, setSelectedCapability] = useState<OfflineCapabilityFeature | null>(null);
  const [handledPreviewCapability, setHandledPreviewCapability] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canViewOffline = useMemo(() => systemAdminMode || memberMode || hasOfflineSupportPermission(user), [memberMode, systemAdminMode, user]);

  const loadOfflineStatus = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    if (mode === 'refresh') setNotice(null);

    try {
      const [serverStatus, pull] = await Promise.all([
        getOfflineSyncStatus(),
        pullOfflineSyncChanges(),
      ]);
      setStatus({
        ...serverStatus,
        recentOperations: Array.isArray(serverStatus.recentOperations) ? serverStatus.recentOperations : [],
      });
      setPullStatus({
        ...pull,
        changes: Array.isArray(pull.changes) ? pull.changes : [],
      });
      if (mode === 'refresh') setNotice('Offline sync status refreshed.');
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      if (mode === 'initial') {
        setStatus(null);
        setPullStatus(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (systemAdminMode) {
      return undefined;
    }
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadOfflineStatus();
    });
    return () => {
      active = false;
    };
  }, [loadOfflineStatus, systemAdminMode]);

  useEffect(() => {
    if (!previewCapability || handledPreviewCapability === previewCapability) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const match = allCapabilities.find((item) => slugForCapability(item) === previewCapability || item.entityType === previewCapability);
      if (!match) return;
      setSelectedCapability(match);
      setSection('capabilities');
      setHandledPreviewCapability(previewCapability);
    });
    return () => {
      active = false;
    };
  }, [handledPreviewCapability, previewCapability]);

  const metrics = useMemo(() => {
    const recent = status?.recentOperations?.length || 0;
    const applied = status?.recentOperations?.filter((operation) => operation.status === 'APPLIED').length || 0;
    const totalCapabilities = allCapabilities.length;
    const autoReplay = offlineAutoReplayFeatures.length;
    return {
      reachable: Boolean(status),
      accepted: status?.accepted || 0,
      rejected: status?.rejected || 0,
      total: status?.total || 0,
      recent,
      applied,
      retentionDays: status?.retentionDays || 30,
      checkpointChanges: pullStatus?.changes?.length || 0,
      totalCapabilities,
      autoReplay,
      guarded: offlineReviewOnlyFeatures.length + offlineBlockedDomains.length,
    };
  }, [pullStatus?.changes?.length, status]);

  const sectionTabs = memberMode ? memberSectionTabs : adminSectionTabs;

  const sectionCounts = useMemo(
    () => sectionTabs.map((tab) => ({
      ...tab,
      count: tab.value === 'overview' ? metrics.totalCapabilities : tab.value === 'capabilities' ? allCapabilities.length : metrics.recent,
    })),
    [metrics.recent, metrics.totalCapabilities, sectionTabs],
  );

  const filteredCapabilities = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return allCapabilities.filter((feature) => {
      if (capabilityFilter !== 'all' && feature.status !== capabilityFilter) return false;
      if (!query) return true;
      return [
        feature.feature,
        feature.entityType,
        feature.module,
        feature.routeArea,
        feature.apiTarget,
        feature.reason,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [capabilityFilter, searchTerm]);

  const capabilityListItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredCapabilities.map((feature) => ({
        id: slugForCapability(feature),
        title: feature.feature,
        subtitle: feature.module,
        meta: feature.entityType || feature.routeArea,
        status: feature.status,
        statusLabel: capabilityStatusLabel(feature.status),
        statusTone: capabilityTone(feature.status),
        accent: capabilityTone(feature.status),
      })),
    [filteredCapabilities],
  );

  const recentOperationItems = useMemo<MobileDataListItem[]>(
    () =>
      (status?.recentOperations || []).map((operation) => ({
        id: operation.serverOperationId || operation.operationId,
        title: operation.operationId,
        subtitle: operation.message || 'No server message recorded',
        meta: operation.serverOperationId ? `Server ${operation.serverOperationId}` : operation.errorCode || 'Client operation',
        status: operation.status,
        statusLabel: operation.status,
        statusTone: statusToneFor(operation.status),
        accent: statusToneFor(operation.status),
      })),
    [status?.recentOperations],
  );

  const exportSnapshot = async () => {
    setExporting(true);
    setError(null);
    try {
      const snapshot = {
        generatedAt: new Date().toISOString(),
        associationId,
        serverStatus: status,
        pullStatus,
        capabilities: {
          autoReplay: offlineAutoReplayFeatures,
          reviewOnly: offlineReviewOnlyFeatures,
          blocked: offlineBlockedDomains,
        },
        appShell: offlineAppShellContract,
        verificationCommands: offlineVerificationCommands,
      };
      const fileName = `nane-offline-support-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(snapshot, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Share offline support snapshot' });
      }
      setNotice(`Support snapshot ready: ${fileName}`);
    } catch (exportError) {
      setError(getApiErrorMessage(exportError));
    } finally {
      setExporting(false);
    }
  };

  const runCleanup = async () => {
    setCleaning(true);
    setError(null);
    setNotice(null);
    try {
      const safeDays = cleanupRetentionDays(cleanupDays);
      const result = await cleanupOfflineServerAudit(safeDays);
      setCleanupOpen(false);
      setNotice(`Deleted ${formatNumber(result.deletedOperations)} old audit record(s) before ${formatDateTime(result.cutoff)}.`);
      await loadOfflineStatus('refresh');
    } catch (cleanupError) {
      setError(getApiErrorMessage(cleanupError));
    } finally {
      setCleaning(false);
    }
  };

  if (memberMode && activeView !== 'MEMBER') {
    return <AccessDeniedScreen title="Offline support" description="Member offline support is available from the member portal workspace." />;
  }

  if (systemAdminMode && activeView !== 'SYSTEM_ADMIN') {
    return <AccessDeniedScreen title="Offline capability" description="Platform offline capability review is available only to system administrators." />;
  }

  if (!memberMode && !systemAdminMode && activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Offline support" description="Offline support settings are available from association admin workspaces only." />;
  }

  if (!canViewOffline) {
    return <AccessDeniedScreen title="Offline support" description="Your role cannot view offline sync support for this association." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="dashboard" message="Loading offline support" />;
  }

  if (!systemAdminMode && error && !status) {
    return (
      <MobileScreen>
        <MobilePageHeader
        showLogo
        eyebrow={pageEyebrow(memberMode, systemAdminMode)}
        title={pageTitle(systemAdminMode)}
        subtitle={pageSubtitle(memberMode, systemAdminMode)}
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadOfflineStatus('refresh')} />}
        />
        <MobileErrorState title="Offline status unavailable" description={error} retryLabel="Retry" onRetry={() => void loadOfflineStatus('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow={pageEyebrow(memberMode, systemAdminMode)}
        title={pageTitle(systemAdminMode)}
        subtitle={pageSubtitle(memberMode, systemAdminMode)}
        onBack={() => router.back()}
        rightAction={systemAdminMode ? undefined : <MobileIconButton icon={RefreshCw} label="Refresh offline status" variant="secondary" disabled={refreshing} onPress={() => void loadOfflineStatus('refresh')} />}
      />

      {error ? <MobileToast title="Offline support" description={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Offline support" description={notice} tone="success" /> : null}

      {systemAdminMode ? (
        <MobileKpiGrid>
          <MobileKpiGridItem>
            <MobileKpiCard
              title="Audit scope"
              value="Tenant-only"
              description="Status endpoints require an association workspace"
              tone="orange"
              icon={LockKeyhole}
            />
          </MobileKpiGridItem>
          <MobileKpiGridItem>
            <MobileKpiCard title="Auto replay" value={formatNumber(metrics.autoReplay)} description="Server-validated safe areas" tone="green" icon={CheckCircle2} />
          </MobileKpiGridItem>
          <MobileKpiGridItem>
            <MobileKpiCard title="Guarded" value={formatNumber(metrics.guarded)} description="Review or online-only areas" tone="red" icon={AlertTriangle} />
          </MobileKpiGridItem>
          <MobileKpiGridItem>
            <MobileKpiCard title="Capabilities" value={formatNumber(metrics.totalCapabilities)} description="Platform catalog rules" tone="purple" icon={ShieldCheck} />
          </MobileKpiGridItem>
        </MobileKpiGrid>
      ) : (
        <MobileKpiGrid>
          <MobileKpiGridItem>
            <MobileKpiCard
              title={memberMode ? 'Connection' : 'Server sync'}
              value={metrics.reachable ? (memberMode ? 'Online' : 'Reachable') : 'Unknown'}
              description={metrics.reachable ? (memberMode ? 'Offline service reachable' : 'Status endpoint online') : 'No server status'}
              tone={metrics.reachable ? 'green' : 'orange'}
              icon={metrics.reachable ? Wifi : CloudOff}
            />
          </MobileKpiGridItem>
          <MobileKpiGridItem>
            <MobileKpiCard
              title={memberMode ? 'Synced actions' : 'Accepted audit'}
              value={formatNumber(metrics.accepted)}
              description={memberMode ? `${formatNumber(metrics.recent)} recent results` : `${formatNumber(metrics.total)} total records`}
              tone="blue"
              icon={Database}
            />
          </MobileKpiGridItem>
          <MobileKpiGridItem>
            <MobileKpiCard
              title={memberMode ? 'Failed actions' : 'Rejected audit'}
              value={formatNumber(metrics.rejected)}
              description={memberMode ? `${formatNumber(metrics.rejected)} need attention` : `${formatNumber(metrics.recent)} recent outcomes`}
              tone={metrics.rejected > 0 ? 'red' : 'green'}
              icon={AlertTriangle}
            />
          </MobileKpiGridItem>
          <MobileKpiGridItem>
            <MobileKpiCard
              title={memberMode ? 'Offline areas' : 'Capabilities'}
              value={formatNumber(metrics.totalCapabilities)}
              description={memberMode ? `${metrics.autoReplay} can sync, ${metrics.guarded} stay online` : `${metrics.autoReplay} replay, ${metrics.guarded} guarded`}
              tone="purple"
              icon={ShieldCheck}
            />
          </MobileKpiGridItem>
        </MobileKpiGrid>
      )}

      <MobileStatusTabs tabs={sectionCounts} value={section} onChange={(value) => setSection(parseSection(value))} />

      {section === 'overview' ? (
        <OverviewSection
          metrics={metrics}
          onExport={() => void exportSnapshot()}
          exporting={exporting}
          memberMode={memberMode}
          systemAdminMode={systemAdminMode}
        />
      ) : null}

      {section === 'capabilities' ? (
        <View style={styles.stack}>
          <MobileSearchToolbar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={memberMode ? 'Search offline area or reason' : 'Search module, route, API, or reason'}
          />
          <MobileStatusTabs
            tabs={capabilityTabs.map((tab) => ({
              ...tab,
              count: tab.value === 'all' ? allCapabilities.length : allCapabilities.filter((item) => item.status === tab.value).length,
            }))}
            value={capabilityFilter}
            onChange={(value) => setCapabilityFilter(parseCapabilityFilter(value))}
          />
          <MobileCard compact>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderText}>
                <MobileText variant="section" weight="bold">
                  {memberMode ? 'Offline area guide' : 'Capability catalog'}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {memberMode
                    ? `${formatNumber(filteredCapabilities.length)} of ${formatNumber(allCapabilities.length)} offline areas shown.`
                    : `${formatNumber(filteredCapabilities.length)} of ${formatNumber(allCapabilities.length)} rules shown.`}
                </MobileText>
              </View>
              <MobileStatusBadge status={capabilityStatusLabel(capabilityFilter === 'all' ? 'auto-replay' : capabilityFilter)} label={capabilityFilter === 'all' ? 'Source-backed' : capabilityStatusLabel(capabilityFilter)} tone={capabilityFilter === 'blocked' ? 'danger' : capabilityFilter === 'review-only' ? 'warning' : 'success'} />
            </View>
          </MobileCard>
          {capabilityListItems.length > 0 ? (
            <MobileDataList
              items={capabilityListItems}
              onPressItem={(item) => {
                const capability = allCapabilities.find((candidate) => slugForCapability(candidate) === item.id);
                if (capability) setSelectedCapability(capability);
              }}
            />
          ) : (
            <MobileEmptyState
              title="No capability found"
              description="Try a different search term or status tab."
              actionLabel="Clear search"
              onAction={() => setSearchTerm('')}
            />
          )}
        </View>
      ) : null}

      {section === 'audit' ? (
        <AuditSection
          status={status}
          pullStatus={pullStatus}
          recentOperationItems={recentOperationItems}
          cleanupDays={cleanupDays}
          cleaning={cleaning}
          allowCleanup={!memberMode && !systemAdminMode}
          memberMode={memberMode}
          systemAdminMode={systemAdminMode}
          onCleanupDaysChange={setCleanupDays}
          onOpenCleanup={() => setCleanupOpen(true)}
        />
      ) : null}

      <CapabilityDetailSheet capability={selectedCapability} onClose={() => setSelectedCapability(null)} />

      <MobileConfirmSheet
        visible={cleanupOpen}
        title="Clean old audit records?"
        description={`This deletes only offline sync audit rows older than ${cleanupRetentionDays(cleanupDays)} days. It does not delete members, payments, wallet records, documents, or drafts.`}
        confirmLabel={cleaning ? 'Cleaning...' : 'Clean audit'}
        destructive
        onCancel={() => setCleanupOpen(false)}
        onConfirm={() => void runCleanup()}
      />
    </MobileScreen>
  );
}

function OverviewSection({
  metrics,
  exporting,
  onExport,
  memberMode,
  systemAdminMode,
}: {
  metrics: {
    retentionDays: number;
    checkpointChanges: number;
    applied: number;
    autoReplay: number;
    guarded: number;
  };
  exporting: boolean;
  onExport: () => void;
  memberMode: boolean;
  systemAdminMode: boolean;
}) {
  return (
    <View style={styles.stack}>
      <MobileCard compact accent="green">
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <ShieldCheck color="#FFFFFF" size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.heroText}>
            <MobileText variant="section" weight="bold">
              {memberMode ? 'Offline mode is safe' : systemAdminMode ? 'Platform offline contract' : 'Offline changes stay server-validated'}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {memberMode
                ? 'Member pages can stay readable in weak connectivity. Payments, loans, wallets, and identity changes stay online-verified.'
                : systemAdminMode
                  ? 'System admins can review the global capability catalog. Tenant sync audit remains association-scoped.'
                : 'Mobile shows the same safety contract as web: narrow auto replay, explicit review for sensitive work, and blocked financial domains.'}
            </MobileText>
          </View>
        </View>
      </MobileCard>

      <MobileCard compact>
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleText}>
            <MobileText variant="section" weight="bold">
              {memberMode ? 'Member safety rules' : systemAdminMode ? 'Platform safety rules' : 'Production safety contract'}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {memberMode ? 'Clear expectations before working with poor signal.' : systemAdminMode ? 'Global rules for every tenant workspace.' : 'Clear rules for weak-connectivity work.'}
            </MobileText>
          </View>
          <MobileStatusBadge status="Active" label="Active" tone="success" />
        </View>
        <MobileInfoRow
          label={memberMode ? 'Safe recovery' : 'Auto replay'}
          value={memberMode ? `${metrics.autoReplay} safe areas` : `${metrics.autoReplay} narrow command group(s)`}
          helper={memberMode ? 'Low-risk member actions can complete only after the server validates them.' : systemAdminMode ? 'Only low-risk tenant commands are allowed to replay after reconnect.' : 'Only low-risk or server-validated commands replay automatically.'}
          icon={CheckCircle2}
          status="Approved"
        />
        <MobileInfoRow
          label={memberMode ? 'Needs review first' : 'Review required'}
          value={`${offlineReviewOnlyFeatures.length} sensitive areas`}
          helper={memberMode ? 'Uploads and profile-sensitive work ask you to review before anything changes.' : 'Uploads, identity changes, campaigns, and bank updates need a user review before mutation.'}
          icon={AlertTriangle}
          status="Under Review"
        />
        <MobileInfoRow
          label={memberMode ? 'Always online' : 'Blocked offline'}
          value={`${offlineBlockedDomains.length} protected areas`}
          helper={memberMode ? 'Payments, wallet, loans, billing, and access changes wait for a live connection.' : 'Ledger, loan, wallet, billing, subscription, and access-control mutations stay online.'}
          icon={LockKeyhole}
          status="Blocked"
        />
      </MobileCard>

      <MobileCard compact>
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleText}>
            <MobileText variant="section" weight="bold">
              {memberMode ? 'How offline support works' : 'Native mobile contract'}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {memberMode ? 'What the app does when connection quality changes.' : systemAdminMode ? 'Native app contract plus tenant-scoped server boundaries.' : 'This page is honest about what exists today.'}
            </MobileText>
          </View>
          {memberMode ? null : <MobileButton label="Snapshot" icon={Download} size="sm" variant="secondary" loading={exporting} onPress={onExport} />}
        </View>
        {memberMode ? (
          <>
            <MobileInfoRow label="Readable pages" value="Available" helper="Saved member information can remain visible while the network is weak." icon={Wifi} status="Active" />
            <MobileInfoRow label="Protected changes" value="Online check" helper="Money, wallet, loan, and identity actions require a live server response." icon={ShieldCheck} status="Approved" />
            <MobileInfoRow label="Refresh marker" value={`${metrics.checkpointChanges} updates`} helper="The server tells the app when fresh cached data is available." icon={RotateCw} />
          </>
        ) : (
          offlineAppShellContract.map((item) => (
            <MobileInfoRow key={item.label} label={item.label} value={item.value} helper={item.helper} icon={ServerCog} />
          ))
        )}
      </MobileCard>

      <MobileCard compact>
        <MobileText variant="section" weight="bold">
          Sync readiness
        </MobileText>
        <MobileProgressBar
          value={Math.round((metrics.autoReplay / Math.max(1, metrics.autoReplay + metrics.guarded)) * 100)}
          label={memberMode ? 'Safe offline coverage' : systemAdminMode ? 'Platform auto replay coverage' : 'Auto replay coverage'}
          tone="green"
        />
        <MobileInfoRow label={systemAdminMode ? 'Audit scope' : 'History window'} value={systemAdminMode ? 'Association required' : `${metrics.retentionDays} days`} helper={memberMode ? 'How long the server keeps recent sync activity.' : systemAdminMode ? 'Server sync audit is stored per association, not globally.' : 'Server-side audit window for sync operations.'} icon={HardDrive} />
        <MobileInfoRow label="Latest refresh" value={systemAdminMode ? 'Tenant scoped' : `${metrics.checkpointChanges} changes`} helper={memberMode ? 'Current server refresh result for this member session.' : systemAdminMode ? 'Open an association workspace to run /sync/pull.' : 'Current checkpoint response from /sync/pull.'} icon={RotateCw} />
        <MobileInfoRow label={memberMode ? 'Synced recently' : systemAdminMode ? 'Platform evidence' : 'Applied recently'} value={systemAdminMode ? 'Catalog only' : `${metrics.applied} operations`} helper={memberMode ? 'Recent activity safely accepted by the server.' : systemAdminMode ? 'This view verifies the supported capability catalog without tenant audit rows.' : 'Recent server outcomes marked APPLIED.'} icon={CheckCircle2} />
      </MobileCard>
    </View>
  );
}

function AuditSection({
  status,
  pullStatus,
  recentOperationItems,
  cleanupDays,
  cleaning,
  allowCleanup,
  memberMode,
  systemAdminMode,
  onCleanupDaysChange,
  onOpenCleanup,
}: {
  status: OfflineSyncServerStatus | null;
  pullStatus: OfflineSyncPullResponse | null;
  recentOperationItems: MobileDataListItem[];
  cleanupDays: string;
  cleaning: boolean;
  allowCleanup: boolean;
  memberMode: boolean;
  systemAdminMode: boolean;
  onCleanupDaysChange: (value: string) => void;
  onOpenCleanup: () => void;
}) {
  return (
    <View style={styles.stack}>
      <MobileCard compact>
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleText}>
            <MobileText variant="section" weight="bold">
              {memberMode ? 'Sync activity' : systemAdminMode ? 'Tenant sync audit boundary' : 'Server sync audit'}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {memberMode ? 'Recent server status for this member session.' : systemAdminMode ? 'Offline sync rows are available after selecting an association workspace.' : 'Association-scoped server evidence from /sync/status.'}
            </MobileText>
          </View>
          <MobileStatusBadge status={status ? 'Active' : 'Unknown'} label={status ? 'Reachable' : systemAdminMode ? 'Tenant scope' : 'Unknown'} tone={status ? 'success' : 'warning'} />
        </View>
        <MobileInfoRow label={systemAdminMode ? 'Scope' : 'Server time'} value={systemAdminMode ? 'Association required' : formatDateTime(status?.serverTime)} helper={memberMode ? 'Latest time returned by the server.' : systemAdminMode ? 'Backend sync status rejects non-association-scoped sessions.' : 'Timestamp returned by the sync service.'} icon={ServerCog} />
        <MobileInfoRow label={memberMode ? 'Synced actions' : systemAdminMode ? 'Accepted audit' : 'Accepted'} value={systemAdminMode ? 'Tenant scoped' : formatNumber(status?.accepted || 0)} helper={memberMode ? 'Actions safely accepted by the server.' : systemAdminMode ? 'Open an association workspace to inspect accepted operations.' : 'Operations accepted into server audit.'} icon={CheckCircle2} status="Accepted" />
        <MobileInfoRow label={memberMode ? 'Failed actions' : systemAdminMode ? 'Rejected audit' : 'Rejected'} value={systemAdminMode ? 'Tenant scoped' : formatNumber(status?.rejected || 0)} helper={memberMode ? 'Actions stopped by server validation.' : systemAdminMode ? 'Rejected operations are stored per association.' : 'Operations rejected by server validation.'} icon={AlertTriangle} status={status?.rejected ? 'Rejected' : 'Completed'} />
        <MobileInfoRow label="History window" value={systemAdminMode ? 'Tenant scoped' : `${status?.retentionDays || 30} days`} helper={memberMode ? 'How long recent sync activity remains visible.' : systemAdminMode ? 'Retention cleanup is disabled in system-admin catalog mode.' : 'Audit retention window configured by the backend.'} icon={HardDrive} />
      </MobileCard>

      {allowCleanup ? (
        <MobileFormSection
          title="Audit maintenance"
          description="Deletes only old sync audit rows for this association. It does not touch business records."
        >
          <MobileTextInput
            label="Keep days"
            value={cleanupDays}
            onChangeText={onCleanupDaysChange}
            keyboardType="number-pad"
            helperText="Allowed range is 7 to 365 days."
          />
          <MobileButton
            label={cleaning ? 'Cleaning audit' : 'Clean old audit'}
            icon={Trash2}
            variant="danger"
            loading={cleaning}
            fullWidth
            onPress={onOpenCleanup}
          />
        </MobileFormSection>
      ) : null}

      <MobileCard compact>
        <MobileText variant="section" weight="bold">
          {memberMode ? 'Refresh state' : 'Pull checkpoint'}
        </MobileText>
        <MobileInfoRow label={memberMode ? 'Refresh marker' : 'Checkpoint'} value={systemAdminMode ? 'Association required' : pullStatus?.checkpoint || 'Server generated'} helper={memberMode ? 'Server marker used to check for newer data.' : systemAdminMode ? 'The backend pull endpoint requires tenant context.' : 'Current checkpoint marker for future native cache refreshes.'} icon={RotateCw} />
        <MobileInfoRow label="Changes" value={systemAdminMode ? 'Tenant scoped' : formatNumber(pullStatus?.changes?.length || 0)} helper={memberMode ? 'Updates currently available from the server.' : systemAdminMode ? 'Use an association workspace to inspect pull changes.' : 'Read-side changes returned in this smoke-sized status call.'} icon={Database} />
      </MobileCard>

      <MobileCard compact>
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleText}>
            <MobileText variant="section" weight="bold">
              {memberMode ? 'Recent sync results' : systemAdminMode ? 'Recent tenant operations' : 'Recent operations'}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {memberMode ? 'Latest offline-related results for this account.' : systemAdminMode ? 'Operation rows appear after entering an association workspace.' : 'Latest server outcomes for the current user and association.'}
            </MobileText>
          </View>
          <MobileStatusBadge status="Info" label={`${recentOperationItems.length}`} tone="info" />
        </View>
      </MobileCard>
      {recentOperationItems.length > 0 ? (
        <MobileDataList items={recentOperationItems} showChevron={false} />
      ) : (
        <MobileEmptyState
          title="No server sync operations"
          description={memberMode ? 'No recent offline sync activity was found for this member account.' : systemAdminMode ? 'System admin catalog mode does not load tenant sync rows.' : 'No recent offline sync operations were found for this account.'}
        />
      )}

      {memberMode ? null : (
        <MobileCard compact>
          <MobileText variant="section" weight="bold">
            Verification commands
          </MobileText>
          <View style={styles.commandList}>
            {offlineVerificationCommands.map((command) => (
              <CommandRow key={command} command={command} />
            ))}
          </View>
        </MobileCard>
      )}
    </View>
  );
}

function CommandRow({ command }: { command: string }) {
  const theme = useNaneTheme();
  return (
    <View style={[styles.commandRow, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
      <FileJson color={theme.colors.primary} size={16} />
      <MobileText variant="tiny" weight="bold" numberOfLines={2} style={styles.commandText}>
        {command}
      </MobileText>
    </View>
  );
}

function CapabilityDetailSheet({
  capability,
  onClose,
}: {
  capability: OfflineCapabilityFeature | null;
  onClose: () => void;
}) {
  if (!capability) return null;

  return (
    <MobileSheet
      visible={Boolean(capability)}
      title={capability.feature}
      description={capability.module}
      onClose={onClose}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
        <MobileStatusBadge
          status={capability.status}
          label={capabilityStatusLabel(capability.status)}
          tone={capabilityTone(capability.status)}
        />
        <MobileInfoRow label="Route area" value={capability.routeArea} helper="Where this rule applies in Nane." icon={Search} />
        <MobileInfoRow label="API target" value={capability.apiTarget || 'Not defined'} helper="Server endpoint or route family involved." icon={ServerCog} />
        <MobileInfoRow label="Entity type" value={capability.entityType || 'Route level'} helper="Offline queue entity marker where available." icon={Database} />
        <MobileCard compact>
          <MobileText variant="small" tone="secondary">
            {capability.reason}
          </MobileText>
        </MobileCard>
        <MobileButton label="Close" variant="secondary" fullWidth onPress={onClose} />
      </ScrollView>
    </MobileSheet>
  );
}

function parseSection(value?: string | null): Section {
  if (value === 'capabilities' || value === 'audit' || value === 'overview') return value;
  return 'overview';
}

function pageEyebrow(memberMode: boolean, systemAdminMode: boolean) {
  if (memberMode) return 'Member portal';
  if (systemAdminMode) return 'Platform operations';
  return 'Settings';
}

function pageTitle(systemAdminMode: boolean) {
  return systemAdminMode ? 'Offline capability' : 'Offline support';
}

function pageSubtitle(memberMode: boolean, systemAdminMode: boolean) {
  if (memberMode) return 'Offline readiness and online-only safety rules.';
  if (systemAdminMode) return 'Platform catalog, safety rules, and tenant audit boundaries.';
  return 'Sync audit, replay rules, and diagnostics.';
}

function parseCapabilityFilter(value: string): CapabilityFilter {
  if (value === 'auto-replay' || value === 'review-only' || value === 'blocked') return value;
  return 'all';
}

function capabilityStatusLabel(status: OfflineCapabilityStatus) {
  if (status === 'auto-replay') return 'Auto replay';
  if (status === 'review-only') return 'Review only';
  return 'Blocked';
}

function capabilityTone(status: OfflineCapabilityStatus): StatusTone {
  if (status === 'auto-replay') return 'success';
  if (status === 'review-only') return 'warning';
  return 'danger';
}

function slugForCapability(feature: OfflineCapabilityFeature) {
  return `${feature.module}-${feature.feature}-${feature.entityType || 'route'}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function cleanupRetentionDays(value: string) {
  return Math.max(7, Math.min(365, Math.trunc(Number(value)) || 30));
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-TZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803D',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitleText: {
    flex: 1,
    minWidth: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  commandList: {
    gap: 8,
    marginTop: 12,
  },
  commandRow: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  commandText: {
    flex: 1,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 18,
  },
});

function hasOfflineSupportPermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string; systemRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || '', user?.systemRole || ''].map((value) => value.toLowerCase());
  return values.some((value) => ['offline.sync', 'settings.view', 'settings.update', 'config.view', 'config.write', 'admin', 'association_admin', 'system_admin'].includes(value) || value.includes('admin'));
}
