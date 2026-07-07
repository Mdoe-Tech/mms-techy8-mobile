import { router } from 'expo-router';
import {
  Banknote,
  Building2,
  CheckCircle2,
  Clock3,
  Landmark,
  RefreshCw,
  Send,
  UserRound,
  XCircle,
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
import {
  cancelDisbursementRequest,
  createDisbursementRequest,
  getAssociationBankAccounts,
  getAssociationDisbursementWalletStatus,
  getAssociationDisbursements,
  getMemberPayoutReferences,
  isBankAccountPrimary,
  type BankAccount,
  type DisbursementRequest,
  type DisbursementType,
  type DisbursementWalletStatus,
  type MemberPayoutReference,
} from '@/services/wallet-service';
import { labelFromStatus, statusToneFor } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, initialsFromName } from '@/utils/format';

type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED' | 'CANCELLED';
type SortOption = 'dateDesc' | 'dateAsc' | 'amountDesc' | 'statusAsc' | 'typeAsc';

const statusTabs: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const sortOptions = [
  { value: 'dateDesc', label: 'Newest request', description: 'Latest disbursement requests first.' },
  { value: 'dateAsc', label: 'Oldest request', description: 'Earliest requests first.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest movement of funds first.' },
  { value: 'statusAsc', label: 'Status', description: 'Group requests by processing state.' },
  { value: 'typeAsc', label: 'Type', description: 'Group association withdrawals and member payouts.' },
];

const typeOptions = [
  { label: 'Association withdrawal', value: 'ASSOCIATION_WITHDRAWAL' },
  { label: 'Member payout', value: 'MEMBER_PAYOUT' },
];

export default function MobileDisbursementsScreen() {
  const { activeView, associationId, user } = useAuth();
  const [requests, setRequests] = useState<DisbursementRequest[]>([]);
  const [walletStatus, setWalletStatus] = useState<DisbursementWalletStatus | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [members, setMembers] = useState<MemberPayoutReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortValue, setSortValue] = useState<SortOption>('dateDesc');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DisbursementRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<DisbursementRequest | null>(null);
  const [form, setForm] = useState({
    disbursementType: 'ASSOCIATION_WITHDRAWAL' as DisbursementType,
    amount: '',
    memberId: '',
    bankAccountId: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    branchName: '',
    requestReason: '',
  });

  const loadDisbursements = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading disbursements.');
        return;
      }
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const [requestPage, status, accounts, memberPage] = await Promise.all([
          getAssociationDisbursements(associationId, { size: 250, sort: 'requestedAt,desc' }),
          getAssociationDisbursementWalletStatus(associationId),
          getAssociationBankAccounts(associationId),
          getMemberPayoutReferences(associationId, { size: 250, sort: 'fullLegalName,asc' }),
        ]);
        setRequests(requestPage.content || []);
        setWalletStatus(status);
        setBankAccounts(accounts || []);
        setMembers(memberPage.content || []);
      } catch (loadError) {
        setRequests([]);
        setWalletStatus(null);
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
      if (active) void loadDisbursements();
    });
    return () => {
      active = false;
    };
  }, [loadDisbursements]);

  const availableBalance = toNumber(walletStatus?.availableBalance);
  const pendingAmount = toNumber(walletStatus?.pendingDisbursements);
  const amountValue = parseAmount(form.amount);
  const selectedMember = members.find((member) => member.id === form.memberId);
  const selectedBankAccount = bankAccounts.find((account) => account.id === form.bankAccountId);
  const validationMessage = getValidationMessage({
    form,
    amountValue,
    availableBalance,
    bankAccounts,
  });
  const formTouched = Boolean(form.amount || form.memberId || form.bankName || form.accountNumber || form.accountName || form.requestReason);
  const canSubmit = !submitting && !validationMessage;

  const statusCounts = useMemo(
    () =>
      statusTabs.reduce<Record<StatusFilter, number>>((acc, tab) => {
        acc[tab.value] = tab.value === 'all' ? requests.length : requests.filter((request) => request.status === tab.value).length;
        return acc;
      }, {} as Record<StatusFilter, number>),
    [requests],
  );

  const filteredRequests = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = requests.filter((request) => {
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      const haystack = [
        request.referenceNumber,
        request.memberName,
        request.membershipNumber,
        request.disbursementType,
        request.status,
        request.statusDisplayText,
        request.bankName,
        request.accountNumber,
        request.accountName,
        request.requestedByName,
        String(request.amount || ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
    return sortRequests(rows, sortValue);
  }, [requests, searchTerm, sortValue, statusFilter]);

  const listItems = useMemo(
    () =>
      filteredRequests.map((request) => ({
        id: request.id,
        title: request.referenceNumber || shortId(request.id),
        subtitle: disbursementRecipientLabel(request),
        meta: `${formatDate(request.requestedAt)} - ${methodLabel(request.disbursementType)}`,
        amount: formatCurrency(toNumber(request.amount)),
        status: request.statusDisplayText || labelFromStatus(request.status),
        statusTone: statusToneFor(request.status),
        accent: statusToneFor(request.status),
        initials: initialsFromName(request.memberName || request.referenceNumber || 'DR'),
      })),
    [filteredRequests],
  );

  const disbursementReportOptions = {
      title: 'Wallet Disbursements',
      associationName: user?.associationName || 'Association',
      purpose: 'A current-view report of wallet disbursement requests, payout destinations, request status, and bank details.',
      rows: filteredRequests,
      fileName: 'nane-wallet-disbursements',
      metrics: [
        { label: 'Available balance', value: formatCurrency(availableBalance), helper: availableBalance > 0 ? 'Ready for bank payout' : 'No funds available' },
        { label: 'Pending amount', value: formatCurrency(pendingAmount), helper: 'Already requested' },
        { label: 'Requests', value: formatNumber(requests.length), helper: 'Disbursement records' },
        { label: 'Completed', value: formatNumber(statusCounts.COMPLETED || 0), helper: 'Bank payouts done' },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Status', value: statusTabs.find((tab) => tab.value === statusFilter)?.label || statusFilter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: DisbursementRequest, index: number) => index + 1 },
        { key: 'reference', label: 'Reference', width: '13%', value: (row: DisbursementRequest) => row.referenceNumber || shortId(row.id) },
        { key: 'type', label: 'Type', width: '13%', value: (row: DisbursementRequest) => methodLabel(row.disbursementType) },
        { key: 'recipient', label: 'Recipient', width: '17%', value: (row: DisbursementRequest) => disbursementRecipientLabel(row) },
        { key: 'membershipNumber', label: 'Membership No.', width: '11%', value: (row: DisbursementRequest) => row.membershipNumber || '-' },
        { key: 'amount', label: 'Amount', align: 'right' as const, width: '12%', value: (row: DisbursementRequest) => formatCurrency(toNumber(row.amount)) },
        { key: 'bank', label: 'Bank', width: '13%', value: (row: DisbursementRequest) => row.bankName || '-' },
        { key: 'accountNumber', label: 'Account No.', width: '12%', value: (row: DisbursementRequest) => row.accountNumber || '-' },
        { key: 'status', label: 'Status', width: '11%', value: (row: DisbursementRequest) => row.statusDisplayText || labelFromStatus(row.status) },
        { key: 'requestedAt', label: 'Requested At', width: '12%', value: (row: DisbursementRequest) => formatDate(row.requestedAt) },
      ],
  };

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const selectBankAccount = (accountId: string) => {
    const account = bankAccounts.find((row) => row.id === accountId);
    setForm((current) => ({
      ...current,
      bankAccountId: accountId,
      bankName: account?.bankName || '',
      accountNumber: account?.accountNumber || '',
      accountName: account?.accountName || '',
      branchName: account?.bankBranch || '',
    }));
  };

  const selectMember = (memberId: string) => {
    const member = members.find((row) => row.id === memberId);
    setForm((current) => ({
      ...current,
      memberId,
      bankName: member?.bankName || '',
      accountNumber: member?.bankAccountNumber || '',
      accountName: member?.bankAccountName || member?.fullLegalName || '',
      branchName: member?.bankBranch || '',
    }));
  };

  const submitRequest = async () => {
    if (!associationId || validationMessage) {
      setError(validationMessage || 'Association context is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createDisbursementRequest(associationId, {
        disbursementType: form.disbursementType,
        memberId: form.disbursementType === 'MEMBER_PAYOUT' ? form.memberId : null,
        amount: amountValue,
        bankName: form.bankName.trim(),
        accountNumber: form.accountNumber.trim(),
        accountName: form.accountName.trim(),
        branchName: form.branchName.trim() || null,
        requestReason: form.requestReason.trim() || null,
      });
      setNotice(`Disbursement request ${created.referenceNumber || shortId(created.id)} submitted.`);
      resetForm();
      await loadDisbursements('refresh');
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async () => {
    if (!associationId || !cancelTarget) return;
    setError(null);
    setNotice(null);
    try {
      await cancelDisbursementRequest(associationId, cancelTarget.id);
      setNotice(`Cancelled ${cancelTarget.referenceNumber || shortId(cancelTarget.id)}.`);
      setCancelTarget(null);
      await loadDisbursements('refresh');
    } catch (cancelError) {
      setError(getApiErrorMessage(cancelError));
    }
  };

  const resetForm = () => {
    setForm({
      disbursementType: 'ASSOCIATION_WITHDRAWAL',
      amount: '',
      memberId: '',
      bankAccountId: '',
      bankName: '',
      accountNumber: '',
      accountName: '',
      branchName: '',
      requestReason: '',
    });
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Wallet disbursements" description="This native disbursement workspace is available for association admins only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading disbursement requests" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Wallet & payments"
        title="Wallet disbursements"
        subtitle="Request and track bank payouts"
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh disbursements" onPress={() => loadDisbursements('refresh')} disabled={refreshing} />}
      />

      {error ? <MobileStatusBadge status="Disbursement issue" label={error} tone="danger" /> : null}
      {notice ? <MobileStatusBadge status="Completed" label={notice} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem style={styles.fullKpi}>
          <MobileKpiCard title="Available balance" value={formatCurrency(availableBalance)} description={availableBalance > 0 ? 'Ready for bank payout' : 'No funds available'} tone="blue" icon={Banknote} featured />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending amount" value={formatCurrency(pendingAmount)} description="Already requested" tone="orange" icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Requests" value={formatNumber(requests.length)} description="Disbursement records" tone="slate" icon={Send} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Completed" value={formatNumber(statusCounts.COMPLETED || 0)} description="Bank payouts done" tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Blocked setup" value={bankAccounts.length > 0 ? 'Ready' : 'Bank needed'} description={`${bankAccounts.length} association account(s)`} tone={bankAccounts.length > 0 ? 'teal' : 'red'} icon={Landmark} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFormSection title="New disbursement request" description={`Minimum: ${formatCurrency(1000)}. Available: ${formatCurrency(availableBalance)}`}>
        {availableBalance <= 0 ? (
          <MobileCard compact accent="orange">
            <MobileInfoRow label="Balance guard" value="No funds available" helper="Add wallet funds before creating requests." icon={Banknote} status="Blocked" />
          </MobileCard>
        ) : null}
        <MobileSelect label="Disbursement type" value={form.disbursementType} options={typeOptions} onChange={(value) => {
          setForm((current) => ({
            ...current,
            disbursementType: value as DisbursementType,
            memberId: '',
            bankAccountId: '',
            bankName: '',
            accountNumber: '',
            accountName: '',
            branchName: '',
          }));
        }} />
        <MobileAmountInput label="Amount" value={form.amount} onChangeText={(value) => updateForm('amount', value)} helperText={`Available balance: ${formatCurrency(availableBalance)}`} disabled={submitting} />

        {form.disbursementType === 'ASSOCIATION_WITHDRAWAL' ? (
          bankAccounts.length > 0 ? (
            <MobileSelect label="Association bank account" value={form.bankAccountId} options={bankAccounts.map((account) => ({ label: bankAccountLabel(account), value: account.id }))} onChange={selectBankAccount} />
          ) : (
            <MobileCard compact accent="slate">
              <MobileInfoRow label="Association bank" value="Not configured" helper="Add an association bank account before requesting association withdrawals." icon={Landmark} status="Required" />
            </MobileCard>
          )
        ) : (
          <>
            <MobileSelect label="Member" value={form.memberId} options={members.map((member) => ({ label: memberLabel(member), value: member.id }))} onChange={selectMember} placeholder={members.length > 0 ? 'Select member' : 'No active members'} />
            {selectedMember ? (
              <MobileCard compact>
                <MobileInfoRow label="Selected member" value={selectedMember.fullLegalName || 'Member'} helper={selectedMember.membershipNumber || 'No member number'} icon={UserRound} status={selectedMember.bankAccountNumber ? 'Bank ready' : 'Needs bank'} />
              </MobileCard>
            ) : null}
          </>
        )}

        {selectedBankAccount ? (
          <MobileCard compact>
            <MobileInfoRow label="Selected bank" value={selectedBankAccount.bankName || 'Bank account'} helper={selectedBankAccount.accountNumber || 'No account number'} icon={Landmark} status={isBankAccountPrimary(selectedBankAccount) ? 'Primary' : 'Selected'} />
          </MobileCard>
        ) : null}

        <MobileTextInput label="Bank name" value={form.bankName} onChangeText={(value) => updateForm('bankName', value)} placeholder="Destination bank" icon={Landmark} disabled={submitting || form.disbursementType === 'ASSOCIATION_WITHDRAWAL'} />
        <MobileTextInput label="Account number" value={form.accountNumber} onChangeText={(value) => updateForm('accountNumber', value)} placeholder="Bank account number" icon={Building2} disabled={submitting || form.disbursementType === 'ASSOCIATION_WITHDRAWAL'} />
        <MobileTextInput label="Account name" value={form.accountName} onChangeText={(value) => updateForm('accountName', value)} placeholder="Account holder name" icon={UserRound} disabled={submitting || form.disbursementType === 'ASSOCIATION_WITHDRAWAL'} />
        <MobileTextInput label="Branch" value={form.branchName} onChangeText={(value) => updateForm('branchName', value)} placeholder="Optional branch" icon={Landmark} disabled={submitting || form.disbursementType === 'ASSOCIATION_WITHDRAWAL'} />
        <MobileTextInput label="Reason" value={form.requestReason} onChangeText={(value) => updateForm('requestReason', value)} placeholder="Purpose of this disbursement" icon={Send} disabled={submitting} />

        {formTouched && validationMessage ? (
          <MobileText variant="small" tone="secondary">
            {validationMessage}
          </MobileText>
        ) : null}

        <View style={styles.actionRow}>
          <MobileButton label="Reset" variant="secondary" onPress={resetForm} disabled={submitting} style={styles.actionButton} />
          <MobileButton label="Submit" icon={Send} loading={submitting} disabled={!canSubmit} onPress={submitRequest} style={styles.actionButton} />
        </View>
      </MobileFormSection>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitle}>
          <MobileText variant="section" weight="bold">
            Disbursement requests
          </MobileText>
          <MobileText variant="small" tone="secondary">
            Showing {formatNumber(filteredRequests.length)} of {formatNumber(requests.length)} request(s)
          </MobileText>
        </View>
        <MobileReportExportButton options={disbursementReportOptions} size="sm" onError={(exportError) => setError(getApiErrorMessage(exportError))} />
      </View>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search reference, member, bank..." onFilterPress={() => setSortOpen(true)} filterLabel="Sort" />
      <MobileStatusTabs value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} tabs={statusTabs.map((tab) => ({ ...tab, count: statusCounts[tab.value] || 0 }))} />

      {listItems.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const request = filteredRequests.find((row) => row.id === item.id);
            if (request) setSelectedRequest(request);
          }}
        />
      ) : (
        <MobileEmptyState
          title={requests.length > 0 ? 'No matching requests' : 'No disbursement requests'}
          description={requests.length > 0 ? 'Clear search or status filters to review more disbursement activity.' : 'Create a request when wallet funds need to move to a bank account.'}
        />
      )}

      <MobileSortSheet visible={sortOpen} value={sortValue} options={sortOptions} onChange={(value) => setSortValue(value as SortOption)} onClose={() => setSortOpen(false)} />
      <DisbursementDetailSheet request={selectedRequest} onClose={() => setSelectedRequest(null)} onCancel={(request) => {
        setSelectedRequest(null);
        setCancelTarget(request);
      }} />
      <MobileConfirmSheet
        visible={Boolean(cancelTarget)}
        destructive
        title="Cancel disbursement?"
        description={cancelTarget ? `Cancel ${cancelTarget.referenceNumber || shortId(cancelTarget.id)} for ${formatCurrency(toNumber(cancelTarget.amount))}.` : ''}
        confirmLabel="Cancel request"
        onCancel={() => setCancelTarget(null)}
        onConfirm={cancelRequest}
      />
    </MobileScreen>
  );
}

function DisbursementDetailSheet({
  request,
  onClose,
  onCancel,
}: {
  request: DisbursementRequest | null;
  onClose: () => void;
  onCancel: (request: DisbursementRequest) => void;
}) {
  if (!request) return null;
  return (
    <MobileSheet visible title="Disbursement request" description={request.referenceNumber || shortId(request.id)} onClose={onClose}>
      <MobileInfoRow label="Amount" value={formatCurrency(toNumber(request.amount))} helper={request.requestReason || 'No request reason'} icon={Banknote} status={request.statusDisplayText || request.status || 'Pending'} />
      <MobileInfoRow label="Recipient" value={disbursementRecipientLabel(request)} helper={methodLabel(request.disbursementType)} icon={request.disbursementType === 'MEMBER_PAYOUT' ? UserRound : Building2} />
      <MobileInfoRow label="Destination" value={request.bankName || 'Bank'} helper={`${request.accountNumber || '-'} - ${request.accountName || '-'}`} icon={Landmark} />
      <MobileInfoRow label="Requested" value={formatDate(request.requestedAt)} helper={request.requestedByName || 'Requester not shown'} icon={Clock3} />
      {request.rejectionReason ? <MobileInfoRow label="Rejection reason" value={request.rejectionReason} icon={XCircle} status="Rejected" /> : null}
      {request.bankTransactionReference ? <MobileInfoRow label="Bank reference" value={request.bankTransactionReference} icon={CheckCircle2} status="Completed" /> : null}
      {request.status === 'PENDING' ? <MobileButton label="Cancel request" variant="danger" icon={XCircle} onPress={() => onCancel(request)} fullWidth /> : null}
    </MobileSheet>
  );
}

function getValidationMessage({
  form,
  amountValue,
  availableBalance,
  bankAccounts,
}: {
  form: {
    disbursementType: DisbursementType;
    memberId: string;
    bankAccountId: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  amountValue: number;
  availableBalance: number;
  bankAccounts: BankAccount[];
}) {
  if (amountValue <= 0) return 'Enter a valid disbursement amount.';
  if (amountValue < 1000) return 'Minimum disbursement amount is TZS 1,000.';
  if (amountValue > availableBalance) return 'Disbursement amount exceeds available wallet balance.';
  if (form.disbursementType === 'ASSOCIATION_WITHDRAWAL' && bankAccounts.length === 0) return 'Configure an association bank account before requesting this withdrawal.';
  if (form.disbursementType === 'ASSOCIATION_WITHDRAWAL' && !form.bankAccountId) return 'Select the association bank account.';
  if (form.disbursementType === 'MEMBER_PAYOUT' && !form.memberId) return 'Select the member receiving this payout.';
  if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountName.trim()) return 'Complete bank name, account number, and account name.';
  return null;
}

function sortRequests(rows: DisbursementRequest[], sortValue: SortOption) {
  return [...rows].sort((a, b) => {
    if (sortValue === 'amountDesc') return toNumber(b.amount) - toNumber(a.amount);
    if (sortValue === 'statusAsc') return String(a.status || '').localeCompare(String(b.status || ''));
    if (sortValue === 'typeAsc') return String(a.disbursementType || '').localeCompare(String(b.disbursementType || ''));
    const modifier = sortValue === 'dateAsc' ? 1 : -1;
    return (dateValue(a.requestedAt) - dateValue(b.requestedAt)) * modifier;
  });
}

function disbursementRecipientLabel(request: DisbursementRequest) {
  if (request.disbursementType === 'MEMBER_PAYOUT') return request.memberName || 'Member payout';
  return request.associationName || 'Association withdrawal';
}

function methodLabel(value?: string | null) {
  if (!value) return 'Unknown';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function bankAccountLabel(account: BankAccount) {
  return `${account.bankName || 'Bank'} - ${account.accountNumber || '-'}`;
}

function memberLabel(member: MemberPayoutReference) {
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
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  fullKpi: {
    flexBasis: '100%',
  },
});
