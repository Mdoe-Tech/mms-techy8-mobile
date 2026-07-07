import { router, useLocalSearchParams } from 'expo-router';
import {
  Banknote,
  CalendarDays,
  CreditCard,
  Edit3,
  Eye,
  FileText,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileFilterControls,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileReportExportButton,
  MobileScreen,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  deleteAssociationGeneralRevenue,
  getAllAssociationGeneralRevenues,
  getAssociationGeneralRevenue,
  getAssociationGeneralRevenues,
  getAssociationRevenueCategories,
  type GeneralRevenue,
  type RevenueCategory,
} from '@/services/general-revenue-service';
import type { StatusTone } from '@/theme/tokens';
import { useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type RevenuePeriod = 'all' | 'month' | 'year' | 'custom';
type RevenueSortOption = 'dateDesc' | 'dateAsc' | 'amountDesc' | 'amountAsc' | 'categoryAsc' | 'sourceAsc';

const PAGE_SIZE = 250;
const ALL_PERIOD_START = '1900-01-01';

const sortOptions = [
  { value: 'dateDesc', label: 'Newest first', description: 'Recent revenue entries appear first.' },
  { value: 'dateAsc', label: 'Oldest first', description: 'Oldest revenue entries appear first.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest revenue records appear first.' },
  { value: 'amountAsc', label: 'Lowest amount', description: 'Smallest revenue records appear first.' },
  { value: 'categoryAsc', label: 'Category A-Z', description: 'Group entries by revenue category.' },
  { value: 'sourceAsc', label: 'Source A-Z', description: 'Sort by payer, source, or origin.' },
];

const periodOptions: { value: RevenuePeriod; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

export default function MobileRevenueManageScreen() {
  const params = useLocalSearchParams();
  const theme = useNaneTheme();
  const { activeView, associationId, user } = useAuth();
  const [revenues, setRevenues] = useState<GeneralRevenue[]>([]);
  const [allRevenues, setAllRevenues] = useState<GeneralRevenue[]>([]);
  const [categories, setCategories] = useState<RevenueCategory[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState<RevenuePeriod>('year');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [sortValue, setSortValue] = useState<RevenueSortOption>('dateDesc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedRevenue, setSelectedRevenue] = useState<GeneralRevenue | null>(null);
  const [openedRevenueId, setOpenedRevenueId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GeneralRevenue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const initialRevenueId = Array.isArray(params.revenueId) ? params.revenueId[0] : params.revenueId;
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const previewRevenueId = initialRevenueId || idParam;
  const canManageRevenue = useMemo(() => hasRevenueManagePermission(user), [user]);

  const periodRange = useMemo(
    () => getRevenuePeriodRange(period, customStartDate, customEndDate),
    [customEndDate, customStartDate, period],
  );

  const loadRevenues = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading revenue records.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const range = getRevenuePeriodRange(period, customStartDate, customEndDate);
        const [page, allPage, categoryList] = await Promise.all([
          getAssociationGeneralRevenues(associationId, {
            size: PAGE_SIZE,
            sort: sortParamFor(sortValue),
            startDate: range.listStartDate,
            endDate: range.listEndDate,
          }),
          getAllAssociationGeneralRevenues(associationId, {
            size: PAGE_SIZE,
            sort: sortParamFor(sortValue),
            startDate: range.listStartDate,
            endDate: range.listEndDate,
          }, { maxPages: 20 }),
          getAssociationRevenueCategories(associationId),
        ]);

        setRevenues(page.revenues);
        setAllRevenues(allPage.revenues);
        setTotalElements(page.totalElements);
        setCategories(categoryList);
      } catch (loadError) {
        setRevenues([]);
        setAllRevenues([]);
        setTotalElements(0);
        setCategories([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, customEndDate, customStartDate, period, sortValue],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadRevenues();
    });
    return () => {
      active = false;
    };
  }, [loadRevenues]);

  useEffect(() => {
    if (!previewRevenueId || openedRevenueId === previewRevenueId || !associationId) return;
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const revenue = allRevenues.find((item) => item.id === previewRevenueId)
          || revenues.find((item) => item.id === previewRevenueId)
          || await getAssociationGeneralRevenue(associationId, previewRevenueId);
        if (!active) return;
        setSelectedRevenue(revenue);
        setOpenedRevenueId(previewRevenueId);
      } catch (detailError) {
        if (active) setError(getApiErrorMessage(detailError));
      }
    });
    return () => {
      active = false;
    };
  }, [allRevenues, associationId, openedRevenueId, previewRevenueId, revenues]);

  const metrics = useMemo(() => {
    const totalAmount = sumRevenue(allRevenues);
    const categoryCount = new Set(allRevenues.map((revenue) => revenue.revenueCategory?.id || 'uncategorized')).size;
    const paymentMethods = new Set(allRevenues.map((revenue) => revenue.paymentMethod).filter(Boolean).map(String));
    return {
      totalAmount,
      count: totalElements || allRevenues.length,
      loadedCount: allRevenues.length || revenues.length,
      categoriesUsed: categoryCount,
      paymentMethodCount: paymentMethods.size,
      average: allRevenues.length > 0 ? totalAmount / allRevenues.length : 0,
    };
  }, [allRevenues, revenues.length, totalElements]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allRevenues.forEach((revenue) => {
      const categoryId = revenue.revenueCategory?.id || 'uncategorized';
      counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
    });
    return counts;
  }, [allRevenues]);

  const categoryTabs = useMemo(() => {
    const tabs = [{ value: 'all', label: 'All', count: allRevenues.length }];
    const usedCategories = categories
      .filter((category) => categoryCounts.has(category.id))
      .sort((a, b) => (categoryCounts.get(b.id) || 0) - (categoryCounts.get(a.id) || 0));

    usedCategories.slice(0, 8).forEach((category) => {
      tabs.push({
        value: category.id,
        label: compactLabel(category.name),
        count: categoryCounts.get(category.id) || 0,
      });
    });

    if (categoryCounts.has('uncategorized')) {
      tabs.push({ value: 'uncategorized', label: 'No Category', count: categoryCounts.get('uncategorized') || 0 });
    }
    return tabs;
  }, [allRevenues.length, categories, categoryCounts]);

  const paymentMethodTabs = useMemo(() => {
    const counts = new Map<string, number>();
    allRevenues.forEach((revenue) => {
      const method = revenue.paymentMethod || 'not-recorded';
      counts.set(method, (counts.get(method) || 0) + 1);
    });
    return [
      { value: 'all', label: 'All Methods', count: allRevenues.length },
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([value, count]) => ({
          value,
          label: value === 'not-recorded' ? 'Not Recorded' : compactLabel(labelFromEnum(value)),
          count,
        })),
    ];
  }, [allRevenues]);

  const visibleRevenues = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = allRevenues.filter((revenue) => {
      const categoryId = revenue.revenueCategory?.id || 'uncategorized';
      const paymentMethod = revenue.paymentMethod || 'not-recorded';
      if (categoryFilter !== 'all' && categoryFilter !== categoryId) return false;
      if (paymentMethodFilter !== 'all' && paymentMethodFilter !== paymentMethod) return false;
      if (!query) return true;
      return [
        revenue.revenueCategory?.name,
        revenue.sourceName,
        revenue.description,
        revenue.paymentMethod,
        revenue.referenceNumber,
        revenue.notes,
        revenue.recordedBy?.fullName,
        revenue.recordedBy?.username,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
    return [...filtered].sort((a, b) => sortRevenues(a, b, sortValue));
  }, [allRevenues, categoryFilter, paymentMethodFilter, searchTerm, sortValue]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleRevenues.map((revenue) => ({
        id: revenue.id,
        title: revenue.revenueCategory?.name || 'Uncategorized Revenue',
        subtitle: [revenue.sourceName || 'Source not recorded', formatDate(revenue.transactionDate)].join(' · '),
        meta: revenue.description || revenue.referenceNumber || labelFromEnum(revenue.paymentMethod) || 'No description recorded',
        amount: formatCurrency(revenue.amount),
        status: revenue.receiptPath ? 'Receipted' : labelFromEnum(revenue.paymentMethod) || 'No Receipt',
        statusTone: toneForRevenue(revenue),
        initials: revenueInitials(revenue),
        accent: toneForRevenue(revenue),
      })),
    [visibleRevenues],
  );

  const openRevenueRoute = (path: string, revenue?: GeneralRevenue) => {
    const route = getRouteByPath(path);
    if (!route) return;
    router.push({
      pathname: '/work/route-preview',
      params: {
        routeId: route.id,
        id: revenue?.id,
        revenueId: revenue?.id,
      },
    } as never);
  };

  const revenueReportOptions = useMemo(
    () => ({
      title: 'General Revenue Report',
      associationName: user?.associationName || 'Association',
      purpose: 'A filtered report of association revenue records, payment methods, references, sources, and collected amounts.',
      rows: visibleRevenues,
      fileName: 'nane-general-revenue',
      metrics: [
        { label: 'Total revenue', value: formatCurrency(metrics.totalAmount), helper: periodRange.label },
        { label: 'Records', value: formatNumber(metrics.count), helper: `${formatNumber(metrics.loadedCount)} loaded on device` },
        { label: 'Categories', value: formatNumber(metrics.categoriesUsed), helper: `${formatNumber(categories.length)} configured` },
        { label: 'Average', value: formatCurrency(metrics.average), helper: `${formatNumber(metrics.paymentMethodCount)} payment methods` },
      ],
      filters: [
        { label: 'Period', value: periodRange.label },
        { label: 'Category', value: categoryFilter === 'all' ? 'All' : selectedCategoryLabel(categoryFilter, categories) },
        { label: 'Payment method', value: paymentMethodFilter === 'all' ? 'All' : selectedPaymentLabel(paymentMethodFilter) },
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '4%', value: (_revenue: GeneralRevenue, index: number) => index + 1 },
        { key: 'date', label: 'Date', width: '10%', value: (revenue: GeneralRevenue) => formatDate(revenue.transactionDate) },
        { key: 'category', label: 'Category', width: '16%', value: (revenue: GeneralRevenue) => revenue.revenueCategory?.name || 'Uncategorized' },
        { key: 'source', label: 'Source', width: '16%', value: (revenue: GeneralRevenue) => revenue.sourceName || '-' },
        { key: 'paymentMethod', label: 'Method', width: '10%', value: (revenue: GeneralRevenue) => labelFromEnum(revenue.paymentMethod) || '-' },
        { key: 'reference', label: 'Reference', width: '12%', value: (revenue: GeneralRevenue) => revenue.referenceNumber || '-' },
        { key: 'description', label: 'Description', width: '18%', value: (revenue: GeneralRevenue) => revenue.description || revenue.notes || '-' },
        { key: 'amount', label: 'Amount', align: 'right' as const, width: '14%', value: (revenue: GeneralRevenue) => formatCurrency(revenue.amount) },
      ],
    }),
    [categories, categoryFilter, metrics, paymentMethodFilter, periodRange.label, searchTerm, sortValue, user?.associationName, visibleRevenues],
  );

  const resetFilters = () => {
    setPeriod('year');
    setCustomStartDate('');
    setCustomEndDate('');
    setCategoryFilter('all');
    setPaymentMethodFilter('all');
    setSearchTerm('');
  };

  const deleteRevenue = async () => {
    if (!associationId || !confirmDelete) return;
    setDeleting(confirmDelete.id);
    setError(null);
    setNotice(null);
    try {
      await deleteAssociationGeneralRevenue(associationId, confirmDelete.id);
      setNotice('Revenue record deleted successfully.');
      setSelectedRevenue(null);
      setConfirmDelete(null);
      await loadRevenues('refresh');
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
      setConfirmDelete(null);
    } finally {
      setDeleting(null);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Revenue management is available from the association admin workspace." />;
  }

  if (loading && revenues.length === 0 && allRevenues.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading revenue records" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Revenue Management"
        eyebrow="Financials"
        subtitle="Track general revenue, sources, receipts and categories."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" onPress={() => void loadRevenues('refresh')} disabled={refreshing} />}
      />

      {error ? <MobileErrorState title="Revenue issue" description={error} onRetry={() => void loadRevenues('refresh')} /> : null}
      {notice ? (
        <MobileCard compact accent="green">
          <MobileText variant="small" weight="bold" style={styles.noticeText}>
            {notice}
          </MobileText>
        </MobileCard>
      ) : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total Revenue" value={formatCurrency(metrics.totalAmount)} description={periodRange.label} tone="green" icon={Banknote} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Records" value={formatNumber(metrics.count)} description={`${formatNumber(metrics.loadedCount)} loaded on device`} tone="blue" icon={ReceiptText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Categories" value={formatNumber(metrics.categoriesUsed)} description={`${formatNumber(categories.length)} configured`} tone="purple" icon={FileText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Average" value={formatCurrency(metrics.average)} description={`${formatNumber(metrics.paymentMethodCount)} payment methods`} tone="orange" icon={CreditCard} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFilterControls
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search revenue..."
        onFilterPress={() => setFilterOpen(true)}
        filterLabel="Filters"
        badges={
          <>
            <MobileStatusBadge status={periodRange.shortLabel} tone="primary" />
            {categoryFilter !== 'all' ? <MobileStatusBadge status="Category" label={selectedCategoryLabel(categoryFilter, categories)} tone="review" /> : null}
            {paymentMethodFilter !== 'all' ? <MobileStatusBadge status="Method" label={selectedPaymentLabel(paymentMethodFilter)} tone="info" /> : null}
            {searchTerm ? <MobileStatusBadge status="Search" label={searchTerm.trim()} tone="neutral" /> : null}
          </>
        }
        tabs={categoryTabs}
        value={categoryFilter}
        onChange={setCategoryFilter}
        primaryAction={{ label: 'Add Revenue', icon: Plus, onPress: () => openRevenueRoute('/associations/revenue/new') }}
        secondaryActions={[
          { label: 'Sort', icon: CalendarDays, variant: 'secondary', onPress: () => setSortOpen(true) },
        ]}
        actionSlot={<MobileReportExportButton fullWidth options={revenueReportOptions} onError={(exportError) => setError(getApiErrorMessage(exportError))} />}
      />

      {visibleRevenues.length === 0 && !loading ? (
        <MobileEmptyState
          title="No revenue records found"
          description={searchTerm || categoryFilter !== 'all' || paymentMethodFilter !== 'all' ? 'Adjust the search, category, payment method or period filters.' : categories.length === 0 ? 'Set up revenue categories before recording revenue.' : 'Add the first general revenue record for this period.'}
          actionLabel={categories.length === 0 ? 'Set Up Categories' : 'Add Revenue'}
          onAction={() => openRevenueRoute(categories.length === 0 ? '/associations/revenue/categories' : '/associations/revenue/new')}
        />
      ) : (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => setSelectedRevenue(visibleRevenues.find((revenue) => revenue.id === item.id) || null)}
        />
      )}

      <MobileSheet
        visible={Boolean(selectedRevenue)}
        title={selectedRevenue?.revenueCategory?.name || 'Revenue details'}
        description={selectedRevenue ? `${formatCurrency(selectedRevenue.amount)} · ${formatDate(selectedRevenue.transactionDate)}` : undefined}
        onClose={() => setSelectedRevenue(null)}
      >
        {selectedRevenue ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
            <View style={styles.badges}>
              <MobileStatusBadge status={selectedRevenue.revenueCategory?.name || 'Uncategorized'} tone={toneForRevenue(selectedRevenue)} />
              {selectedRevenue.paymentMethod ? <MobileStatusBadge status={labelFromEnum(selectedRevenue.paymentMethod)} tone="primary" /> : null}
              {selectedRevenue.receiptPath ? <MobileStatusBadge status="Receipted" tone="success" /> : <MobileStatusBadge status="No Receipt" tone="warning" />}
            </View>

            <View style={styles.detailActions}>
              <MobileButton label="View" icon={Eye} variant="secondary" onPress={() => openRevenueRoute('/associations/revenue/:id/view', selectedRevenue)} size="sm" />
              <MobileButton label="Edit" icon={Edit3} variant="secondary" onPress={() => openRevenueRoute('/associations/revenue/:id/edit', selectedRevenue)} size="sm" />
              {canManageRevenue ? (
                <MobileButton
                  label="Delete"
                  icon={Trash2}
                  variant="danger"
                  onPress={() => setConfirmDelete(selectedRevenue)}
                  loading={deleting === selectedRevenue.id}
                  size="sm"
                />
              ) : null}
            </View>

            <MobileCard compact>
              <MobileInfoRow label="Amount" value={formatCurrency(selectedRevenue.amount)} icon={Banknote} status="Revenue" />
              <MobileInfoRow label="Transaction Date" value={formatDate(selectedRevenue.transactionDate)} icon={CalendarDays} />
              <MobileInfoRow label="Source" value={selectedRevenue.sourceName || 'Not recorded'} icon={UserRound} />
              <MobileInfoRow label="Payment Method" value={labelFromEnum(selectedRevenue.paymentMethod)} icon={CreditCard} />
              <MobileInfoRow label="Reference" value={selectedRevenue.referenceNumber || 'Not recorded'} icon={ReceiptText} />
              <MobileInfoRow label="Receipt" value={selectedRevenue.receiptPath || 'Not attached'} icon={FileText} />
              <MobileInfoRow label="Recorded By" value={selectedRevenue.recordedBy?.fullName || selectedRevenue.recordedBy?.username || 'Not recorded'} />
              <MobileInfoRow label="Created" value={formatDate(selectedRevenue.createdAt)} />
              <MobileInfoRow label="Updated" value={formatDate(selectedRevenue.updatedAt)} />
            </MobileCard>

            {selectedRevenue.description || selectedRevenue.notes ? (
              <MobileCard compact>
                {selectedRevenue.description ? (
                  <>
                    <MobileText variant="small" tone="secondary" weight="bold">
                      Description
                    </MobileText>
                    <MobileText variant="body">{selectedRevenue.description}</MobileText>
                  </>
                ) : null}
                {selectedRevenue.notes ? (
                  <>
                    <MobileText variant="small" tone="secondary" weight="bold">
                      Notes
                    </MobileText>
                    <MobileText variant="body">{selectedRevenue.notes}</MobileText>
                  </>
                ) : null}
              </MobileCard>
            ) : null}
          </ScrollView>
        ) : null}
      </MobileSheet>

      <MobileSheet
        visible={filterOpen}
        title="Filter revenue"
        description="Narrow the list without leaving revenue management."
        onClose={() => setFilterOpen(false)}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          <View style={styles.filterBlock}>
            <MobileText variant="small" weight="bold">
              Period
            </MobileText>
            <View style={styles.periodGrid}>
              {periodOptions.map((option) => {
                const active = option.value === period;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setPeriod(option.value)}
                    style={({ pressed }) => [
                      styles.periodOption,
                      {
                        backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                        opacity: pressed ? 0.82 : 1,
                      },
                    ]}
                  >
                    <MobileText variant="small" weight="bold" style={{ color: active ? theme.colors.onPrimary : theme.colors.text }}>
                      {option.label}
                    </MobileText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {period === 'custom' ? (
            <View style={styles.customDates}>
              <MobileTextInput
                label="Start Date"
                value={customStartDate}
                onChangeText={setCustomStartDate}
                placeholder="YYYY-MM-DD"
                helperText="Use ISO date format."
                icon={CalendarDays}
              />
              <MobileTextInput
                label="End Date"
                value={customEndDate}
                onChangeText={setCustomEndDate}
                placeholder="YYYY-MM-DD"
                helperText="Use ISO date format."
                icon={CalendarDays}
              />
            </View>
          ) : null}

          <View style={styles.filterBlock}>
            <MobileText variant="small" weight="bold">
              Payment Method
            </MobileText>
            <MobileStatusTabs tabs={paymentMethodTabs} value={paymentMethodFilter} onChange={setPaymentMethodFilter} />
          </View>

          <View style={styles.filterActions}>
            <MobileButton label="Reset" icon={RotateCcw} variant="secondary" onPress={resetFilters} />
            <MobileButton label="Apply" fullWidth onPress={() => setFilterOpen(false)} style={styles.applyButton} />
          </View>
        </ScrollView>
      </MobileSheet>

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={sortOptions}
        onChange={(value) => setSortValue(value as RevenueSortOption)}
        onClose={() => setSortOpen(false)}
      />

      <MobileConfirmSheet
        visible={Boolean(confirmDelete)}
        title="Delete revenue record"
        description={confirmDelete ? `Delete ${confirmDelete.revenueCategory?.name || 'this revenue'} for ${formatCurrency(confirmDelete.amount)}? This cannot be undone.` : ''}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={deleteRevenue}
      />
    </MobileScreen>
  );
}

function hasRevenueManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    [
      'finance.transactions.update',
      'finance.transactions.delete',
      'finance_manage',
      'association_admin',
      'admin',
    ].includes(value),
  );
}

function sortParamFor(value: RevenueSortOption) {
  if (value === 'dateAsc') return 'transactionDate,asc';
  if (value === 'amountDesc') return 'amount,desc';
  if (value === 'amountAsc') return 'amount,asc';
  if (value === 'categoryAsc') return 'revenueCategory.name,asc';
  if (value === 'sourceAsc') return 'sourceName,asc';
  return 'transactionDate,desc';
}

function sortRevenues(a: GeneralRevenue, b: GeneralRevenue, value: RevenueSortOption) {
  if (value === 'dateAsc') return dateValue(a.transactionDate) - dateValue(b.transactionDate);
  if (value === 'amountDesc') return b.amount - a.amount;
  if (value === 'amountAsc') return a.amount - b.amount;
  if (value === 'categoryAsc') return String(a.revenueCategory?.name || '').localeCompare(String(b.revenueCategory?.name || ''));
  if (value === 'sourceAsc') return String(a.sourceName || '').localeCompare(String(b.sourceName || ''));
  return dateValue(b.transactionDate) - dateValue(a.transactionDate);
}

function getRevenuePeriodRange(period: RevenuePeriod, customStartDate: string, customEndDate: string) {
  const today = toIsoDate(new Date());
  if (period === 'month') {
    const start = startOfCurrentMonth();
    return {
      label: `${formatDate(start)} - ${formatDate(today)}`,
      shortLabel: 'This Month',
      listStartDate: start,
      listEndDate: today,
    };
  }
  if (period === 'year') {
    const start = `${new Date().getFullYear()}-01-01`;
    return {
      label: `${formatDate(start)} - ${formatDate(today)}`,
      shortLabel: 'This Year',
      listStartDate: start,
      listEndDate: today,
    };
  }
  if (period === 'custom' && isIsoDate(customStartDate) && isIsoDate(customEndDate)) {
    return {
      label: `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`,
      shortLabel: 'Custom',
      listStartDate: customStartDate,
      listEndDate: customEndDate,
    };
  }
  return {
    label: 'All recorded revenue',
    shortLabel: period === 'custom' ? 'Custom Date' : 'All Periods',
    listStartDate: period === 'all' ? undefined : ALL_PERIOD_START,
    listEndDate: period === 'all' ? undefined : today,
  };
}

function sumRevenue(revenues: GeneralRevenue[]) {
  return revenues.reduce((total, revenue) => total + Number(revenue.amount || 0), 0);
}

function toneForRevenue(revenue: GeneralRevenue): StatusTone {
  if (revenue.receiptPath) return 'success';
  if (revenue.amount >= 1_000_000) return 'paid';
  if (revenue.amount >= 250_000) return 'primary';
  if (revenue.paymentMethod) return 'info';
  return 'warning';
}

function revenueInitials(revenue: GeneralRevenue) {
  const name = revenue.revenueCategory?.name || revenue.sourceName || 'Revenue';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function selectedCategoryLabel(categoryFilter: string, categories: RevenueCategory[]) {
  if (categoryFilter === 'uncategorized') return 'No Category';
  return categories.find((category) => category.id === categoryFilter)?.name || 'Selected';
}

function selectedPaymentLabel(paymentMethodFilter: string) {
  if (paymentMethodFilter === 'not-recorded') return 'Not Recorded';
  return labelFromEnum(paymentMethodFilter);
}

function labelFromEnum(value?: string | null) {
  if (!value) return 'Not recorded';
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function compactLabel(name: string) {
  const trimmed = name.trim();
  return trimmed.length > 18 ? `${trimmed.slice(0, 17)}…` : trimmed;
}

function dateValue(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function startOfCurrentMonth() {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

const styles = StyleSheet.create({
  noticeText: {
    color: '#15803D',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetScroll: {
    gap: 12,
    paddingBottom: 10,
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterContent: {
    gap: 16,
    paddingBottom: 10,
  },
  filterBlock: {
    gap: 10,
  },
  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  periodOption: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customDates: {
    gap: 12,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 10,
  },
  applyButton: {
    flex: 1,
  },
});
