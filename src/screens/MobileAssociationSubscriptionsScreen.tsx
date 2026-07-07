import { router, useLocalSearchParams } from 'expo-router';
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  Package,
  Plus,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
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
  MobileReportExportButton,
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAllAssociationMembers, type AssociationMember } from '@/services/member-service';
import {
  getAllAssociationSubscriptions,
  updateAllAssociationSubscriptionStatuses,
  updateMultipleSubscriptionStatuses,
  updateSubscriptionBillingCycle,
  updateSubscriptionStatus,
  type BillingCycle,
  type BulkStatusUpdateResponse,
  type MemberSubscription,
  type SubscriptionStatus,
} from '@/services/subscription-service';
import { type KpiTone, type StatusTone, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, initialsFromName } from '@/utils/format';

type SubscriptionFilter = 'ALL' | SubscriptionStatus;
type SubscriptionSort = 'createdDesc' | 'memberAsc' | 'packageAsc' | 'amountDesc' | 'statusAsc';
type StatusAction =
  | { kind: 'single'; targetStatus: SubscriptionStatus; subscription: MemberSubscription }
  | { kind: 'selected'; targetStatus: SubscriptionStatus }
  | { kind: 'all'; targetStatus: SubscriptionStatus; currentFilter: SubscriptionStatus }
  | null;

const sortOptions = [
  { value: 'createdDesc', label: 'Newest first', description: 'Recently created subscriptions first.' },
  { value: 'memberAsc', label: 'Member name', description: 'Alphabetical member order.' },
  { value: 'packageAsc', label: 'Package name', description: 'Alphabetical package order.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest subscription amount first.' },
  { value: 'statusAsc', label: 'Status', description: 'Pending and active subscriptions first.' },
];

const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const billingCycleOptions = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BI_WEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUAL', label: 'Semi-annual' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'FREE', label: 'Free' },
];

export default function MobileAssociationSubscriptionsScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const theme = useNaneTheme();
  const paramSubscriptionId = firstParam(params.subscriptionId) || firstParam(params.id);
  const [subscriptions, setSubscriptions] = useState<MemberSubscription[]>([]);
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [pagesFetched, setPagesFetched] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SubscriptionFilter>('ALL');
  const [sortBy, setSortBy] = useState<SubscriptionSort>('createdDesc');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<SubscriptionStatus>('ACTIVE');
  const [detailSubscription, setDetailSubscription] = useState<MemberSubscription | null>(null);
  const [statusAction, setStatusAction] = useState<StatusAction>(null);
  const [actionReason, setActionReason] = useState('');
  const [billingTarget, setBillingTarget] = useState<MemberSubscription | null>(null);
  const [newBillingCycle, setNewBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [billingIsFree, setBillingIsFree] = useState(false);
  const initialDetailConsumed = useRef(false);

  const canManageSubscriptions = useMemo(() => hasSubscriptionManagePermission(user), [user]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const loadSubscriptions = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);

      setError(null);
      setFeatureUnavailable(false);
      try {
        const [subscriptionPage, memberPage] = await Promise.all([
          getAllAssociationSubscriptions(associationId, { size: 200, sort: 'createdAt,desc' }, { maxPages: 25 }),
          getAllAssociationMembers(associationId, { size: 250, sort: 'fullLegalName,asc' }),
        ]);
        setSubscriptions(subscriptionPage.content.filter((subscription) => Boolean(subscription?.id)));
        setServerTotal(subscriptionPage.totalElements);
        setPagesFetched(subscriptionPage.pagesFetched);
        setMembers(memberPage.content.filter((member) => Boolean(member?.id)));
      } catch (loadError) {
        const message = getApiErrorMessage(loadError);
        setSubscriptions([]);
        setMembers([]);
        setServerTotal(0);
        setPagesFetched(0);
        if (isFeatureUnavailable(message)) {
          setFeatureUnavailable(true);
          setError(null);
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadSubscriptions());
  }, [loadSubscriptions]);

  useEffect(() => {
    if (!paramSubscriptionId || initialDetailConsumed.current || subscriptions.length === 0) return;
    const match = subscriptions.find((subscription) => subscription.id === paramSubscriptionId);
    if (!match) return;
    initialDetailConsumed.current = true;
    const timer = setTimeout(() => setDetailSubscription(match), 0);
    return () => clearTimeout(timer);
  }, [paramSubscriptionId, subscriptions]);

  const metrics = useMemo(() => computeSubscriptionMetrics(subscriptions), [subscriptions]);

  const tabs = useMemo(() => [
    { value: 'ALL', label: 'All', count: subscriptions.length },
    { value: 'PENDING', label: 'Pending', count: metrics.pending },
    { value: 'ACTIVE', label: 'Active', count: metrics.active },
    { value: 'CANCELLED', label: 'Cancelled', count: metrics.cancelled },
    { value: 'EXPIRED', label: 'Expired', count: metrics.expired },
  ].filter((tab) => tab.value === 'ALL' || tab.count > 0), [metrics, subscriptions.length]);

  const visibleSubscriptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return subscriptions
      .filter((subscription) => {
        const status = statusOf(subscription);
        if (filter !== 'ALL' && status !== filter) return false;
        if (!term) return true;
        const member = subscription.memberId ? memberById.get(subscription.memberId) : null;
        return [
          member?.fullLegalName,
          member?.membershipNumber,
          member?.contactInfo?.email,
          packageName(subscription),
          cycleLabel(cycleOf(subscription)),
          status,
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => sortSubscriptions(a, b, sortBy, memberById));
  }, [filter, memberById, search, sortBy, subscriptions]);

  const subscriptionReportOptions = useMemo(
    () => ({
      title: 'Member Subscriptions',
      associationName: user?.associationName || 'Association',
      purpose: 'A current-view report of member subscriptions, package billing, subscription status, and key dates.',
      rows: visibleSubscriptions,
      fileName: 'nane-member-subscriptions',
      metrics: [
        { label: 'Subscriptions', value: formatNumber(metrics.total), helper: 'Loaded records' },
        { label: 'Pending', value: formatNumber(metrics.pending), helper: 'Need review' },
        { label: 'Active', value: formatNumber(metrics.active), helper: 'Currently billed' },
        { label: 'Cycle value', value: formatCurrency(metrics.cycleValue), helper: 'Visible subscription amount' },
      ],
      filters: [
        { label: 'Search', value: search || 'All' },
        { label: 'Status', value: tabs.find((tab) => tab.value === filter)?.label || filter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortBy)?.label || sortBy },
        { label: 'Loaded from server', value: `${formatNumber(subscriptions.length)} of ${formatNumber(serverTotal || subscriptions.length)}` },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: MemberSubscription, index: number) => index + 1 },
        { key: 'member', label: 'Member', width: '17%', value: (row: MemberSubscription) => memberName(row, memberById) },
        { key: 'membershipNumber', label: 'Membership No.', width: '12%', value: (row: MemberSubscription) => (row.memberId ? memberById.get(row.memberId)?.membershipNumber || '-' : '-') },
        { key: 'package', label: 'Package', width: '16%', value: (row: MemberSubscription) => packageName(row) },
        { key: 'cycle', label: 'Billing Cycle', width: '12%', value: (row: MemberSubscription) => cycleLabel(cycleOf(row)) },
        { key: 'amount', label: 'Amount', align: 'right' as const, width: '12%', value: (row: MemberSubscription) => formatCurrency(amountNumber(row.amount)) },
        { key: 'status', label: 'Status', width: '10%', value: (row: MemberSubscription) => statusOf(row) },
        { key: 'startDate', label: 'Start Date', width: '11%', value: (row: MemberSubscription) => formatDate(row.startDate) },
        { key: 'endDate', label: 'End Date', width: '11%', value: (row: MemberSubscription) => formatDate(row.endDate) },
        { key: 'createdAt', label: 'Created', width: '11%', value: (row: MemberSubscription) => formatDate(row.createdAt) },
      ],
    }),
    [filter, memberById, metrics, search, serverTotal, sortBy, subscriptions.length, tabs, user?.associationName, visibleSubscriptions],
  );

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association workspace required" description="Subscriptions are managed from the association admin workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading member subscriptions" />;
  }

  async function refresh() {
    await loadSubscriptions('refresh');
  }

  function toggleSelected(subscriptionId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(subscriptionId)) next.delete(subscriptionId);
      else next.add(subscriptionId);
      return next;
    });
  }

  function openBilling(subscription: MemberSubscription) {
    setBillingTarget(subscription);
    setNewBillingCycle(cycleOf(subscription));
    setBillingIsFree(amountNumber(subscription.amount) <= 0 || cycleOf(subscription) === 'FREE');
    setDetailSubscription(null);
  }

  async function confirmStatusAction() {
    if (!statusAction || !associationId) return;
    setWorking(true);
    setError(null);
    try {
      if (statusAction.kind === 'single') {
        await updateSubscriptionStatus(statusAction.subscription.id, statusAction.targetStatus);
        setNotice(`${memberName(statusAction.subscription, memberById)} marked ${statusAction.targetStatus.toLowerCase()}.`);
      } else if (statusAction.kind === 'selected') {
        const response = await updateMultipleSubscriptionStatuses(Array.from(selectedIds), statusAction.targetStatus);
        setNotice(formatBulkStatusResult(response, statusAction.targetStatus));
        setSelectedIds(new Set());
      } else {
        const response = await updateAllAssociationSubscriptionStatuses(associationId, statusAction.targetStatus, statusAction.currentFilter);
        setNotice(formatBulkStatusResult(response, statusAction.targetStatus));
        setSelectedIds(new Set());
      }
      setStatusAction(null);
      setActionReason('');
      setDetailSubscription(null);
      await loadSubscriptions('refresh');
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setWorking(false);
    }
  }

  async function saveBillingCycle() {
    if (!billingTarget) return;
    setWorking(true);
    setError(null);
    try {
      await updateSubscriptionBillingCycle(billingTarget.id, newBillingCycle, billingIsFree);
      setNotice(`Billing cycle updated for ${memberName(billingTarget, memberById)}.`);
      setBillingTarget(null);
      await loadSubscriptions('refresh');
    } catch (billingError) {
      setError(getApiErrorMessage(billingError));
    } finally {
      setWorking(false);
    }
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Subscriptions"
        eyebrow="Membership billing"
        subtitle={`${formatNumber(subscriptions.length)} loaded from ${formatNumber(serverTotal || subscriptions.length)} server records across ${formatNumber(pagesFetched)} page${pagesFetched === 1 ? '' : 's'}.`}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh subscriptions" onPress={refresh} disabled={refreshing} />}
      />

      {notice ? <MobileToast title={notice} tone="success" /> : null}
      {error ? <MobileErrorState title="Subscription action failed" description={error} onRetry={refresh} /> : null}

      {featureUnavailable ? (
        <FeatureUnavailableState onRefresh={refresh} />
      ) : (
        <>
          <MobileKpiGrid>
            <MobileKpiGridItem>
              <MobileKpiCard title="Subscriptions" value={formatNumber(metrics.total)} description="Loaded records" tone="blue" icon={Package} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Pending" value={formatNumber(metrics.pending)} description="Need review" tone="orange" icon={Clock3} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Active" value={formatNumber(metrics.active)} description="Currently billed" tone="green" icon={CheckCircle2} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Cycle Value" value={formatCurrency(metrics.cycleValue)} description="Visible subscription amount" tone="purple" icon={Banknote} />
            </MobileKpiGridItem>
          </MobileKpiGrid>

          <View style={styles.actionsRow}>
            <MobileButton label="Subscribe member" icon={Plus} onPress={() => router.push({ pathname: '/work/route-preview', params: { routeId: 'association-admin-associations-subscriptions-subscribe-member' } } as never)} disabled={!canManageSubscriptions} />
            <MobileReportExportButton options={subscriptionReportOptions} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
          </View>

          {!canManageSubscriptions ? (
            <MobileCard compact accent="orange" style={styles.noticeCard}>
              <ShieldAlert color={theme.colors.status.warning} size={20} />
              <View style={styles.noticeCopy}>
                <MobileText variant="small" weight="bold">
                  Read-only access
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Your account can review subscriptions, but approvals and billing changes require subscription management permission.
                </MobileText>
              </View>
            </MobileCard>
          ) : null}

          {selectedIds.size > 0 ? (
            <MobileCard compact accent="blue">
              <View style={styles.bulkHeader}>
                <View>
                  <MobileText variant="small" weight="bold">
                    {formatNumber(selectedIds.size)} selected
                  </MobileText>
                  <MobileText variant="small" tone="secondary">
                    Apply a status update to checked subscriptions.
                  </MobileText>
                </View>
                <MobileButton label="Clear" variant="ghost" size="sm" onPress={() => setSelectedIds(new Set())} />
              </View>
              <MobileSelect label="Set selected status to" value={bulkStatus} options={statusOptions} onChange={(value) => setBulkStatus(value as SubscriptionStatus)} />
              <MobileButton
                label="Apply to selected"
                icon={UserCheck}
                loading={working && statusAction?.kind === 'selected'}
                onPress={() => setStatusAction({ kind: 'selected', targetStatus: bulkStatus })}
                disabled={!canManageSubscriptions || selectedIds.size === 0}
                fullWidth
              />
            </MobileCard>
          ) : null}

          {canManageSubscriptions && (filter === 'PENDING' || filter === 'ACTIVE') ? (
            <MobileCard compact accent={filter === 'PENDING' ? 'green' : 'red'}>
              <View style={styles.allFilterRow}>
                <View style={styles.allFilterCopy}>
                  <MobileText variant="small" weight="bold">
                    Act on all {filter.toLowerCase()} subscriptions
                  </MobileText>
                  <MobileText variant="small" tone="secondary">
                    This affects all matching server records for the association, not only the visible rows.
                  </MobileText>
                </View>
                <MobileButton
                  label={filter === 'PENDING' ? 'Approve all' : 'Cancel all'}
                  icon={filter === 'PENDING' ? CheckCircle2 : XCircle}
                  size="sm"
                  variant={filter === 'PENDING' ? 'primary' : 'danger'}
                  onPress={() => setStatusAction({ kind: 'all', currentFilter: filter, targetStatus: filter === 'PENDING' ? 'ACTIVE' : 'CANCELLED' })}
                />
              </View>
            </MobileCard>
          ) : null}

          <MobileSearchToolbar
            value={search}
            onChange={setSearch}
            placeholder="Search member, package, cycle"
            onFilterPress={() => setSortOpen(true)}
            filterLabel="Sort"
          />
          <MobileStatusTabs tabs={tabs} value={filter} onChange={(value) => setFilter(value as SubscriptionFilter)} />

          {visibleSubscriptions.length > 0 ? (
            <View style={styles.list}>
              {visibleSubscriptions.map((subscription) => (
                <SubscriptionRow
                  key={subscription.id}
                  subscription={subscription}
                  member={subscription.memberId ? memberById.get(subscription.memberId) : undefined}
                  selected={selectedIds.has(subscription.id)}
                  canSelect={canManageSubscriptions}
                  onToggle={() => toggleSelected(subscription.id)}
                  onPress={() => setDetailSubscription(subscription)}
                />
              ))}
            </View>
          ) : (
            <MobileEmptyState
              title={subscriptions.length === 0 ? 'No subscriptions yet' : 'No matching subscriptions'}
              description={subscriptions.length === 0 ? 'Use the subscribe member flow to assign active packages to members.' : 'Try another search term, status tab, or sort order.'}
              actionLabel={canManageSubscriptions ? 'Subscribe member' : undefined}
              onAction={canManageSubscriptions ? () => router.push({ pathname: '/work/route-preview', params: { routeId: 'association-admin-associations-subscriptions-subscribe-member' } } as never) : undefined}
            />
          )}
        </>
      )}

      <SubscriptionDetailSheet
        subscription={detailSubscription}
        member={detailSubscription?.memberId ? memberById.get(detailSubscription.memberId) : undefined}
        canManage={canManageSubscriptions}
        onClose={() => setDetailSubscription(null)}
        onApprove={(subscription) => setStatusAction({ kind: 'single', targetStatus: 'ACTIVE', subscription })}
        onCancel={(subscription) => setStatusAction({ kind: 'single', targetStatus: 'CANCELLED', subscription })}
        onEditBilling={openBilling}
      />

      <StatusActionSheet
        action={statusAction}
        reason={actionReason}
        working={working}
        selectedCount={selectedIds.size}
        currentFilterCount={visibleSubscriptions.length}
        onReasonChange={setActionReason}
        onCancel={() => {
          setStatusAction(null);
          setActionReason('');
        }}
        onConfirm={confirmStatusAction}
      />

      <BillingCycleSheet
        subscription={billingTarget}
        member={billingTarget?.memberId ? memberById.get(billingTarget.memberId) : undefined}
        value={newBillingCycle}
        isFree={billingIsFree}
        working={working}
        onChange={setNewBillingCycle}
        onFreeChange={setBillingIsFree}
        onClose={() => setBillingTarget(null)}
        onSubmit={saveBillingCycle}
      />

      <MobileSortSheet
        visible={sortOpen}
        value={sortBy}
        options={sortOptions}
        onChange={(value) => {
          setSortBy(value as SubscriptionSort);
          setSortOpen(false);
        }}
        onClose={() => setSortOpen(false)}
      />
    </MobileScreen>
  );
}

function SubscriptionRow({
  subscription,
  member,
  selected,
  canSelect,
  onToggle,
  onPress,
}: {
  subscription: MemberSubscription;
  member?: AssociationMember;
  selected: boolean;
  canSelect: boolean;
  onToggle: () => void;
  onPress: () => void;
}) {
  const theme = useNaneTheme();
  const status = statusOf(subscription);
  const accent = subscriptionTone(subscription);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          shadowColor: theme.colors.shadow,
          opacity: pressed ? 0.84 : 1,
        },
      ]}
    >
      {canSelect ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          onPress={(event) => {
            event.stopPropagation?.();
            onToggle();
          }}
          style={[
            styles.checkBox,
            {
              backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
              borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
            },
          ]}
        >
          {selected ? <CheckCircle2 color={theme.colors.onPrimary} size={18} strokeWidth={2.8} /> : null}
        </Pressable>
      ) : null}
      <View style={[styles.avatar, { backgroundColor: theme.colors.status[accent] }]}>
        <MobileText variant="small" weight="bold" tone="inverse">
          {initialsFromName(member?.fullLegalName || packageName(subscription) || 'S')}
        </MobileText>
      </View>
      <View style={styles.rowMain}>
        <View style={styles.rowTitle}>
          <MobileText variant="body" weight="bold" numberOfLines={1} style={styles.rowTitleText}>
            {member?.fullLegalName || 'Unknown member'}
          </MobileText>
          <MobileStatusBadge status={statusLabel(status)} tone={statusTone(status)} />
        </View>
        <MobileText variant="small" tone="secondary" numberOfLines={1}>
          {packageName(subscription)} • {cycleLabel(cycleOf(subscription))}
        </MobileText>
        <View style={styles.rowMeta}>
          <MobileText variant="small" tone="secondary" numberOfLines={1} style={styles.rowMetaText}>
            {member?.membershipNumber || 'No membership no.'} • {formatDate(subscription.createdAt)}
          </MobileText>
          <MobileText variant="small" weight="bold" numberOfLines={1}>
            {formatCurrency(amountNumber(subscription.amount), packageCurrency(subscription))}
          </MobileText>
        </View>
      </View>
    </Pressable>
  );
}

function SubscriptionDetailSheet({
  subscription,
  member,
  canManage,
  onClose,
  onApprove,
  onCancel,
  onEditBilling,
}: {
  subscription: MemberSubscription | null;
  member?: AssociationMember;
  canManage: boolean;
  onClose: () => void;
  onApprove: (subscription: MemberSubscription) => void;
  onCancel: (subscription: MemberSubscription) => void;
  onEditBilling: (subscription: MemberSubscription) => void;
}) {
  if (!subscription) return null;
  const status = statusOf(subscription);

  return (
    <MobileSheet visible={Boolean(subscription)} title={memberName(subscription, new Map(member ? [[member.id, member]] : []))} description={packageName(subscription)} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
        {canManage && (status === 'PENDING' || status === 'ACTIVE') ? (
          <View style={styles.detailActions}>
            <MobileButton label="Billing" icon={Edit3} size="sm" variant="secondary" onPress={() => onEditBilling(subscription)} />
            {status === 'PENDING' ? (
              <>
                <MobileButton label="Approve" icon={CheckCircle2} size="sm" onPress={() => onApprove(subscription)} />
                <MobileButton label="Deny" icon={XCircle} size="sm" variant="danger" onPress={() => onCancel(subscription)} />
              </>
            ) : (
              <MobileButton label="Cancel" icon={XCircle} size="sm" variant="danger" onPress={() => onCancel(subscription)} />
            )}
          </View>
        ) : null}

        <MobileCard compact accent={subscriptionKpiTone(subscription)}>
          <View style={styles.detailHeader}>
            <View style={styles.detailTitle}>
              <MobileText variant="section" weight="bold">
                {packageName(subscription)}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {cycleLabel(cycleOf(subscription))} membership package
              </MobileText>
            </View>
            <MobileStatusBadge status={statusLabel(status)} tone={statusTone(status)} />
          </View>
          <MobileInfoRow label="Amount" value={formatCurrency(amountNumber(subscription.amount), packageCurrency(subscription))} icon={Banknote} />
          <MobileInfoRow label="Billing cycle" value={cycleLabel(cycleOf(subscription))} icon={CalendarClock} />
          <MobileInfoRow label="Created" value={formatDate(subscription.createdAt)} icon={Clock3} />
          <MobileInfoRow label="Start date" value={formatDate(subscription.startDate)} icon={CalendarClock} />
          <MobileInfoRow label="End date" value={formatDate(subscription.endDate)} icon={CalendarClock} />
        </MobileCard>

        <MobileFormSection title="Member" description="Subscription owner details.">
          <MobileInfoRow label="Name" value={member?.fullLegalName || 'Unknown member'} icon={Users} />
          <MobileInfoRow label="Membership no." value={member?.membershipNumber || 'Not assigned'} icon={UserCheck} />
          <MobileInfoRow label="Email" value={member?.contactInfo?.email || 'Not available'} icon={Users} />
          <MobileInfoRow label="Phone" value={member?.contactInfo?.phoneNumber || 'Not available'} icon={Users} />
        </MobileFormSection>
      </ScrollView>
    </MobileSheet>
  );
}

function StatusActionSheet({
  action,
  reason,
  working,
  selectedCount,
  currentFilterCount,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  action: StatusAction;
  reason: string;
  working: boolean;
  selectedCount: number;
  currentFilterCount: number;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!action) return null;
  const destructive = action.targetStatus === 'CANCELLED';
  const denyRequiresReason = action.kind === 'single' && action.targetStatus === 'CANCELLED';
  const countLabel = action.kind === 'selected'
    ? `${selectedCount} selected subscription${selectedCount === 1 ? '' : 's'}`
    : action.kind === 'all'
      ? `all ${action.currentFilter.toLowerCase()} server records`
      : 'this subscription';
  const disabled = working || (denyRequiresReason && reason.trim().length < 3);

  return (
    <MobileSheet visible={Boolean(action)} title={destructive ? 'Cancel subscription?' : 'Approve subscription?'} description={`This will mark ${countLabel} as ${action.targetStatus.toLowerCase()}.`} onClose={onCancel}>
      <MobileText variant="body" tone="secondary">
        {action.kind === 'all'
          ? `The current visible estimate is ${formatNumber(currentFilterCount)}, but the backend will update every matching ${action.currentFilter.toLowerCase()} subscription for this association.`
          : 'Review the action before applying it.'}
      </MobileText>
      <MobileTextInput
        label={destructive ? 'Reason' : 'Note'}
        value={reason}
        onChangeText={onReasonChange}
        placeholder={destructive ? 'Why is this being cancelled?' : 'Optional approval note'}
        helperText={denyRequiresReason ? 'Required for cancellation or denial.' : 'Optional note for your records.'}
        multiline
        numberOfLines={3}
      />
      <View style={styles.sheetActions}>
        <MobileButton label="Back" variant="secondary" onPress={onCancel} />
        <MobileButton
          label={destructive ? 'Cancel subscription' : 'Approve'}
          variant={destructive ? 'danger' : 'primary'}
          loading={working}
          disabled={disabled}
          onPress={onConfirm}
          fullWidth
          style={styles.flexButton}
        />
      </View>
    </MobileSheet>
  );
}

function BillingCycleSheet({
  subscription,
  member,
  value,
  isFree,
  working,
  onChange,
  onFreeChange,
  onClose,
  onSubmit,
}: {
  subscription: MemberSubscription | null;
  member?: AssociationMember;
  value: BillingCycle;
  isFree: boolean;
  working: boolean;
  onChange: (value: BillingCycle) => void;
  onFreeChange: (value: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!subscription) return null;

  return (
    <MobileSheet visible={Boolean(subscription)} title="Edit billing cycle" description={member?.fullLegalName || packageName(subscription)} onClose={onClose}>
      <MobileInfoRow label="Current cycle" value={cycleLabel(cycleOf(subscription))} icon={CalendarClock} />
      <MobileInfoRow label="Current amount" value={formatCurrency(amountNumber(subscription.amount), packageCurrency(subscription))} icon={Banknote} />
      <MobileSelect label="New billing cycle" value={value} options={billingCycleOptions} onChange={(next) => onChange(next as BillingCycle)} />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isFree }}
        onPress={() => onFreeChange(!isFree)}
        style={({ pressed }) => [
          styles.freeToggle,
          { opacity: pressed ? 0.82 : 1 },
        ]}
      >
        <MobileStatusBadge status={isFree ? 'Free' : 'Paid'} tone={isFree ? 'success' : 'neutral'} />
        <View style={styles.noticeCopy}>
          <MobileText variant="small" weight="bold">
            Make this subscription free
          </MobileText>
          <MobileText variant="small" tone="secondary">
            The amount becomes zero and pending free subscriptions are activated by the backend.
          </MobileText>
        </View>
      </Pressable>
      <View style={styles.sheetActions}>
        <MobileButton label="Cancel" variant="secondary" onPress={onClose} />
        <MobileButton label="Update cycle" loading={working} onPress={onSubmit} fullWidth style={styles.flexButton} />
      </View>
    </MobileSheet>
  );
}

function FeatureUnavailableState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <MobileCard compact accent="orange">
      <View style={styles.featureState}>
        <ShieldAlert size={26} />
        <View style={styles.featureCopy}>
          <MobileText variant="section" weight="bold">
            Subscriptions are not enabled here
          </MobileText>
          <MobileText variant="body" tone="secondary">
            The backend currently enables package subscriptions for eligible generic associations. This workspace can continue using its member, loan, revenue, and attendance workflows without package subscriptions.
          </MobileText>
        </View>
        <MobileButton label="Refresh" icon={RefreshCw} variant="secondary" onPress={onRefresh} />
      </View>
    </MobileCard>
  );
}

function computeSubscriptionMetrics(subscriptions: MemberSubscription[]) {
  const statuses = subscriptions.map(statusOf);
  const cycleValue = subscriptions.reduce((sum, subscription) => sum + amountNumber(subscription.amount), 0);
  return {
    total: subscriptions.length,
    pending: statuses.filter((status) => status === 'PENDING').length,
    active: statuses.filter((status) => status === 'ACTIVE').length,
    cancelled: statuses.filter((status) => status === 'CANCELLED').length,
    expired: statuses.filter((status) => status === 'EXPIRED').length,
    cycleValue,
  };
}

function sortSubscriptions(
  a: MemberSubscription,
  b: MemberSubscription,
  sortBy: SubscriptionSort,
  members: Map<string, AssociationMember>,
) {
  if (sortBy === 'memberAsc') return memberName(a, members).localeCompare(memberName(b, members));
  if (sortBy === 'packageAsc') return packageName(a).localeCompare(packageName(b));
  if (sortBy === 'amountDesc') return amountNumber(b.amount) - amountNumber(a.amount);
  if (sortBy === 'statusAsc') return statusOrder(statusOf(a)) - statusOrder(statusOf(b));
  return dateMs(b.createdAt) - dateMs(a.createdAt);
}

function statusOrder(status: SubscriptionStatus) {
  return ['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED'].indexOf(status);
}

function memberName(subscription: MemberSubscription, members: Map<string, AssociationMember>) {
  return subscription.memberId ? members.get(subscription.memberId)?.fullLegalName || 'Unknown member' : 'Unknown member';
}

function packageName(subscription: MemberSubscription) {
  return subscription.packageResponse?.name || subscription.membershipPackage?.name || 'Unknown package';
}

function packageCurrency(subscription: MemberSubscription) {
  return subscription.packageResponse?.currency || subscription.membershipPackage?.currency || 'TZS';
}

function statusOf(subscription: MemberSubscription): SubscriptionStatus {
  const status = String(subscription.status || 'PENDING').toUpperCase();
  if (status === 'ACTIVE' || status === 'CANCELLED' || status === 'EXPIRED') return status;
  return 'PENDING';
}

function statusLabel(status: SubscriptionStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function statusTone(status: SubscriptionStatus): StatusTone {
  if (status === 'ACTIVE') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}

function subscriptionTone(subscription: MemberSubscription): StatusTone {
  return statusTone(statusOf(subscription));
}

function subscriptionKpiTone(subscription: MemberSubscription): KpiTone {
  const status = statusOf(subscription);
  if (status === 'ACTIVE') return 'green';
  if (status === 'PENDING') return 'orange';
  if (status === 'CANCELLED') return 'red';
  return 'slate';
}

function cycleOf(subscription: MemberSubscription): BillingCycle {
  const cycle = String(subscription.billingCycle || 'MONTHLY').toUpperCase();
  if (cycle === 'WEEKLY' || cycle === 'BI_WEEKLY' || cycle === 'QUARTERLY' || cycle === 'SEMI_ANNUAL' || cycle === 'ANNUAL' || cycle === 'FREE') return cycle;
  return 'MONTHLY';
}

function cycleLabel(cycle: BillingCycle) {
  if (cycle === 'BI_WEEKLY') return 'Bi-weekly';
  if (cycle === 'SEMI_ANNUAL') return 'Semi-annual';
  return cycle.charAt(0) + cycle.slice(1).toLowerCase();
}

function amountNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function dateMs(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatBulkStatusResult(response: BulkStatusUpdateResponse, targetStatus: SubscriptionStatus) {
  const success = amountNumber(response.successfullyUpdated);
  const failed = amountNumber(response.failedUpdates);
  return `Updated ${formatNumber(success)} subscription${success === 1 ? '' : 's'} to ${targetStatus.toLowerCase()}. Failed: ${formatNumber(failed)}.`;
}

function hasSubscriptionManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) => [
    'subscriptions.manage',
    'subscriptions_manage',
    'members.manage',
    'members_manage',
    'association_admin',
    'admin',
  ].includes(value));
}

function isFeatureUnavailable(message: string) {
  return /ASSOCIATION_TYPE_FORBIDDEN|not available for this association type|forbidden/i.test(message);
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noticeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bulkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  allFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  allFilterCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  list: {
    gap: 10,
  },
  row: {
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOpacity: 0.015,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0,
  },
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitleText: {
    flex: 1,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowMetaText: {
    flex: 1,
  },
  sheetContent: {
    gap: 14,
    paddingBottom: 8,
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailTitle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  freeToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureState: {
    alignItems: 'flex-start',
    gap: 14,
  },
  featureCopy: {
    gap: 6,
  },
});
