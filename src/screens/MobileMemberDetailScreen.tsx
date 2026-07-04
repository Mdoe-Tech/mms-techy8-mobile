import { router } from 'expo-router';
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  Hash,
  Landmark,
  Mail,
  MapPin,
  Package,
  Phone,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  type MobileDataListItem,
  MobileDetailHeader,
  MobileDocumentCard,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileProgressBar,
  MobileScreen,
  MobileStatusBadge,
  MobileText,
} from '@/components/mobile';
import {
  getAssociationMember,
  getAssociationMemberDocuments,
  getAssociationMemberLoans,
  getAssociationMemberRevenueSummary,
  getAssociationMemberRevenueTransactions,
  type AssociationMember,
  type MemberDocument,
  type MemberLoan,
  type MemberRevenueSummary,
  type MemberRevenueTransaction,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatPercent, formatTzs } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type MobileMemberDetailScreenProps = {
  memberId?: string;
};

export default function MobileMemberDetailScreen({ memberId }: MobileMemberDetailScreenProps) {
  const { activeView, user } = useAuth();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [documents, setDocuments] = useState<MemberDocument[]>([]);
  const [summary, setSummary] = useState<MemberRevenueSummary | null>(null);
  const [transactions, setTransactions] = useState<MemberRevenueTransaction[]>([]);
  const [loans, setLoans] = useState<MemberLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  const loadMember = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!memberId) {
        setLoading(false);
        setError('Member context is missing.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setActivityError(null);

      try {
        const memberResponse = await getAssociationMember(memberId);
        setMember(memberResponse);

        const [documentResult, summaryResult, transactionResult, loanResult] = await Promise.allSettled([
          getAssociationMemberDocuments(memberId),
          getAssociationMemberRevenueSummary(memberId),
          getAssociationMemberRevenueTransactions(memberId),
          getAssociationMemberLoans(memberId),
        ]);

        if (documentResult.status === 'fulfilled') {
          setDocuments(documentResult.value);
        } else {
          setDocuments(memberResponse.documents || []);
        }

        if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
        if (transactionResult.status === 'fulfilled') setTransactions(transactionResult.value);
        if (loanResult.status === 'fulfilled') setLoans(loanResult.value);

        const failed = [documentResult, summaryResult, transactionResult, loanResult].filter((result) => result.status === 'rejected');
        if (failed.length) {
          setActivityError('Some activity sections could not refresh. Core member details are still available.');
        }
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [memberId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadMember());
  }, [loadMember]);

  const name = member ? getMemberName(member) : 'Member details';
  const phone = member?.contactInfo?.phoneNumber || '';
  const email = member?.contactInfo?.email || '';
  const totalShares = summary?.totalShares ?? sumShares(member);
  const totalShareValue = summary?.totalShareValue ?? sumShareValue(member);
  const paidTransactions = summary?.paidCount ?? transactions.filter((transaction) => normalizeStatus(transaction.paymentStatus) === 'PAID').length;
  const pendingTransactions =
    summary?.pendingCount ?? transactions.filter((transaction) => normalizeStatus(transaction.paymentStatus) === 'PENDING').length;
  const overdueTransactions =
    summary?.overdueCount ?? transactions.filter((transaction) => normalizeStatus(transaction.paymentStatus) === 'OVERDUE').length;
  const activeLoanBalance = loans.reduce((sum, loan) => sum + Number(loan.remainingBalance || 0), 0);
  const openLoans = loans.filter((loan) => !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(normalizeStatus(loan.status))).length;

  const transactionItems = useMemo<MobileDataListItem[]>(
    () =>
      transactions.slice(0, 4).map((transaction) => ({
        id: transaction.id,
        title: transaction.description || firstPaymentType(transaction.paymentDetails) || 'Revenue transaction',
        subtitle: formatDate(transaction.transactionDate),
        meta: firstPaymentType(transaction.paymentDetails) || 'Payment activity',
        amount: formatTzs(sumPaymentDetails(transaction.paymentDetails)),
        status: transaction.paymentStatus || 'Unknown',
        accent: statusAccent(transaction.paymentStatus),
      })),
    [transactions],
  );

  const loanItems = useMemo<MobileDataListItem[]>(
    () =>
      loans.slice(0, 4).map((loan) => ({
        id: loan.id,
        title: loan.purpose || 'Loan request',
        subtitle: `Requested ${formatTzs(Number(loan.requestedAmount || 0))}`,
        meta: loan.nextPaymentDueDate ? `Next due ${formatDate(loan.nextPaymentDueDate)}` : formatDate(loan.requestDate),
        amount: formatTzs(Number(loan.remainingBalance || 0)),
        status: loan.status || 'Unknown',
        accent: loan.isOverdue ? 'danger' : statusAccent(loan.status),
      })),
    [loans],
  );

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Member details"
        description="This native detail page is available for association admin workspaces only."
      />
    );
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="detail" message="Loading member details" />;
  }

  if (error && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Members"
          title="Member details"
          subtitle="Member could not be loaded"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadMember('refresh')} />}
        />
        <MobileErrorState title="Member could not load" description={error} retryLabel="Retry" onRetry={() => void loadMember('refresh')} />
      </MobileScreen>
    );
  }

  if (!member) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Members" title="Member details" onBack={() => router.back()} />
        <MobileErrorState title="Member not found" description="The selected member was not found in this association." />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Members"
        title="Member details"
        subtitle={member.associationName || user?.associationName || 'Association member'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh member"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadMember('refresh')}
          />
        }
      />

      {activityError ? <MobileStatusBadge status="Partial refresh" label={activityError} tone="warning" /> : null}

      <MobileDetailHeader
        title={name}
        subtitle={member.membershipNumber || member.employeeId || 'No membership number'}
        eyebrow={member.memberType || 'Member profile'}
        status={member.status || 'Unknown'}
        avatarName={name}
        avatarTone={statusAccent(member.status)}
      />

      <MobileCard compact>
        <MobileProgressBar value={Number(member.registrationProgress || 0)} label="Registration progress" tone="green" />
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Profile progress"
            value={formatPercent(Number(member.registrationProgress || 0))}
            description={member.status || 'Unknown status'}
            tone="green"
            icon={ShieldCheck}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Shares"
            value={formatNumber(Number(totalShares || 0))}
            description={formatTzs(Number(totalShareValue || 0))}
            tone="purple"
            icon={WalletCards}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Transactions"
            value={formatNumber(paidTransactions)}
            description={`${formatNumber(pendingTransactions)} pending · ${formatNumber(overdueTransactions)} overdue`}
            tone="blue"
            icon={ReceiptText}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Loans"
            value={formatNumber(loans.length)}
            description={`${formatNumber(openLoans)} open · ${formatTzs(activeLoanBalance)} balance`}
            tone="orange"
            icon={Landmark}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard>
        <SectionTitle title="Contact" />
        <MobileInfoRow label="Phone" value={phone || 'Not provided'} icon={Phone} />
        <MobileInfoRow label="Email" value={email || 'Not provided'} icon={Mail} />
        <MobileInfoRow label="Physical address" value={member.contactInfo?.physicalAddress || 'Not provided'} icon={MapPin} />
        <View style={styles.actions}>
          <MobileButton
            label="Call"
            icon={Phone}
            variant="secondary"
            disabled={!phone}
            style={styles.actionButton}
            onPress={() => phone && Linking.openURL(`tel:${phone}`)}
          />
          <MobileButton
            label="Email"
            icon={Mail}
            variant="secondary"
            disabled={!email}
            style={styles.actionButton}
            onPress={() => email && Linking.openURL(`mailto:${email}`)}
          />
        </View>
      </MobileCard>

      <MobileCard>
        <SectionTitle title="Membership" />
        <MobileInfoRow label="Membership number" value={member.membershipNumber || 'Not assigned'} icon={Hash} />
        <MobileInfoRow label="Member type" value={member.memberType || 'Not provided'} icon={UserRound} />
        <MobileInfoRow label="Package" value={member.packageName || 'No package'} icon={Package} />
        <MobileInfoRow label="Joined" value={formatDate(member.firstRegistrationDate || member.createdAt)} icon={CalendarDays} />
        <MobileInfoRow label="Role" value={member.associationRole || member.systemRole || 'Member'} icon={BadgeCheck} status={member.status || 'Unknown'} />
      </MobileCard>

      <MobileCard>
        <SectionTitle title="Financial overview" />
        <MobileInfoRow label="Share value" value={formatTzs(Number(totalShareValue || 0))} icon={WalletCards} helper={`${formatNumber(Number(totalShares || 0))} shares`} />
        <MobileInfoRow label="Paid transactions" value={formatNumber(paidTransactions)} icon={ReceiptText} helper={`${formatNumber(transactions.length)} total transaction records loaded`} />
        <MobileInfoRow label="Pending and overdue" value={`${formatNumber(pendingTransactions)} pending · ${formatNumber(overdueTransactions)} overdue`} icon={Banknote} />
        <MobileInfoRow label="Active loan balance" value={formatTzs(activeLoanBalance)} icon={Landmark} helper={`${formatNumber(openLoans)} open loan records`} />
      </MobileCard>

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Documents
        </MobileText>
        <MobileStatusBadge status="Documents" label={formatNumber(documents.length)} tone={documents.length ? 'primary' : 'neutral'} />
      </View>
      {documents.length ? (
        <View style={styles.stack}>
          {documents.slice(0, 4).map((document) => (
            <MobileDocumentCard
              key={document.id}
              title={document.documentName || document.originalFileName || document.fileName || document.documentType || document.type || 'Member document'}
              meta={formatDate(document.uploadedAt || document.createdAt)}
              status={document.status || 'Uploaded'}
            />
          ))}
        </View>
      ) : (
        <MobileEmptyState title="No documents" description="Uploaded member documents will appear here when available." />
      )}

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Recent transactions
        </MobileText>
        <MobileStatusBadge status="Transactions" label={formatNumber(transactions.length)} tone="primary" />
      </View>
      {transactionItems.length ? (
        <MobileDataList items={transactionItems} />
      ) : (
        <MobileEmptyState title="No transactions" description="Revenue, payment, fine, and share records will appear here when available." />
      )}

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Loans
        </MobileText>
        <MobileStatusBadge status="Loans" label={formatNumber(loans.length)} tone={openLoans ? 'warning' : 'neutral'} />
      </View>
      {loanItems.length ? (
        <MobileDataList items={loanItems} />
      ) : (
        <MobileEmptyState title="No loans" description="Loan requests and repayment records will appear here when available." />
      )}
    </MobileScreen>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <MobileText variant="section" weight="bold" style={styles.cardTitle}>
      {title}
    </MobileText>
  );
}

function getMemberName(member: AssociationMember) {
  return member.fullLegalName || getBusinessName(member) || member.contactInfo?.email || 'Unnamed member';
}

function getBusinessName(member: AssociationMember) {
  const attrs = member.customAttributes || {};
  return String(attrs.businessname || attrs.businessName || attrs.business_name || '').trim();
}

function normalizeStatus(status?: string | null) {
  return String(status || 'UNKNOWN').trim().toUpperCase();
}

function statusAccent(status?: string | null): MobileDataListItem['accent'] {
  const normalized = normalizeStatus(status);
  if (['ACTIVE', 'PAID', 'COMPLETED', 'APPROVED', 'DISBURSED'].includes(normalized)) return 'success';
  if (['PENDING', 'PARTIAL', 'UNDER_REVIEW', 'PROCESSING'].includes(normalized)) return 'warning';
  if (['OVERDUE', 'FAILED', 'REJECTED', 'CANCELLED', 'SUSPENDED', 'INACTIVE'].includes(normalized)) return 'danger';
  return 'primary';
}

function sumShares(member: AssociationMember | null) {
  return (member?.shares || []).reduce((sum, share) => sum + Number(share.shareCount || 0), 0);
}

function sumShareValue(member: AssociationMember | null) {
  return (member?.shares || []).reduce(
    (sum, share) => sum + Number(share.totalShareValue || share.currentShareValue || share.shareValue || 0),
    0,
  );
}

function sumPaymentDetails(details?: Record<string, number> | null) {
  return Object.values(details || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function firstPaymentType(details?: Record<string, number> | null) {
  const key = Object.keys(details || {})[0];
  return key ? humanize(key) : '';
}

function humanize(input: string) {
  return input
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  cardTitle: {
    marginBottom: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stack: {
    gap: 10,
  },
});
