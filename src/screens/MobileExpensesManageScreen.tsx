import { router, useLocalSearchParams } from 'expo-router';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Trash2,
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
  deleteAssociationExpense,
  duplicateAssociationExpense,
  getAssociationExpense,
  getAssociationExpenseCategories,
  getAssociationExpenses,
  getAssociationExpenseTotal,
  type Expense,
  type ExpenseCategory,
} from '@/services/expense-service';
import { type StatusTone, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type ExpensePeriod = 'all' | 'month' | 'year' | 'custom';
type ExpenseSortOption = 'dateDesc' | 'dateAsc' | 'amountDesc' | 'amountAsc' | 'categoryAsc' | 'supplierAsc';
type ConfirmAction = {
  kind: 'delete' | 'duplicate';
  expense: Expense;
} | null;

const PAGE_SIZE = 250;
const ALL_PERIOD_START = '1900-01-01';

const sortOptions = [
  { value: 'dateDesc', label: 'Newest first', description: 'Recent expense transactions appear first.' },
  { value: 'dateAsc', label: 'Oldest first', description: 'Oldest transactions appear first.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest expenses appear first.' },
  { value: 'amountAsc', label: 'Lowest amount', description: 'Smallest expenses appear first.' },
  { value: 'categoryAsc', label: 'Category A-Z', description: 'Group records by expense category.' },
  { value: 'supplierAsc', label: 'Supplier A-Z', description: 'Sort by paid-to or supplier name.' },
];

export default function MobileExpensesManageScreen() {
  const params = useLocalSearchParams();
  const theme = useNaneTheme();
  const { activeView, associationId, user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [periodTotal, setPeriodTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState<ExpensePeriod>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortValue, setSortValue] = useState<ExpenseSortOption>('dateDesc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [openedExpenseId, setOpenedExpenseId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const initialExpenseId = Array.isArray(params.expenseId) ? params.expenseId[0] : params.expenseId;
  const canManageExpenses = useMemo(() => hasExpenseManagePermission(user), [user]);

  const periodRange = useMemo(
    () => getExpensePeriodRange(period, customStartDate, customEndDate),
    [customEndDate, customStartDate, period],
  );

  const loadExpenses = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading expenses.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const range = getExpensePeriodRange(period, customStartDate, customEndDate);
        const [expensePage, categoryPage, total] = await Promise.all([
          getAssociationExpenses(associationId, {
            size: PAGE_SIZE,
            sort: sortParamFor(sortValue),
            startDate: range.listStartDate,
            endDate: range.listEndDate,
          }),
          getAssociationExpenseCategories(associationId, { size: PAGE_SIZE }),
          getAssociationExpenseTotal(associationId, range.summaryStartDate, range.summaryEndDate).catch(() => null),
        ]);

        setExpenses(expensePage.expenses);
        setTotalElements(expensePage.totalElements);
        setCategories(categoryPage.categories);
        setPeriodTotal(total?.totalAmount ?? null);
      } catch (loadError) {
        setExpenses([]);
        setTotalElements(0);
        setCategories([]);
        setPeriodTotal(null);
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
      if (active) void loadExpenses();
    });
    return () => {
      active = false;
    };
  }, [loadExpenses]);

  useEffect(() => {
    if (!initialExpenseId || openedExpenseId === initialExpenseId || !associationId) return;
    void Promise.resolve().then(async () => {
      try {
        const expense = expenses.find((item) => item.id === initialExpenseId) || await getAssociationExpense(associationId, initialExpenseId);
        setSelectedExpense(expense);
        setOpenedExpenseId(initialExpenseId);
      } catch (detailError) {
        setError(getApiErrorMessage(detailError));
      }
    });
  }, [associationId, expenses, initialExpenseId, openedExpenseId]);

  useEffect(() => {
    if (initialExpenseId || !openedExpenseId) return;
    void Promise.resolve().then(() => {
      setOpenedExpenseId(null);
      setSelectedExpense(null);
    });
  }, [initialExpenseId, openedExpenseId]);

  const metrics = useMemo(() => {
    const loadedAmount = sumExpenses(expenses);
    const monthStart = startOfCurrentMonth();
    const currentMonth = expenses.filter((expense) => expense.transactionDate >= monthStart);
    const categoriesUsed = new Set(expenses.map((expense) => expense.expenseCategory?.id || 'uncategorized'));
    const topCategory = getTopCategory(expenses);

    return {
      totalAmount: periodTotal ?? loadedAmount,
      loadedAmount,
      count: totalElements || expenses.length,
      loadedCount: expenses.length,
      currentMonthAmount: sumExpenses(currentMonth),
      categoryCount: categoriesUsed.size,
      topCategory,
    };
  }, [expenses, periodTotal, totalElements]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    expenses.forEach((expense) => {
      counts.set(expense.expenseCategory?.id || 'uncategorized', (counts.get(expense.expenseCategory?.id || 'uncategorized') || 0) + 1);
    });
    return counts;
  }, [expenses]);

  const categoryTabs = useMemo(() => {
    const tabs = [{ value: 'all', label: 'All', count: expenses.length }];
    const usedCategories = categories
      .filter((category) => categoryCounts.has(category.id))
      .sort((a, b) => (categoryCounts.get(b.id) || 0) - (categoryCounts.get(a.id) || 0));

    usedCategories.slice(0, 8).forEach((category) => {
      tabs.push({
        value: category.id,
        label: compactCategoryName(category.name),
        count: categoryCounts.get(category.id) || 0,
      });
    });

    if (categoryCounts.has('uncategorized')) {
      tabs.push({ value: 'uncategorized', label: 'No Category', count: categoryCounts.get('uncategorized') || 0 });
    }
    return tabs;
  }, [categories, categoryCounts, expenses.length]);

  const visibleExpenses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = expenses.filter((expense) => {
      const categoryId = expense.expenseCategory?.id || 'uncategorized';
      if (categoryFilter !== 'all' && categoryFilter !== categoryId) return false;
      if (!query) return true;
      return [
        expense.expenseCategory?.name,
        expense.supplierName,
        expense.description,
        expense.paymentMethod,
        expense.supportingDocumentPath,
        expense.recordedBy?.fullName,
        expense.recordedBy?.username,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

    return [...filtered].sort((a, b) => sortExpenses(a, b, sortValue));
  }, [categoryFilter, expenses, searchTerm, sortValue]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleExpenses.map((expense) => ({
        id: expense.id,
        title: expense.expenseCategory?.name || 'Uncategorized Expense',
        subtitle: [expense.supplierName || 'Supplier not recorded', formatDate(expense.transactionDate)].join(' · '),
        meta: expense.description || expense.paymentMethod || 'No description recorded',
        amount: formatCurrency(expense.amount),
        status: expense.receiptPath || expense.supportingDocumentPath ? 'Documented' : 'No Receipt',
        statusTone: expense.receiptPath || expense.supportingDocumentPath ? 'success' : 'warning',
        initials: expenseInitials(expense),
        accent: toneForExpense(expense),
      })),
    [visibleExpenses],
  );

  const openExpense = useCallback(
    (item: MobileDataListItem) => {
      const expense = expenses.find((entry) => entry.id === item.id);
      if (!expense) return;
      setSelectedExpense(expense);
      setNotice(null);
    },
    [expenses],
  );

  const openExpenseRoute = (path: string, expense?: Expense) => {
    const route = getRouteByPath(path);
    if (!route) return;
    router.push({
      pathname: '/work/route-preview',
      params: {
        routeId: route.id,
        id: expense?.id,
        expenseId: expense?.id,
      },
    } as never);
  };

  const expenseReportOptions = useMemo(
    () => ({
      title: 'Expense Report',
      associationName: user?.associationName || 'Association',
      purpose: 'A filtered report of association expenses, suppliers, payment methods, documentation status, and recorded amounts.',
      rows: visibleExpenses,
      fileName: 'nane-expenses',
      metrics: [
        { label: 'Period spend', value: formatCurrency(metrics.totalAmount), helper: periodRange.label },
        { label: 'Expenses', value: formatNumber(metrics.count), helper: `${formatNumber(metrics.loadedCount)} loaded on device` },
        { label: 'This month', value: formatCurrency(metrics.currentMonthAmount), helper: 'Loaded month total' },
        { label: 'Top category', value: metrics.topCategory.value, helper: metrics.topCategory.label },
      ],
      filters: [
        { label: 'Period', value: periodRange.label },
        { label: 'Category', value: categoryFilter === 'all' ? 'All' : selectedCategoryLabel(categoryFilter, categories) },
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '4%', value: (_expense: Expense, index: number) => index + 1 },
        { key: 'date', label: 'Date', width: '10%', value: (expense: Expense) => formatDate(expense.transactionDate) },
        { key: 'category', label: 'Category', width: '16%', value: (expense: Expense) => expense.expenseCategory?.name || 'Uncategorized' },
        { key: 'supplier', label: 'Supplier', width: '16%', value: (expense: Expense) => expense.supplierName || '-' },
        { key: 'paymentMethod', label: 'Method', width: '10%', value: (expense: Expense) => labelFromEnum(expense.paymentMethod) || '-' },
        { key: 'description', label: 'Description', width: '22%', value: (expense: Expense) => expense.description || '-' },
        { key: 'documented', label: 'Docs', width: '8%', value: (expense: Expense) => (expense.receiptPath || expense.supportingDocumentPath ? 'Documented' : 'Missing') },
        { key: 'amount', label: 'Amount', align: 'right' as const, width: '14%', value: (expense: Expense) => formatCurrency(expense.amount) },
      ],
    }),
    [categories, categoryFilter, metrics, periodRange.label, searchTerm, sortValue, user?.associationName, visibleExpenses],
  );

  const resetFilters = () => {
    setPeriod('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setCategoryFilter('all');
    setSearchTerm('');
  };

  const runConfirmedAction = async () => {
    if (!associationId || !confirmAction) return;
    const { kind, expense } = confirmAction;
    setActionLoading(`${kind}:${expense.id}`);
    setError(null);
    setNotice(null);
    try {
      if (kind === 'delete') {
        await deleteAssociationExpense(associationId, expense.id);
        setNotice('Expense deleted successfully.');
        setSelectedExpense(null);
      } else {
        const duplicated = await duplicateAssociationExpense(associationId, expense.id);
        setNotice('Expense duplicated with today’s date.');
        setSelectedExpense(duplicated);
      }
      setConfirmAction(null);
      await loadExpenses('refresh');
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setActionLoading(null);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association admin only" description="Expense management is available from the association admin workspace." />;
  }

  if (loading && expenses.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading expenses" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Expenses"
        eyebrow="Financials"
        subtitle="Track operating costs, receipts, categories and payment methods."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" onPress={() => void loadExpenses('refresh')} disabled={refreshing} />}
      />

      {error ? <MobileErrorState title="Expenses issue" description={error} onRetry={() => void loadExpenses('refresh')} /> : null}
      {notice ? (
        <MobileCard compact accent="green">
          <View style={styles.noticeRow}>
            <CheckCircle2 size={18} color="#15803D" />
            <MobileText variant="small" weight="bold" style={styles.noticeText}>
              {notice}
            </MobileText>
          </View>
        </MobileCard>
      ) : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Period Spend" value={formatCurrency(metrics.totalAmount)} description={periodRange.label} tone="red" icon={Banknote} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Expenses" value={formatNumber(metrics.count)} description={`${formatNumber(metrics.loadedCount)} loaded on device`} tone="blue" icon={ReceiptText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="This Month" value={formatCurrency(metrics.currentMonthAmount)} description="Loaded month total" tone="orange" icon={CalendarDays} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Top Category" value={metrics.topCategory.value} description={metrics.topCategory.label} tone="purple" icon={FileText} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFilterControls
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search expenses..."
        onFilterPress={() => setFilterOpen(true)}
        filterLabel="Filters"
        badges={
          <>
            <MobileStatusBadge status={periodRange.shortLabel} tone="primary" />
            {categoryFilter !== 'all' ? <MobileStatusBadge status="Category" label={selectedCategoryLabel(categoryFilter, categories)} tone="review" /> : null}
            {searchTerm ? <MobileStatusBadge status="Search" label={searchTerm.trim()} tone="info" /> : null}
          </>
        }
        tabs={categoryTabs}
        value={categoryFilter}
        onChange={setCategoryFilter}
        primaryAction={canManageExpenses ? { label: 'New Expense', icon: Plus, onPress: () => openExpenseRoute('/associations/expenses/new') } : null}
        secondaryActions={[
          { label: 'Sort', icon: CalendarDays, variant: 'secondary', onPress: () => setSortOpen(true) },
        ]}
        actionSlot={<MobileReportExportButton fullWidth options={expenseReportOptions} onError={(exportError) => setError(getApiErrorMessage(exportError))} />}
      />

      {visibleExpenses.length === 0 && !loading ? (
        <MobileEmptyState
          title="No expenses found"
          description={searchTerm || categoryFilter !== 'all' ? 'Adjust the search, category or period filters to see more expenses.' : 'Record the first association expense to track financial outflows.'}
          actionLabel={canManageExpenses ? 'New Expense' : undefined}
          onAction={canManageExpenses ? () => openExpenseRoute('/associations/expenses/new') : undefined}
        />
      ) : (
        <MobileDataList items={listItems} onPressItem={openExpense} />
      )}

      <MobileSheet
        visible={Boolean(selectedExpense)}
        title={selectedExpense?.expenseCategory?.name || 'Expense details'}
        description={selectedExpense ? `${formatCurrency(selectedExpense.amount)} · ${formatDate(selectedExpense.transactionDate)}` : undefined}
        onClose={() => setSelectedExpense(null)}
      >
        {selectedExpense ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
            <View style={styles.badges}>
              <MobileStatusBadge status={selectedExpense.expenseCategory?.name || 'Uncategorized'} tone={toneForExpense(selectedExpense)} />
              <MobileStatusBadge
                status={selectedExpense.receiptPath || selectedExpense.supportingDocumentPath ? 'Documented' : 'Missing Receipt'}
                tone={selectedExpense.receiptPath || selectedExpense.supportingDocumentPath ? 'success' : 'warning'}
              />
              {selectedExpense.paymentMethod ? <MobileStatusBadge status={selectedExpense.paymentMethod} tone="primary" /> : null}
            </View>

            <View style={styles.detailActions}>
              {canManageExpenses ? (
                <>
                  <MobileButton label="Edit" icon={Edit3} variant="secondary" onPress={() => openExpenseRoute('/associations/expenses/edit/:id', selectedExpense)} size="sm" />
                  <MobileButton label="Duplicate" icon={Copy} variant="secondary" onPress={() => setConfirmAction({ kind: 'duplicate', expense: selectedExpense })} loading={actionLoading === `duplicate:${selectedExpense.id}`} size="sm" />
                  <MobileButton label="Delete" icon={Trash2} variant="danger" onPress={() => setConfirmAction({ kind: 'delete', expense: selectedExpense })} loading={actionLoading === `delete:${selectedExpense.id}`} size="sm" />
                </>
              ) : null}
            </View>

            <MobileCard compact>
              <MobileInfoRow label="Amount" value={formatCurrency(selectedExpense.amount)} icon={Banknote} status="Expense" />
              <MobileInfoRow label="Transaction Date" value={formatDate(selectedExpense.transactionDate)} icon={CalendarDays} />
              <MobileInfoRow label="Supplier / Paid To" value={selectedExpense.supplierName || 'Not recorded'} icon={ReceiptText} />
              <MobileInfoRow label="Payment Method" value={labelFromEnum(selectedExpense.paymentMethod)} />
              <MobileInfoRow label="Supporting Document" value={selectedExpense.supportingDocumentPath || selectedExpense.receiptPath || 'Not attached'} icon={FileText} />
              <MobileInfoRow label="Recorded By" value={selectedExpense.recordedBy?.fullName || selectedExpense.recordedBy?.username || 'Not recorded'} />
              <MobileInfoRow label="Created" value={formatDate(selectedExpense.createdAt)} />
              <MobileInfoRow label="Updated" value={formatDate(selectedExpense.updatedAt)} />
            </MobileCard>

            {selectedExpense.description ? (
              <MobileCard compact>
                <MobileText variant="small" tone="secondary" weight="bold">
                  Description
                </MobileText>
                <MobileText variant="body">{selectedExpense.description}</MobileText>
              </MobileCard>
            ) : null}
          </ScrollView>
        ) : null}
      </MobileSheet>

      <MobileSheet
        visible={filterOpen}
        title="Filter expenses"
        description="Use period and category filters without leaving the list."
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
              Category
            </MobileText>
            <MobileStatusTabs tabs={categoryTabs} value={categoryFilter} onChange={setCategoryFilter} />
          </View>

          <View style={styles.filterActions}>
            <MobileButton label="Reset" icon={RotateCcw} variant="secondary" onPress={resetFilters} />
            <MobileButton label="Apply" fullWidth onPress={() => setFilterOpen(false)} style={styles.applyButton} />
          </View>
        </ScrollView>
      </MobileSheet>

      <MobileSortSheet visible={sortOpen} value={sortValue} options={sortOptions} onChange={(value) => setSortValue(value as ExpenseSortOption)} onClose={() => setSortOpen(false)} />

      <MobileConfirmSheet
        visible={Boolean(confirmAction)}
        title={confirmTitle(confirmAction)}
        description={confirmDescription(confirmAction)}
        confirmLabel={confirmLabel(confirmAction, actionLoading)}
        destructive={confirmAction?.kind === 'delete'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={runConfirmedAction}
      />
    </MobileScreen>
  );
}

const periodOptions: { value: ExpensePeriod; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

function hasExpenseManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    [
      'finance.transactions.create',
      'finance.transactions.update',
      'finance.transactions.delete',
      'expenses_manage',
      'finance_manage',
      'association_admin',
      'admin',
    ].includes(value),
  );
}

function sortParamFor(value: ExpenseSortOption) {
  if (value === 'dateAsc') return 'transactionDate,asc';
  if (value === 'amountDesc') return 'amount,desc';
  if (value === 'amountAsc') return 'amount,asc';
  if (value === 'categoryAsc') return 'expenseCategory.name,asc';
  if (value === 'supplierAsc') return 'supplierName,asc';
  return 'transactionDate,desc';
}

function sortExpenses(a: Expense, b: Expense, value: ExpenseSortOption) {
  if (value === 'dateAsc') return dateValue(a.transactionDate) - dateValue(b.transactionDate);
  if (value === 'amountDesc') return b.amount - a.amount;
  if (value === 'amountAsc') return a.amount - b.amount;
  if (value === 'categoryAsc') return String(a.expenseCategory?.name || '').localeCompare(String(b.expenseCategory?.name || ''));
  if (value === 'supplierAsc') return String(a.supplierName || '').localeCompare(String(b.supplierName || ''));
  return dateValue(b.transactionDate) - dateValue(a.transactionDate);
}

function getExpensePeriodRange(period: ExpensePeriod, customStartDate: string, customEndDate: string) {
  const today = toIsoDate(new Date());
  if (period === 'month') {
    const start = startOfCurrentMonth();
    return {
      label: `${formatDate(start)} - ${formatDate(today)}`,
      shortLabel: 'This Month',
      listStartDate: start,
      listEndDate: today,
      summaryStartDate: start,
      summaryEndDate: today,
    };
  }
  if (period === 'year') {
    const start = `${new Date().getFullYear()}-01-01`;
    return {
      label: `${formatDate(start)} - ${formatDate(today)}`,
      shortLabel: 'This Year',
      listStartDate: start,
      listEndDate: today,
      summaryStartDate: start,
      summaryEndDate: today,
    };
  }
  if (period === 'custom' && isIsoDate(customStartDate) && isIsoDate(customEndDate)) {
    return {
      label: `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`,
      shortLabel: 'Custom',
      listStartDate: customStartDate,
      listEndDate: customEndDate,
      summaryStartDate: customStartDate,
      summaryEndDate: customEndDate,
    };
  }
  return {
    label: 'All tracked expenses',
    shortLabel: period === 'custom' ? 'Custom Date' : 'All Periods',
    listStartDate: undefined,
    listEndDate: undefined,
    summaryStartDate: ALL_PERIOD_START,
    summaryEndDate: today,
  };
}

function sumExpenses(expenses: Expense[]) {
  return expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
}

function getTopCategory(expenses: Expense[]) {
  const totals = new Map<string, { label: string; amount: number }>();
  expenses.forEach((expense) => {
    const key = expense.expenseCategory?.id || 'uncategorized';
    const current = totals.get(key) || { label: expense.expenseCategory?.name || 'Uncategorized', amount: 0 };
    current.amount += Number(expense.amount || 0);
    totals.set(key, current);
  });

  const top = [...totals.values()].sort((a, b) => b.amount - a.amount)[0];
  if (!top) return { value: 'None', label: 'No expenses loaded' };
  return { value: compactCategoryName(top.label), label: formatCurrency(top.amount) };
}

function toneForExpense(expense: Expense): StatusTone {
  if (expense.receiptPath || expense.supportingDocumentPath) return 'success';
  if (expense.amount >= 1_000_000) return 'danger';
  if (expense.amount >= 250_000) return 'warning';
  return 'primary';
}

function expenseInitials(expense: Expense) {
  const name = expense.expenseCategory?.name || 'Expense';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function selectedCategoryLabel(categoryFilter: string, categories: ExpenseCategory[]) {
  if (categoryFilter === 'uncategorized') return 'No Category';
  return categories.find((category) => category.id === categoryFilter)?.name || 'Selected';
}

function labelFromEnum(value?: string | null) {
  if (!value) return 'Not recorded';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function compactCategoryName(name: string) {
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

function confirmTitle(action: ConfirmAction) {
  if (action?.kind === 'delete') return 'Delete expense';
  if (action?.kind === 'duplicate') return 'Duplicate expense';
  return 'Confirm action';
}

function confirmDescription(action: ConfirmAction) {
  if (!action) return '';
  const category = action.expense.expenseCategory?.name || 'this expense';
  if (action.kind === 'delete') return `Delete ${category} for ${formatCurrency(action.expense.amount)}? This cannot be undone.`;
  return `Create a copy of ${category} for ${formatCurrency(action.expense.amount)}? The duplicate will use today’s date and will not copy the receipt.`;
}

function confirmLabel(action: ConfirmAction, loading: string | null) {
  if (!action) return 'Confirm';
  if (loading === `${action.kind}:${action.expense.id}`) return 'Working...';
  if (action.kind === 'delete') return 'Delete';
  return 'Duplicate';
}

const styles = StyleSheet.create({
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  noticeText: {
    flex: 1,
    color: '#15803D',
  },
  sheetScroll: {
    gap: 14,
    paddingBottom: 14,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterContent: {
    gap: 16,
    paddingBottom: 14,
  },
  filterBlock: {
    gap: 10,
  },
  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  periodOption: {
    minHeight: 40,
    borderRadius: 14,
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
