import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import {
  ArrowDownUp,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileUp,
  Package,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  UserRound,
  WalletCards,
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
  MobileFileUpload,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobileListHeaderCard,
  MobileLoadingState,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileReportExportButton,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import {
  getCurrentMemberSubscriptions,
  importSubscriptionHistory,
  type MemberSubscription,
  type SubscriptionImportFile,
  type SubscriptionImportResult,
  type SubscriptionStatus,
} from '@/services/subscription-service';
import { labelFromStatus, statusToneFor, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import type { AuthUser } from '@/types/auth';
import { formatDate, formatNumber, initialsFromName } from '@/utils/format';

type HistoryTab = 'ALL' | 'ACTIVE' | 'PENDING' | 'CANCELLED' | 'EXPIRED';
type SortValue = 'createdDesc' | 'createdAsc' | 'amountDesc' | 'amountAsc' | 'startDesc' | 'startAsc';
type Notice = { title: string; description?: string; tone?: StatusTone } | null;

const INITIAL_VISIBLE_COUNT = 12;
const LOAD_MORE_COUNT = 12;

const sortOptions = [
  { value: 'createdDesc', label: 'Newest records', description: 'Recently created subscription records first.' },
  { value: 'createdAsc', label: 'Oldest records', description: 'Earliest created subscription records first.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest subscription amount first.' },
  { value: 'amountAsc', label: 'Lowest amount', description: 'Smallest subscription amount first.' },
  { value: 'startDesc', label: 'Latest start date', description: 'Most recent subscription start first.' },
  { value: 'startAsc', label: 'Earliest start date', description: 'Oldest subscription start first.' },
] satisfies { value: SortValue; label: string; description: string }[];

export default function MobileMemberSubscriptionHistoryScreen() {
  const { activeView, associationId, user } = useAuth();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [subscriptions, setSubscriptions] = useState<MemberSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<HistoryTab>('ALL');
  const [sortValue, setSortValue] = useState<SortValue>('createdDesc');
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [selectedSubscription, setSelectedSubscription] = useState<MemberSubscription | null>(null);
  const [selectedFile, setSelectedFile] = useState<SubscriptionImportFile | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<SubscriptionImportResult | null>(null);

  const userId = user?.userId;
  const associationType = String(user?.associationType || '').toUpperCase();
  const genericSupported = associationType === 'GENERIC';
  const subscriptionRoute = getRouteByPath('/member/subscription');
  const canManageSubscriptions = canManage(user);

  const loadHistory = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId || !associationId) {
        setLoading(false);
        setLoadError('Member and association context are required before loading subscription history.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      setNotice(null);
      setFeatureUnavailable(false);

      try {
        const currentMember = await getCurrentMemberByUserId(userId);
        setMember(currentMember);

        if (!genericSupported) {
          setSubscriptions([]);
          setFeatureUnavailable(true);
          return;
        }

        const page = await getCurrentMemberSubscriptions(associationId, { size: 100 });
        setSubscriptions((page.content || []).filter((subscription) => Boolean(subscription?.id)));
      } catch (error) {
        const message = getApiErrorMessage(error);
        setSubscriptions([]);
        if (isFeatureUnavailable(message)) {
          setFeatureUnavailable(true);
          setLoadError(null);
        } else {
          setLoadError(message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, genericSupported, userId],
  );

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(() => loadHistory());
    }
  }, [activeView, loadHistory]);

  const totals = useMemo(() => {
    const active = subscriptions.filter((subscription) => statusOf(subscription) === 'ACTIVE').length;
    const pending = subscriptions.filter((subscription) => statusOf(subscription) === 'PENDING').length;
    const cancelled = subscriptions.filter((subscription) => statusOf(subscription) === 'CANCELLED').length;
    const expired = subscriptions.filter((subscription) => statusOf(subscription) === 'EXPIRED').length;
    const amount = subscriptions.reduce((sum, subscription) => sum + toNumber(subscription.amount), 0);
    return { active, pending, cancelled, expired, amount };
  }, [subscriptions]);

  const currency = useMemo(() => currencyOf(subscriptions[0]) || 'TZS', [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortSubscriptions(
      subscriptions.filter((subscription) => {
        const status = statusOf(subscription);
        if (statusFilter !== 'ALL' && status !== statusFilter) return false;
        if (!query) return true;
        return [
          subscription.id,
          packageName(subscription),
          status,
          subscription.billingCycle,
          subscription.amount,
          subscription.startDate,
          subscription.endDate,
          subscription.createdAt,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
      }),
      sortValue,
    );
  }, [search, sortValue, statusFilter, subscriptions]);

  const visibleSubscriptions = useMemo(
    () => filteredSubscriptions.slice(0, visibleCount),
    [filteredSubscriptions, visibleCount],
  );

  const tabs = useMemo(
    () => [
      { value: 'ALL', label: 'All', count: subscriptions.length },
      { value: 'ACTIVE', label: 'Active', count: totals.active },
      { value: 'PENDING', label: 'Pending', count: totals.pending },
      { value: 'CANCELLED', label: 'Cancelled', count: totals.cancelled },
      { value: 'EXPIRED', label: 'Expired', count: totals.expired },
    ],
    [subscriptions.length, totals.active, totals.cancelled, totals.expired, totals.pending],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleSubscriptions.map((subscription) => {
        const status = labelFromStatus(statusOf(subscription));
        const tone = statusToneFor(status) as StatusTone;
        return {
          id: subscription.id,
          title: packageName(subscription),
          subtitle: `${billingLabel(subscription.billingCycle)} · ${periodLabel(subscription)}`,
          meta: `Created ${formatDate(subscription.createdAt)}`,
          amount: formatMoney(subscription.amount, currencyOf(subscription) || currency),
          status,
          statusTone: tone,
          accent: tone,
          initials: initialsFromName(packageName(subscription)),
        };
      }),
    [currency, visibleSubscriptions],
  );

  const subscriptionReportOptions = useMemo(
    () => ({
      title: 'Subscription History',
      associationName: user?.associationName || 'Association',
      purpose: 'A filtered report of member subscription history, package billing, status, and lifecycle dates.',
      rows: filteredSubscriptions,
      fileName: 'nane-subscription-history',
      metadata: [
        { label: 'Member', value: memberName(member, user?.fullName) },
        { label: 'Membership No.', value: member?.membershipNumber || 'Not available' },
      ],
      metrics: [
        { label: 'Lifetime value', value: formatMoney(totals.amount, currency), helper: `${formatNumber(subscriptions.length)} total records` },
        { label: 'Active', value: formatNumber(totals.active), helper: 'Currently active' },
        { label: 'Pending', value: formatNumber(totals.pending), helper: 'Awaiting activation' },
        { label: 'Visible records', value: formatNumber(filteredSubscriptions.length), helper: 'Current filters' },
      ],
      filters: [
        { label: 'Search', value: search || 'All' },
        { label: 'Status', value: tabs.find((tab) => tab.value === statusFilter)?.label || statusFilter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: MemberSubscription, index: number) => index + 1 },
        { key: 'package', label: 'Package', width: '20%', value: (row: MemberSubscription) => packageName(row) },
        { key: 'status', label: 'Status', width: '11%', value: (row: MemberSubscription) => labelFromStatus(statusOf(row)) },
        { key: 'billingCycle', label: 'Billing Cycle', width: '13%', value: (row: MemberSubscription) => billingLabel(row.billingCycle) },
        { key: 'amount', label: 'Amount', align: 'right' as const, width: '13%', value: (row: MemberSubscription) => formatMoney(row.amount, currencyOf(row) || currency) },
        { key: 'currency', label: 'Currency', width: '8%', value: (row: MemberSubscription) => currencyOf(row) || currency },
        { key: 'startDate', label: 'Start Date', width: '12%', value: (row: MemberSubscription) => formatDate(row.startDate) },
        { key: 'endDate', label: 'End Date', width: '12%', value: (row: MemberSubscription) => formatDate(row.endDate) },
        { key: 'createdAt', label: 'Created', width: '12%', value: (row: MemberSubscription) => formatDate(row.createdAt) },
      ],
    }),
    [currency, filteredSubscriptions, member, search, sortValue, statusFilter, subscriptions.length, tabs, totals, user?.associationName, user?.fullName],
  );

  const selectedFileSize = useMemo(() => {
    if (!selectedFile?.size) return 'CSV or Excel file';
    return `${(Number(selectedFile.size || 0) / 1024).toFixed(1)} KB`;
  }, [selectedFile]);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  };

  const openSubscription = () => {
    if (subscriptionRoute) {
      router.push({ pathname: '/work/route-preview', params: { routeId: subscriptionRoute.id } } as never);
      return;
    }
    router.back();
  };

  const pickImportFile = async () => {
    setLoadError(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];
    if (!asset?.uri) return;
    setSelectedFile({
      uri: asset.uri,
      name: asset.name || 'subscription-history.csv',
      mimeType: asset.mimeType || 'application/octet-stream',
      size: asset.size,
    });
    setImportResult(null);
  };

  const importHistory = async () => {
    if (!associationId || !selectedFile || !canManageSubscriptions) return;
    setImporting(true);
    setLoadError(null);
    setNotice(null);
    setImportResult(null);

    try {
      const result = await importSubscriptionHistory(associationId, selectedFile);
      setImportResult(result || null);
      setSelectedFile(null);
      setNotice({
        title: 'History imported',
        description: importResultSummary(result),
        tone: 'success',
      });
      await loadHistory('refresh');
    } catch (error) {
      setLoadError(getApiErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Subscription history"
        description="This native history page is available from the member portal workspace."
      />
    );
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="list" message="Loading subscription history" />;
  }

  if (featureUnavailable) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Membership"
          title="Subscription History"
          subtitle={user?.associationName || 'Member portal'}
          onBack={openSubscription}
          rightAction={<MobileStatusBadge status="Unavailable" tone="warning" />}
        />
        <MobileEmptyState
          title="Subscription history is not enabled here"
          description="Membership subscriptions are available for Generic associations. This association uses a different contribution model."
          actionLabel="My subscriptions"
          onAction={openSubscription}
        />
        <MobileCard compact accent="blue">
          <MobileInfoRow label="Association type" value={associationType || 'Not provided'} helper="The API restricts subscription history to Generic associations." icon={ShieldAlert} />
          <MobileInfoRow label="Member" value={memberName(member, user?.fullName)} helper={member?.membershipNumber || user?.email || 'Current member'} icon={UserRound} />
        </MobileCard>
      </MobileScreen>
    );
  }

  if (loadError && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Membership"
          title="Subscription History"
          subtitle="History unavailable"
          onBack={openSubscription}
          rightAction={<MobileButton label="Retry" icon={RefreshCw} size="sm" variant="secondary" onPress={() => void loadHistory('refresh')} />}
        />
        <MobileErrorState title="Subscription history could not load" description={loadError} retryLabel="Retry" onRetry={() => void loadHistory('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Membership"
        title="Subscription History"
        subtitle={member?.membershipNumber || user?.associationName || 'Member portal'}
        onBack={openSubscription}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh history"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadHistory('refresh')}
          />
        }
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone || 'success'} /> : null}
      {loadError ? <MobileErrorState title="Some records could not refresh" description={loadError} retryLabel="Retry" onRetry={() => void loadHistory('refresh')} /> : null}

      <MobileCard compact accent="green">
        <View style={styles.memberHeader}>
          <View style={styles.flex}>
            <MobileText variant="body" weight="bold" numberOfLines={2}>
              {memberName(member, user?.fullName)}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {member?.membershipNumber || 'No membership number'}
            </MobileText>
          </View>
          <MobileStatusBadge status={labelFromStatus(member?.status)} tone="success" />
        </View>
      </MobileCard>

      <MobileSummaryPanel
        title="Lifetime subscriptions"
        value={formatMoney(totals.amount, currency)}
        description={`${formatNumber(subscriptions.length)} total record(s), ${formatNumber(totals.active)} active, ${formatNumber(totals.pending)} pending.`}
        tone="blue"
        icon={ReceiptText}
        footer={
          <View style={styles.summaryFooter}>
            <MobileButton label="My Plan" icon={Package} variant="secondary" size="sm" onPress={openSubscription} />
            <MobileReportExportButton options={subscriptionReportOptions} variant="secondary" size="sm" onSuccess={(_uri, format) => setNotice({ title: 'Export ready', description: `${format.toUpperCase()} subscription report is ready.`, tone: 'success' })} onError={(error) => setLoadError(getApiErrorMessage(error))} />
          </View>
        }
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total Records" value={formatNumber(subscriptions.length)} description="Loaded history" tone="blue" icon={Package} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active" value={formatNumber(totals.active)} description="Current approved plans" tone={totals.active ? 'green' : 'slate'} icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending" value={formatNumber(totals.pending)} description="Awaiting action" tone={totals.pending ? 'orange' : 'slate'} icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Lifetime Amount" value={formatMoney(totals.amount, currency)} description="All loaded records" tone="purple" icon={WalletCards} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {canManageSubscriptions ? (
        <MobileCard compact accent="purple">
          <View style={styles.cardHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                Import historical subscriptions
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Upload CSV or Excel history for this association.
              </MobileText>
            </View>
            <MobileStatusBadge status="Admin" tone="review" />
          </View>
          <MobileFileUpload
            title={selectedFile ? selectedFile.name : 'Choose history file'}
            description={selectedFile ? selectedFileSize : 'Accepted formats: CSV, XLS, XLSX.'}
            onPress={pickImportFile}
          />
          {importResult ? (
            <MobileInfoRow label="Last import" value={importResultSummary(importResult)} helper={firstImportError(importResult) || 'Import endpoint completed.'} icon={FileUp} />
          ) : null}
          <View style={styles.actionsRow}>
            <MobileButton label="Choose File" icon={FileUp} variant="secondary" onPress={pickImportFile} />
            <MobileButton label="Import" icon={FileUp} loading={importing} disabled={!selectedFile} onPress={() => void importHistory()} style={styles.flexButton} />
          </View>
        </MobileCard>
      ) : null}

      <MobileSearchToolbar
        value={search}
        onChange={(value) => {
          setSearch(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        placeholder="Search package, status, billing..."
        onFilterPress={() => setSortOpen(true)}
        filterLabel="Sort"
      />

      <MobileStatusTabs
        tabs={tabs}
        value={statusFilter}
        onChange={(value) => {
          setStatusFilter(value as HistoryTab);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
      />

      <MobileListHeaderCard
        title="Transactions"
        subtitle={`Showing ${formatNumber(visibleSubscriptions.length)} of ${formatNumber(filteredSubscriptions.length)} matching subscription record(s).`}
        meta={`Search, tabs, and sort apply to all ${formatNumber(subscriptions.length)} loaded records.`}
        actions={
          <>
            <MobileIconButton icon={ArrowDownUp} label="Sort records" variant="secondary" onPress={() => setSortOpen(true)} />
            <MobileReportExportButton mode="icon" label="Export history" options={subscriptionReportOptions} onSuccess={(_uri, format) => setNotice({ title: 'Export ready', description: `${format.toUpperCase()} subscription report is ready.`, tone: 'success' })} onError={(error) => setLoadError(getApiErrorMessage(error))} />
          </>
        }
      />

      {refreshing ? <MobileLoadingState compact message="Refreshing subscription history" /> : null}

      {!refreshing && listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const subscription = subscriptions.find((candidate) => candidate.id === item.id);
            if (subscription) setSelectedSubscription(subscription);
          }}
        />
      ) : null}

      {!refreshing && !listItems.length ? (
        <MobileEmptyState
          title="No matching subscription history"
          description={subscriptions.length ? 'Try a different search term or status tab.' : 'No subscription history has been recorded for your member account yet.'}
          actionLabel={subscriptions.length ? 'Clear filters' : 'My subscriptions'}
          onAction={subscriptions.length ? resetFilters : openSubscription}
        />
      ) : null}

      {visibleCount < filteredSubscriptions.length ? (
        <MobileButton
          label={`Load ${formatNumber(Math.min(LOAD_MORE_COUNT, filteredSubscriptions.length - visibleCount))} more`}
          variant="secondary"
          fullWidth
          onPress={() => setVisibleCount((current) => current + LOAD_MORE_COUNT)}
        />
      ) : null}

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => {
          setSortValue(value as SortValue);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onClose={() => setSortOpen(false)}
      />

      <MobileSheet
        visible={Boolean(selectedSubscription)}
        title="Subscription details"
        description={selectedSubscription ? packageName(selectedSubscription) : 'Subscription record'}
        onClose={() => setSelectedSubscription(null)}
      >
        {selectedSubscription ? (
          <>
            <MobileInfoRow label="Package" value={packageName(selectedSubscription)} helper={packageOf(selectedSubscription)?.id || selectedSubscription.id} icon={Package} />
            <MobileInfoRow label="Status" value={labelFromStatus(statusOf(selectedSubscription))} helper="Current record status" icon={CheckCircle2} status={labelFromStatus(statusOf(selectedSubscription))} />
            <MobileInfoRow label="Billing" value={billingLabel(selectedSubscription.billingCycle)} helper="Subscription billing cycle" icon={ReceiptText} />
            <MobileInfoRow label="Amount" value={formatMoney(selectedSubscription.amount, currencyOf(selectedSubscription) || currency)} helper="Recorded subscription amount" icon={WalletCards} />
            <MobileInfoRow label="Start Date" value={formatDate(selectedSubscription.startDate)} helper={selectedSubscription.startDate || 'Not provided'} icon={CalendarDays} />
            <MobileInfoRow label="End Date" value={formatDate(selectedSubscription.endDate)} helper={selectedSubscription.endDate || 'Not provided'} icon={CalendarDays} />
            <MobileInfoRow label="Created" value={formatDate(selectedSubscription.createdAt)} helper={selectedSubscription.id} icon={Clock3} />
            <View style={styles.sheetActions}>
              <MobileButton label="My Plan" icon={Package} variant="secondary" onPress={openSubscription} />
              <MobileReportExportButton label="Export view" options={subscriptionReportOptions} fullWidth onSuccess={(_uri, format) => setNotice({ title: 'Export ready', description: `${format.toUpperCase()} subscription report is ready.`, tone: 'success' })} onError={(error) => setLoadError(getApiErrorMessage(error))} />
            </View>
          </>
        ) : null}
      </MobileSheet>
    </MobileScreen>
  );
}

function canManage(user: AuthUser | null) {
  const values = new Set([...(user?.permissions || []), ...(user?.roles || [])].map((value) => value.toLowerCase()));
  return ['subscriptions.manage', 'subscriptions_manage', 'members_manage', 'members.manage'].some((permission) => values.has(permission));
}

function isFeatureUnavailable(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('association type') || normalized.includes('not allowed') || normalized.includes('not supported');
}

function packageOf(subscription: MemberSubscription) {
  return subscription.packageResponse || subscription.membershipPackage || null;
}

function packageName(subscription: MemberSubscription) {
  return packageOf(subscription)?.name || 'Membership package';
}

function currencyOf(subscription?: MemberSubscription | null) {
  const currency = packageOf(subscription || ({} as MemberSubscription))?.currency || 'TZS';
  return String(currency || 'TZS').toUpperCase() === 'TSH' ? 'TZS' : String(currency || 'TZS').toUpperCase();
}

function statusOf(subscription: MemberSubscription): HistoryTab {
  const normalized = String(subscription.status || 'PENDING').trim().replace(/[-\s]+/g, '_').toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'CANCELLED' || normalized === 'EXPIRED' || normalized === 'PENDING') {
    return normalized as SubscriptionStatus;
  }
  return 'PENDING';
}

function billingLabel(value?: string | null) {
  return labelFromStatus(value || 'Not provided');
}

function periodLabel(subscription: MemberSubscription) {
  const start = formatDate(subscription.startDate);
  const end = subscription.endDate ? formatDate(subscription.endDate) : 'Open ended';
  return `${start} - ${end}`;
}

function toNumber(value?: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value?: number | string | null, currency = 'TZS') {
  const amount = toNumber(value);
  const code = currency.toUpperCase() === 'TSH' ? 'TZS' : currency.toUpperCase();
  try {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'code',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${formatNumber(amount)}`;
  }
}

function memberName(member: AssociationMember | null, fallback?: string | null) {
  return member?.fullLegalName || fallback || 'Current member';
}

function sortSubscriptions(rows: MemberSubscription[], sortValue: SortValue) {
  return [...rows].sort((left, right) => {
    switch (sortValue) {
      case 'createdAsc':
        return timestamp(left.createdAt) - timestamp(right.createdAt);
      case 'amountDesc':
        return toNumber(right.amount) - toNumber(left.amount);
      case 'amountAsc':
        return toNumber(left.amount) - toNumber(right.amount);
      case 'startDesc':
        return timestamp(right.startDate) - timestamp(left.startDate);
      case 'startAsc':
        return timestamp(left.startDate) - timestamp(right.startDate);
      case 'createdDesc':
      default:
        return timestamp(right.createdAt) - timestamp(left.createdAt);
    }
  });
}

function importResultSummary(result?: SubscriptionImportResult | null) {
  if (!result) return 'No import result returned.';
  const imported = Number(result.importedRows ?? result.imported ?? 0);
  const skipped = Number(result.skippedRows ?? result.skipped ?? 0);
  const failed = Number(result.failedRows ?? result.failed ?? 0);
  return `Imported ${formatNumber(imported)}, skipped ${formatNumber(skipped)}, failed ${formatNumber(failed)}.`;
}

function firstImportError(result?: SubscriptionImportResult | null) {
  return result?.errors?.find(Boolean) || null;
}

const styles = StyleSheet.create({
  summaryFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  flexButton: {
    flex: 1,
  },
});
