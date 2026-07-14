import { router } from 'expo-router';
import {
  AlertTriangle,
  ArrowDownUp,
  CalendarDays,
  FileWarning,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  MobileFormSection,
  MobileIconButton,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobileListHeaderCard,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileReportExportButton,
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import {
  getAllAssociationMembers,
  getAssociationGroupConfigs,
  type AssociationMember,
  type GroupConfig,
} from '@/services/member-service';
import {
  cancelGeneratedShareFines,
  generateManualShareFines,
  getAllAssociationRevenueTransactions,
  type RevenueTransaction,
  type ShareFineScopeParams,
} from '@/services/revenue-transaction-service';
import { labelFromStatus, statusToneFor } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type CheckMode = 'exact' | 'period' | 'range';
type ActiveTab = 'generate' | 'view';
type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'member_asc' | 'status_asc';
type ConfirmAction = 'generate' | 'cancel' | null;

const modeOptions = [
  { label: 'Exact date', value: 'exact' },
  { label: 'Period-based', value: 'period' },
  { label: 'Custom range', value: 'range' },
];

const sortOptions = [
  { label: 'Newest transaction', value: 'date_desc', description: 'Latest transaction date first.' },
  { label: 'Oldest transaction', value: 'date_asc', description: 'Earliest transaction date first.' },
  { label: 'Highest amount', value: 'amount_desc', description: 'Largest fine amount first.' },
  { label: 'Lowest amount', value: 'amount_asc', description: 'Smallest fine amount first.' },
  { label: 'Member name', value: 'member_asc', description: 'Alphabetical member order.' },
  { label: 'Status', value: 'status_asc', description: 'Group fines by status.' },
];

export default function MobileShareFinesScreen() {
  const { activeView, associationId, user } = useAuth();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [configs, setConfigs] = useState<GroupConfig[]>([]);
  const [fines, setFines] = useState<RevenueTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workError, setWorkError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('generate');
  const [checkMode, setCheckMode] = useState<CheckMode>('exact');
  const [checkDate, setCheckDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('date_desc');
  const [sortOpen, setSortOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadSetup = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading share fines.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [loadedMembers, loadedConfigs] = await Promise.all([
          getAllAssociationMembers(associationId, { size: 250, sort: 'membershipNumber,asc' }),
          getAssociationGroupConfigs(associationId),
        ]);
        setMembers(loadedMembers.content || []);
        setConfigs(loadedConfigs || []);
      } catch (loadError) {
        setMembers([]);
        setConfigs([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadSetup();
    });
    return () => {
      active = false;
    };
  }, [loadSetup]);

  const config = configs[0] || null;
  const memberMap = useMemo(() => {
    const map = new Map<string, AssociationMember>();
    members.forEach((member) => map.set(member.id, member));
    return map;
  }, [members]);

  const validationMessage = useMemo(() => {
    if (checkMode === 'exact' && !isIsoDate(checkDate)) return 'Enter a valid check date using YYYY-MM-DD.';
    if (checkMode === 'period' && !isIsoDate(checkDate)) return 'Enter a valid check date using YYYY-MM-DD.';
    if (checkMode === 'period' && !config?.sharePurchaseFrequency) return 'Share purchase frequency is not configured.';
    if (checkMode === 'range' && (!isIsoDate(startDate) || !isIsoDate(endDate))) return 'Enter valid start and end dates using YYYY-MM-DD.';
    if (checkMode === 'range' && new Date(startDate).getTime() > new Date(endDate).getTime()) return 'Start date must be before end date.';
    return null;
  }, [checkDate, checkMode, config?.sharePurchaseFrequency, endDate, startDate]);

  const scope = useMemo(() => resolveScope(checkMode, checkDate, startDate, endDate, config?.sharePurchaseFrequency), [
    checkDate,
    checkMode,
    config?.sharePurchaseFrequency,
    endDate,
    startDate,
  ]);
  const scopeLabel = useMemo(() => describeScope(checkMode, checkDate, startDate, endDate, config?.sharePurchaseFrequency), [
    checkDate,
    checkMode,
    config?.sharePurchaseFrequency,
    endDate,
    startDate,
  ]);

  const totalFineAmount = useMemo(() => fines.reduce((sum, fine) => sum + fineAmount(fine), 0), [fines]);
  const openFineAmount = useMemo(
    () =>
      fines
        .filter((fine) => !['PAID', 'CANCELLED'].includes(String(fine.paymentStatus || '').toUpperCase()))
        .reduce((sum, fine) => sum + fineAmount(fine), 0),
    [fines],
  );
  const paidFineCount = useMemo(() => fines.filter((fine) => String(fine.paymentStatus || '').toUpperCase() === 'PAID').length, [fines]);
  const pendingFineCount = fines.length - paidFineCount;

  const statusTabs = useMemo(() => {
    const counts = new Map<string, number>();
    fines.forEach((fine) => {
      const status = String(fine.paymentStatus || 'Unknown').toUpperCase();
      counts.set(status, (counts.get(status) || 0) + 1);
    });
    return [
      { value: 'all', label: 'All', count: fines.length },
      ...Array.from(counts.entries()).map(([status, count]) => ({
        value: status,
        label: labelFromStatus(status),
        count,
      })),
    ];
  }, [fines]);

  const enrichedFines = useMemo(
    () =>
      fines.map((fine) => {
        const member = fine.memberId ? memberMap.get(fine.memberId) : undefined;
        const memberName = member?.fullLegalName || fine.memberFullName || fine.memberName || fine.membershipNumber || 'Unknown member';
        const description = fine.description || fine.fineCategory || 'Share purchase fine';
        const searchText = [
          memberName,
          member?.contactInfo?.email,
          fine.id,
          fine.paymentStatus,
          fine.fineCategory,
          description,
          fineAmount(fine),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return { fine, memberName, description, searchText };
      }),
    [fines, memberMap],
  );

  const visibleFines = useMemo(() => {
    const filtered = enrichedFines.filter((item) => {
      const statusMatch =
        statusFilter === 'all' || String(item.fine.paymentStatus || '').toUpperCase() === statusFilter;
      const searchMatch = !debouncedSearch || item.searchText.includes(debouncedSearch);
      return statusMatch && searchMatch;
    });
    return sortFineRows(filtered, sortBy);
  }, [debouncedSearch, enrichedFines, sortBy, statusFilter]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleFines.map((item) => ({
        id: item.fine.id,
        title: item.memberName,
        subtitle: item.description,
        meta: `${formatDate(item.fine.transactionDate || item.fine.createdAt)} · Due ${formatDate(item.fine.dueDate)}`,
        amount: formatTzs(fineAmount(item.fine)),
        status: labelFromStatus(item.fine.paymentStatus),
        statusTone: statusToneFor(item.fine.paymentStatus),
        initials: initialsFromName(item.memberName),
        accent: statusToneFor(item.fine.paymentStatus),
      })),
    [visibleFines],
  );

  const fineReportOptions = useMemo(
    () => ({
      title: 'Share Purchase Fines',
      associationName: user?.associationName || 'Association',
      purpose: 'A current-view report of generated share purchase fines, member status, amounts, and due dates.',
      rows: visibleFines,
      fileName: 'nane-share-purchase-fines',
      metadata: [
        { label: 'Scope', value: scopeLabel },
        { label: 'Check mode', value: modeOptions.find((option) => option.value === checkMode)?.label || checkMode },
      ],
      metrics: [
        { label: 'Generated fines', value: formatNumber(fines.length), helper: 'Loaded for selected scope' },
        { label: 'Total fine value', value: formatTzs(totalFineAmount), helper: 'Visible generated amount' },
        { label: 'Open fine value', value: formatTzs(openFineAmount), helper: `${formatNumber(pendingFineCount)} open records` },
        { label: 'Frequency', value: config?.sharePurchaseFrequency || 'Unknown', helper: 'Configured share purchase schedule' },
      ],
      filters: [
        { label: 'Search', value: search || 'All' },
        { label: 'Status', value: statusTabs.find((tab) => tab.value === statusFilter)?.label || statusFilter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortBy)?.label || sortBy },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: (typeof visibleFines)[number], index: number) => index + 1 },
        { key: 'member', label: 'Member', width: '20%', value: (row: (typeof visibleFines)[number]) => row.memberName },
        { key: 'status', label: 'Status', width: '11%', value: (row: (typeof visibleFines)[number]) => labelFromStatus(row.fine.paymentStatus) },
        { key: 'amount', label: 'Amount', align: 'right' as const, width: '12%', value: (row: (typeof visibleFines)[number]) => formatTzs(fineAmount(row.fine)) },
        { key: 'transactionDate', label: 'Transaction Date', width: '13%', value: (row: (typeof visibleFines)[number]) => formatDate(row.fine.transactionDate || row.fine.createdAt) },
        { key: 'dueDate', label: 'Due Date', width: '12%', value: (row: (typeof visibleFines)[number]) => formatDate(row.fine.dueDate) },
        { key: 'description', label: 'Description', width: '25%', value: (row: (typeof visibleFines)[number]) => row.description || '-' },
      ],
    }),
    [checkMode, config?.sharePurchaseFrequency, fines.length, openFineAmount, pendingFineCount, scopeLabel, search, sortBy, statusFilter, statusTabs, totalFineAmount, user?.associationName, visibleFines],
  );

  const fetchExistingFines = useCallback(async () => {
    if (!associationId || validationMessage || !scope) return;
    setWorking(true);
    setWorkError(null);
    setLastResult(null);
    try {
      const loaded = await getAllAssociationRevenueTransactions({
        associationId,
        paymentType: 'FINE',
        fineCategory: 'MISSED_SHARE_PURCHASE',
        startDate: scope.startDate,
        endDate: scope.endDate,
        size: 250,
      });
      setFines(loaded.content || []);
      setActiveTab('view');
      setLastResult(`Fetched ${formatNumber(loaded.content?.length || 0)} share fines.`);
    } catch (fetchError) {
      setWorkError(getApiErrorMessage(fetchError));
    } finally {
      setWorking(false);
    }
  }, [associationId, scope, validationMessage]);

  const runGenerate = async () => {
    if (!associationId || validationMessage) return;
    setWorking(true);
    setWorkError(null);
    setLastResult(null);
    try {
      const generated = await generateManualShareFines(associationId, buildGenerateParams(checkMode, checkDate, startDate, endDate));
      setFines(generated || []);
      setActiveTab('view');
      setLastResult(generated?.length ? `Generated ${formatNumber(generated.length)} share fines.` : 'No fines generated for this scope.');
    } catch (generateError) {
      setWorkError(getApiErrorMessage(generateError));
    } finally {
      setWorking(false);
      setConfirmAction(null);
    }
  };

  const runCancelGenerated = async () => {
    if (!associationId || validationMessage || !scope) return;
    setWorking(true);
    setWorkError(null);
    setLastResult(null);
    try {
      const cancelled = await cancelGeneratedShareFines(associationId, {
        startDate: `${scope.startDate}T00:00:00`,
        endDate: `${scope.endDate}T23:59:59`,
      });
      setFines(cancelled || []);
      setActiveTab('view');
      setLastResult(cancelled?.length ? `Cancelled ${formatNumber(cancelled.length)} open generated fines.` : 'No open generated fines found for this scope.');
    } catch (cancelError) {
      setWorkError(getApiErrorMessage(cancelError));
    } finally {
      setWorking(false);
      setConfirmAction(null);
    }
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Share purchase fines"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading share fine setup" />;
  }

  if (error && !configs.length) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Share purchase fines" subtitle="Generate and review fines" onBack={() => router.back()} />
        <MobileErrorState title="Share fine setup could not load" description={error} retryLabel="Retry" onRetry={() => void loadSetup('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Share purchase fines"
        subtitle="Generate and review fines"
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh configuration"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadSetup('refresh')}
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh issue" label={error} tone="warning" /> : null}
      {workError ? <MobileStatusBadge status="Action issue" label={workError} tone="danger" /> : null}
      {lastResult ? <MobileStatusBadge status="Completed" label={lastResult} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Generated fines" value={formatNumber(fines.length)} description="Loaded for selected scope" tone="blue" icon={FileWarning} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total fine value" value={formatTzs(totalFineAmount)} description="Visible generated amount" tone="green" icon={WalletCards} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Open fine value" value={formatTzs(openFineAmount)} description={`${formatNumber(pendingFineCount)} open records`} tone={openFineAmount > 0 ? 'orange' : 'green'} icon={ShieldAlert} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Frequency" value={config?.sharePurchaseFrequency || 'Unknown'} description="Configured share purchase schedule" tone={config?.sharePurchaseFrequency ? 'teal' : 'slate'} icon={SlidersHorizontal} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs
        tabs={[
          { value: 'generate', label: 'Generate' },
          { value: 'view', label: 'View', count: fines.length },
        ]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as ActiveTab)}
      />

      {activeTab === 'generate' ? (
        <MobileFormSection title="Fine generation scope" description="Choose the date logic used to identify missed share purchases.">
          <MobileSelect label="Check mode" value={checkMode} options={modeOptions} onChange={(value) => setCheckMode(value as CheckMode)} />
          {checkMode !== 'range' ? (
            <MobileTextInput
              label="Check date"
              value={checkDate}
              onChangeText={setCheckDate}
              placeholder="YYYY-MM-DD"
              icon={CalendarDays}
              keyboardType="number-pad"
            />
          ) : (
            <>
              <MobileTextInput label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" icon={CalendarDays} keyboardType="number-pad" />
              <MobileTextInput label="End date" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" icon={CalendarDays} keyboardType="number-pad" />
            </>
          )}

          <MobileCard compact style={styles.contextCard}>
            <MobileText variant="small" weight="bold">
              Scope
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {scopeLabel}
            </MobileText>
          </MobileCard>

          {validationMessage ? (
            <View style={styles.validationBox}>
              <AlertTriangle color="#C2410C" size={17} />
              <MobileText variant="small" weight="bold" style={styles.validationText}>
                {validationMessage}
              </MobileText>
            </View>
          ) : null}

          <View style={styles.actionGrid}>
            <MobileButton label="Generate fines" icon={FileWarning} fullWidth disabled={Boolean(validationMessage)} loading={working && confirmAction === 'generate'} onPress={() => setConfirmAction('generate')} />
            <MobileButton label="Cancel generated" icon={RotateCcw} variant="danger" fullWidth disabled={Boolean(validationMessage)} loading={working && confirmAction === 'cancel'} onPress={() => setConfirmAction('cancel')} />
            <MobileButton label="Fetch existing" icon={RefreshCw} variant="secondary" fullWidth disabled={Boolean(validationMessage) || working} onPress={() => void fetchExistingFines()} />
          </View>
        </MobileFormSection>
      ) : (
        <>
          <MobileSearchToolbar value={search} onChange={setSearch} placeholder="Search fines..." />
          <MobileStatusTabs tabs={statusTabs} value={statusFilter} onChange={setStatusFilter} />

          <MobileListHeaderCard
            title="Share fine register"
            subtitle={`${formatNumber(visibleFines.length)} of ${formatNumber(fines.length)} records`}
            meta={scopeLabel}
            actions={
              <>
                <MobileIconButton icon={ArrowDownUp} label="Sort fines" variant="secondary" onPress={() => setSortOpen(true)} />
                <MobileReportExportButton mode="icon" label="Export fines" options={fineReportOptions} disabled={!visibleFines.length || working} onError={(exportError) => setWorkError(getApiErrorMessage(exportError))} />
              </>
            }
          />

          {listItems.length ? (
            <MobileDataList items={listItems} showChevron={false} />
          ) : (
            <MobileEmptyState
              title="No share fines found"
              description="Select a scope, fetch existing fines, or generate new fines."
              actionLabel="Go to generate"
              onAction={() => setActiveTab('generate')}
            />
          )}

          <MobileSortSheet
            visible={sortOpen}
            value={sortBy}
            options={sortOptions}
            onChange={(value) => setSortBy(value as SortKey)}
            onClose={() => setSortOpen(false)}
          />
        </>
      )}

      <MobileConfirmSheet
        visible={confirmAction === 'generate'}
        title="Generate share fines?"
        description="Generated fines should be reviewed carefully before notifying members."
        confirmLabel="Generate"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runGenerate()}
      />
      <MobileConfirmSheet
        visible={confirmAction === 'cancel'}
        title="Cancel generated fines?"
        description="This will cancel open generated share purchase fines for the selected scope. Paid and partially paid fines will not be changed."
        confirmLabel="Cancel generated"
        destructive
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runCancelGenerated()}
      />
    </MobileScreen>
  );
}

function buildGenerateParams(checkMode: CheckMode, checkDate: string, startDate: string, endDate: string): ShareFineScopeParams {
  if (checkMode === 'range') {
    return {
      startDate: `${startDate}T00:00:00`,
      endDate: `${endDate}T23:59:59`,
    };
  }
  return {
    checkDate: `${checkDate}T00:00:00`,
    checkMode,
  };
}

function resolveScope(
  checkMode: CheckMode,
  checkDate: string,
  startDate: string,
  endDate: string,
  frequency?: string | null,
) {
  if (checkMode === 'range') {
    if (!isIsoDate(startDate) || !isIsoDate(endDate)) return null;
    return { startDate, endDate };
  }
  if (!isIsoDate(checkDate)) return null;
  if (checkMode === 'period') {
    const normalized = String(frequency || 'DAILY').toUpperCase();
    if (normalized === 'WEEKLY') return { startDate: shiftIsoDate(checkDate, -6), endDate: checkDate };
    if (normalized === 'MONTHLY') return { startDate: `${checkDate.slice(0, 8)}01`, endDate: checkDate };
  }
  return { startDate: checkDate, endDate: checkDate };
}

function describeScope(
  checkMode: CheckMode,
  checkDate: string,
  startDate: string,
  endDate: string,
  frequency?: string | null,
) {
  if (checkMode === 'range' && isIsoDate(startDate) && isIsoDate(endDate)) {
    return `Fines will be generated for missed expected periods from ${formatDate(startDate)} to ${formatDate(endDate)}.`;
  }
  if (checkMode === 'period' && isIsoDate(checkDate)) {
    return `Fines will be generated for members without paid share purchase in the ${String(frequency || 'configured').toLowerCase()} period ending ${formatDate(checkDate)}.`;
  }
  if (checkMode === 'exact' && isIsoDate(checkDate)) {
    return `Fines will be generated for members without paid share purchase on ${formatDate(checkDate)}.`;
  }
  return 'Select a date or range to generate or fetch share fines.';
}

function sortFineRows(rows: { fine: RevenueTransaction; memberName: string; description: string; searchText: string }[], sortBy: SortKey) {
  return [...rows].sort((a, b) => {
    if (sortBy === 'amount_asc' || sortBy === 'amount_desc') {
      const delta = fineAmount(a.fine) - fineAmount(b.fine);
      return sortBy === 'amount_desc' ? -delta : delta;
    }
    if (sortBy === 'member_asc') return a.memberName.localeCompare(b.memberName);
    if (sortBy === 'status_asc') return String(a.fine.paymentStatus || '').localeCompare(String(b.fine.paymentStatus || ''));
    const aTime = new Date(String(a.fine.transactionDate || a.fine.createdAt || '')).getTime() || 0;
    const bTime = new Date(String(b.fine.transactionDate || b.fine.createdAt || '')).getTime() || 0;
    return sortBy === 'date_asc' ? aTime - bTime : bTime - aTime;
  });
}

function fineAmount(fine: RevenueTransaction) {
  return toAmount(fine.paymentDetails?.FINE) || toAmount(Object.values(fine.paymentDetails || {})[0]);
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function shiftIsoDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function toAmount(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

const styles = StyleSheet.create({
  contextCard: {
    shadowOpacity: 0.015,
  },
  validationBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  validationText: {
    color: '#C2410C',
    flex: 1,
  },
  actionGrid: {
    gap: 10,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
