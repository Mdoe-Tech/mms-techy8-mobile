import { router } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  Clock3,
  Landmark,
  ReceiptText,
  RefreshCw,
  Send,
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
  MobileConfirmSheet,
  MobileDataList,
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
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAssociationMembers, type AssociationMember } from '@/services/member-service';
import {
  createAssociationWalletWithdrawal,
  getAssociationBankAccounts,
  getAssociationWalletSummary,
  getAssociationWalletWithdrawals,
  isBankAccountPrimary,
  type AssociationWithdrawal,
  type BankAccount,
  type WalletSummary,
} from '@/services/wallet-service';
import { labelFromStatus, statusToneFor } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, initialsFromName } from '@/utils/format';

type StatusFilter = 'all' | 'pending' | 'approved' | 'completed' | 'rejected' | 'failed';
type SortOption = 'dateDesc' | 'dateAsc' | 'amountDesc' | 'amountAsc' | 'statusAsc';
type RecipientType = 'OWN' | 'MEMBER';

const statusTabs: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'failed', label: 'Failed' },
];

const sortOptions = [
  { value: 'dateDesc', label: 'Newest request', description: 'Latest withdrawal requests first.' },
  { value: 'dateAsc', label: 'Oldest request', description: 'Earliest withdrawal requests first.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest requested withdrawals first.' },
  { value: 'amountAsc', label: 'Lowest amount', description: 'Smallest requested withdrawals first.' },
  { value: 'statusAsc', label: 'Status', description: 'Group requests by current approval status.' },
];

const recipientOptions = [
  { label: 'Own bank account', value: 'OWN' },
  { label: 'Member payout', value: 'MEMBER' },
];

export default function MobileAssociationWalletScreen() {
  const { activeView, associationId, user } = useAuth();
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [withdrawals, setWithdrawals] = useState<AssociationWithdrawal[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortValue, setSortValue] = useState<SortOption>('dateDesc');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<AssociationWithdrawal | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('OWN');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [notes, setNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);

  const loadWallet = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading wallet data.');
        return;
      }

      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const [summaryResult, withdrawalsResult, bankResult, memberResult] = await Promise.allSettled([
          getAssociationWalletSummary(),
          getAssociationWalletWithdrawals({ size: 250 }),
          getAssociationBankAccounts(associationId),
          getAssociationMembers(associationId, { size: 250, sort: 'membershipNumber,asc' }),
        ]);
        const failures: string[] = [];

        if (summaryResult.status === 'fulfilled') {
          setSummary(summaryResult.value);
        } else {
          failures.push('wallet summary');
        }

        if (withdrawalsResult.status === 'fulfilled') {
          setWithdrawals(withdrawalsResult.value.content || []);
        } else {
          failures.push('withdrawal history');
        }

        if (bankResult.status === 'fulfilled') {
          setBankAccounts(bankResult.value || []);
        } else {
          failures.push('bank accounts');
        }

        if (memberResult.status === 'fulfilled') {
          setMembers(memberResult.value.content || []);
        } else {
          failures.push('member list');
        }

        if (failures.length > 0) {
          setError(`Some wallet data could not be loaded: ${failures.join(', ')}.`);
        }
      } catch (loadError) {
        setSummary(null);
        setWithdrawals([]);
        setBankAccounts([]);
        setMembers([]);
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
      if (active) void loadWallet();
    });
    return () => {
      active = false;
    };
  }, [loadWallet]);

  const currency = summary?.currency || 'TZS';
  const availableBalance = toNumber(summary?.availableBalance);
  const amountValue = parseAmount(amount);
  const selectedBankAccount = bankAccounts.find((account) => account.id === selectedBankAccountId);
  const selectedMember = members.find((member) => member.id === selectedMemberId);
  const recipientReady = recipientType === 'OWN' ? Boolean(selectedBankAccountId) : Boolean(selectedMemberId);
  const validationMessage = getValidationMessage({
    amount: amountValue,
    availableBalance,
    recipientType,
    recipientReady,
    bankAccounts,
  });
  const shouldShowValidationMessage = Boolean(amount.trim() || selectedBankAccountId || selectedMemberId || notes.trim());
  const canSubmit = !submitting && !validationMessage;

  const filteredWithdrawals = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = withdrawals.filter((withdrawal) => {
      const kind = withdrawalStatusKind(withdrawal.status);
      const matchesStatus = statusFilter === 'all' || kind === statusFilter;
      const haystack = [
        withdrawal.status,
        withdrawal.requestNotes,
        withdrawal.notes,
        withdrawal.requestedByName,
        withdrawal.processedByName,
        withdrawal.currency,
        String(withdrawal.amount || ''),
        formatDate(withdrawal.createdAt),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });

    return sortWithdrawals(rows, sortValue);
  }, [searchTerm, sortValue, statusFilter, withdrawals]);

  const tabCounts = useMemo(
    () =>
      statusTabs.reduce<Record<StatusFilter, number>>((acc, tab) => {
        acc[tab.value] = tab.value === 'all'
          ? withdrawals.length
          : withdrawals.filter((withdrawal) => withdrawalStatusKind(withdrawal.status) === tab.value).length;
        return acc;
      }, {} as Record<StatusFilter, number>),
    [withdrawals],
  );

  const listItems = useMemo(
    () =>
      filteredWithdrawals.map((withdrawal) => ({
        id: withdrawal.id,
        title: formatCurrency(toNumber(withdrawal.amount), withdrawal.currency || currency),
        subtitle: withdrawal.requestNotes || withdrawal.notes || withdrawal.requestedByName || 'Withdrawal request',
        meta: `${formatDate(withdrawal.createdAt)} - ${withdrawal.memberId ? 'Member payout' : 'Association bank'}`,
        amount: shortId(withdrawal.id),
        status: labelFromStatus(withdrawal.status),
        statusTone: statusToneFor(withdrawal.status),
        initials: initialsFromName(labelFromStatus(withdrawal.status)),
        accent: statusToneFor(withdrawal.status),
      })),
    [currency, filteredWithdrawals],
  );

  const submitWithdrawal = async () => {
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    setConfirmOpen(false);
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await createAssociationWalletWithdrawal(
        {
          amount: amountValue,
          currency,
          notes: notes.trim() || undefined,
          bankAccountId: recipientType === 'OWN' ? selectedBankAccountId : undefined,
          memberId: recipientType === 'MEMBER' ? selectedMemberId : undefined,
        },
        idempotencyKey,
      );
      setNotice(`Withdrawal ${shortId(result.id)} submitted with status ${labelFromStatus(result.status)}.`);
      setAmount('');
      setNotes('');
      setSelectedBankAccountId('');
      setSelectedMemberId('');
      setIdempotencyKey(createIdempotencyKey());
      await loadWallet('refresh');
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const withdrawalReportOptions = {
      title: 'Wallet Withdrawal History',
      associationName: summary?.associationName || user?.associationName || 'Association',
      purpose: 'A filtered report of association wallet withdrawal requests, destinations, notes, status, and processors.',
      rows: filteredWithdrawals,
      fileName: 'nane-wallet-withdrawals',
      metrics: [
        { label: 'Available balance', value: formatCurrency(availableBalance, currency), helper: summary?.associationName || 'Current wallet' },
        { label: 'Total collected', value: formatCurrency(toNumber(summary?.totalCollected), currency), helper: 'Funds received' },
        { label: 'Pending withdrawals', value: formatNumber(toNumber(summary?.pendingWithdrawals)), helper: `${tabCounts.pending || 0} request(s)` },
        { label: 'Total withdrawn', value: formatCurrency(toNumber(summary?.totalWithdrawn), currency), helper: 'Paid out' },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Status', value: statusTabs.find((tab) => tab.value === statusFilter)?.label || statusFilter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: AssociationWithdrawal, index: number) => index + 1 },
        { key: 'createdAt', label: 'Date', width: '12%', value: (row: AssociationWithdrawal) => formatDate(row.createdAt) },
        { key: 'amount', label: 'Amount', align: 'right' as const, width: '13%', value: (row: AssociationWithdrawal) => formatCurrency(toNumber(row.amount), row.currency || currency) },
        { key: 'status', label: 'Status', width: '12%', value: (row: AssociationWithdrawal) => labelFromStatus(row.status) },
        { key: 'requestedBy', label: 'Requested By', width: '16%', value: (row: AssociationWithdrawal) => row.requestedByName || '-' },
        { key: 'destination', label: 'Destination', width: '16%', value: (row: AssociationWithdrawal) => (row.memberId ? `Member ${row.memberId}` : row.bankAccountId ? `Bank ${row.bankAccountId}` : '-') },
        { key: 'notes', label: 'Notes', width: '18%', value: (row: AssociationWithdrawal) => row.requestNotes || row.notes || '-' },
        { key: 'processedBy', label: 'Processed By', width: '12%', value: (row: AssociationWithdrawal) => row.processedByName || '-' },
      ],
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association wallet" description="This native wallet workspace is available for association admins only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading wallet balances" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Wallet & payments"
        title="Association wallet"
        subtitle="Balances, withdrawal requests, and payout readiness"
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh wallet" onPress={() => loadWallet('refresh')} disabled={refreshing} />}
      />

      {error ? <MobileStatusBadge status="Wallet issue" label={error} tone="danger" /> : null}
      {notice ? <MobileStatusBadge status="Completed" label={notice} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem style={styles.fullKpi}>
          <MobileKpiCard title="Available balance" value={formatCurrency(availableBalance, currency)} description={summary?.associationName || 'Current wallet'} tone="blue" icon={WalletCards} featured />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total collected" value={formatCurrency(toNumber(summary?.totalCollected), currency)} description="Funds received" tone="green" icon={ArrowUpRight} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending withdrawals" value={formatNumber(toNumber(summary?.pendingWithdrawals))} description={`${tabCounts.pending || 0} request(s) awaiting action`} tone="orange" icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total withdrawn" value={formatCurrency(toNumber(summary?.totalWithdrawn), currency)} description="Paid out" tone="teal" icon={ArrowDownLeft} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Requests" value={formatNumber(withdrawals.length)} description="Withdrawal records" tone="slate" icon={ReceiptText} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFormSection title="Request withdrawal" description={`Available: ${formatCurrency(availableBalance, currency)}`}>
        {availableBalance <= 0 ? (
          <MobileCard compact accent="orange">
            <MobileInfoRow label="Balance guard" value="No funds available" helper="Add wallet funds before requesting withdrawals." icon={Banknote} status="Blocked" />
          </MobileCard>
        ) : null}

        <MobileAmountInput
          label="Amount"
          value={amount}
          onChangeText={(value) => {
            setAmount(value);
            setError(null);
          }}
          helperText={`Maximum: ${formatCurrency(availableBalance, currency)}`}
          error={amount.length > 0 && amountValue <= 0 ? 'Enter a valid amount.' : undefined}
          disabled={submitting}
        />
        <MobileSelect label="Recipient type" value={recipientType} options={recipientOptions} onChange={(value) => setRecipientType(value as RecipientType)} />

        {recipientType === 'OWN' ? (
          bankAccounts.length > 0 ? (
            <MobileSelect
              label="Bank account"
              value={selectedBankAccountId}
              options={bankAccounts.map((account) => ({ label: bankAccountLabel(account), value: account.id }))}
              onChange={setSelectedBankAccountId}
              placeholder="Select association bank account"
            />
          ) : (
            <MobileCard compact accent="slate">
              <MobileInfoRow label="Bank account" value="Not configured" helper="Add an association bank account before requesting own-account withdrawals." icon={Landmark} status="Required" />
            </MobileCard>
          )
        ) : (
          <MobileSelect
            label="Member"
            value={selectedMemberId}
            options={members.map((member) => ({ label: memberLabel(member), value: member.id }))}
            onChange={setSelectedMemberId}
            placeholder={members.length > 0 ? 'Select member for payout' : 'No members available'}
          />
        )}

        {selectedBankAccount ? (
          <MobileCard compact>
            <MobileInfoRow label="Selected bank" value={selectedBankAccount.bankName || 'Bank account'} helper={selectedBankAccount.accountNumber || 'No account number'} icon={Landmark} status={isBankAccountPrimary(selectedBankAccount) ? 'Primary' : 'Selected'} />
          </MobileCard>
        ) : null}
        {selectedMember ? (
          <MobileCard compact>
            <MobileInfoRow label="Selected member" value={selectedMember.fullLegalName || 'Member'} helper={selectedMember.membershipNumber || selectedMember.contactInfo?.phoneNumber || 'No member number'} icon={UserRound} status={selectedMember.status || 'Selected'} />
          </MobileCard>
        ) : null}

        <MobileTextInput
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Reason for withdrawal"
          helperText="Optional, but recommended for audit clarity."
          icon={Building2}
          disabled={submitting}
        />

        {shouldShowValidationMessage && validationMessage ? (
          <MobileText variant="small" tone="secondary">
            {validationMessage}
          </MobileText>
        ) : null}

        <MobileButton label="Submit request" icon={Send} fullWidth loading={submitting} disabled={!canSubmit} onPress={() => setConfirmOpen(true)} />
      </MobileFormSection>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitle}>
          <MobileText variant="section" weight="bold">
            Withdrawal history
          </MobileText>
          <MobileText variant="small" tone="secondary">
            Showing {formatNumber(filteredWithdrawals.length)} of {formatNumber(withdrawals.length)} request(s)
          </MobileText>
        </View>
        <MobileReportExportButton options={withdrawalReportOptions} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
      </View>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search amount, status, requester..." onFilterPress={() => setSortOpen(true)} filterLabel="Sort" />
      <MobileStatusTabs
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as StatusFilter)}
        tabs={statusTabs.map((tab) => ({ ...tab, count: tabCounts[tab.value] || 0 }))}
      />

      {listItems.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const withdrawal = filteredWithdrawals.find((row) => row.id === item.id);
            if (withdrawal) setSelectedWithdrawal(withdrawal);
          }}
        />
      ) : (
        <MobileEmptyState
          title={withdrawals.length > 0 ? 'No matching withdrawals' : 'No withdrawal requests yet'}
          description={withdrawals.length > 0 ? 'Adjust search, sort, or status tabs to see more wallet activity.' : 'Submitted wallet withdrawal requests will appear here for approval tracking.'}
        />
      )}

      {error && withdrawals.length === 0 && !summary ? (
        <MobileErrorState title="Unable to load wallet" description={error} retryLabel="Try again" onRetry={() => loadWallet('refresh')} />
      ) : null}

      <MobileSortSheet visible={sortOpen} value={sortValue} options={sortOptions} onChange={(value) => setSortValue(value as SortOption)} onClose={() => setSortOpen(false)} />

      <MobileConfirmSheet
        visible={confirmOpen}
        title="Submit withdrawal request?"
        description={`Request ${formatCurrency(amountValue, currency)} for ${recipientType === 'OWN' ? bankAccountLabel(selectedBankAccount) : memberLabel(selectedMember)}. This will enter the approval queue.`}
        confirmLabel="Submit"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={submitWithdrawal}
      />

      <WithdrawalDetailSheet withdrawal={selectedWithdrawal} currency={currency} onClose={() => setSelectedWithdrawal(null)} />
    </MobileScreen>
  );
}

function WithdrawalDetailSheet({
  withdrawal,
  currency,
  onClose,
}: {
  withdrawal: AssociationWithdrawal | null;
  currency: string;
  onClose: () => void;
}) {
  if (!withdrawal) return null;

  return (
    <MobileSheet visible title="Withdrawal request" description={shortId(withdrawal.id)} onClose={onClose}>
      <MobileInfoRow label="Amount" value={formatCurrency(toNumber(withdrawal.amount), withdrawal.currency || currency)} helper={withdrawal.requestNotes || withdrawal.notes || 'No notes provided'} icon={Banknote} status={withdrawal.status || 'Pending'} />
      <MobileInfoRow label="Requested by" value={withdrawal.requestedByName || 'Association admin'} helper={withdrawal.requestedByEmail || withdrawal.requestedByPhone || 'Requester details'} icon={UserRound} />
      <MobileInfoRow label="Destination" value={withdrawal.memberId ? 'Member payout' : 'Association bank account'} helper={withdrawal.memberId || withdrawal.bankAccountId || 'Destination reference unavailable'} icon={withdrawal.memberId ? UserRound : Landmark} />
      <MobileInfoRow label="Created" value={formatDate(withdrawal.createdAt)} helper={withdrawal.updatedAt ? `Updated ${formatDate(withdrawal.updatedAt)}` : undefined} icon={Clock3} />
      {withdrawal.processedByName || withdrawal.processedAt ? (
        <MobileInfoRow label="Processed" value={withdrawal.processedByName || 'Processed'} helper={formatDate(withdrawal.processedAt)} icon={ArrowDownLeft} status="Completed" />
      ) : null}
      {withdrawal.adminNotes ? <MobileInfoRow label="Admin notes" value={withdrawal.adminNotes} icon={Building2} /> : null}
    </MobileSheet>
  );
}

function getValidationMessage({
  amount,
  availableBalance,
  recipientType,
  recipientReady,
  bankAccounts,
}: {
  amount: number;
  availableBalance: number;
  recipientType: RecipientType;
  recipientReady: boolean;
  bankAccounts: BankAccount[];
}) {
  if (amount <= 0) return 'Enter a valid withdrawal amount.';
  if (amount > availableBalance) return 'Withdrawal amount exceeds the available wallet balance.';
  if (recipientType === 'OWN' && bankAccounts.length === 0) return 'Configure an association bank account before requesting this withdrawal.';
  if (!recipientReady) return recipientType === 'OWN' ? 'Select a bank account.' : 'Select a member for payout.';
  return null;
}

function sortWithdrawals(rows: AssociationWithdrawal[], sortValue: SortOption) {
  return [...rows].sort((a, b) => {
    if (sortValue === 'amountAsc' || sortValue === 'amountDesc') {
      const modifier = sortValue === 'amountAsc' ? 1 : -1;
      return (toNumber(a.amount) - toNumber(b.amount)) * modifier;
    }
    if (sortValue === 'statusAsc') {
      return String(a.status || '').localeCompare(String(b.status || ''));
    }
    const modifier = sortValue === 'dateAsc' ? 1 : -1;
    return (dateValue(a.createdAt) - dateValue(b.createdAt)) * modifier;
  });
}

function withdrawalStatusKind(status?: string | null): Exclude<StatusFilter, 'all'> {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('complete')) return 'completed';
  if (normalized.includes('approve')) return 'approved';
  if (normalized.includes('reject')) return 'rejected';
  if (normalized.includes('fail')) return 'failed';
  return 'pending';
}

function bankAccountLabel(account?: BankAccount | null) {
  if (!account) return 'Selected account';
  const bankName = account.bankName || 'Bank';
  const number = account.accountNumber || '-';
  return `${bankName} - ${number}`;
}

function memberLabel(member?: AssociationMember | null) {
  if (!member) return 'Selected member';
  return member.membershipNumber ? `${member.fullLegalName || 'Member'} (${member.membershipNumber})` : member.fullLegalName || 'Member';
}

function parseAmount(value: string) {
  return toNumber(value.replace(/[^\d.]/g, ''));
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value?: string | null) {
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function shortId(value?: string | null) {
  return value ? `#${value.slice(0, 8)}` : '-';
}

function createIdempotencyKey() {
  return `wallet-withdrawal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fullKpi: {
    flexBasis: '100%',
  },
});
