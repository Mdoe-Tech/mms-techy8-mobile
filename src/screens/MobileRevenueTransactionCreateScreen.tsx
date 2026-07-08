import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  FileText,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  UserRound,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { isGenericAssociation } from '@/auth/association-type';
import {
  MobileAmountInput,
  MobileButton,
  MobileCard,
  MobileErrorState,
  MobileFormSection,
  MobileIconButton,
  MobileInfoRow,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import { getAllAssociationMembers, getAssociationGroupConfigs, type AssociationMember, type GroupConfig } from '@/services/member-service';
import {
  createRevenueTransaction,
  labelFromPaymentType,
  type RevenuePaymentStatus,
  type RevenueTransaction,
} from '@/services/revenue-transaction-service';
import { useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatTzs } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type PaymentEntry = {
  id: string;
  type: string;
  amount: string;
  fineCategory?: string;
};

const MAX_PAYMENT_ENTRIES = 6;

const paymentTypeOptions = [
  { label: 'Share purchase', value: 'SHARE_PURCHASE' },
  { label: 'Social contribution', value: 'SOCIAL_CONTRIBUTION' },
  { label: 'Fine', value: 'FINE' },
  { label: 'Penalty', value: 'PENALTY' },
  { label: 'Membership fee', value: 'MEMBERSHIP_FEE' },
  { label: 'Loan repayment', value: 'LOAN_REPAYMENT' },
  { label: 'Other', value: 'OTHER' },
];

const statusOptions = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Unpaid', value: 'UNPAID' },
  { label: 'Partially paid', value: 'PARTIALLY_PAID' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const fineCategoryOptions = [
  { label: 'Late payment', value: 'LATE_PAYMENT' },
  { label: 'Misconduct', value: 'MISCONDUCT' },
  { label: 'Non-attendance', value: 'NON_ATTENDANCE' },
  { label: 'Attendance', value: 'ATTENDANCE' },
  { label: 'Other', value: 'OTHER' },
];

export default function MobileRevenueTransactionCreateScreen() {
  const { activeView, associationId, user } = useAuth();
  const theme = useNaneTheme();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [groupConfig, setGroupConfig] = useState<GroupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [createdTransaction, setCreatedTransaction] = useState<RevenueTransaction | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberId, setMemberId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<RevenuePaymentStatus>('PENDING');
  const [transactionDate, setTransactionDate] = useState(defaultDateTime());
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [loanId, setLoanId] = useState('');
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([
    { id: 'line-1', type: defaultPaymentType(user?.associationType), amount: '' },
  ]);

  const loadFormData = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [memberResponse, configs] = await Promise.all([
          getAllAssociationMembers(associationId),
          getAssociationGroupConfigs(associationId).catch(() => []),
        ]);
        setMembers(memberResponse.content.filter((member) => Boolean(member?.id)));
        setGroupConfig(configs[0] || null);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadFormData());
  }, [loadFormData]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    const source = members.slice(0, 250);
    if (!query) return source.slice(0, 40);
    return source
      .filter((member) =>
        [
          member.fullLegalName,
          member.membershipNumber,
          member.employeeId,
          member.contactInfo?.email,
          member.contactInfo?.phoneNumber,
        ].some((value) => String(value || '').toLowerCase().includes(query)),
      )
      .slice(0, 40);
  }, [memberSearch, members]);

  const memberOptions = useMemo(
    () =>
      filteredMembers.map((member) => ({
        value: member.id,
        label: member.fullLegalName || member.membershipNumber || 'Unnamed member',
      })),
    [filteredMembers],
  );

  const selectedMember = useMemo(() => members.find((member) => member.id === memberId), [memberId, members]);
  const paymentDetails = useMemo(() => buildPaymentDetails(paymentEntries), [paymentEntries]);
  const totalAmount = useMemo(
    () => Object.values(paymentDetails).reduce((sum, value) => sum + Number(value || 0), 0),
    [paymentDetails],
  );
  const hasFine = paymentEntries.some((entry) => entry.type === 'FINE' && toAmount(entry.amount) > 0);
  const hasLoanRepayment = paymentEntries.some((entry) => entry.type === 'LOAN_REPAYMENT' && toAmount(entry.amount) > 0);
  const ledgerRoute = getRouteByPath('/associations/revenue-transactions');
  const detailRoute = getRouteByPath('/associations/revenue-transactions/:id');

  const addPaymentEntry = () => {
    if (paymentEntries.length >= MAX_PAYMENT_ENTRIES) {
      setValidationError(`You can add up to ${MAX_PAYMENT_ENTRIES} payment lines on mobile.`);
      return;
    }
    setPaymentEntries((current) => [
      ...current,
      { id: `${Date.now()}-${current.length}`, type: defaultPaymentType(user?.associationType), amount: '' },
    ]);
  };

  const updatePaymentEntry = (id: string, patch: Partial<PaymentEntry>) => {
    setPaymentEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
    setValidationError(null);
  };

  const removePaymentEntry = (id: string) => {
    setPaymentEntries((current) => (current.length === 1 ? current : current.filter((entry) => entry.id !== id)));
    setValidationError(null);
  };

  const handleSubmit = async () => {
    if (!associationId) return;
    const validation = validateForm({
      memberId,
      paymentEntries,
      groupConfig,
      hasFine,
      hasLoanRepayment,
      loanId,
    });

    if (validation) {
      setValidationError(validation);
      return;
    }

    setSubmitting(true);
    setValidationError(null);
    setError(null);

    try {
      const response = await createRevenueTransaction({
        memberId,
        paymentDetails,
        paymentStatus,
        transactionDate: transactionDate || undefined,
        dueDate: dueDate || undefined,
        description: description.trim() || undefined,
        fineCategory: firstFineCategory(paymentEntries),
        loanId: loanId.trim() || undefined,
      });
      setCreatedTransaction(response);
    } catch (submitError) {
      setValidationError(getApiErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Record transaction"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading && members.length === 0) {
    return <MobilePageLoadingState kind="form" message="Preparing transaction form" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Record transaction" subtitle="Association context unavailable" onBack={() => router.back()} />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before recording transactions." />
      </MobileScreen>
    );
  }

  if (error && members.length === 0) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Finance"
          title="Record transaction"
          subtitle="Required data could not load"
          onBack={() => router.back()}
          rightAction={
            <MobileIconButton
              icon={RefreshCw}
              label="Retry"
              variant="secondary"
              disabled={refreshing}
              onPress={() => void loadFormData('refresh')}
            />
          }
        />
        <MobileErrorState title="Create form could not load" description={error} retryLabel="Retry" onRetry={() => void loadFormData('refresh')} />
      </MobileScreen>
    );
  }

  if (createdTransaction) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Transaction recorded" subtitle="The ledger has been updated" onBack={() => router.back()} />
        <MobileSummaryPanel
          title="Recorded amount"
          value={formatTzs(totalAmount)}
          description={selectedMember?.fullLegalName || 'Revenue transaction created'}
          tone="green"
          icon={CheckCircle2}
        />
        <MobileCard compact>
          <MobileInfoRow label="Transaction ID" value={createdTransaction.id} icon={ReceiptText} />
          <MobileInfoRow label="Status" value={createdTransaction.paymentStatus || paymentStatus} icon={Banknote} status={createdTransaction.paymentStatus || paymentStatus} />
          <MobileInfoRow label="Payment" value={Object.keys(paymentDetails).map(labelFromPaymentType).join(' + ')} icon={FileText} />
        </MobileCard>
        <View style={styles.actions}>
          {detailRoute ? (
            <MobileButton
              label="View receipt"
              icon={ReceiptText}
              fullWidth
              onPress={() =>
                router.push({ pathname: '/work/route-preview', params: { routeId: detailRoute.id, id: createdTransaction.id } } as never)
              }
            />
          ) : null}
          <MobileButton
            label="Back to ledger"
            icon={ReceiptText}
            variant="secondary"
            fullWidth
            onPress={() => (ledgerRoute ? router.push({ pathname: '/work/route-preview', params: { routeId: ledgerRoute.id } } as never) : router.back())}
          />
        </View>
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Record transaction"
        subtitle={selectedMember ? selectedMember.fullLegalName || 'Selected member' : 'Select member and payments'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh form data"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadFormData('refresh')}
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh failed" label={error} tone="warning" /> : null}
      {validationError ? <MobileStatusBadge status="Validation" label={validationError} tone="danger" /> : null}

      <MobileSummaryPanel
        title="Transaction total"
        value={formatTzs(totalAmount)}
        description={`${paymentEntries.filter((entry) => toAmount(entry.amount) > 0).length || 0} payment line(s) ready`}
        tone={totalAmount > 0 ? 'blue' : 'slate'}
        icon={Banknote}
      />

      <MobileFormSection title="Member" description="Search the full member list, then choose the member to credit.">
        <MobileSearchToolbar
          value={memberSearch}
          onChange={setMemberSearch}
          placeholder="Search member name, number, phone..."
        />
        <MobileSelect
          label="Selected member"
          value={memberId}
          options={memberOptions}
          onChange={(value) => {
            setMemberId(value);
            setValidationError(null);
          }}
          placeholder={members.length ? 'Choose member' : 'No members available'}
        />
        {selectedMember ? (
          <MobileInfoRow
            label="Selected"
            value={selectedMember.fullLegalName || 'Unnamed member'}
            helper={selectedMember.membershipNumber || selectedMember.contactInfo?.phoneNumber || selectedMember.contactInfo?.email || 'No member reference'}
            icon={UserRound}
          />
        ) : null}
      </MobileFormSection>

      <MobileFormSection title="Payment lines" description="Add one or more payment purposes. Amounts are combined before submission.">
        <View style={styles.sectionActionRow}>
          <MobileButton label="Add line" icon={Plus} size="sm" variant="secondary" onPress={addPaymentEntry} disabled={paymentEntries.length >= MAX_PAYMENT_ENTRIES} />
        </View>
        <View style={styles.paymentEntries}>
          {paymentEntries.map((entry, index) => (
            <View key={entry.id} style={[styles.paymentLinePanel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <View style={styles.paymentHeader}>
                <MobileText variant="body" weight="bold">
                  Line {index + 1}
                </MobileText>
                {paymentEntries.length > 1 ? (
                  <MobileIconButton icon={Trash2} label="Remove payment line" variant="danger" onPress={() => removePaymentEntry(entry.id)} />
                ) : null}
              </View>
              <MobileSelect
                label="Payment type"
                value={entry.type}
                options={paymentTypeOptions}
                onChange={(value) => updatePaymentEntry(entry.id, { type: value, fineCategory: value === 'FINE' ? entry.fineCategory : undefined })}
              />
              <MobileAmountInput
                label="Amount"
                value={entry.amount}
                onChangeText={(value) => updatePaymentEntry(entry.id, { amount: value })}
                helperText={amountHelper(entry, groupConfig)}
              />
              {entry.type === 'FINE' ? (
                <MobileSelect
                  label="Fine category"
                  value={entry.fineCategory || ''}
                  options={fineCategoryOptions}
                  onChange={(value) => updatePaymentEntry(entry.id, { fineCategory: value })}
                  placeholder="Choose fine category"
                />
              ) : null}
            </View>
          ))}
        </View>
      </MobileFormSection>

      <MobileFormSection title="Transaction details" description="Set status and timing before saving to the ledger.">
        <MobileSelect label="Payment status" value={paymentStatus} options={statusOptions} onChange={(value) => setPaymentStatus(value as RevenuePaymentStatus)} />
        <View style={styles.fieldGrid}>
          <MobileTextInput
            label="Transaction date/time"
            value={transactionDate}
            onChangeText={setTransactionDate}
            placeholder="YYYY-MM-DDTHH:mm:ss"
            helperText="Local EAT time"
            icon={CalendarDays}
            autoCapitalize="none"
          />
          <MobileTextInput
            label="Due date/time"
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="Optional YYYY-MM-DDTHH:mm:ss"
            helperText="Optional"
            icon={CalendarDays}
            autoCapitalize="none"
          />
        </View>
        {hasLoanRepayment ? (
          <MobileTextInput
            label="Loan ID"
            value={loanId}
            onChangeText={setLoanId}
            placeholder="Required for loan repayment"
            helperText="Paste the linked loan ID"
            icon={ReceiptText}
            autoCapitalize="none"
          />
        ) : null}
        <MobileTextInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional note for this transaction"
          helperText="Visible in transaction details and reports"
          icon={FileText}
        />
      </MobileFormSection>

      <View style={styles.actions}>
        <MobileButton
          label="Record transaction"
          icon={ReceiptText}
          fullWidth
          loading={submitting}
          disabled={submitting || totalAmount <= 0}
          onPress={handleSubmit}
        />
        <MobileButton
          label="Cancel"
          variant="secondary"
          fullWidth
          onPress={() => (ledgerRoute ? router.push({ pathname: '/work/route-preview', params: { routeId: ledgerRoute.id } } as never) : router.back())}
        />
      </View>
    </MobileScreen>
  );
}

function defaultPaymentType(associationType?: string | null) {
  return isGenericAssociation(associationType) ? 'MEMBERSHIP_FEE' : 'SHARE_PURCHASE';
}

function defaultDateTime() {
  const now = new Date();
  const eatTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return eatTime.toISOString().slice(0, 19);
}

function toAmount(value: string) {
  const amount = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

function buildPaymentDetails(entries: PaymentEntry[]) {
  return entries.reduce<Record<string, number>>((acc, entry) => {
    const amount = toAmount(entry.amount);
    if (amount <= 0) return acc;
    acc[entry.type] = (acc[entry.type] || 0) + amount;
    return acc;
  }, {});
}

function firstFineCategory(entries: PaymentEntry[]) {
  return entries.find((entry) => entry.type === 'FINE' && entry.fineCategory)?.fineCategory;
}

function validateForm(input: {
  memberId: string;
  paymentEntries: PaymentEntry[];
  groupConfig: GroupConfig | null;
  hasFine: boolean;
  hasLoanRepayment: boolean;
  loanId: string;
}) {
  if (!input.memberId) return 'Select a member before recording the transaction.';
  if (!input.paymentEntries.some((entry) => toAmount(entry.amount) > 0)) return 'Add at least one payment amount greater than zero.';
  if (input.hasFine && !firstFineCategory(input.paymentEntries)) return 'Select a fine category for fine payment lines.';
  if (input.hasLoanRepayment && !input.loanId.trim()) return 'Loan repayment requires a linked loan ID.';

  for (const entry of input.paymentEntries) {
    const amount = toAmount(entry.amount);
    if (amount <= 0) continue;
    if (entry.type === 'SHARE_PURCHASE') {
      const shareValue = Number(input.groupConfig?.shareValue || 0);
      if (shareValue > 0 && amount % shareValue !== 0) {
        return `Share purchase must be a multiple of ${formatTzs(shareValue)}.`;
      }
    }
    if (entry.type === 'SOCIAL_CONTRIBUTION') {
      const socialAmount = Number(input.groupConfig?.socialAmount || 0);
      if (socialAmount > 0 && amount !== socialAmount) {
        return `Social contribution must be exactly ${formatTzs(socialAmount)}.`;
      }
    }
  }

  return null;
}

function amountHelper(entry: PaymentEntry, groupConfig: GroupConfig | null) {
  if (entry.type === 'SHARE_PURCHASE' && Number(groupConfig?.shareValue || 0) > 0) {
    return `Share value: ${formatTzs(Number(groupConfig?.shareValue || 0))}`;
  }
  if (entry.type === 'SOCIAL_CONTRIBUTION' && Number(groupConfig?.socialAmount || 0) > 0) {
    return `Expected social amount: ${formatTzs(Number(groupConfig?.socialAmount || 0))}`;
  }
  return 'Enter amount in TZS';
}

const styles = StyleSheet.create({
  paymentEntries: {
    gap: 12,
  },
  paymentLinePanel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 12,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  fieldGrid: {
    gap: 12,
  },
  sectionActionRow: {
    alignItems: 'flex-start',
  },
  actions: {
    gap: 10,
  },
});
