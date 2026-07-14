import { router } from 'expo-router';
import {
  ArrowDownUp,
  CalendarDays,
  RefreshCw,
  SearchCheck,
  UserRound,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAmountInput,
  MobileButton,
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
  MobileTextInput,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import { getMemberUnionDeductions, type UnionDeduction } from '@/services/union-service';
import { labelFromStatus } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs, initialsFromName } from '@/utils/format';

type ViewTab = 'all' | 'thisMonth' | 'thisYear';
type SortValue = 'dateDesc' | 'dateAsc' | 'amountDesc' | 'amountAsc';

const INITIAL_VISIBLE_COUNT = 12;
const LOAD_MORE_COUNT = 12;

const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1;
const currentYear = currentDate.getFullYear();

const sortOptions = [
  { value: 'dateDesc', label: 'Newest deductions', description: 'Latest deduction period first.' },
  { value: 'dateAsc', label: 'Oldest deductions', description: 'Earliest deduction period first.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest deduction value first.' },
  { value: 'amountAsc', label: 'Lowest amount', description: 'Smallest deduction value first.' },
] satisfies { value: SortValue; label: string; description: string }[];

export default function MobileMemberDeductionsScreen() {
  const { activeView, user } = useAuth();
  const userId = user?.userId;
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [deductions, setDeductions] = useState<UnionDeduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewTab, setViewTab] = useState<ViewTab>('all');
  const [sortValue, setSortValue] = useState<SortValue>('dateDesc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [selectedDeduction, setSelectedDeduction] = useState<UnionDeduction | null>(null);

  const calendarRoute = getRouteByPath('/member/deductions/calendar');

  const loadDeductions = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) {
        setLoading(false);
        setLoadError('Member session is missing the user identifier.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);
      setNotice(null);

      try {
        const loadedMember = await getCurrentMemberByUserId(userId);
        const loadedDeductions = await getMemberUnionDeductions(loadedMember.id);
        setMember(loadedMember);
        setDeductions(loadedDeductions);
      } catch (error) {
        setMember(null);
        setDeductions([]);
        setLoadError(getApiErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(() => loadDeductions());
    }
  }, [activeView, loadDeductions]);

  const filteredDeductions = useMemo(() => {
    const query = search.trim().toLowerCase();
    const min = parseAmountFilter(minAmount);
    const max = parseAmountFilter(maxAmount);
    const start = startDate ? atDayStart(startDate).getTime() : null;
    const end = endDate ? atDayEnd(endDate).getTime() : null;

    return sortDeductions(
      deductions.filter((deduction) => {
        const date = parseDate(deduction.deductionPeriod);
        const timestamp = date?.getTime() ?? null;

        if (viewTab === 'thisMonth' && !(date && date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth)) {
          return false;
        }
        if (viewTab === 'thisYear' && !(date && date.getFullYear() === currentYear)) {
          return false;
        }
        if (start !== null && (timestamp === null || timestamp < start)) return false;
        if (end !== null && (timestamp === null || timestamp > end)) return false;
        if (min !== null && deduction.amount < min) return false;
        if (max !== null && deduction.amount > max) return false;

        if (!query) return true;
        return [
          deduction.id,
          deduction.member?.fullLegalName,
          deduction.member?.membershipNumber,
          deduction.amount,
          deduction.deductionPeriod,
          deduction.createdAt,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
      }),
      sortValue,
    );
  }, [deductions, endDate, maxAmount, minAmount, search, sortValue, startDate, viewTab]);

  const visibleDeductions = useMemo(() => filteredDeductions.slice(0, visibleCount), [filteredDeductions, visibleCount]);

  const kpis = useMemo(() => {
    const total = filteredDeductions.reduce((sum, deduction) => sum + deduction.amount, 0);
    const allTotal = deductions.reduce((sum, deduction) => sum + deduction.amount, 0);
    const average = filteredDeductions.length ? total / filteredDeductions.length : 0;
    const months = new Set(deductions.map((deduction) => monthKey(deduction.deductionPeriod)).filter(Boolean)).size;
    const lastDeduction = filteredDeductions[0]?.deductionPeriod || null;
    return { total, allTotal, average, months, lastDeduction };
  }, [deductions, filteredDeductions]);

  const viewTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: deductions.length },
      { value: 'thisMonth', label: 'Month', count: deductions.filter(isCurrentMonthDeduction).length },
      { value: 'thisYear', label: 'Year', count: deductions.filter(isCurrentYearDeduction).length },
    ],
    [deductions],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleDeductions.map((deduction) => ({
        id: deduction.id,
        title: formatDate(deduction.deductionPeriod),
        subtitle: `Payroll deduction - ${deduction.member?.membershipNumber || member?.membershipNumber || 'membership number unavailable'}`,
        meta: monthKey(deduction.deductionPeriod) || 'No period',
        amount: formatTzs(deduction.amount),
        status: 'Recorded',
        statusTone: 'success',
        accent: 'success',
        initials: initialsFromName(deduction.member?.fullLegalName || member?.fullLegalName || 'UD'),
      })),
    [member?.fullLegalName, member?.membershipNumber, visibleDeductions],
  );

  const deductionReportOptions = useMemo(
    () => ({
      title: 'Member Deduction History',
      associationName: member?.associationName || user?.associationName || 'Association',
      purpose: 'A filtered report of member payroll deductions, periods, totals, and processing dates.',
      rows: filteredDeductions,
      fileName: 'nane-member-deductions',
      metadata: [
        { label: 'Member', value: member?.fullLegalName || user?.fullName || 'Current member' },
        { label: 'Membership No.', value: member?.membershipNumber || 'Not available' },
      ],
      metrics: [
        { label: 'Filtered total', value: formatTzs(kpis.total), helper: `${formatNumber(filteredDeductions.length)} matching records` },
        { label: 'Lifetime total', value: formatTzs(kpis.allTotal), helper: `${formatNumber(deductions.length)} loaded records` },
        { label: 'Average', value: formatTzs(kpis.average), helper: 'Average matching deduction' },
        { label: 'Months', value: formatNumber(kpis.months), helper: 'Months with deductions' },
      ],
      filters: [
        { label: 'Search', value: search || 'All' },
        { label: 'View', value: viewTabs.find((tab) => tab.value === viewTab)?.label || viewTab },
        { label: 'Start date', value: startDate || 'Any' },
        { label: 'End date', value: endDate || 'Any' },
        { label: 'Minimum amount', value: minAmount || 'Any' },
        { label: 'Maximum amount', value: maxAmount || 'Any' },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: UnionDeduction, index: number) => index + 1 },
        { key: 'member', label: 'Member', width: '18%', value: (row: UnionDeduction) => row.member?.fullLegalName || member?.fullLegalName || '-' },
        { key: 'membershipNumber', label: 'Membership No.', width: '13%', value: (row: UnionDeduction) => row.member?.membershipNumber || member?.membershipNumber || '-' },
        { key: 'amount', label: 'Amount', align: 'right' as const, width: '13%', value: (row: UnionDeduction) => formatTzs(row.amount) },
        { key: 'deductionPeriod', label: 'Deduction Period', width: '13%', value: (row: UnionDeduction) => formatDate(row.deductionPeriod) },
        { key: 'month', label: 'Month', width: '10%', value: (row: UnionDeduction) => monthKey(row.deductionPeriod) || '-' },
        { key: 'processedAt', label: 'Processed At', width: '13%', value: (row: UnionDeduction) => formatDate(row.createdAt) },
        { key: 'deductionId', label: 'Deduction ID', width: '15%', value: (row: UnionDeduction) => row.id || '-' },
      ],
    }),
    [deductions.length, endDate, filteredDeductions, kpis, maxAmount, member, minAmount, search, sortValue, startDate, user?.associationName, user?.fullName, viewTab, viewTabs],
  );

  const activeFilterCount = [
    Boolean(startDate),
    Boolean(endDate),
    Boolean(minAmount),
    Boolean(maxAmount),
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch('');
    setViewTab('all');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  };

  const openCalendar = () => {
    if (!calendarRoute) return;
    router.push({ pathname: '/work/route-preview', params: { routeId: calendarRoute.id } } as never);
  };

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="My deductions"
        description="This native deduction history is available from the member portal workspace."
      />
    );
  }

  if (user?.associationType && user.associationType !== 'UNION') {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="My deductions"
          subtitle={user.associationName || 'Union payroll deductions'}
          onBack={() => router.back()}
        />
        <MobileEmptyState
          title="Deductions are for UNION members"
          description="This association does not use the UNION salary deduction workflow. Contribution history is available from My contributions."
          actionLabel="Open contributions"
          onAction={() => {
            const route = getRouteByPath('/member/revenue-transactions');
            if (route) router.push({ pathname: '/work/route-preview', params: { routeId: route.id } } as never);
          }}
        />
      </MobileScreen>
    );
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="list" message="Loading your deductions" />;
  }

  if (loadError && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="My deductions"
          subtitle="Deduction history unavailable"
          onBack={() => router.back()}
          rightAction={<MobileButton label="Retry" icon={RefreshCw} size="sm" variant="secondary" onPress={() => void loadDeductions('refresh')} />}
        />
        <MobileErrorState title="Deductions could not load" description={loadError} retryLabel="Retry" onRetry={() => void loadDeductions('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="My deductions"
        subtitle={member?.associationName || user?.associationName || 'Union payroll deduction history'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh deductions"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadDeductions('refresh')}
          />
        }
      />

      {loadError ? <MobileErrorState title="Some records could not refresh" description={loadError} retryLabel="Retry" onRetry={() => void loadDeductions('refresh')} /> : null}
      {notice ? <MobileStatusBadge status="Completed" label={notice} tone="success" /> : null}

      <MobileStatusBadge
        status={labelFromStatus(member?.status)}
        label={`${member?.fullLegalName || user?.fullName || 'Current member'} · ${member?.membershipNumber || 'No membership number'}`}
        tone="success"
      />

      <MobileSummaryPanel
        title="Filtered deductions"
        value={formatTzs(kpis.total)}
        description={`${formatNumber(filteredDeductions.length)} matching record(s) from ${formatTzs(kpis.allTotal)} lifetime deductions.`}
        tone="green"
        icon={WalletCards}
        footer={
          <View style={styles.summaryFooter}>
            <MobileButton label="Calendar" icon={CalendarDays} variant="secondary" size="sm" onPress={openCalendar} />
            <MobileReportExportButton label="Export" options={deductionReportOptions} variant="secondary" size="sm" onSuccess={(_uri, format) => setNotice(`${format.toUpperCase()} deduction report is ready.`)} onError={(error) => setLoadError(getApiErrorMessage(error))} />
          </View>
        }
      />

      <MobileSearchToolbar
        value={search}
        onChange={(value) => {
          setSearch(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        placeholder="Search period, amount, ID..."
        onFilterPress={() => setFilterOpen(true)}
        filterLabel={activeFilterCount ? `Filters ${activeFilterCount}` : 'Filters'}
      />

      <MobileStatusTabs
        tabs={viewTabs}
        value={viewTab}
        onChange={(value) => {
          setViewTab(value as ViewTab);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
      />

      <MobileListHeaderCard
        title="Deduction history"
        subtitle={`Showing ${formatNumber(visibleDeductions.length)} of ${formatNumber(filteredDeductions.length)} deduction(s).`}
        meta={`Filters run across all ${formatNumber(deductions.length)} loaded deduction records.`}
        actions={
          <>
            <MobileIconButton icon={ArrowDownUp} label="Sort deductions" variant="secondary" onPress={() => setSortOpen(true)} />
            <MobileReportExportButton mode="icon" label="Export deductions" options={deductionReportOptions} onSuccess={(_uri, format) => setNotice(`${format.toUpperCase()} deduction report is ready.`)} onError={(error) => setLoadError(getApiErrorMessage(error))} />
          </>
        }
      />

      {refreshing ? <MobileLoadingState compact message="Refreshing deductions" /> : null}

      {!refreshing && listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const deduction = deductions.find((candidate) => candidate.id === item.id);
            if (deduction) setSelectedDeduction(deduction);
          }}
        />
      ) : null}

      {!refreshing && !listItems.length ? (
        <MobileEmptyState
          title="No matching deductions"
          description={deductions.length ? 'Try a different search, time tab, date range, or amount filter.' : 'Your salary deduction history is empty for this association.'}
          actionLabel={deductions.length ? 'Clear filters' : 'Open calendar'}
          onAction={deductions.length ? resetFilters : openCalendar}
        />
      ) : null}

      {visibleCount < filteredDeductions.length ? (
        <MobileButton
          label={`Load ${formatNumber(Math.min(LOAD_MORE_COUNT, filteredDeductions.length - visibleCount))} more`}
          variant="secondary"
          fullWidth
          onPress={() => setVisibleCount((current) => current + LOAD_MORE_COUNT)}
        />
      ) : null}

      <MobileCard compact>
        <MobileText variant="section" weight="bold">
          Deduction insights
        </MobileText>
        <MobileText variant="small" tone="secondary">
          Quick context based on the current filters.
        </MobileText>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Average" value={formatTzs(kpis.average)} description="Average matching deduction" tone="blue" icon={SearchCheck} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Months" value={formatNumber(kpis.months)} description="Months with deductions" tone="purple" icon={CalendarDays} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Last deduction" value={formatDate(kpis.lastDeduction)} description="Newest matching period" tone="orange" icon={CalendarDays} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MemberDeductionsFilterSheet
        visible={filterOpen}
        startDate={startDate}
        endDate={endDate}
        minAmount={minAmount}
        maxAmount={maxAmount}
        onStartDateChange={(value) => {
          setStartDate(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onEndDateChange={(value) => {
          setEndDate(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onMinAmountChange={(value) => {
          setMinAmount(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onMaxAmountChange={(value) => {
          setMaxAmount(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onReset={() => {
          setStartDate('');
          setEndDate('');
          setMinAmount('');
          setMaxAmount('');
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        onClose={() => setFilterOpen(false)}
      />

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
        visible={Boolean(selectedDeduction)}
        title="Deduction details"
        description={selectedDeduction ? formatDate(selectedDeduction.deductionPeriod) : 'Union deduction record'}
        onClose={() => setSelectedDeduction(null)}
      >
        {selectedDeduction ? (
          <>
            <MobileInfoRow label="Member" value={selectedDeduction.member?.fullLegalName || member?.fullLegalName || 'Current member'} helper={selectedDeduction.member?.id || member?.id} icon={UserRound} />
            <MobileInfoRow label="Membership No." value={selectedDeduction.member?.membershipNumber || member?.membershipNumber || 'Not available'} icon={UserRound} />
            <MobileInfoRow label="Amount" value={formatTzs(selectedDeduction.amount)} helper="Deducted amount for this payroll period" icon={WalletCards} />
            <MobileInfoRow label="Deduction Period" value={formatDate(selectedDeduction.deductionPeriod)} helper={monthKey(selectedDeduction.deductionPeriod) || undefined} icon={CalendarDays} />
            <MobileInfoRow label="Processed At" value={formatDate(selectedDeduction.createdAt)} helper={selectedDeduction.id} icon={CalendarDays} status="Recorded" />
            <View style={styles.sheetActions}>
              <MobileButton label="Calendar" icon={CalendarDays} variant="secondary" onPress={openCalendar} />
              <MobileReportExportButton label="Export view" options={deductionReportOptions} fullWidth onSuccess={(_uri, format) => setNotice(`${format.toUpperCase()} deduction report is ready.`)} onError={(error) => setLoadError(getApiErrorMessage(error))} />
            </View>
          </>
        ) : null}
      </MobileSheet>
    </MobileScreen>
  );
}

type FilterSheetProps = {
  visible: boolean;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onMinAmountChange: (value: string) => void;
  onMaxAmountChange: (value: string) => void;
  onReset: () => void;
  onClose: () => void;
};

function MemberDeductionsFilterSheet({
  visible,
  startDate,
  endDate,
  minAmount,
  maxAmount,
  onStartDateChange,
  onEndDateChange,
  onMinAmountChange,
  onMaxAmountChange,
  onReset,
  onClose,
}: FilterSheetProps) {
  return (
    <MobileSheet
      visible={visible}
      title="Filter deductions"
      description="These filters apply to your full loaded deduction history."
      onClose={onClose}
    >
      <View style={styles.filterFields}>
        <View style={styles.twoColumns}>
          <MobileTextInput label="Start date" value={startDate} onChangeText={onStartDateChange} placeholder="YYYY-MM-DD" helperText="Optional" icon={CalendarDays} autoCapitalize="none" />
          <MobileTextInput label="End date" value={endDate} onChangeText={onEndDateChange} placeholder="YYYY-MM-DD" helperText="Optional" icon={CalendarDays} autoCapitalize="none" />
        </View>
        <View style={styles.twoColumns}>
          <MobileAmountInput label="Min amount" value={minAmount} onChangeText={onMinAmountChange} helperText="Optional" />
          <MobileAmountInput label="Max amount" value={maxAmount} onChangeText={onMaxAmountChange} helperText="Optional" />
        </View>
      </View>
      <View style={styles.sheetActions}>
        <MobileButton label="Reset" variant="secondary" onPress={onReset} />
        <MobileButton label="Apply filters" fullWidth onPress={onClose} style={styles.flexButton} />
      </View>
    </MobileSheet>
  );
}

function sortDeductions(rows: UnionDeduction[], sortValue: SortValue) {
  return [...rows].sort((left, right) => {
    switch (sortValue) {
      case 'dateAsc':
        return dateValue(left.deductionPeriod) - dateValue(right.deductionPeriod);
      case 'amountDesc':
        return right.amount - left.amount;
      case 'amountAsc':
        return left.amount - right.amount;
      default:
        return dateValue(right.deductionPeriod) - dateValue(left.deductionPeriod);
    }
  });
}

function parseAmountFilter(value: string) {
  const normalized = value.replace(/[^\d.]/g, '');
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function isCurrentMonthDeduction(row: UnionDeduction) {
  const date = parseDate(row.deductionPeriod);
  return Boolean(date && date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth);
}

function isCurrentYearDeduction(row: UnionDeduction) {
  const date = parseDate(row.deductionPeriod);
  return Boolean(date && date.getFullYear() === currentYear);
}

function monthKey(value?: string | null) {
  const date = parseDate(value);
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(value?: string | null) {
  return parseDate(value)?.getTime() || 0;
}

function atDayStart(value: string) {
  return new Date(`${value}T00:00:00`);
}

function atDayEnd(value: string) {
  return new Date(`${value}T23:59:59.999`);
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  summaryFooter: {
    flexDirection: 'row',
    gap: 10,
  },
  filterFields: {
    gap: 14,
  },
  twoColumns: {
    gap: 12,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
});
