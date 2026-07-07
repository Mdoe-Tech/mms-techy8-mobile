import { router } from 'expo-router';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Landmark,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  MobileDetailHeader,
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
  MobileSummaryPanel,
  MobileText,
  MobileTimeline,
  type MobileDataListItem,
  type MobileTimelineItem,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getMemberLoanDetails,
  getMemberLoanHistory,
  type LoanDetail,
  type LoanHistoryRecord,
  type LoanRepaymentSchedule,
  type LoanRevenueTransaction,
} from '@/services/loan-service';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import { type StatusTone, statusToneFor, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type MobileMemberLoanDetailScreenProps = {
  loanId?: string;
};

export default function MobileMemberLoanDetailScreen({ loanId }: MobileMemberLoanDetailScreenProps) {
  const { activeView, user } = useAuth();
  const userId = user?.userId;
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [history, setHistory] = useState<LoanHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLoan = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) {
        setLoading(false);
        setError('Member session is missing the user identifier.');
        return;
      }
      if (!loanId) {
        setLoading(false);
        setError('Loan identifier is missing.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [loadedMember, loadedLoan, loadedHistory] = await Promise.all([
          getCurrentMemberByUserId(userId),
          getMemberLoanDetails(loanId),
          getMemberLoanHistory(loanId),
        ]);

        if (loadedLoan.memberId && loadedLoan.memberId !== loadedMember.id) {
          throw new Error('This loan does not belong to the signed-in member.');
        }

        setMember(loadedMember);
        setLoan(loadedLoan);
        setHistory(loadedHistory || loadedLoan.histories || []);
      } catch (loadError) {
        setMember(null);
        setLoan(null);
        setHistory([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loanId, userId],
  );

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(() => loadLoan());
    }
  }, [activeView, loadLoan]);

  const metrics = useMemo(() => (loan ? buildMetrics(loan) : null), [loan]);

  if (activeView !== 'MEMBER') {
    return <AccessDeniedScreen title="Loan detail" description="This loan detail is available from the member portal workspace." />;
  }

  if (user?.associationType && user.associationType !== 'VIKOBA') {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="Loan detail"
          subtitle={user.associationName || 'Loan self-service'}
          onBack={() => router.back()}
        />
        <MobileEmptyState
          title="Loans are for VIKOBA members"
          description="This association does not use the VIKOBA loan lifecycle."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </MobileScreen>
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="detail" message="Loading loan detail" />;
  }

  if (error && !loan) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="Loan detail"
          subtitle="Loan unavailable"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry loan" variant="secondary" onPress={() => void loadLoan('refresh')} />}
        />
        <MobileErrorState title="Loan detail could not load" description={error} retryLabel="Retry" onRetry={() => void loadLoan('refresh')} />
      </MobileScreen>
    );
  }

  if (!loan || !metrics) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Member portal" title="Loan detail" onBack={() => router.back()} />
        <MobileEmptyState title="Loan not found" description="The requested loan could not be found for this member." actionLabel="Back" onAction={() => router.back()} />
      </MobileScreen>
    );
  }

  const status = loan.isOverdue ? 'Overdue' : loan.status || 'Unknown';
  const scheduleItems = buildScheduleItems(loan.repaymentSchedules || []);
  const transactionItems = buildTransactionItems(loan.transactions || []);
  const historyItems = buildHistoryItems(history);

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="Loan detail"
        subtitle={member?.associationName || user?.associationName || 'Loan self-service'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh loan detail"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadLoan('refresh')}
          />
        }
      />

      {error ? <MobileErrorState title="Some loan data could not refresh" description={error} retryLabel="Retry" onRetry={() => void loadLoan('refresh')} /> : null}

      <MobileDetailHeader
        eyebrow="Loan account"
        title={`Loan ${shortId(loan.id)}`}
        subtitle={`${loan.purpose || 'No purpose recorded'} · ${member?.membershipNumber || loan.membershipNumber || 'No membership number'}`}
        avatarName={member?.fullLegalName || loan.memberFullName || user?.fullName || 'Loan'}
        avatarTone={toneForLoan(loan)}
        status={status}
        statusTone={loan.isOverdue ? 'danger' : statusToneFor(status)}
      />

      <MobileSummaryPanel
        title="Outstanding balance"
        value={formatCurrency(metrics.remainingBalance)}
        description={`${formatCurrency(metrics.totalPaid)} paid from ${formatCurrency(metrics.requestedAmount)} requested.`}
        tone={loan.isOverdue ? 'red' : metrics.remainingBalance > 0 ? 'blue' : 'green'}
        icon={WalletCards}
        footer={
          <View style={styles.summaryFooter}>
            <MobileProgressBar value={metrics.progress} label="Repayment progress" tone={loan.isOverdue ? 'red' : metrics.progress >= 100 ? 'green' : 'blue'} />
            <MobileStatusBadge
              status={loan.nextPaymentDueDate ? 'Pending' : 'Completed'}
              label={loan.nextPaymentDueDate ? `Next due ${formatDate(loan.nextPaymentDueDate)}` : 'No due date'}
              tone={loan.nextPaymentDueDate ? 'warning' : 'success'}
            />
          </View>
        }
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Requested" value={formatCurrency(metrics.requestedAmount)} description={formatDate(loan.requestDate)} tone="blue" icon={Banknote} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Installment" value={formatCurrency(metrics.installmentAmount)} description={loan.nextPaymentDueDate ? formatDate(loan.nextPaymentDueDate) : 'No due date'} tone="orange" icon={CalendarDays} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Interest" value={`${formatNumber(metrics.interestRate)}%`} description={formatCurrency(metrics.interestAmount)} tone="purple" icon={Landmark} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Schedules" value={String(scheduleItems.length)} description={`${transactionItems.length} payment record(s)`} tone="green" icon={ReceiptText} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Loan terms
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Dates, disbursement and calculation context.
            </MobileText>
          </View>
          {refreshing ? <MobileStatusBadge status="Processing" label="Refreshing" tone="warning" /> : null}
        </View>
        <MobileInfoRow label="Request date" value={formatDate(loan.requestDate)} helper={shortId(loan.id)} icon={Clock3} />
        <MobileInfoRow label="Purpose" value={loan.purpose || 'No purpose recorded'} helper={member?.fullLegalName || loan.memberFullName || user?.fullName} icon={FileText} />
        <MobileInfoRow
          label="Disbursement"
          value={loan.disbursementDate ? formatDate(loan.disbursementDate) : 'Not disbursed'}
          helper={formatCurrency(toNumber(loan.disbursedAmount))}
          icon={WalletCards}
        />
        <MobileInfoRow
          label="Total payable"
          value={formatCurrency(metrics.totalPayable)}
          helper={loan.calculationDescription || `${formatNumber(toNumber(loan.installmentCount || loan.repaymentPeriod))} installment(s)`}
          icon={FileText}
        />
        <MobileInfoRow
          label="Last payment"
          value={loan.lastPaymentDate ? formatDate(loan.lastPaymentDate) : 'No payment recorded'}
          helper={formatCurrency(metrics.totalPaid)}
          icon={CheckCircle2}
        />
      </MobileCard>

      <MobileCard compact>
        <SectionHeader title="Repayment schedule" description={`${scheduleItems.length} scheduled installment(s).`} />
        {scheduleItems.length ? <MobileDataList items={scheduleItems} showChevron={false} /> : <InlineEmpty title="No schedule available" description="No repayment schedule has been generated for this loan yet." />}
      </MobileCard>

      <MobileCard compact>
        <SectionHeader title="Payments" description={`${transactionItems.length} payment transaction(s) linked to this loan.`} />
        {transactionItems.length ? <MobileDataList items={transactionItems} showChevron={false} /> : <InlineEmpty title="No payments yet" description="Repayments will appear here after they are recorded." />}
      </MobileCard>

      <MobileCard compact>
        <SectionHeader title="History" description={`${historyItems.length} lifecycle event(s).`} />
        {historyItems.length ? <MobileTimeline items={historyItems} /> : <InlineEmpty title="No history" description="Loan lifecycle history has not been recorded yet." />}
      </MobileCard>

      <MobileButton label="Back to loans" icon={ReceiptText} variant="secondary" onPress={() => router.back()} />
    </MobileScreen>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.flex}>
        <MobileText variant="section" weight="bold">
          {title}
        </MobileText>
        <MobileText variant="small" tone="secondary">
          {description}
        </MobileText>
      </View>
    </View>
  );
}

function InlineEmpty({ title, description }: { title: string; description: string }) {
  const theme = useNaneTheme();
  return (
    <View style={[styles.inlineEmpty, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
      <MobileText variant="body" weight="bold">
        {title}
      </MobileText>
      <MobileText variant="small" tone="secondary">
        {description}
      </MobileText>
    </View>
  );
}

function buildMetrics(loan: LoanDetail) {
  const requestedAmount = toNumber(loan.requestedAmount);
  const remainingBalance = toNumber(loan.remainingBalance);
  const totalPaid = toNumber(loan.totalPaid) || Math.max(0, requestedAmount - remainingBalance);
  const totalPayable = toNumber(loan.totalPayment) || requestedAmount + toNumber(loan.interestAmount || loan.totalInterest) + toNumber(loan.insuranceFee);
  const installmentAmount = toNumber(loan.repaymentAmount || loan.monthlyPayment);
  const progress = requestedAmount > 0 ? Math.min(100, Math.max(0, Math.round((totalPaid / requestedAmount) * 100))) : 0;

  return {
    requestedAmount,
    remainingBalance,
    totalPaid,
    totalPayable,
    installmentAmount,
    progress,
    interestRate: toNumber(loan.interestRate),
    interestAmount: toNumber(loan.interestAmount || loan.totalInterest),
  };
}

function buildScheduleItems(schedules: LoanRepaymentSchedule[]): MobileDataListItem[] {
  return schedules.map((schedule, index) => {
    const status = String(schedule.status || 'Unknown');
    const amountDue = toNumber(schedule.amountDue);
    const amountPaid = toNumber(schedule.amountPaid);
    const penalty = toNumber(schedule.penaltyAmount);

    return {
      id: schedule.id || `schedule-${index}`,
      title: `Installment ${schedule.installmentNumber || index + 1}`,
      subtitle: `Due ${formatDate(schedule.dueDate)}`,
      meta: `Paid ${formatCurrency(amountPaid)}${penalty > 0 ? ` · penalty ${formatCurrency(penalty)}` : ''}`,
      amount: formatCurrency(amountDue),
      status,
      statusTone: statusToneFor(status),
      accent: statusToneFor(status),
      initials: String(schedule.installmentNumber || index + 1).slice(0, 2),
    };
  });
}

function buildTransactionItems(transactions: LoanRevenueTransaction[]): MobileDataListItem[] {
  return transactions.map((transaction, index) => {
    const amount = totalPaymentDetails(transaction.paymentDetails);
    const status = String(transaction.paymentStatus || 'Unknown');

    return {
      id: transaction.id || `payment-${index}`,
      title: transaction.description || `Payment ${index + 1}`,
      subtitle: formatDate(transaction.transactionDate),
      meta: transaction.referenceId || transaction.referenceType || 'Loan repayment',
      amount: formatCurrency(amount),
      status,
      statusTone: statusToneFor(status),
      accent: statusToneFor(status),
      initials: 'TZ',
    };
  });
}

function buildHistoryItems(history: LoanHistoryRecord[]): MobileTimelineItem[] {
  return history.map((item, index) => {
    const title = labelFromCode(item.action || `event ${index + 1}`);
    return {
      id: item.id || `history-${index}`,
      title,
      description: item.details || undefined,
      time: formatDate(item.actionDate || item.createdAt),
      tone: toneForHistory(item.action),
      icon: iconForHistory(item.action),
    };
  });
}

function iconForHistory(action?: string | null) {
  const normalized = String(action || '').toUpperCase();
  if (normalized.includes('APPROV')) return ShieldCheck;
  if (normalized.includes('DISBURS')) return WalletCards;
  if (normalized.includes('REJECT') || normalized.includes('OVERDUE') || normalized.includes('DEFAULT')) return AlertTriangle;
  if (normalized.includes('PAY') || normalized.includes('COMPLET')) return CheckCircle2;
  return Clock3;
}

function toneForHistory(action?: string | null): StatusTone {
  const normalized = String(action || '').toUpperCase();
  if (normalized.includes('APPROV') || normalized.includes('PAY') || normalized.includes('COMPLET')) return 'success';
  if (normalized.includes('DISBURS')) return 'info';
  if (normalized.includes('REJECT') || normalized.includes('OVERDUE') || normalized.includes('DEFAULT')) return 'danger';
  if (normalized.includes('PEND') || normalized.includes('REQUEST')) return 'warning';
  return 'primary';
}

function toneForLoan(loan: LoanDetail): StatusTone {
  const status = String(loan.status || '').toUpperCase();
  if (loan.isOverdue || status === 'OVERDUE' || status === 'DEFAULTED') return 'danger';
  if (status === 'PENDING') return 'warning';
  if (status === 'APPROVED' || status === 'DISBURSED') return 'info';
  if (status === 'COMPLETED' || status === 'PAID') return 'success';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'neutral';
  return 'primary';
}

function totalPaymentDetails(details?: Record<string, number | string | null | undefined> | null): number {
  if (!details) return 0;
  return Object.values(details).reduce<number>((sum, value) => sum + toNumber(value), 0);
}

function shortId(value?: string | null) {
  return value ? value.slice(0, 8) : 'loan';
}

function toNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function labelFromCode(value?: string | null) {
  if (!value) return 'Unknown';
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  summaryFooter: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineEmpty: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
});
