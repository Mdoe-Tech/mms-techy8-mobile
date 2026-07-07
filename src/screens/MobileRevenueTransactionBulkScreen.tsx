import { router } from 'expo-router';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Edit3,
  FilePlus2,
  RefreshCw,
  RotateCcw,
  Save,
  UsersRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAmountInput,
  MobileButton,
  MobileCard,
  MobileCheckboxRow,
  MobileEmptyState,
  MobileFormSection,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobileLoadingState,
  MobilePageHeader,
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
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
  createBulkRevenueTransactions,
  getAllAssociationRevenueTransactions,
  updateBulkRevenueTransactions,
  type RevenuePaymentStatus,
  type RevenueTransaction,
  type RevenueTransactionBulkUpdatePayload,
  type RevenueTransactionCreatePayload,
} from '@/services/revenue-transaction-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

const LOAD_MORE_COUNT = 12;

type WorkspaceMode = 'create' | 'update';
type CreateStep = 'entry' | 'review';
type CreateFilter = 'all' | 'selected' | 'withAmount' | 'empty';
type UpdateFilter = 'all' | 'pending' | 'paid' | 'locked';
type PaymentKind = 'SHARE_PURCHASE' | 'SOCIAL_CONTRIBUTION';

type BulkMemberInput = {
  id: string;
  name: string;
  email: string;
  selected: boolean;
  sharePurchase: string;
  socialContribution: string;
};

type PreparedBulkTransaction = RevenueTransactionCreatePayload & {
  memberName: string;
  memberEmail: string;
};

type UpdatablePayment = {
  transactionId: string | null;
  originalAmount: number;
  originalStatus: string;
  currentAmount: string;
};

type UpdatableRow = {
  memberId: string;
  memberName: string;
  email: string;
  sharePurchase: UpdatablePayment;
  socialContribution: UpdatablePayment;
};

const paymentStatusOptions = [
  { label: 'Paid', value: 'PAID' },
  { label: 'Pending', value: 'PENDING' },
];

type MobileRevenueTransactionBulkScreenProps = {
  initialMode?: WorkspaceMode;
};

export default function MobileRevenueTransactionBulkScreen({ initialMode = 'create' }: MobileRevenueTransactionBulkScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [groupConfig, setGroupConfig] = useState<GroupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [mode, setMode] = useState<WorkspaceMode>(initialMode);
  const [createStep, setCreateStep] = useState<CreateStep>('entry');
  const [createSearch, setCreateSearch] = useState('');
  const [createFilter, setCreateFilter] = useState<CreateFilter>('all');
  const [createVisibleCount, setCreateVisibleCount] = useState(LOAD_MORE_COUNT);
  const [createTransactionDate, setCreateTransactionDate] = useState(todayIsoDate());
  const [createDueDate, setCreateDueDate] = useState('');
  const [createPaymentStatus, setCreatePaymentStatus] = useState<RevenuePaymentStatus>('PAID');
  const [memberInputs, setMemberInputs] = useState<BulkMemberInput[]>([]);
  const [preparedTransactions, setPreparedTransactions] = useState<PreparedBulkTransaction[]>([]);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const [fetchUpdateDate, setFetchUpdateDate] = useState(todayIsoDate());
  const [updatePaymentDate, setUpdatePaymentDate] = useState(todayIsoDate());
  const [updateSearch, setUpdateSearch] = useState('');
  const [updateFilter, setUpdateFilter] = useState<UpdateFilter>('all');
  const [updateRows, setUpdateRows] = useState<UpdatableRow[]>([]);
  const [hasFetchedUpdates, setHasFetchedUpdates] = useState(false);
  const [fetchingUpdates, setFetchingUpdates] = useState(false);
  const [submittingUpdates, setSubmittingUpdates] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      if (!associationId) {
        if (!active) return;
        setLoading(false);
        setError('Association context is required before using bulk transactions.');
        return;
      }

      try {
        const [memberResponse, configs] = await Promise.all([
          getAllAssociationMembers(associationId, { size: 250 }),
          getAssociationGroupConfigs(associationId).catch(() => []),
        ]);
        if (!active) return;
        const loadedMembers = memberResponse.content || [];
        setMembers(loadedMembers);
        setGroupConfig(configs[0] || null);
        setMemberInputs(loadedMembers.map(memberToInput));
      } catch (loadError) {
        if (active) {
          setError(getApiErrorMessage(loadError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();
    return () => {
      active = false;
    };
  }, [associationId]);

  const selectedCount = memberInputs.filter((member) => member.selected).length;
  const configured = Boolean(groupConfig);
  const shareValue = toNumber(groupConfig?.shareValue);
  const socialAmount = toNumber(groupConfig?.socialAmount);
  const rowsWithAmount = memberInputs.filter(hasAnyAmount).length;

  const filteredCreateRows = useMemo(() => {
    const search = createSearch.trim().toLowerCase();
    return memberInputs.filter((member) => {
      const matchesSearch = !search || member.name.toLowerCase().includes(search) || member.email.toLowerCase().includes(search);
      const hasAmount = hasAnyAmount(member);
      const matchesFilter =
        createFilter === 'all' ||
        (createFilter === 'selected' && member.selected) ||
        (createFilter === 'withAmount' && hasAmount) ||
        (createFilter === 'empty' && !hasAmount);

      return matchesSearch && matchesFilter;
    });
  }, [createFilter, createSearch, memberInputs]);

  const visibleCreateRows = filteredCreateRows.slice(0, createVisibleCount);
  const filteredPreparedTransactions = useMemo(() => {
    const search = createSearch.trim().toLowerCase();
    return preparedTransactions.filter((transaction) => {
      if (!search) return true;
      return transaction.memberName.toLowerCase().includes(search) || transaction.memberEmail.toLowerCase().includes(search);
    });
  }, [createSearch, preparedTransactions]);

  const updateRowsWithPending = updateRows.filter(rowHasPending).length;

  const filteredUpdateRows = useMemo(() => {
    const search = updateSearch.trim().toLowerCase();
    return updateRows.filter((row) => {
      const matchesSearch = !search || row.memberName.toLowerCase().includes(search) || row.email.toLowerCase().includes(search);
      const hasPending = rowHasPending(row);
      const hasPaid = rowHasPaid(row);
      const matchesFilter =
        updateFilter === 'all' ||
        (updateFilter === 'pending' && hasPending) ||
        (updateFilter === 'paid' && hasPaid) ||
        (updateFilter === 'locked' && !hasPending);

      return matchesSearch && matchesFilter;
    });
  }, [updateFilter, updateRows, updateSearch]);

  const updateInput = useCallback((memberId: string, patch: Partial<BulkMemberInput>) => {
    setMemberInputs((current) => current.map((row) => (row.id === memberId ? { ...row, ...patch } : row)));
  }, []);

  const updateBulkAmount = useCallback((memberId: string, kind: PaymentKind, value: string) => {
    setMemberInputs((current) =>
      current.map((row) => {
        if (row.id !== memberId) return row;
        return kind === 'SHARE_PURCHASE' ? { ...row, sharePurchase: value } : { ...row, socialContribution: value };
      }),
    );
  }, []);

  const fillVisibleWithConfig = () => {
    const visibleIds = new Set(filteredCreateRows.map((row) => row.id));
    setMemberInputs((current) =>
      current.map((row) =>
        visibleIds.has(row.id)
          ? {
              ...row,
              selected: true,
              sharePurchase: shareValue > 0 ? String(shareValue) : row.sharePurchase,
              socialContribution: socialAmount > 0 ? String(socialAmount) : row.socialContribution,
            }
          : row,
      ),
    );
  };

  const clearVisibleAmounts = () => {
    const visibleIds = new Set(filteredCreateRows.map((row) => row.id));
    setMemberInputs((current) =>
      current.map((row) => (visibleIds.has(row.id) ? { ...row, sharePurchase: '0', socialContribution: '0' } : row)),
    );
  };

  const prepareCreateReview = () => {
    setError(null);
    setSuccess(null);

    if (!isIsoDate(createTransactionDate)) {
      setError('Enter a valid transaction date using YYYY-MM-DD.');
      return;
    }
    if (createDueDate && !isIsoDate(createDueDate)) {
      setError('Enter a valid due date using YYYY-MM-DD.');
      return;
    }

    const transactions: PreparedBulkTransaction[] = [];
    for (const member of memberInputs.filter((row) => row.selected)) {
      const shareAmount = parseAmount(member.sharePurchase);
      const socialValue = parseAmount(member.socialContribution);
      const shareError = validateAmount('SHARE_PURCHASE', member.sharePurchase, groupConfig);
      const socialError = validateAmount('SOCIAL_CONTRIBUTION', member.socialContribution, groupConfig);

      if (shareError && shareAmount > 0) {
        setError(`${member.name}: ${shareError}`);
        return;
      }
      if (socialError && socialValue > 0) {
        setError(`${member.name}: ${socialError}`);
        return;
      }
      if (shareAmount > 0) {
        transactions.push(buildPreparedTransaction(member, 'SHARE_PURCHASE', shareAmount, createPaymentStatus, createTransactionDate, createDueDate));
      }
      if (socialValue > 0) {
        transactions.push(buildPreparedTransaction(member, 'SOCIAL_CONTRIBUTION', socialValue, createPaymentStatus, createTransactionDate, createDueDate));
      }
    }

    if (!transactions.length) {
      setError('Enter at least one share purchase or social contribution amount before review.');
      return;
    }

    setPreparedTransactions(transactions);
    setCreateStep('review');
  };

  const submitCreate = async () => {
    if (!preparedTransactions.length) return;
    setSubmittingCreate(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await createBulkRevenueTransactions(preparedTransactions);
      setSuccess(`${formatNumber(response.length)} transaction(s) created.`);
      setPreparedTransactions([]);
      setCreateStep('entry');
      setMemberInputs((current) => current.map((row) => ({ ...row, sharePurchase: '0', socialContribution: '0' })));
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSubmittingCreate(false);
    }
  };

  const fetchRowsForUpdate = async () => {
    if (!associationId) return;
    if (!isIsoDate(fetchUpdateDate)) {
      setError('Enter a valid original transaction date using YYYY-MM-DD.');
      return;
    }

    setFetchingUpdates(true);
    setHasFetchedUpdates(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await getAllAssociationRevenueTransactions({
        associationId,
        startDate: fetchUpdateDate,
        endDate: fetchUpdateDate,
        size: 250,
        sort: 'transactionDate,asc',
      });
      setUpdateRows(buildUpdateRows(response.content, memberInputs));
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError));
      setUpdateRows([]);
    } finally {
      setFetchingUpdates(false);
    }
  };

  const updateFetchedAmount = (memberId: string, kind: PaymentKind, value: string) => {
    setUpdateRows((current) =>
      current.map((row) => {
        if (row.memberId !== memberId) return row;
        return kind === 'SHARE_PURCHASE'
          ? { ...row, sharePurchase: { ...row.sharePurchase, currentAmount: value } }
          : { ...row, socialContribution: { ...row.socialContribution, currentAmount: value } };
      }),
    );
  };

  const submitUpdates = async () => {
    if (!isIsoDate(updatePaymentDate)) {
      setError('Enter a valid payment date using YYYY-MM-DD.');
      return;
    }

    const updates: RevenueTransactionBulkUpdatePayload[] = [];
    for (const row of updateRows) {
      const shareAmount = parseAmount(row.sharePurchase.currentAmount);
      const socialValue = parseAmount(row.socialContribution.currentAmount);

      if (row.sharePurchase.transactionId && isPending(row.sharePurchase.originalStatus) && shareAmount > 0) {
        const validationError = validateAmount('SHARE_PURCHASE', row.sharePurchase.currentAmount, groupConfig);
        if (validationError) {
          setError(`${row.memberName}: ${validationError}`);
          return;
        }
        updates.push({
          transactionId: row.sharePurchase.transactionId,
          paymentStatus: 'PAID',
          paymentDetails: { SHARE_PURCHASE: shareAmount },
          transactionDate: `${updatePaymentDate}T00:00:00`,
        });
      }

      if (row.socialContribution.transactionId && isPending(row.socialContribution.originalStatus) && socialValue > 0) {
        const validationError = validateAmount('SOCIAL_CONTRIBUTION', row.socialContribution.currentAmount, groupConfig);
        if (validationError) {
          setError(`${row.memberName}: ${validationError}`);
          return;
        }
        updates.push({
          transactionId: row.socialContribution.transactionId,
          paymentStatus: 'PAID',
          paymentDetails: { SOCIAL_CONTRIBUTION: socialValue },
          transactionDate: `${updatePaymentDate}T00:00:00`,
        });
      }
    }

    if (!updates.length) {
      setError('No pending share or social contribution rows are ready to update.');
      return;
    }

    setSubmittingUpdates(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await updateBulkRevenueTransactions(updates);
      setSuccess(`${formatNumber(response.length)} transaction(s) updated to paid.`);
      await fetchRowsForUpdate();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSubmittingUpdates(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Bulk transactions"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Bulk transactions" subtitle="Loading members and group rules" onBack={() => router.back()} />
        <MobileLoadingState />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Bulk transactions"
        subtitle={`${user?.associationName || 'Association'} batch workspace`}
        onBack={() => router.back()}
      />

      {error ? <MobileStatusBadge status="Issue" label={error} tone="danger" /> : null}
      {success ? <MobileStatusBadge status="Completed" label={success} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members" value={formatNumber(members.length)} description={`${formatNumber(selectedCount)} selected · ${formatNumber(rowsWithAmount)} with amounts`} tone="blue" icon={UsersRound} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Config"
            value={configured ? 'Ready' : 'Missing'}
            description={`Share ${formatTzs(shareValue)} · Social ${formatTzs(socialAmount)}`}
            tone={configured ? 'teal' : 'red'}
            icon={Banknote}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs
        value={mode}
        onChange={(value) => setMode(value as WorkspaceMode)}
        tabs={[
          { value: 'create', label: 'Batch create', count: preparedTransactions.length || rowsWithAmount },
          { value: 'update', label: 'Batch update', count: updateRowsWithPending },
        ]}
      />

      {mode === 'create' ? (
        createStep === 'entry' ? (
          <CreateEntryView
            createTransactionDate={createTransactionDate}
            createDueDate={createDueDate}
            createPaymentStatus={createPaymentStatus}
            createSearch={createSearch}
            createFilter={createFilter}
            filteredCount={filteredCreateRows.length}
            visibleRows={visibleCreateRows}
            totalRows={memberInputs.length}
            canLoadMore={createVisibleCount < filteredCreateRows.length}
            groupConfig={groupConfig}
            onDateChange={setCreateTransactionDate}
            onDueDateChange={setCreateDueDate}
            onStatusChange={(value) => setCreatePaymentStatus(value as RevenuePaymentStatus)}
            onSearchChange={(value) => {
              setCreateSearch(value);
              setCreateVisibleCount(LOAD_MORE_COUNT);
            }}
            onFilterChange={(value) => {
              setCreateFilter(value as CreateFilter);
              setCreateVisibleCount(LOAD_MORE_COUNT);
            }}
            onMemberChange={updateInput}
            onAmountChange={updateBulkAmount}
            onFillVisible={fillVisibleWithConfig}
            onClearVisible={clearVisibleAmounts}
            onLoadMore={() => setCreateVisibleCount((current) => current + LOAD_MORE_COUNT)}
            onReview={prepareCreateReview}
          />
        ) : (
          <CreateReviewView
            search={createSearch}
            transactions={filteredPreparedTransactions}
            allTransactions={preparedTransactions}
            submitting={submittingCreate}
            onSearchChange={setCreateSearch}
            onBack={() => setCreateStep('entry')}
            onSubmit={submitCreate}
          />
        )
      ) : (
        <UpdateView
          fetchUpdateDate={fetchUpdateDate}
          updatePaymentDate={updatePaymentDate}
          updateSearch={updateSearch}
          updateFilter={updateFilter}
          rows={filteredUpdateRows}
          allRows={updateRows}
          hasFetched={hasFetchedUpdates}
          fetching={fetchingUpdates}
          submitting={submittingUpdates}
          groupConfig={groupConfig}
          onFetchDateChange={setFetchUpdateDate}
          onPaymentDateChange={setUpdatePaymentDate}
          onSearchChange={setUpdateSearch}
          onFilterChange={(value) => setUpdateFilter(value as UpdateFilter)}
          onFetch={fetchRowsForUpdate}
          onAmountChange={updateFetchedAmount}
          onSubmit={submitUpdates}
          onClear={() => {
            setUpdateRows([]);
            setHasFetchedUpdates(false);
            setUpdateSearch('');
            setUpdateFilter('all');
          }}
        />
      )}
    </MobileScreen>
  );
}

type CreateEntryViewProps = {
  createTransactionDate: string;
  createDueDate: string;
  createPaymentStatus: string;
  createSearch: string;
  createFilter: CreateFilter;
  filteredCount: number;
  visibleRows: BulkMemberInput[];
  totalRows: number;
  canLoadMore: boolean;
  groupConfig: GroupConfig | null;
  onDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onMemberChange: (memberId: string, patch: Partial<BulkMemberInput>) => void;
  onAmountChange: (memberId: string, kind: PaymentKind, value: string) => void;
  onFillVisible: () => void;
  onClearVisible: () => void;
  onLoadMore: () => void;
  onReview: () => void;
};

function CreateEntryView({
  createTransactionDate,
  createDueDate,
  createPaymentStatus,
  createSearch,
  createFilter,
  filteredCount,
  visibleRows,
  totalRows,
  canLoadMore,
  groupConfig,
  onDateChange,
  onDueDateChange,
  onStatusChange,
  onSearchChange,
  onFilterChange,
  onMemberChange,
  onAmountChange,
  onFillVisible,
  onClearVisible,
  onLoadMore,
  onReview,
}: CreateEntryViewProps) {
  return (
    <>
      <MobileStatusTabs
        value={createFilter}
        onChange={onFilterChange}
        tabs={[
          { value: 'all', label: 'All', count: totalRows },
          { value: 'selected', label: 'Selected' },
          { value: 'withAmount', label: 'With amount' },
          { value: 'empty', label: 'Empty' },
        ]}
      />

      <MobileFormSection title="Transaction settings" description="These values are applied to every generated share and social contribution row.">
        <MobileTextInput label="Transaction date" value={createTransactionDate} onChangeText={onDateChange} placeholder="YYYY-MM-DD" icon={CalendarDays} />
        <MobileTextInput label="Due date" value={createDueDate} onChangeText={onDueDateChange} placeholder="Optional YYYY-MM-DD" icon={CalendarDays} />
        <MobileSelect label="Payment status" value={createPaymentStatus} options={paymentStatusOptions} onChange={onStatusChange} />
        <View style={styles.actionRow}>
          <MobileButton label="Fill visible" icon={CheckCircle2} variant="secondary" onPress={onFillVisible} style={styles.flexButton} />
          <MobileButton label="Clear visible" icon={RotateCcw} variant="secondary" onPress={onClearVisible} style={styles.flexButton} />
        </View>
      </MobileFormSection>

      <MobileSearchToolbar value={createSearch} onChange={onSearchChange} placeholder="Search members..." />

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Member rows
        </MobileText>
        <MobileStatusBadge status="Rows" label={`${formatNumber(filteredCount)} visible`} tone="primary" />
      </View>

      {!groupConfig ? (
        <MobileEmptyState
          title="Group configuration missing"
          description="Share and social validation needs group configuration. You can still review, but amounts may fail server validation."
        />
      ) : null}

      {visibleRows.map((member) => (
        <MobileCard key={member.id} compact style={styles.memberCard}>
          <MobileCheckboxRow
            label={member.name}
            description={member.email || 'No email'}
            checked={member.selected}
            onChange={(checked) => onMemberChange(member.id, { selected: checked })}
          />
          <MobileAmountInput
            label="Share purchase"
            value={member.sharePurchase}
            onChangeText={(value) => onAmountChange(member.id, 'SHARE_PURCHASE', value)}
            helperText={shareHelper(groupConfig)}
            disabled={!member.selected}
          />
          <MobileAmountInput
            label="Social contribution"
            value={member.socialContribution}
            onChangeText={(value) => onAmountChange(member.id, 'SOCIAL_CONTRIBUTION', value)}
            helperText={socialHelper(groupConfig)}
            disabled={!member.selected}
          />
        </MobileCard>
      ))}

      {visibleRows.length === 0 ? (
        <MobileEmptyState title="No members match" description="Adjust search or filters to find members for bulk entry." />
      ) : null}

      {canLoadMore ? <MobileButton label="Load more rows" variant="secondary" fullWidth onPress={onLoadMore} /> : null}
      <MobileButton label="Review transactions" icon={FilePlus2} fullWidth onPress={onReview} />
    </>
  );
}

type CreateReviewViewProps = {
  search: string;
  transactions: PreparedBulkTransaction[];
  allTransactions: PreparedBulkTransaction[];
  submitting: boolean;
  onSearchChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
};

function CreateReviewView({ search, transactions, allTransactions, submitting, onSearchChange, onBack, onSubmit }: CreateReviewViewProps) {
  const total = allTransactions.reduce((sum, transaction) => sum + firstPaymentAmount(transaction.paymentDetails), 0);

  return (
    <>
      <MobileFormSection title="Review create batch" description="Confirm the generated records before submitting them to the server.">
        <MobileKpiGrid>
          <MobileKpiGridItem>
            <MobileKpiCard title="Records" value={formatNumber(allTransactions.length)} description={`${formatNumber(transactions.length)} visible`} tone="blue" icon={FilePlus2} />
          </MobileKpiGridItem>
          <MobileKpiGridItem>
            <MobileKpiCard title="Total value" value={formatTzs(total)} description="Prepared share/social value" tone="green" icon={Banknote} />
          </MobileKpiGridItem>
        </MobileKpiGrid>
      </MobileFormSection>
      <MobileSearchToolbar value={search} onChange={onSearchChange} placeholder="Search prepared rows..." />
      {transactions.map((transaction, index) => {
        const paymentType = Object.keys(transaction.paymentDetails)[0] || 'UNKNOWN';
        return (
          <MobileCard key={`${transaction.memberId}-${paymentType}-${index}`} compact>
            <View style={styles.rowTop}>
              <View style={styles.flex}>
                <MobileText variant="body" weight="bold">
                  {transaction.memberName}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {transaction.memberEmail || 'No email'}
                </MobileText>
              </View>
              <MobileStatusBadge status={transaction.paymentStatus || 'Pending'} />
            </View>
            <View style={styles.inlineMeta}>
              <MobileStatusBadge status="Published" label={labelPayment(paymentType)} tone={paymentType === 'SHARE_PURCHASE' ? 'info' : 'paid'} />
              <MobileText variant="body" weight="bold">
                {formatTzs(firstPaymentAmount(transaction.paymentDetails))}
              </MobileText>
            </View>
            <MobileText variant="small" tone="secondary">
              Date {formatDate(transaction.transactionDate)}{transaction.dueDate ? ` · Due ${formatDate(transaction.dueDate)}` : ''}
            </MobileText>
          </MobileCard>
        );
      })}
      <View style={styles.actionRow}>
        <MobileButton label="Back to edit" icon={Edit3} variant="secondary" onPress={onBack} style={styles.flexButton} disabled={submitting} />
        <MobileButton label="Submit batch" icon={Save} onPress={onSubmit} loading={submitting} style={styles.flexButton} disabled={!allTransactions.length || submitting} />
      </View>
    </>
  );
}

type UpdateViewProps = {
  fetchUpdateDate: string;
  updatePaymentDate: string;
  updateSearch: string;
  updateFilter: UpdateFilter;
  rows: UpdatableRow[];
  allRows: UpdatableRow[];
  hasFetched: boolean;
  fetching: boolean;
  submitting: boolean;
  groupConfig: GroupConfig | null;
  onFetchDateChange: (value: string) => void;
  onPaymentDateChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onFetch: () => void;
  onAmountChange: (memberId: string, kind: PaymentKind, value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
};

function UpdateView({
  fetchUpdateDate,
  updatePaymentDate,
  updateSearch,
  updateFilter,
  rows,
  allRows,
  hasFetched,
  fetching,
  submitting,
  groupConfig,
  onFetchDateChange,
  onPaymentDateChange,
  onSearchChange,
  onFilterChange,
  onFetch,
  onAmountChange,
  onSubmit,
  onClear,
}: UpdateViewProps) {
  const pendingRows = allRows.filter(rowHasPending).length;

  return (
    <>
      <MobileFormSection title="Fetch rows to update" description="Select the original transaction date, then update pending share/social rows as paid.">
        <MobileTextInput label="Original transaction date" value={fetchUpdateDate} onChangeText={onFetchDateChange} placeholder="YYYY-MM-DD" icon={CalendarDays} />
        <MobileTextInput label="Payment date for updates" value={updatePaymentDate} onChangeText={onPaymentDateChange} placeholder="YYYY-MM-DD" icon={CalendarDays} />
        <MobileButton label="Fetch transactions" icon={RefreshCw} loading={fetching} disabled={fetching || !fetchUpdateDate} fullWidth onPress={onFetch} />
      </MobileFormSection>

      {fetching ? <MobileLoadingState compact message="Fetching transactions" /> : null}

      {!fetching && allRows.length > 0 ? (
        <>
          <MobileKpiGrid>
            <MobileKpiGridItem>
              <MobileKpiCard title="Fetched members" value={formatNumber(allRows.length)} description={`${formatNumber(rows.length)} visible`} tone="blue" icon={UsersRound} />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard title="Pending rows" value={formatNumber(pendingRows)} description="Editable rows" tone="orange" icon={Edit3} />
            </MobileKpiGridItem>
          </MobileKpiGrid>
          <MobileSearchToolbar value={updateSearch} onChange={onSearchChange} placeholder="Search fetched rows..." />
          <MobileStatusTabs
            value={updateFilter}
            onChange={onFilterChange}
            tabs={[
              { value: 'all', label: 'All', count: allRows.length },
              { value: 'pending', label: 'Pending', count: pendingRows },
              { value: 'paid', label: 'Paid' },
              { value: 'locked', label: 'Locked' },
            ]}
          />
          {rows.map((row) => (
            <MobileCard key={row.memberId} compact>
              <View style={styles.rowTop}>
                <View style={styles.flex}>
                  <MobileText variant="body" weight="bold">
                    {row.memberName}
                  </MobileText>
                  <MobileText variant="small" tone="secondary">
                    {row.email || 'No email'}
                  </MobileText>
                </View>
                <MobileStatusBadge status={rowHasPending(row) ? 'Pending' : 'Locked'} tone={rowHasPending(row) ? 'warning' : 'neutral'} />
              </View>
              <EditableAmountRow
                title="Share purchase"
                payment={row.sharePurchase}
                helper={shareHelper(groupConfig)}
                onChange={(value) => onAmountChange(row.memberId, 'SHARE_PURCHASE', value)}
              />
              <EditableAmountRow
                title="Social contribution"
                payment={row.socialContribution}
                helper={socialHelper(groupConfig)}
                onChange={(value) => onAmountChange(row.memberId, 'SOCIAL_CONTRIBUTION', value)}
              />
            </MobileCard>
          ))}
          <View style={styles.actionRow}>
            <MobileButton label="Clear" icon={RotateCcw} variant="secondary" onPress={onClear} style={styles.flexButton} disabled={submitting} />
            <MobileButton label="Submit updates" icon={Save} onPress={onSubmit} loading={submitting} style={styles.flexButton} disabled={!pendingRows || submitting} />
          </View>
        </>
      ) : null}

      {!fetching && hasFetched && allRows.length === 0 ? (
        <MobileEmptyState title="No transactions found" description={`No share or social contribution records were found on ${formatDate(fetchUpdateDate)}.`} />
      ) : null}

      {!fetching && !hasFetched ? (
        <MobileEmptyState title="Select a date to start" description="Fetch existing transactions before updating pending payments." />
      ) : null}
    </>
  );
}

function EditableAmountRow({
  title,
  payment,
  helper,
  onChange,
}: {
  title: string;
  payment: UpdatablePayment;
  helper: string;
  onChange: (value: string) => void;
}) {
  const editable = Boolean(payment.transactionId && isPending(payment.originalStatus));
  return (
    <View style={styles.editableBlock}>
      <View style={styles.rowTop}>
        <MobileText variant="small" weight="bold">
          {title}
        </MobileText>
        <MobileStatusBadge status={payment.originalStatus || 'N/A'} />
      </View>
      <MobileAmountInput
        label="Amount"
        value={payment.currentAmount}
        onChangeText={onChange}
        helperText={`${helper} · Original ${formatTzs(payment.originalAmount)}`}
        disabled={!editable}
      />
      {!editable ? (
        <MobileText variant="small" tone="secondary">
          This row is not editable because it is not pending.
        </MobileText>
      ) : null}
    </View>
  );
}

function memberToInput(member: AssociationMember): BulkMemberInput {
  return {
    id: member.id,
    name: member.fullLegalName || member.membershipNumber || 'Unknown member',
    email: member.contactInfo?.email || '',
    selected: true,
    sharePurchase: '0',
    socialContribution: '0',
  };
}

function buildPreparedTransaction(
  member: BulkMemberInput,
  kind: PaymentKind,
  amount: number,
  paymentStatus: RevenuePaymentStatus,
  transactionDate: string,
  dueDate: string,
): PreparedBulkTransaction {
  return {
    memberId: member.id,
    memberName: member.name,
    memberEmail: member.email,
    paymentDetails: { [kind]: amount },
    paymentStatus,
    transactionDate: `${transactionDate}T00:00:00`,
    ...(dueDate ? { dueDate: `${dueDate}T00:00:00` } : {}),
  };
}

function buildUpdateRows(transactions: RevenueTransaction[], members: BulkMemberInput[]) {
  const memberLookup = new Map(members.map((member) => [member.id, member]));
  const rows = new Map<string, UpdatableRow>();

  transactions.forEach((transaction) => {
    const memberId = transaction.memberId;
    if (!memberId) return;
    const details = transaction.paymentDetails || {};
    const member = memberLookup.get(memberId);
    const row =
      rows.get(memberId) ||
      ({
        memberId,
        memberName: transaction.memberName || transaction.memberFullName || member?.name || `Member ${memberId.slice(0, 6)}`,
        email: transaction.memberEmail || member?.email || '',
        sharePurchase: emptyPayment(),
        socialContribution: emptyPayment(),
      } satisfies UpdatableRow);

    if (details.SHARE_PURCHASE !== undefined && details.SHARE_PURCHASE !== null) {
      const amount = Number(details.SHARE_PURCHASE || 0);
      row.sharePurchase = {
        transactionId: transaction.id,
        originalAmount: amount,
        originalStatus: transaction.paymentStatus || 'UNKNOWN',
        currentAmount: String(amount),
      };
    }

    if (details.SOCIAL_CONTRIBUTION !== undefined && details.SOCIAL_CONTRIBUTION !== null) {
      const amount = Number(details.SOCIAL_CONTRIBUTION || 0);
      row.socialContribution = {
        transactionId: transaction.id,
        originalAmount: amount,
        originalStatus: transaction.paymentStatus || 'UNKNOWN',
        currentAmount: String(amount),
      };
    }

    if (row.sharePurchase.transactionId || row.socialContribution.transactionId) {
      rows.set(memberId, row);
    }
  });

  return Array.from(rows.values()).sort((a, b) => a.memberName.localeCompare(b.memberName));
}

function emptyPayment(): UpdatablePayment {
  return {
    transactionId: null,
    originalAmount: 0,
    originalStatus: 'N/A',
    currentAmount: '0',
  };
}

function hasAnyAmount(member: BulkMemberInput) {
  return parseAmount(member.sharePurchase) > 0 || parseAmount(member.socialContribution) > 0;
}

function parseAmount(value: string) {
  return Number(String(value || '0').replace(/,/g, '')) || 0;
}

function toNumber(value: unknown) {
  return Number(value || 0) || 0;
}

function firstPaymentAmount(paymentDetails?: Record<string, number>) {
  return Object.values(paymentDetails || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function validateAmount(kind: PaymentKind, value: string, groupConfig: GroupConfig | null) {
  const amount = parseAmount(value);
  if (amount < 0) return 'Amount must be zero or greater.';
  if (!groupConfig || amount <= 0) return null;

  const shareValue = toNumber(groupConfig.shareValue);
  const socialAmount = toNumber(groupConfig.socialAmount);

  if (kind === 'SHARE_PURCHASE' && shareValue > 0 && amount % shareValue !== 0) {
    return `Share purchase must be a multiple of ${formatTzs(shareValue)}.`;
  }
  if (kind === 'SOCIAL_CONTRIBUTION' && socialAmount > 0 && amount !== socialAmount) {
    return `Social contribution must equal ${formatTzs(socialAmount)}.`;
  }
  return null;
}

function shareHelper(groupConfig: GroupConfig | null) {
  const value = toNumber(groupConfig?.shareValue);
  return value > 0 ? `Multiple of ${formatTzs(value)}` : 'Enter share purchase amount';
}

function socialHelper(groupConfig: GroupConfig | null) {
  const value = toNumber(groupConfig?.socialAmount);
  return value > 0 ? `Expected ${formatTzs(value)}` : 'Enter social contribution amount';
}

function rowHasPending(row: UpdatableRow) {
  return isPending(row.sharePurchase.originalStatus) || isPending(row.socialContribution.originalStatus);
}

function rowHasPaid(row: UpdatableRow) {
  return isPaid(row.sharePurchase.originalStatus) || isPaid(row.socialContribution.originalStatus);
}

function isPending(status?: string | null) {
  return String(status || '').toUpperCase() === 'PENDING';
}

function isPaid(status?: string | null) {
  return String(status || '').toUpperCase() === 'PAID';
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function labelPayment(value: string) {
  if (value === 'SHARE_PURCHASE') return 'Share purchase';
  if (value === 'SOCIAL_CONTRIBUTION') return 'Social contribution';
  return value.replace(/_/g, ' ');
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  memberCard: {
    gap: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  inlineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  editableBlock: {
    gap: 8,
  },
});
