import { router } from 'expo-router';
import {
  Activity,
  Ban,
  Building2,
  CircleDollarSign,
  LogIn,
  Mail,
  Power,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  MobileEmptyState,
  MobileErrorState,
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
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getAllSystemAdminAssociationMetrics,
  impersonateAssociationAdmin,
  impersonateAssociationUser,
  updateAssociationAccountStatus,
  type SystemAdminAssociationMetricsRow,
  type SystemAdminImpersonationResponse,
} from '@/services/dashboard-service';
import { labelFromStatus, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type AssociationFilter = 'all' | 'active' | 'disabled' | 'attention' | 'live';

type StatusAction = {
  row: SystemAdminAssociationMetricsRow;
  nextStatus: 'ACTIVE' | 'DISABLED';
} | null;

type ImpersonationAction = {
  row: SystemAdminAssociationMetricsRow;
  mode: 'admin' | 'user';
  email?: string;
} | null;

type Notice = {
  title: string;
  description?: string;
  tone?: StatusTone;
} | null;

type MobileSystemAdminAssociationsScreenProps = {
  initialAssociationId?: string;
  initialMode?: 'detail' | 'disable';
};

export default function MobileSystemAdminAssociationsScreen({
  initialAssociationId,
  initialMode,
}: MobileSystemAdminAssociationsScreenProps = {}) {
  const { activeView, replaceSession } = useAuth();
  const [rows, setRows] = useState<SystemAdminAssociationMetricsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<AssociationFilter>('all');
  const [selectedRow, setSelectedRow] = useState<SystemAdminAssociationMetricsRow | null>(null);
  const [statusAction, setStatusAction] = useState<StatusAction>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [impersonationAction, setImpersonationAction] = useState<ImpersonationAction>(null);
  const [impersonationEmail, setImpersonationEmail] = useState('');
  const [impersonating, setImpersonating] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const handledInitialSelectionRef = useRef(false);

  const loadAssociations = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);

    try {
      const response = await getAllSystemAdminAssociationMetrics({ size: 100 });
      setRows(response.rows);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      if (mode === 'initial') setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadAssociations('initial'));
  }, [loadAssociations]);

  useEffect(() => {
    if (loading || handledInitialSelectionRef.current || !rows.length || !initialMode) return;
    handledInitialSelectionRef.current = true;
    const nextSelectedRow = initialAssociationId
      ? rows.find((row) => row.associationId === initialAssociationId)
      : rows.slice().sort(sortAssociationRows)[0];
    if (nextSelectedRow) {
      void Promise.resolve().then(() => {
        if (initialMode === 'disable') {
          setStatusAction({ row: nextSelectedRow, nextStatus: 'DISABLED' });
          setStatusReason(nextSelectedRow.accountStatusReason || '');
          return;
        }
        setImpersonationEmail(nextSelectedRow.adminEmail || '');
        setSelectedRow(nextSelectedRow);
      });
    }
  }, [initialAssociationId, initialMode, loading, rows]);

  const totals = useMemo(() => aggregateAssociations(rows), [rows]);
  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: rows.length },
      { value: 'active', label: 'Active', count: rows.filter((row) => !isDisabledAssociation(row)).length },
      { value: 'disabled', label: 'Disabled', count: rows.filter(isDisabledAssociation).length },
      { value: 'attention', label: 'Review', count: rows.filter((row) => associationAttention(row) > 0).length },
      { value: 'live', label: 'Live', count: rows.filter((row) => row.currentWebsocketConnections > 0).length },
    ],
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (filter === 'active' && isDisabledAssociation(row)) return false;
        if (filter === 'disabled' && !isDisabledAssociation(row)) return false;
        if (filter === 'attention' && associationAttention(row) === 0) return false;
        if (filter === 'live' && row.currentWebsocketConnections === 0) return false;
        if (!query) return true;
        return [row.associationName, row.associationId, row.associationType, row.schemaName, row.adminEmail]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort(sortAssociationRows);
  }, [filter, rows, searchTerm]);

  const openStatusAction = (row: SystemAdminAssociationMetricsRow, nextStatus: 'ACTIVE' | 'DISABLED') => {
    setStatusAction({ row, nextStatus });
    setStatusReason(nextStatus === 'DISABLED' ? row.accountStatusReason || '' : '');
  };

  const closeStatusAction = () => {
    if (statusUpdating) return;
    setStatusAction(null);
    setStatusReason('');
  };

  const handleStatusUpdate = async () => {
    if (!statusAction) return;
    const reason = statusReason.trim();
    if (statusAction.nextStatus === 'DISABLED' && !reason) {
      setNotice({
        title: 'Reason required',
        description: 'Add a short reason before disabling the association account.',
        tone: 'warning',
      });
      return;
    }

    setStatusUpdating(true);
    setNotice(null);
    try {
      const updated = await updateAssociationAccountStatus(statusAction.row.associationId, {
        status: statusAction.nextStatus,
        reason: reason || undefined,
      });
      setRows((currentRows) => currentRows.map((row) => (
        row.associationId === statusAction.row.associationId
          ? {
              ...row,
              accountStatus: updated.accountStatus || statusAction.nextStatus,
              accountStatusReason: updated.accountStatusReason ?? reason,
              accountStatusUpdatedAt: updated.accountStatusUpdatedAt || new Date().toISOString(),
              accountStatusUpdatedBy: updated.accountStatusUpdatedBy || null,
            }
          : row
      )));
      setSelectedRow((currentRow) => (
        currentRow?.associationId === statusAction.row.associationId
          ? {
              ...currentRow,
              accountStatus: updated.accountStatus || statusAction.nextStatus,
              accountStatusReason: updated.accountStatusReason ?? reason,
              accountStatusUpdatedAt: updated.accountStatusUpdatedAt || new Date().toISOString(),
              accountStatusUpdatedBy: updated.accountStatusUpdatedBy || null,
            }
          : currentRow
      ));
      setNotice({
        title: statusAction.nextStatus === 'DISABLED' ? 'Association disabled' : 'Association re-enabled',
        description: `${statusAction.row.associationName} is now ${statusAction.nextStatus.toLowerCase()}.`,
        tone: 'success',
      });
      setStatusAction(null);
      setStatusReason('');
    } catch (statusError) {
      setNotice({
        title: 'Status update failed',
        description: getApiErrorMessage(statusError),
        tone: 'danger',
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const openImpersonation = (row: SystemAdminAssociationMetricsRow, mode: 'admin' | 'user') => {
    if (!row.schemaName) {
      setNotice({
        title: 'Workspace key missing',
        description: 'Nane cannot open a support session for this association because its workspace key was not returned.',
        tone: 'warning',
      });
      return;
    }
    if (isDisabledAssociation(row)) {
      setNotice({
        title: 'Association disabled',
        description: 'Re-enable the association before opening an impersonated tenant session.',
        tone: 'warning',
      });
      return;
    }
    const email = impersonationEmail.trim().toLowerCase();
    if (mode === 'user' && !email) {
      setNotice({
        title: 'Email required',
        description: 'Enter the exact user email before opening a user session.',
        tone: 'warning',
      });
      return;
    }
    setImpersonationAction({ row, mode, email: mode === 'user' ? email : undefined });
  };

  const handleImpersonation = async () => {
    if (!impersonationAction?.row.schemaName) return;
    setImpersonating(true);
    setNotice(null);

    try {
      const result = impersonationAction.mode === 'admin'
        ? await impersonateAssociationAdmin(impersonationAction.row.schemaName)
        : await impersonateAssociationUser(impersonationAction.email || '', impersonationAction.row.schemaName);
      await startImpersonatedSession(result, replaceSession);
    } catch (impersonationError) {
      setNotice({
        title: 'Impersonation failed',
        description: getApiErrorMessage(impersonationError),
        tone: 'danger',
      });
    } finally {
      setImpersonating(false);
      setImpersonationAction(null);
    }
  };

  if (activeView !== 'SYSTEM_ADMIN') {
    return (
      <AccessDeniedScreen
        title="Association overview"
        description="Association management is available only to platform administrators."
      />
    );
  }

  if (loading && rows.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading associations" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="System Admin"
        title="Associations"
        subtitle="Search, review, disable, and open tenant sessions."
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh associations"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadAssociations('refresh')}
          />
        }
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone} /> : null}
      {error && rows.length > 0 ? <MobileToast title="Association list issue" description={error} tone="danger" /> : null}

      <MobileSummaryPanel
        title="Managed associations"
        value={formatNumber(totals.associations)}
        description={`${formatNumber(totals.activeAssociations)} active · ${formatNumber(totals.disabledAssociations)} disabled · ${formatNumber(totals.attention)} attention signals`}
        tone={totals.disabledAssociations > 0 ? 'orange' : 'blue'}
        icon={Building2}
      />

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search associations..." />
      <MobileStatusTabs tabs={tabs} value={filter} onChange={(nextFilter) => setFilter(nextFilter as AssociationFilter)} />

      <View style={styles.sectionHeader}>
        <View style={styles.titleBlock}>
          <MobileText variant="section" weight="bold">
            Association register
          </MobileText>
          <MobileText variant="small" tone="secondary">
            {formatNumber(filteredRows.length)} of {formatNumber(rows.length)} associations shown
          </MobileText>
        </View>
        <MobileStatusBadge
          status={totals.attention > 0 ? 'Overdue' : 'Active'}
          label={totals.attention > 0 ? 'Review' : 'Healthy'}
          tone={totals.attention > 0 ? 'danger' : 'success'}
        />
      </View>

      {error && rows.length === 0 ? (
        <MobileErrorState title="Associations could not load" description={error} retryLabel="Retry" onRetry={() => void loadAssociations('refresh')} />
      ) : filteredRows.length > 0 ? (
        <MobileDataList
          items={filteredRows.map(toAssociationListItem)}
          onPressItem={(item) => {
            const nextRow = rows.find((row) => row.associationId === item.id);
            if (nextRow) {
              setSelectedRow(nextRow);
              setImpersonationEmail(nextRow.adminEmail || '');
            }
          }}
        />
      ) : (
        <MobileEmptyState
          title="No associations found"
          description="Change the search or status tab to review more associations."
          actionLabel="Reset filters"
          onAction={() => {
            setSearchTerm('');
            setFilter('all');
          }}
        />
      )}

      <View style={styles.sectionHeader}>
        <View style={styles.titleBlock}>
          <MobileText variant="section" weight="bold">
            Platform totals
          </MobileText>
          <MobileText variant="small" tone="secondary">
            Membership, finance, login, and message signals from the same register.
          </MobileText>
        </View>
      </View>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members" value={formatCompactNumber(totals.totalMembers)} description={`${formatCompactNumber(totals.activeMembers)} active`} icon={UsersRound} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Revenue 30d" value={formatCompactCurrency(totals.revenuePaidAmount30d)} description="Paid transactions" icon={CircleDollarSign} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active loans" value={formatNumber(totals.activeLoans)} description={`${formatNumber(totals.overdueLoans)} overdue`} icon={WalletCards} tone={totals.overdueLoans > 0 ? 'red' : 'purple'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Online" value={formatNumber(totals.liveAssociations)} description="Associations live" icon={Activity} tone="teal" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <AssociationDetailSheet
        row={selectedRow}
        impersonationEmail={impersonationEmail}
        onChangeImpersonationEmail={setImpersonationEmail}
        onClose={() => setSelectedRow(null)}
        onOpenStatusAction={openStatusAction}
        onOpenImpersonation={openImpersonation}
      />

      <StatusActionSheet
        action={statusAction}
        reason={statusReason}
        updating={statusUpdating}
        onReasonChange={setStatusReason}
        onCancel={closeStatusAction}
        onConfirm={handleStatusUpdate}
      />

      <MobileConfirmSheet
        visible={Boolean(impersonationAction)}
        title={impersonationAction?.mode === 'admin' ? 'Login as association admin?' : 'Login as selected user?'}
        description={
          impersonationAction?.mode === 'admin'
            ? `This will switch your mobile session into ${impersonationAction?.row.associationName || 'the selected association'} as its first available admin.`
            : `This will switch your mobile session into ${impersonationAction?.email || 'the selected user'} inside ${impersonationAction?.row.associationName || 'the selected association'}.`
        }
        confirmLabel="Open session"
        loading={impersonating}
        onCancel={() => {
          if (!impersonating) setImpersonationAction(null);
        }}
        onConfirm={handleImpersonation}
      />
    </MobileScreen>
  );
}

function AssociationDetailSheet({
  row,
  impersonationEmail,
  onChangeImpersonationEmail,
  onClose,
  onOpenStatusAction,
  onOpenImpersonation,
}: {
  row: SystemAdminAssociationMetricsRow | null;
  impersonationEmail: string;
  onChangeImpersonationEmail: (value: string) => void;
  onClose: () => void;
  onOpenStatusAction: (row: SystemAdminAssociationMetricsRow, nextStatus: 'ACTIVE' | 'DISABLED') => void;
  onOpenImpersonation: (row: SystemAdminAssociationMetricsRow, mode: 'admin' | 'user') => void;
}) {
  const status = row ? associationStatus(row) : { status: 'Unknown', label: 'Unknown', tone: 'neutral' as StatusTone };
  const disabled = row ? isDisabledAssociation(row) : false;
  const attention = row ? associationAttention(row) : 0;

  return (
    <MobileSheet
      visible={Boolean(row)}
      title={row?.associationName || 'Association'}
      description="Workspace metrics, account state, and guarded support actions."
      onClose={onClose}
    >
      {row ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <MobileCard compact accent={disabled ? 'red' : attention > 0 ? 'orange' : 'green'}>
            <View style={styles.sheetHero}>
              <View style={styles.titleBlock}>
                <MobileText variant="section" weight="bold" numberOfLines={2}>
                  {row.associationName}
                </MobileText>
                <MobileText variant="small" tone="secondary" numberOfLines={2}>
                  {labelFromStatus(row.associationType || 'Association')} · {row.schemaName ? 'Workspace key available' : 'Workspace key missing'}
                </MobileText>
              </View>
              <MobileStatusBadge status={status.status} label={status.label} tone={status.tone} />
            </View>
          </MobileCard>

          <MobileCard compact accent={disabled ? 'red' : 'blue'} style={styles.actionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.titleBlock}>
                <MobileText variant="section" weight="bold">
                  Support actions
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  High-risk changes require confirmation before execution.
                </MobileText>
              </View>
            </View>
            <View style={styles.actionStack}>
              <MobileButton
                label={disabled ? 'Re-enable association' : 'Disable association'}
                icon={Power}
                variant={disabled ? 'secondary' : 'danger'}
                fullWidth
                onPress={() => onOpenStatusAction(row, disabled ? 'ACTIVE' : 'DISABLED')}
              />
              <MobileButton
                label="Login as admin"
                icon={LogIn}
                variant="secondary"
                fullWidth
                disabled={disabled || !row.schemaName}
                onPress={() => onOpenImpersonation(row, 'admin')}
              />
              <MobileTextInput
                label="User email"
                value={impersonationEmail}
                onChangeText={onChangeImpersonationEmail}
                placeholder="user@association.com"
                autoCapitalize="none"
                keyboardType="email-address"
                icon={Mail}
                disabled={disabled}
                helperText="Open a specific member or admin session inside this association."
              />
              <MobileButton
                label="Login as user"
                icon={LogIn}
                variant="secondary"
                fullWidth
                disabled={disabled || !row.schemaName}
                onPress={() => onOpenImpersonation(row, 'user')}
              />
            </View>
          </MobileCard>

          <MobileInfoRow label="Association ID" value={row.associationId} helper="Platform association identifier." icon={Building2} />
          <MobileInfoRow label="Admin email" value={row.adminEmail || 'Not available'} helper="Used for support and admin impersonation context." icon={Mail} />
          <MobileInfoRow label="Members" value={`${formatNumber(row.activeMembers)} active / ${formatNumber(row.totalMembers)} total`} helper={`${formatNumber(row.newMembers30d)} new in 30 days · ${formatNumber(row.incompleteRegistrations)} incomplete.`} icon={UsersRound} status={row.incompleteRegistrations > 0 ? 'Pending' : 'Completed'} />
          <MobileInfoRow label="Users" value={`${formatNumber(row.activeUsers)} active / ${formatNumber(row.totalUsers)} total`} helper={`${formatNumber(row.adminUsers)} admin users · ${formatNumber(row.lastLoginActive7d)} active in 7 days.`} icon={UserCheck} />
          <MobileInfoRow label="Revenue 30d" value={formatCurrency(row.revenuePaidAmount30d)} helper={`${formatNumber(row.paidTransactions)} paid · ${formatNumber(row.pendingTransactions)} pending · ${formatNumber(row.overdueTransactions)} overdue.`} icon={CircleDollarSign} status={row.overdueTransactions > 0 ? 'Overdue' : 'Paid'} />
          <MobileInfoRow label="Loans" value={`${formatNumber(row.activeLoans)} active`} helper={`${formatCurrency(row.loansOutstandingAmount)} outstanding · ${formatNumber(row.overdueLoans)} overdue.`} icon={WalletCards} status={row.overdueLoans > 0 ? 'Overdue' : 'Active'} />
          <MobileInfoRow label="Messaging 7d" value={`${formatNumber(row.messagesDelivered7d)} delivered`} helper={`${formatNumber(row.messagesFailed7d)} failed · ${formatNumber(row.campaignsCompleted7d)} campaigns completed.`} icon={Activity} status={row.messagesFailed7d > 0 ? 'Failed' : 'Delivered'} />
          <MobileInfoRow label="Account status" value={labelFromStatus(row.accountStatus || 'ACTIVE')} helper={row.accountStatusReason || `Last update: ${formatDate(row.accountStatusUpdatedAt)}`} icon={disabled ? Ban : ShieldCheck} status={disabled ? 'Failed' : 'Active'} />

        </ScrollView>
      ) : null}
    </MobileSheet>
  );
}

function StatusActionSheet({
  action,
  reason,
  updating,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  action: StatusAction;
  reason: string;
  updating: boolean;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <MobileSheet
      visible={Boolean(action)}
      title={action?.nextStatus === 'DISABLED' ? 'Disable association?' : 'Re-enable association?'}
      description={
        action?.nextStatus === 'DISABLED'
          ? 'Disabled associations cannot be selected at login, accessed by tenant users, or impersonated.'
          : 'Re-enabled associations become available again for login, tenant access, and support impersonation.'
      }
      onClose={onCancel}
    >
      {action ? (
        <View style={styles.actionStack}>
          <MobileCard compact accent={action.nextStatus === 'DISABLED' ? 'red' : 'green'}>
            <MobileText variant="body" weight="bold" numberOfLines={2}>
              {action.row.associationName}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {action.row.associationId}
            </MobileText>
          </MobileCard>
          <MobileTextInput
            label={action.nextStatus === 'DISABLED' ? 'Reason' : 'Note'}
            value={reason}
            onChangeText={onReasonChange}
            placeholder={action.nextStatus === 'DISABLED' ? 'Example: account exited or dues are unpaid' : 'Optional note'}
            multiline
            numberOfLines={4}
            maxLength={1000}
            helperText={
              action.nextStatus === 'DISABLED'
                ? `Required before disabling · ${reason.length}/1000 characters`
                : `${reason.length}/1000 characters`
            }
          />
          <View style={styles.sheetActions}>
            <MobileButton label="Cancel" variant="secondary" onPress={onCancel} disabled={updating} />
            <MobileButton
              label={action.nextStatus === 'DISABLED' ? 'Disable' : 'Re-enable'}
              variant={action.nextStatus === 'DISABLED' ? 'danger' : 'primary'}
              fullWidth
              loading={updating}
              disabled={updating || (action.nextStatus === 'DISABLED' && !reason.trim())}
              onPress={onConfirm}
              style={styles.confirmAction}
            />
          </View>
        </View>
      ) : null}
    </MobileSheet>
  );
}

async function startImpersonatedSession(
  result: SystemAdminImpersonationResponse,
  replaceSession: (accessToken: string, refreshToken: string, preferredView?: 'SYSTEM_ADMIN' | 'ADMIN' | 'MEMBER' | null) => Promise<unknown>,
) {
  const systemRole = String(result.systemRole || '').toUpperCase();
  const associationRole = String(result.associationRole || '').toUpperCase();
  const nextView = systemRole === 'ASSOCIATION_USER' || associationRole === 'MEMBER' ? 'MEMBER' : 'ADMIN';
  await replaceSession(result.accessToken, result.refreshToken, nextView);
  router.replace('/' as never);
}

function toAssociationListItem(row: SystemAdminAssociationMetricsRow) {
  const disabled = isDisabledAssociation(row);
  const attention = associationAttention(row);
  const status = associationStatus(row);

  return {
    id: row.associationId,
    title: row.associationName,
    subtitle: `${labelFromStatus(row.associationType || 'Association')} · ${row.adminEmail || (row.schemaName ? 'Workspace key available' : 'No admin email')}`,
    meta: `${formatCompactNumber(row.activeMembers)} active members · ${formatCompactNumber(row.activeUsers)} users`,
    amount: formatCompactCurrency(row.revenuePaidAmount30d),
    status: status.status,
    statusLabel: disabled ? 'Disabled' : attention > 0 ? `${attention} alerts` : status.label,
    statusTone: status.tone,
    accent: status.tone,
  };
}

function aggregateAssociations(rows: SystemAdminAssociationMetricsRow[]) {
  return rows.reduce(
    (totals, row) => ({
      associations: totals.associations + 1,
      activeAssociations: totals.activeAssociations + (isDisabledAssociation(row) ? 0 : 1),
      disabledAssociations: totals.disabledAssociations + (isDisabledAssociation(row) ? 1 : 0),
      liveAssociations: totals.liveAssociations + (row.currentWebsocketConnections > 0 ? 1 : 0),
      totalMembers: totals.totalMembers + row.totalMembers,
      activeMembers: totals.activeMembers + row.activeMembers,
      activeLoans: totals.activeLoans + row.activeLoans,
      overdueLoans: totals.overdueLoans + row.overdueLoans,
      revenuePaidAmount30d: totals.revenuePaidAmount30d + row.revenuePaidAmount30d,
      attention: totals.attention + associationAttention(row),
    }),
    {
      associations: 0,
      activeAssociations: 0,
      disabledAssociations: 0,
      liveAssociations: 0,
      totalMembers: 0,
      activeMembers: 0,
      activeLoans: 0,
      overdueLoans: 0,
      revenuePaidAmount30d: 0,
      attention: 0,
    },
  );
}

function associationStatus(row: SystemAdminAssociationMetricsRow): { status: string; label: string; tone: StatusTone } {
  if (isDisabledAssociation(row)) {
    return {
      status: row.accountStatus || 'Disabled',
      label: labelFromStatus(row.accountStatus || 'Disabled'),
      tone: 'danger',
    };
  }
  const attention = associationAttention(row);
  if (attention > 0) return { status: 'Overdue', label: 'Review', tone: 'danger' };
  if (row.currentWebsocketConnections > 0) return { status: 'Active', label: 'Live', tone: 'success' };
  return { status: 'Active', label: 'Active', tone: 'success' };
}

function associationAttention(row: SystemAdminAssociationMetricsRow) {
  return (
    row.incompleteRegistrations +
    row.overdueLoans +
    row.nextDueLoans7d +
    row.overdueTransactions +
    row.messagesFailed7d +
    row.campaignsFailed7d +
    (isDisabledAssociation(row) ? 1 : 0)
  );
}

function sortAssociationRows(left: SystemAdminAssociationMetricsRow, right: SystemAdminAssociationMetricsRow) {
  const disabledDelta = Number(isDisabledAssociation(right)) - Number(isDisabledAssociation(left));
  if (disabledDelta !== 0) return disabledDelta;
  const attentionDelta = associationAttention(right) - associationAttention(left);
  if (attentionDelta !== 0) return attentionDelta;
  return left.associationName.localeCompare(right.associationName);
}

function isDisabledAssociation(row: SystemAdminAssociationMetricsRow) {
  return String(row.accountStatus || 'ACTIVE').toUpperCase() !== 'ACTIVE';
}

function formatCompactCurrency(value: number) {
  return `TZS ${formatCompactNumber(value)}`;
}

function formatCompactNumber(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return formatNumber(value);
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 8,
  },
  sheetHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    gap: 14,
  },
  actionStack: {
    gap: 12,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  confirmAction: {
    flex: 1,
  },
});
