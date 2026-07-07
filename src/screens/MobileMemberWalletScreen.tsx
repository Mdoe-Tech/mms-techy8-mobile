import { router } from 'expo-router';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Clock3,
  Landmark,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAmountInput,
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
  MobileSelect,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import {
  createMemberWithdrawalRequest,
  getMemberWalletBalance,
  getMemberWalletTransactions,
  getMyMemberWithdrawalRequests,
  type MemberWalletTransaction,
  type MemberWalletWithdrawalPayload,
  type MemberWithdrawalRequest,
} from '@/services/wallet-service';
import { labelFromStatus, statusToneFor } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, initialsFromName } from '@/utils/format';

type WalletTab = 'transactions' | 'withdrawals';
type SortOption = 'newest' | 'oldest' | 'amountDesc' | 'amountAsc' | 'status';
type WithdrawalMethod = 'MOBILE_MONEY' | 'BANK_TRANSFER';

const tabOptions = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'withdrawals', label: 'Withdrawals' },
];

const sortOptions = [
  { value: 'newest', label: 'Newest first', description: 'Latest wallet activity first.' },
  { value: 'oldest', label: 'Oldest first', description: 'Earliest wallet activity first.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest wallet amounts first.' },
  { value: 'amountAsc', label: 'Lowest amount', description: 'Smallest wallet amounts first.' },
  { value: 'status', label: 'Status', description: 'Group records by status or result.' },
];

const withdrawalMethodOptions = [
  { value: 'MOBILE_MONEY', label: 'Mobile money' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
];

export default function MobileMemberWalletScreen() {
  const { activeView, associationId, user } = useAuth();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('TZS');
  const [transactions, setTransactions] = useState<MemberWalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<MemberWithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WalletTab>('transactions');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortValue, setSortValue] = useState<SortOption>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawalMethod>('MOBILE_MONEY');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawBankName, setWithdrawBankName] = useState('');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState('');
  const [withdrawAccountName, setWithdrawAccountName] = useState('');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [confirmWithdrawalOpen, setConfirmWithdrawalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<MemberWalletTransaction | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<MemberWithdrawalRequest | null>(null);

  const userId = user?.userId;

  const loadWallet = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId || !associationId) {
        setLoading(false);
        setError('Member and association context are required before loading wallet data.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const loadedMember = await getCurrentMemberByUserId(userId);
        const memberAssociationId = loadedMember.associationId || associationId;
        setMember(loadedMember);

        const [balanceResult, transactionResult, withdrawalResult] = await Promise.all([
          getMemberWalletBalance(loadedMember.id, memberAssociationId),
          getMemberWalletTransactions(loadedMember.id, memberAssociationId),
          getMyMemberWithdrawalRequests(loadedMember.id, { size: 100 }),
        ]);

        setBalance(balanceResult.balance);
        setCurrency(balanceResult.currency || 'TZS');
        setTransactions(transactionResult);
        setWithdrawals(withdrawalResult.content || []);

        const memberPhone = loadedMember.contactInfo?.phoneNumber || '';
        if (!withdrawPhone && memberPhone && validatePhone(memberPhone)) {
          setWithdrawPhone(memberPhone);
        }
      } catch (loadError) {
        setBalance(0);
        setTransactions([]);
        setWithdrawals([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, userId, withdrawPhone],
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

  const totalIn = useMemo(
    () =>
      transactions
        .filter((transaction) => Boolean(transaction.success) && incomingTransactionTypes.has(String(transaction.transactionType || '').toUpperCase()))
        .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0),
    [transactions],
  );
  const totalOut = useMemo(
    () =>
      transactions
        .filter((transaction) => Boolean(transaction.success) && outgoingTransactionTypes.has(String(transaction.transactionType || '').toUpperCase()))
        .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0),
    [transactions],
  );
  const pendingWithdrawals = useMemo(
    () => withdrawals.filter((withdrawal) => ['PENDING', 'FIRST_APPROVED', 'APPROVED', 'PROCESSING'].includes(String(withdrawal.status || '').toUpperCase())).length,
    [withdrawals],
  );

  const transactionItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = transactions.filter((transaction) => {
      if (!query) return true;
      return [
        transaction.transactionType,
        transaction.description,
        transaction.referenceType,
        transaction.paymentReference,
        transaction.memberName,
        transaction.membershipNumber,
        formatCurrency(toNumber(transaction.amount), transaction.currency || currency),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

    return sortTransactions(filtered, sortValue).map((transaction) => {
      const type = String(transaction.transactionType || 'TRANSACTION').toUpperCase();
      const incoming = incomingTransactionTypes.has(type);
      const status = transaction.success ? 'Completed' : isPendingTransaction(transaction) ? 'Pending' : 'Failed';
      return {
        id: transaction.id,
        title: `${incoming ? '+' : '-'}${formatCurrency(toNumber(transaction.amount), transaction.currency || currency)}`,
        subtitle: transaction.description || transactionTypeLabel(type),
        meta: `${formatDate(transaction.createdAt)} - ${transactionTypeLabel(type)}`,
        amount: formatCurrency(toNumber(transaction.balanceAfter), transaction.currency || currency),
        status,
        statusTone: statusToneFor(status),
        initials: incoming ? 'IN' : 'OUT',
        accent: incoming ? ('success' as const) : status === 'Failed' ? ('danger' as const) : ('primary' as const),
      };
    });
  }, [currency, searchTerm, sortValue, transactions]);

  const withdrawalItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = withdrawals.filter((withdrawal) => {
      if (!query) return true;
      return [
        withdrawal.status,
        withdrawal.withdrawalMethod,
        withdrawal.destinationNumber,
        withdrawal.bankName,
        withdrawal.accountNumber,
        withdrawal.accountName,
        withdrawal.requestNotes,
        withdrawal.rejectionReason,
        formatCurrency(toNumber(withdrawal.amount), currency),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

    return sortWithdrawals(filtered, sortValue).map((withdrawal) => ({
      id: withdrawal.id,
      title: formatCurrency(toNumber(withdrawal.amount), currency),
      subtitle: withdrawal.requestNotes || withdrawalDestination(withdrawal),
      meta: `${formatDate(withdrawal.createdAt)} - ${withdrawalMethodLabel(withdrawal.withdrawalMethod)}`,
      amount: shortId(withdrawal.id),
      status: labelFromStatus(withdrawal.status),
      statusTone: statusToneFor(withdrawal.status),
      initials: initialsFromName(labelFromStatus(withdrawal.status)),
      accent: statusToneFor(withdrawal.status),
    }));
  }, [currency, searchTerm, sortValue, withdrawals]);

  const withdrawAmountValue = parseAmount(withdrawAmount);
  const topUpAmountValue = parseAmount(topUpAmount);
  const withdrawalValidation = getWithdrawalValidation({
    amount: withdrawAmountValue,
    balance,
    method: withdrawMethod,
    phone: withdrawPhone,
    bankName: withdrawBankName,
    accountNumber: withdrawAccountNumber,
    accountName: withdrawAccountName,
  });

  const openTopUpPayment = () => {
    if (topUpAmountValue <= 0) {
      setError('Enter a valid top-up amount.');
      return;
    }
    setTopUpOpen(false);
    router.push({
      pathname: '/work/route-preview',
      params: {
        routeId: 'member-member-pay-generic',
        amount: String(topUpAmountValue),
        purpose: 'WALLET_TOP_UP',
        walletTopUp: 'true',
      },
    } as never);
  };

  const submitWithdrawal = async () => {
    if (!member || !associationId || withdrawalValidation) {
      setError(withdrawalValidation || 'Member wallet context is missing.');
      return;
    }
    setConfirmWithdrawalOpen(false);
    setSubmittingWithdrawal(true);
    setError(null);
    setNotice(null);

    const payload: MemberWalletWithdrawalPayload = {
      amount: withdrawAmountValue,
      withdrawalMethod: withdrawMethod,
      requestNotes: withdrawNotes.trim() || undefined,
      destinationNumber: withdrawMethod === 'MOBILE_MONEY' ? normalizePhone(withdrawPhone) : undefined,
      bankName: withdrawMethod === 'BANK_TRANSFER' ? withdrawBankName.trim() : undefined,
      accountNumber: withdrawMethod === 'BANK_TRANSFER' ? withdrawAccountNumber.trim() : undefined,
      accountName: withdrawMethod === 'BANK_TRANSFER' ? withdrawAccountName.trim() : undefined,
    };

    try {
      const response = await createMemberWithdrawalRequest(member.id, member.associationId || associationId, payload);
      setNotice(`Withdrawal ${shortId(response.data?.id)} submitted for approval.`);
      setWithdrawOpen(false);
      setWithdrawAmount('');
      setWithdrawBankName('');
      setWithdrawAccountNumber('');
      setWithdrawAccountName('');
      setWithdrawNotes('');
      await loadWallet('refresh');
      setActiveTab('withdrawals');
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  if (activeView !== 'MEMBER') {
    return <AccessDeniedScreen title="My wallet" description="This native wallet page is available inside the member workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="dashboard" message="Loading wallet" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Wallet"
        title="My wallet"
        subtitle="Balance, top-ups, withdrawals, and wallet activity"
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh wallet" variant="secondary" disabled={refreshing} onPress={() => void loadWallet('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Wallet issue" label={error} tone="danger" /> : null}
      {notice ? <MobileStatusBadge status="Completed" label={notice} tone="success" /> : null}

      <MobileSummaryPanel
        title="Available balance"
        value={formatCurrency(balance, currency)}
        description={member ? `${member.fullLegalName || 'Member'} - ${member.membershipNumber || 'No membership number'}` : 'Current wallet'}
        tone={balance > 0 ? 'green' : 'blue'}
        icon={WalletCards}
        footer={<MobileStatusBadge status={balance > 0 ? 'Active' : 'Pending'} label={balance > 0 ? 'Ready for use' : 'No funds yet'} tone={balance > 0 ? 'success' : 'info'} />}
      />

      <View style={styles.actionRow}>
        <View style={styles.actionButton}>
          <MobileButton label="Top up" icon={Plus} fullWidth onPress={() => setTopUpOpen(true)} />
        </View>
        <View style={styles.actionButton}>
          <MobileButton label="Withdraw" icon={ArrowUpRight} fullWidth variant="secondary" disabled={balance <= 0} onPress={() => setWithdrawOpen(true)} />
        </View>
      </View>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Wallet activity
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {activeTab === 'transactions'
                ? `Showing ${formatNumber(transactionItems.length)} of ${formatNumber(transactions.length)} transaction(s)`
                : `Showing ${formatNumber(withdrawalItems.length)} of ${formatNumber(withdrawals.length)} request(s)`}
            </MobileText>
          </View>
          <MobileButton label="Sort" size="sm" variant="secondary" onPress={() => setSortOpen(true)} />
        </View>
        <MobileStatusTabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as WalletTab)}
          tabs={[
            { ...tabOptions[0], count: transactions.length },
            { ...tabOptions[1], count: withdrawals.length },
          ]}
        />
        <MobileSearchToolbar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder={activeTab === 'transactions' ? 'Search transactions...' : 'Search withdrawals...'}
          onFilterPress={() => setSortOpen(true)}
          filterLabel="Sort"
        />
      </MobileCard>

      {activeTab === 'transactions' ? (
        transactionItems.length > 0 ? (
          <MobileDataList
            items={transactionItems}
            onPressItem={(item) => {
              const transaction = transactions.find((row) => row.id === item.id);
              if (transaction) setSelectedTransaction(transaction);
            }}
          />
        ) : (
          <MobileEmptyState
            title={transactions.length > 0 ? 'No matching transactions' : 'No wallet transactions yet'}
            description={transactions.length > 0 ? 'Adjust search or sort to see more activity.' : 'Top-ups and wallet payments will appear here once they are recorded.'}
          />
        )
      ) : withdrawalItems.length > 0 ? (
        <MobileDataList
          items={withdrawalItems}
          onPressItem={(item) => {
            const withdrawal = withdrawals.find((row) => row.id === item.id);
            if (withdrawal) setSelectedWithdrawal(withdrawal);
          }}
        />
      ) : (
        <MobileEmptyState
          title={withdrawals.length > 0 ? 'No matching withdrawals' : 'No withdrawal requests yet'}
          description={withdrawals.length > 0 ? 'Adjust search or sort to see more requests.' : 'Submitted withdrawal requests will appear here for approval tracking.'}
        />
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total in" value={formatCurrency(totalIn, currency)} description="Successful credits" tone="green" icon={ArrowDownRight} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total out" value={formatCurrency(totalOut, currency)} description="Payments and transfers" tone="red" icon={ArrowUpRight} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending" value={formatNumber(pendingWithdrawals)} description="Withdrawal requests" tone="orange" icon={Clock3} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {error && !member ? <MobileErrorState title="Unable to load wallet" description={error} retryLabel="Try again" onRetry={() => void loadWallet('refresh')} /> : null}

      <MobileSortSheet visible={sortOpen} value={sortValue} options={sortOptions} onChange={(value) => setSortValue(value as SortOption)} onClose={() => setSortOpen(false)} />

      <TopUpSheet
        visible={topUpOpen}
        amount={topUpAmount}
        balance={balance}
        currency={currency}
        onChangeAmount={setTopUpAmount}
        onClose={() => setTopUpOpen(false)}
        onContinue={openTopUpPayment}
      />

      <WithdrawalSheet
        visible={withdrawOpen}
        amount={withdrawAmount}
        balance={balance}
        currency={currency}
        method={withdrawMethod}
        phone={withdrawPhone}
        bankName={withdrawBankName}
        accountNumber={withdrawAccountNumber}
        accountName={withdrawAccountName}
        notes={withdrawNotes}
        validation={withdrawalValidation}
        submitting={submittingWithdrawal}
        onChangeAmount={setWithdrawAmount}
        onChangeMethod={(value) => setWithdrawMethod(value as WithdrawalMethod)}
        onChangePhone={setWithdrawPhone}
        onChangeBankName={setWithdrawBankName}
        onChangeAccountNumber={setWithdrawAccountNumber}
        onChangeAccountName={setWithdrawAccountName}
        onChangeNotes={setWithdrawNotes}
        onClose={() => setWithdrawOpen(false)}
        onSubmit={() => setConfirmWithdrawalOpen(true)}
      />

      <MobileConfirmSheet
        visible={confirmWithdrawalOpen}
        title="Submit withdrawal request?"
        description={`Request ${formatCurrency(withdrawAmountValue, currency)} by ${withdrawalMethodLabel(withdrawMethod)}. The request will go to the approval queue.`}
        confirmLabel="Submit"
        onCancel={() => setConfirmWithdrawalOpen(false)}
        onConfirm={() => void submitWithdrawal()}
      />

      <TransactionDetailSheet transaction={selectedTransaction} currency={currency} onClose={() => setSelectedTransaction(null)} />
      <WithdrawalDetailSheet withdrawal={selectedWithdrawal} currency={currency} onClose={() => setSelectedWithdrawal(null)} />
    </MobileScreen>
  );
}

function TopUpSheet({
  visible,
  amount,
  balance,
  currency,
  onChangeAmount,
  onClose,
  onContinue,
}: {
  visible: boolean;
  amount: string;
  balance: number;
  currency: string;
  onChangeAmount: (value: string) => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  return (
    <MobileSheet visible={visible} title="Top up wallet" description="Add funds through the member payment flow." onClose={onClose}>
      <MobileAmountInput label="Amount" value={amount} onChangeText={onChangeAmount} helperText={`Current balance: ${formatCurrency(balance, currency)}`} />
      <MobileInfoRow label="Payment route" value="Wallet top-up" helper="You will continue to the member payment screen." icon={WalletCards} status="Ready" />
      <MobileButton label="Continue to payment" icon={Send} fullWidth disabled={parseAmount(amount) <= 0} onPress={onContinue} />
    </MobileSheet>
  );
}

function WithdrawalSheet({
  visible,
  amount,
  balance,
  currency,
  method,
  phone,
  bankName,
  accountNumber,
  accountName,
  notes,
  validation,
  submitting,
  onChangeAmount,
  onChangeMethod,
  onChangePhone,
  onChangeBankName,
  onChangeAccountNumber,
  onChangeAccountName,
  onChangeNotes,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  amount: string;
  balance: number;
  currency: string;
  method: WithdrawalMethod;
  phone: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  notes: string;
  validation: string | null;
  submitting: boolean;
  onChangeAmount: (value: string) => void;
  onChangeMethod: (value: string) => void;
  onChangePhone: (value: string) => void;
  onChangeBankName: (value: string) => void;
  onChangeAccountNumber: (value: string) => void;
  onChangeAccountName: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <MobileSheet visible={visible} title="Withdraw funds" description={`Available: ${formatCurrency(balance, currency)}`} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheetStack} showsVerticalScrollIndicator={false}>
        <MobileAmountInput label="Amount" value={amount} onChangeText={onChangeAmount} helperText="Minimum withdrawal is TZS 100." disabled={submitting} />
        <MobileSelect label="Withdrawal method" value={method} options={withdrawalMethodOptions} onChange={onChangeMethod} />
        {method === 'MOBILE_MONEY' ? (
          <MobileTextInput
            label="Mobile number"
            value={phone}
            onChangeText={onChangePhone}
            placeholder="255712345678"
            helperText="Use a Tanzanian mobile money number."
            icon={Smartphone}
            keyboardType="phone-pad"
            error={phone && !validatePhone(phone) ? 'Enter a valid Tanzanian mobile number.' : undefined}
            disabled={submitting}
          />
        ) : (
          <>
            <MobileTextInput label="Bank name" value={bankName} onChangeText={onChangeBankName} placeholder="Bank name or bank code" icon={Landmark} disabled={submitting} />
            <MobileTextInput label="Account number" value={accountNumber} onChangeText={onChangeAccountNumber} placeholder="Account number" icon={Banknote} disabled={submitting} />
            <MobileTextInput label="Account name" value={accountName} onChangeText={onChangeAccountName} placeholder="Account holder name" icon={Landmark} disabled={submitting} />
          </>
        )}
        <MobileTextInput label="Notes" value={notes} onChangeText={onChangeNotes} placeholder="Reason for withdrawal" helperText="Optional, but useful for approval review." icon={Clock3} disabled={submitting} />
        {validation ? <MobileStatusBadge status="Draft" label={validation} tone="warning" /> : null}
        <MobileButton label="Submit withdrawal" icon={Send} fullWidth loading={submitting} disabled={Boolean(validation) || submitting} onPress={onSubmit} />
      </ScrollView>
    </MobileSheet>
  );
}

function TransactionDetailSheet({ transaction, currency, onClose }: { transaction: MemberWalletTransaction | null; currency: string; onClose: () => void }) {
  if (!transaction) return null;
  const type = String(transaction.transactionType || 'TRANSACTION').toUpperCase();
  const status = transaction.success ? 'Completed' : isPendingTransaction(transaction) ? 'Pending' : 'Failed';

  return (
    <MobileSheet visible title="Wallet transaction" description={shortId(transaction.id)} onClose={onClose}>
      <MobileInfoRow label="Amount" value={formatCurrency(toNumber(transaction.amount), transaction.currency || currency)} helper={transactionTypeLabel(type)} icon={WalletCards} status={status} />
      <MobileInfoRow label="Description" value={transaction.description || 'No description'} helper={formatDate(transaction.createdAt)} icon={Clock3} />
      <MobileInfoRow label="Balance before" value={formatCurrency(toNumber(transaction.balanceBefore), transaction.currency || currency)} icon={ArrowUpRight} />
      <MobileInfoRow label="Balance after" value={formatCurrency(toNumber(transaction.balanceAfter), transaction.currency || currency)} icon={ArrowDownRight} />
      {transaction.paymentReference ? <MobileInfoRow label="Payment reference" value={transaction.paymentReference} icon={Banknote} /> : null}
      {transaction.referenceType || transaction.referenceId ? <MobileInfoRow label="Linked record" value={transaction.referenceType || 'Reference'} helper={transaction.referenceId || undefined} icon={Landmark} /> : null}
    </MobileSheet>
  );
}

function WithdrawalDetailSheet({ withdrawal, currency, onClose }: { withdrawal: MemberWithdrawalRequest | null; currency: string; onClose: () => void }) {
  if (!withdrawal) return null;

  return (
    <MobileSheet visible title="Withdrawal request" description={shortId(withdrawal.id)} onClose={onClose}>
      <MobileInfoRow label="Amount" value={formatCurrency(toNumber(withdrawal.amount), currency)} helper={withdrawal.requestNotes || 'No request notes'} icon={Banknote} status={withdrawal.status || 'Pending'} />
      <MobileInfoRow label="Method" value={withdrawalMethodLabel(withdrawal.withdrawalMethod)} helper={withdrawalDestination(withdrawal)} icon={withdrawal.withdrawalMethod === 'BANK_TRANSFER' ? Landmark : Smartphone} />
      <MobileInfoRow label="Created" value={formatDate(withdrawal.createdAt)} helper={withdrawal.updatedAt ? `Updated ${formatDate(withdrawal.updatedAt)}` : undefined} icon={Clock3} />
      {withdrawal.rejectionReason ? <MobileInfoRow label="Rejection reason" value={withdrawal.rejectionReason} icon={Clock3} status="Rejected" /> : null}
      {withdrawal.firstApproverName ? <MobileInfoRow label="First approval" value={withdrawal.firstApproverName} helper={formatDate(withdrawal.firstApprovedAt)} icon={ArrowUpRight} status="Approved" /> : null}
      {withdrawal.secondApproverName ? <MobileInfoRow label="Second approval" value={withdrawal.secondApproverName} helper={formatDate(withdrawal.secondApprovedAt)} icon={ArrowUpRight} status="Approved" /> : null}
      {withdrawal.processedAt ? <MobileInfoRow label="Processed" value={formatDate(withdrawal.processedAt)} helper={withdrawal.zenoPayReference || withdrawal.disbursementStatus || undefined} icon={Send} status="Completed" /> : null}
    </MobileSheet>
  );
}

const incomingTransactionTypes = new Set(['TOP_UP', 'REFUND', 'TRANSFER_IN']);
const outgoingTransactionTypes = new Set(['PAYMENT', 'TRANSFER_OUT']);

function sortTransactions(rows: MemberWalletTransaction[], sortValue: SortOption) {
  return [...rows].sort((a, b) => {
    if (sortValue === 'amountAsc' || sortValue === 'amountDesc') {
      const modifier = sortValue === 'amountAsc' ? 1 : -1;
      return (toNumber(a.amount) - toNumber(b.amount)) * modifier;
    }
    if (sortValue === 'status') {
      return String(a.success ? 'completed' : isPendingTransaction(a) ? 'pending' : 'failed').localeCompare(String(b.success ? 'completed' : isPendingTransaction(b) ? 'pending' : 'failed'));
    }
    const modifier = sortValue === 'oldest' ? 1 : -1;
    return (dateValue(a.createdAt) - dateValue(b.createdAt)) * modifier;
  });
}

function sortWithdrawals(rows: MemberWithdrawalRequest[], sortValue: SortOption) {
  return [...rows].sort((a, b) => {
    if (sortValue === 'amountAsc' || sortValue === 'amountDesc') {
      const modifier = sortValue === 'amountAsc' ? 1 : -1;
      return (toNumber(a.amount) - toNumber(b.amount)) * modifier;
    }
    if (sortValue === 'status') {
      return String(a.status || '').localeCompare(String(b.status || ''));
    }
    const modifier = sortValue === 'oldest' ? 1 : -1;
    return (dateValue(a.createdAt) - dateValue(b.createdAt)) * modifier;
  });
}

function getWithdrawalValidation({
  amount,
  balance,
  method,
  phone,
  bankName,
  accountNumber,
  accountName,
}: {
  amount: number;
  balance: number;
  method: WithdrawalMethod;
  phone: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}) {
  if (amount <= 0) return 'Enter a valid withdrawal amount.';
  if (amount < 100) return 'Minimum withdrawal amount is TZS 100.';
  if (amount > balance) return 'Withdrawal amount exceeds your wallet balance.';
  if (method === 'MOBILE_MONEY' && !validatePhone(phone)) return 'Enter a valid Tanzanian mobile number.';
  if (method === 'BANK_TRANSFER' && (!bankName.trim() || !accountNumber.trim() || !accountName.trim())) return 'Enter bank name, account number, and account name.';
  return null;
}

function transactionTypeLabel(type?: string | null) {
  const normalized = String(type || '').toUpperCase();
  if (normalized === 'TOP_UP') return 'Top up';
  if (normalized === 'PAYMENT') return 'Payment';
  if (normalized === 'REFUND') return 'Refund';
  if (normalized === 'ADJUSTMENT') return 'Adjustment';
  if (normalized === 'TRANSFER_IN') return 'Transfer in';
  if (normalized === 'TRANSFER_OUT') return 'Transfer out';
  return normalized ? normalized.replace(/_/g, ' ') : 'Transaction';
}

function withdrawalMethodLabel(method?: string | null) {
  const normalized = String(method || '').toUpperCase();
  if (normalized === 'MOBILE_MONEY') return 'Mobile money';
  if (normalized === 'BANK_TRANSFER') return 'Bank transfer';
  return normalized ? normalized.replace(/_/g, ' ') : 'Withdrawal';
}

function withdrawalDestination(withdrawal: MemberWithdrawalRequest) {
  if (String(withdrawal.withdrawalMethod || '').toUpperCase() === 'BANK_TRANSFER') {
    return [withdrawal.bankName, withdrawal.accountNumber, withdrawal.accountName].filter(Boolean).join(' - ') || 'Bank account';
  }
  return withdrawal.destinationNumber || 'Mobile money destination';
}

function isPendingTransaction(transaction: MemberWalletTransaction) {
  return String(transaction.description || '').toLowerCase().includes('pending');
}

function parseAmount(value: string) {
  const normalized = value.replace(/[^0-9.]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function validatePhone(value: string) {
  return /^(?:\+255|255|0)?[67]\d{8}$/.test(value.replace(/[\s\-()]/g, ''));
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.length >= 9) digits = digits.slice(-9);
  return `0${digits}`;
}

function shortId(value?: string | null) {
  if (!value) return 'Not available';
  return value.length > 8 ? value.slice(0, 8) : value;
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minWidth: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  sheetStack: {
    gap: 12,
    paddingBottom: 10,
  },
});
