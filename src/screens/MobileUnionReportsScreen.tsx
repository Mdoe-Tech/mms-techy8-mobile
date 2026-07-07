import { router } from 'expo-router';
import {
  Ban,
  CalendarDays,
  CheckSquare,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
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
  MobileReportExportButton,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  deleteUnionDeductions,
  disableUnionDeductions,
  getUnionDeductions,
  getUnionMemberStatusAtPeriod,
  type UnionDeduction,
  type UnionMemberStatusAtPeriod,
} from '@/services/union-service';
import { type StatusTone, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import type { MobileReportExportFormat, MobileReportExportOptions } from '@/utils/mobile-report-export';
import { formatDate, formatNumber, formatTzs, initialsFromName } from '@/utils/format';

type ViewTab = 'all' | 'thisMonth' | 'thisYear' | 'selected';
type SortValue = 'dateDesc' | 'dateAsc' | 'amountDesc' | 'amountAsc' | 'memberAsc' | 'numberAsc';
type BulkAction = 'disable' | 'delete';
type UnionReportRow = {
  deduction: UnionDeduction;
  statusAtMonth: string;
};

type FilterDraft = {
  startDate: string;
  endDate: string;
  month: string;
  year: string;
};

const INITIAL_VISIBLE_COUNT = 18;
const LOAD_MORE_COUNT = 18;

const sortOptions = [
  { value: 'dateDesc', label: 'Newest deduction', description: 'Latest deduction period first.' },
  { value: 'dateAsc', label: 'Oldest deduction', description: 'Earliest deduction period first.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest deductions first.' },
  { value: 'amountAsc', label: 'Lowest amount', description: 'Smallest deductions first.' },
  { value: 'memberAsc', label: 'Member name', description: 'Sort alphabetically by member.' },
  { value: 'numberAsc', label: 'Membership number', description: 'Sort by payroll/member number.' },
] satisfies { value: SortValue; label: string; description: string }[];

const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1;
const currentYear = currentDate.getFullYear();

export default function MobileUnionReportsScreen() {
  const { activeView, associationId, user } = useAuth();
  const [deductions, setDeductions] = useState<UnionDeduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewTab, setViewTab] = useState<ViewTab>('all');
  const [sortValue, setSortValue] = useState<SortValue>('dateDesc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDeduction, setSelectedDeduction] = useState<UnionDeduction | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<UnionMemberStatusAtPeriod | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [filters, setFilters] = useState<FilterDraft>({ startDate: '', endDate: '', month: '', year: '' });
  const [draftFilters, setDraftFilters] = useState<FilterDraft>(filters);
  const [filterErrors, setFilterErrors] = useState<Partial<FilterDraft>>({});

  const canManageUnion = useMemo(() => canUseUnionActions(user), [user]);

  const loadDeductions = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading union reports.');
        return;
      }

      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const rows = await getUnionDeductions(associationId);
        setDeductions(rows);
        setSelectedIds((current) => new Set(Array.from(current).filter((id) => rows.some((row) => row.id === id))));
        setNotice(null);
      } catch (loadError) {
        if (!deductions.length) setDeductions([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, deductions.length],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadDeductions('initial'));
  }, [loadDeductions]);

  useEffect(() => {
    if (!selectedDeduction || !associationId) {
      return;
    }

    const period = monthKey(selectedDeduction.deductionPeriod);
    const memberId = selectedDeduction.member?.id;
    if (!period || !memberId) {
      return;
    }

    let active = true;
    void getUnionMemberStatusAtPeriod(associationId, period)
      .then((rows) => {
        if (!active) return;
        setSelectedStatus(rows.find((row) => row.memberId === memberId) || null);
      })
      .catch(() => {
        if (active) setSelectedStatus(null);
      })
      .finally(() => {
        if (active) setStatusLoading(false);
      });

    return () => {
      active = false;
    };
  }, [associationId, selectedDeduction]);

  const filteredDeductions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return sortDeductions(
      deductions.filter((deduction) => {
        const date = parseDate(deduction.deductionPeriod);
        const matchesView =
          viewTab === 'all' ||
          (viewTab === 'selected' && selectedIds.has(deduction.id)) ||
          (viewTab === 'thisMonth' && date?.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth) ||
          (viewTab === 'thisYear' && date?.getFullYear() === currentYear);
        if (!matchesView) return false;

        if (filters.startDate && (!date || date < atDayStart(filters.startDate))) return false;
        if (filters.endDate && (!date || date > atDayEnd(filters.endDate))) return false;
        if (filters.month && (!date || date.getMonth() + 1 !== Number(filters.month))) return false;
        if (filters.year && (!date || date.getFullYear() !== Number(filters.year))) return false;

        if (!query) return true;
        return [
          deduction.member?.fullLegalName,
          deduction.member?.membershipNumber,
          deduction.member?.id,
          deduction.amount,
          deduction.deductionPeriod,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
      }),
      sortValue,
    );
  }, [deductions, filters, searchTerm, selectedIds, sortValue, viewTab]);

  const stats = useMemo(() => {
    const filteredAmount = filteredDeductions.reduce((sum, row) => sum + row.amount, 0);
    const totalAmount = deductions.reduce((sum, row) => sum + row.amount, 0);
    const memberCount = new Set(deductions.map((row) => row.member?.id).filter(Boolean)).size;
    const monthCount = new Set(deductions.map((row) => monthKey(row.deductionPeriod)).filter(Boolean)).size;
    return {
      totalRecords: deductions.length,
      filteredRecords: filteredDeductions.length,
      selectedRecords: selectedIds.size,
      totalAmount,
      filteredAmount,
      memberCount,
      monthCount,
    };
  }, [deductions, filteredDeductions, selectedIds.size]);

  const viewTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: deductions.length },
      { value: 'thisMonth', label: 'Month', count: deductions.filter(isCurrentMonthDeduction).length },
      { value: 'thisYear', label: 'Year', count: deductions.filter(isCurrentYearDeduction).length },
      { value: 'selected', label: 'Selected', count: selectedIds.size },
    ],
    [deductions, selectedIds.size],
  );

  const visibleRows = filteredDeductions.slice(0, visibleCount);
  const activeFilterCount = [filters.startDate, filters.endDate, filters.month, filters.year].filter(Boolean).length;

  const unionReportRows = useMemo<UnionReportRow[]>(
    () => filteredDeductions.map((deduction) => ({ deduction, statusAtMonth: 'Active' })),
    [filteredDeductions],
  );

  const unionReportOptions = useMemo<MobileReportExportOptions<UnionReportRow>>(
    () => ({
      title: 'Union Deduction Report',
      associationName: user?.associationName || 'Association',
      purpose: 'A filtered report of union deductions, member status at deduction month, periods, and amounts.',
      rows: unionReportRows,
      fileName: 'nane-union-deductions',
      metrics: [
        { label: 'Filtered amount', value: formatTzs(stats.filteredAmount), helper: `${formatNumber(stats.filteredRecords)} matching records` },
        { label: 'Total amount', value: formatTzs(stats.totalAmount), helper: `${formatNumber(stats.totalRecords)} loaded records` },
        { label: 'Members', value: formatNumber(stats.memberCount), helper: 'Members with deductions' },
        { label: 'Months', value: formatNumber(stats.monthCount), helper: 'Deduction periods' },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'View', value: viewTabs.find((tab) => tab.value === viewTab)?.label || viewTab },
        { label: 'Start date', value: filters.startDate || 'Any' },
        { label: 'End date', value: filters.endDate || 'Any' },
        { label: 'Month', value: filters.month || 'Any' },
        { label: 'Year', value: filters.year || 'Any' },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: UnionReportRow, index: number) => index + 1 },
        { key: 'member', label: 'Member', width: '18%', value: (row: UnionReportRow) => row.deduction.member?.fullLegalName || '-' },
        { key: 'membershipNumber', label: 'Membership No.', width: '13%', value: (row: UnionReportRow) => row.deduction.member?.membershipNumber || '-' },
        { key: 'statusAtMonth', label: 'Status At Month', width: '13%', value: (row: UnionReportRow) => row.statusAtMonth },
        { key: 'amount', label: 'Amount', align: 'right' as const, width: '13%', value: (row: UnionReportRow) => formatTzs(row.deduction.amount) },
        { key: 'deductionPeriod', label: 'Deduction Period', width: '13%', value: (row: UnionReportRow) => formatDate(row.deduction.deductionPeriod) },
        { key: 'month', label: 'Month', width: '10%', value: (row: UnionReportRow) => monthKey(row.deduction.deductionPeriod) || '-' },
        { key: 'memberId', label: 'Member ID', width: '14%', value: (row: UnionReportRow) => row.deduction.member?.id || '-' },
        { key: 'deductionId', label: 'Deduction ID', width: '14%', value: (row: UnionReportRow) => row.deduction.id || '-' },
      ],
    }),
    [filters.endDate, filters.month, filters.startDate, filters.year, searchTerm, sortValue, stats, unionReportRows, user?.associationName, viewTab, viewTabs],
  );

  const prepareUnionReportOptions = useCallback(
    async (_format: MobileReportExportFormat, options: MobileReportExportOptions<UnionReportRow>) => {
      const statusMap = await buildStatusMap(associationId, filteredDeductions);
      return {
        ...options,
        rows: filteredDeductions.map((deduction) => {
          const period = monthKey(deduction.deductionPeriod);
          const statusAtMonth = deduction.member?.id && period ? statusMap.get(`${deduction.member.id}_${period}`) || 'ACTIVE' : 'ACTIVE';
          return { deduction, statusAtMonth };
        }),
      };
    },
    [associationId, filteredDeductions],
  );

  const applyFilters = () => {
    const nextErrors = validateFilters(draftFilters);
    setFilterErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setFilters({
      startDate: draftFilters.startDate.trim(),
      endDate: draftFilters.endDate.trim(),
      month: draftFilters.month.trim(),
      year: draftFilters.year.trim(),
    });
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    setFilterOpen(false);
  };

  const resetFilters = () => {
    const emptyFilters = { startDate: '', endDate: '', month: '', year: '' };
    setFilters(emptyFilters);
    setDraftFilters(emptyFilters);
    setFilterErrors({});
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    setFilterOpen(false);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openDeduction = (deduction: UnionDeduction) => {
    setSelectedStatus(null);
    setStatusLoading(Boolean(associationId && monthKey(deduction.deductionPeriod) && deduction.member?.id));
    setSelectedDeduction(deduction);
  };

  const closeDeduction = () => {
    setSelectedDeduction(null);
    setSelectedStatus(null);
    setStatusLoading(false);
  };

  const handleBulkAction = async () => {
    if (!associationId || !bulkAction || selectedIds.size === 0) return;
    setMutating(true);
    setError(null);
    setNotice(null);
    try {
      const ids = Array.from(selectedIds);
      if (bulkAction === 'disable') {
        await disableUnionDeductions(associationId, ids);
        setNotice(`${formatNumber(ids.length)} deduction(s) disabled.`);
      } else {
        await deleteUnionDeductions(associationId, ids);
        setNotice(`${formatNumber(ids.length)} deduction(s) deleted.`);
      }
      setBulkAction(null);
      setSelectedDeduction(null);
      setSelectedIds(new Set());
      await loadDeductions('refresh');
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setMutating(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Union reports" description="Union deduction reports are available for association admin workspaces only." />;
  }

  if (loading && !deductions.length) {
    return <MobilePageLoadingState kind="list" message="Loading union deduction reports" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Reports" title="Union reports" subtitle="Association context unavailable" />
        <MobileErrorState title="Association not selected" description="Sign in through a UNION association account before opening union reports." />
      </MobileScreen>
    );
  }

  if (error && !deductions.length) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Reports"
          title="Union reports"
          subtitle="Deduction report workspace"
          onBack={() => router.back()}
          rightAction={
            <MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" disabled={refreshing} onPress={() => void loadDeductions('refresh')} />
          }
        />
        <MobileErrorState
          title="Union report could not load"
          description={`${error}${user?.associationType && user.associationType !== 'UNION' ? ' This route is intended for UNION associations.' : ''}`}
          retryLabel="Retry"
          onRetry={() => void loadDeductions('refresh')}
        />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Reports"
        title="Union reports"
        subtitle={user?.associationName || 'Deduction report workspace'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton icon={RefreshCw} label="Refresh deductions" variant="secondary" disabled={refreshing} onPress={() => void loadDeductions('refresh')} />
        }
      />

      {user?.associationType && user.associationType !== 'UNION' ? (
        <MobileStatusBadge status="Under Review" label="This report is intended for UNION associations." tone="warning" />
      ) : null}
      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileStatusBadge status="Completed" label={notice} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Filtered Amount" value={formatTzs(stats.filteredAmount)} description={`${formatNumber(stats.filteredRecords)} visible rows`} icon={WalletCards} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="All Deductions" value={formatNumber(stats.totalRecords)} description={formatTzs(stats.totalAmount)} icon={CalendarDays} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members" value={formatNumber(stats.memberCount)} description={`${formatNumber(stats.monthCount)} deduction month(s)`} icon={Users} tone="teal" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Selected" value={formatNumber(stats.selectedRecords)} description={canManageUnion ? 'Ready for bulk action' : 'Selection only'} icon={CheckSquare} tone={stats.selectedRecords ? 'purple' : 'slate'} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileSearchToolbar
        value={searchTerm}
        onChange={(value) => {
          setSearchTerm(value);
          setVisibleCount(INITIAL_VISIBLE_COUNT);
        }}
        placeholder="Search member or number..."
        onFilterPress={() => {
          setDraftFilters(filters);
          setFilterOpen(true);
        }}
        filterLabel={activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}
      />

      <MobileStatusTabs tabs={viewTabs} value={viewTab} onChange={(value) => setViewTab(value as ViewTab)} />

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitle}>
          <MobileText variant="section" weight="bold">
            Deduction register
          </MobileText>
          <MobileText variant="small" tone="secondary">
            Showing {formatNumber(visibleRows.length)} of {formatNumber(filteredDeductions.length)} record(s)
          </MobileText>
        </View>
        <View style={styles.actionRow}>
          <MobileButton label="Sort" icon={SlidersHorizontal} variant="secondary" size="sm" onPress={() => setSortOpen(true)} />
          <MobileReportExportButton options={unionReportOptions} prepareOptions={prepareUnionReportOptions} size="sm" onSuccess={(_uri, format) => setNotice(`${format.toUpperCase()} union report is ready.`)} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
        </View>
      </View>

      {selectedIds.size > 0 ? (
        <MobileCard compact accent="purple">
          <View style={styles.selectionHeader}>
            <View style={styles.sectionTitle}>
              <MobileText variant="body" weight="bold">
                {formatNumber(selectedIds.size)} selected deduction(s)
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Bulk actions require union management permission.
              </MobileText>
            </View>
            <MobileButton label="Clear" variant="ghost" size="sm" onPress={() => setSelectedIds(new Set())} />
          </View>
          {canManageUnion ? (
            <View style={styles.bulkActions}>
              <MobileButton label="Disable" icon={Ban} variant="secondary" size="sm" disabled={mutating} onPress={() => setBulkAction('disable')} />
              <MobileButton label="Delete" icon={Trash2} variant="danger" size="sm" disabled={mutating} onPress={() => setBulkAction('delete')} />
            </View>
          ) : null}
        </MobileCard>
      ) : null}

      {visibleRows.length > 0 ? (
        <View style={styles.deductionList}>
          {visibleRows.map((deduction, index) => (
            <DeductionRow
              key={deduction.id}
              deduction={deduction}
              index={index}
              selected={selectedIds.has(deduction.id)}
              onToggleSelected={() => toggleSelected(deduction.id)}
              onPress={() => openDeduction(deduction)}
            />
          ))}
        </View>
      ) : (
        <MobileEmptyState
          title="No union deductions found"
          description="Adjust the search, date range, month, or year filters to find deduction records."
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      )}

      {visibleRows.length < filteredDeductions.length ? (
        <MobileButton
          label={`Load ${formatNumber(Math.min(LOAD_MORE_COUNT, filteredDeductions.length - visibleRows.length))} more`}
          variant="secondary"
          fullWidth
          onPress={() => setVisibleCount((count) => count + LOAD_MORE_COUNT)}
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

      <MobileSheet visible={filterOpen} title="Filter union deductions" description="Use dates, month, or year to narrow the report." onClose={() => setFilterOpen(false)}>
        <View style={styles.filterGrid}>
          <MobileTextInput
            label="Start date"
            value={draftFilters.startDate}
            onChangeText={(value) => {
              setDraftFilters((current) => ({ ...current, startDate: value }));
              setFilterErrors((current) => ({ ...current, startDate: undefined }));
            }}
            placeholder="YYYY-MM-DD"
            error={filterErrors.startDate}
            icon={CalendarDays}
          />
          <MobileTextInput
            label="End date"
            value={draftFilters.endDate}
            onChangeText={(value) => {
              setDraftFilters((current) => ({ ...current, endDate: value }));
              setFilterErrors((current) => ({ ...current, endDate: undefined }));
            }}
            placeholder="YYYY-MM-DD"
            error={filterErrors.endDate}
            icon={CalendarDays}
          />
          <MobileTextInput
            label="Month"
            value={draftFilters.month}
            onChangeText={(value) => {
              setDraftFilters((current) => ({ ...current, month: value.replace(/[^0-9]/g, '').slice(0, 2) }));
              setFilterErrors((current) => ({ ...current, month: undefined }));
            }}
            placeholder="1-12"
            error={filterErrors.month}
            keyboardType="number-pad"
            icon={Filter}
          />
          <MobileTextInput
            label="Year"
            value={draftFilters.year}
            onChangeText={(value) => {
              setDraftFilters((current) => ({ ...current, year: value.replace(/[^0-9]/g, '').slice(0, 4) }));
              setFilterErrors((current) => ({ ...current, year: undefined }));
            }}
            placeholder="2026"
            error={filterErrors.year}
            keyboardType="number-pad"
            icon={CalendarDays}
          />
        </View>
        <View style={styles.sheetActions}>
          <MobileButton label="Reset" variant="secondary" onPress={resetFilters} />
          <MobileButton label="Apply filters" fullWidth style={styles.flexButton} onPress={applyFilters} />
        </View>
      </MobileSheet>

      <MobileSheet
        visible={Boolean(selectedDeduction)}
        title="Deduction details"
        description={selectedDeduction?.member?.fullLegalName || 'Union deduction record'}
        onClose={closeDeduction}
      >
        {selectedDeduction ? (
          <>
            <MobileInfoRow label="Member" value={selectedDeduction.member?.fullLegalName || 'Unknown member'} helper={selectedDeduction.member?.id || undefined} icon={UserRound} />
            <MobileInfoRow label="Membership No." value={selectedDeduction.member?.membershipNumber || 'Not available'} icon={Users} />
            <MobileInfoRow label="Amount" value={formatTzs(selectedDeduction.amount)} helper="Deducted amount for the period" icon={WalletCards} />
            <MobileInfoRow label="Deduction Period" value={formatDate(selectedDeduction.deductionPeriod)} helper={monthKey(selectedDeduction.deductionPeriod) || undefined} icon={CalendarDays} />
            <MobileInfoRow
              label="Status At Month"
              value={statusLoading ? 'Checking status...' : selectedStatus?.statusAtMonth || 'Not available'}
              helper={selectedStatus?.currentStatus ? `Current status: ${selectedStatus.currentStatus}` : 'Status lookup is included in exports when available.'}
              status={selectedStatus?.statusAtMonth || undefined}
            />
            <View style={styles.sheetActions}>
              <MobileButton
                label={selectedIds.has(selectedDeduction.id) ? 'Unselect' : 'Select'}
                variant="secondary"
                onPress={() => toggleSelected(selectedDeduction.id)}
              />
              <MobileReportExportButton label="Export view" options={unionReportOptions} prepareOptions={prepareUnionReportOptions} fullWidth onSuccess={(_uri, format) => setNotice(`${format.toUpperCase()} union report is ready.`)} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
            </View>
          </>
        ) : null}
      </MobileSheet>

      <MobileConfirmSheet
        visible={Boolean(bulkAction)}
        title={bulkAction === 'delete' ? 'Delete selected deductions?' : 'Disable selected deductions?'}
        description={
          bulkAction === 'delete'
            ? `This will permanently delete ${formatNumber(selectedIds.size)} selected deduction(s). This cannot be undone.`
            : `This will disable ${formatNumber(selectedIds.size)} selected deduction(s). They will no longer be active in union reporting.`
        }
        confirmLabel={bulkAction === 'delete' ? 'Delete' : 'Disable'}
        destructive={bulkAction === 'delete'}
        onCancel={() => setBulkAction(null)}
        onConfirm={() => void handleBulkAction()}
      />
    </MobileScreen>
  );
}

function DeductionRow({
  deduction,
  index,
  selected,
  onToggleSelected,
  onPress,
}: {
  deduction: UnionDeduction;
  index: number;
  selected: boolean;
  onToggleSelected: () => void;
  onPress: () => void;
}) {
  const theme = useNaneTheme();
  const status = selected ? 'Selected' : 'Recorded';
  const statusTone: StatusTone = selected ? 'review' : 'success';
  const item: MobileDataListItem = {
    id: deduction.id,
    title: deduction.member?.fullLegalName || 'Unknown member',
    subtitle: `#${deduction.member?.membershipNumber || 'N/A'} - ${formatDate(deduction.deductionPeriod)}`,
    meta: monthKey(deduction.deductionPeriod) || `Row ${index + 1}`,
    amount: formatTzs(deduction.amount),
    status,
    statusTone,
    accent: statusTone,
    initials: initialsFromName(deduction.member?.fullLegalName || 'UD'),
  };

  return (
    <View style={styles.rowWrap}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onToggleSelected} style={styles.checkHit}>
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
              borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
            },
          ]}
        >
          {selected ? <CheckSquare color={theme.colors.onPrimary} size={16} strokeWidth={2.8} /> : null}
        </View>
      </Pressable>
      <View style={styles.rowList}>
        <MobileDataList items={[item]} onPressItem={onPress ? () => onPress() : undefined} />
      </View>
    </View>
  );
}

async function buildStatusMap(associationId: string | null, rows: UnionDeduction[]) {
  const statusMap = new Map<string, string>();
  if (!associationId) return statusMap;

  const periods = Array.from(new Set(rows.map((row) => monthKey(row.deductionPeriod)).filter(Boolean))) as string[];
  for (const period of periods) {
    try {
      const statuses = await getUnionMemberStatusAtPeriod(associationId, period);
      statuses.forEach((status) => statusMap.set(`${status.memberId}_${period}`, status.statusAtMonth || 'ACTIVE'));
    } catch {
      // Keep export usable even if one status snapshot fails.
    }
  }
  return statusMap;
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
      case 'memberAsc':
        return String(left.member?.fullLegalName || '').localeCompare(String(right.member?.fullLegalName || ''));
      case 'numberAsc':
        return String(left.member?.membershipNumber || '').localeCompare(String(right.member?.membershipNumber || ''));
      default:
        return dateValue(right.deductionPeriod) - dateValue(left.deductionPeriod);
    }
  });
}

function canUseUnionActions(user: ReturnType<typeof useAuth>['user']) {
  const permissions = (user?.permissions || []).map((permission) => permission.trim().toLowerCase());
  return Boolean(
    user?.associationType === 'UNION' &&
      (permissions.includes('union_manage') ||
        permissions.includes('union.manage') ||
        user.associationRole === 'ASSOCIATION_ADMIN' ||
        user.systemRole === 'ASSOCIATION_ADMIN'),
  );
}

function validateFilters(filters: FilterDraft) {
  const errors: Partial<FilterDraft> = {};
  const start = filters.startDate.trim();
  const end = filters.endDate.trim();
  const month = filters.month.trim();
  const year = filters.year.trim();

  if (start && !isIsoDate(start)) errors.startDate = 'Use YYYY-MM-DD.';
  if (end && !isIsoDate(end)) errors.endDate = 'Use YYYY-MM-DD.';
  if (start && end && isIsoDate(start) && isIsoDate(end) && atDayStart(start).getTime() > atDayEnd(end).getTime()) {
    errors.endDate = 'End date must be after start date.';
  }
  if (month && (Number(month) < 1 || Number(month) > 12)) errors.month = 'Use a month from 1 to 12.';
  if (year && year.length !== 4) errors.year = 'Use a four digit year.';
  return errors;
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

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

const styles = StyleSheet.create({
  sectionHeader: {
    gap: 10,
  },
  sectionTitle: {
    minWidth: 0,
    gap: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  deductionList: {
    gap: 10,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkHit: {
    width: 34,
    minHeight: 82,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 25,
    height: 25,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowList: {
    flex: 1,
    minWidth: 0,
  },
  filterGrid: {
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
