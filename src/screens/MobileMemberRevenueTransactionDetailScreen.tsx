import { router } from 'expo-router';
import {
  Banknote,
  CalendarDays,
  Clock3,
  FileText,
  Hash,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { isSaccosAssociation } from '@/auth/association-type';
import {
  MobileButton,
  MobileCard,
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
  MobileScreen,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import {
  formatRevenuePaymentTypes,
  getMemberRevenueTransaction,
  getRevenueTransactionTotal,
  labelFromPaymentType,
  type RevenueTransaction,
} from '@/services/revenue-transaction-service';
import { labelFromStatus, statusToneFor, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs } from '@/utils/format';

type MobileMemberRevenueTransactionDetailScreenProps = {
  transactionId?: string | null;
};

export default function MobileMemberRevenueTransactionDetailScreen({ transactionId }: MobileMemberRevenueTransactionDetailScreenProps) {
  const { activeView, user } = useAuth();
  const isSaccos = isSaccosAssociation(user?.associationType);
  const theme = useNaneTheme();
  const userId = user?.userId;
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [transaction, setTransaction] = useState<RevenueTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRoute = getRouteByPath('/member/revenue-transactions');

  const loadReceipt = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!transactionId) {
        setLoading(false);
        return;
      }

      if (!userId) {
        setLoading(false);
        setError('Member session is missing the user identifier.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [loadedMember, loadedTransaction] = await Promise.all([
          getCurrentMemberByUserId(userId),
          getMemberRevenueTransaction(transactionId),
        ]);

        if (loadedTransaction.memberId && loadedMember.id && loadedTransaction.memberId !== loadedMember.id) {
          throw new Error('This receipt does not belong to the signed-in member.');
        }

        setMember(loadedMember);
        setTransaction(loadedTransaction);
      } catch (loadError) {
        setMember(null);
        setTransaction(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [transactionId, userId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadReceipt());
  }, [loadReceipt]);

  const paymentEntries = useMemo(() => Object.entries(transaction?.paymentDetails || {}), [transaction?.paymentDetails]);
  const metadataEntries = useMemo(() => Object.entries(transaction?.metadata || {}).filter(([, value]) => value), [transaction?.metadata]);
  const amount = transaction ? getRevenueTransactionTotal(transaction) : 0;
  const statusLabel = labelFromStatus(transaction?.paymentStatus);
  const memberName = transaction?.memberFullName || member?.fullLegalName || user?.fullName || 'Current member';

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Contribution receipt"
        description="This native receipt is available from the member portal workspace."
      />
    );
  }

  if (!transactionId) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="Contribution receipt"
          subtitle="Missing receipt context"
          onBack={() => router.back()}
        />
        <MobileEmptyState
          title="No receipt selected"
          description="Open a transaction from My contributions so the receipt ID is available."
          actionLabel="Back to contributions"
          onAction={() =>
            listRoute ? router.push({ pathname: '/work/route-preview', params: { routeId: listRoute.id } } as never) : router.back()
          }
        />
      </MobileScreen>
    );
  }

  if (loading && !transaction) {
    return <MobilePageLoadingState kind="detail" message="Loading contribution receipt" />;
  }

  if (error && !transaction) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="Contribution receipt"
          subtitle={shortId(transactionId)}
          onBack={() => router.back()}
          rightAction={
            <MobileIconButton
              icon={RefreshCw}
              label="Retry"
              variant="secondary"
              disabled={refreshing}
              onPress={() => void loadReceipt('refresh')}
            />
          }
        />
        <MobileErrorState title="Receipt could not load" description={error} retryLabel="Retry" onRetry={() => void loadReceipt('refresh')} />
      </MobileScreen>
    );
  }

  if (!transaction) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Member portal" title="Contribution receipt" subtitle={shortId(transactionId)} onBack={() => router.back()} />
        <MobileEmptyState title="Receipt not found" description="The selected member transaction was not returned by the server." />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="Contribution receipt"
        subtitle={shortId(transaction.id)}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh receipt"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadReceipt('refresh')}
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh failed" label={error} tone="warning" /> : null}

      <MobileDetailHeader
        eyebrow="Member transaction"
        title={formatRevenuePaymentTypes(transaction)}
        subtitle={`${memberName} · ${formatDate(transaction.transactionDate || transaction.createdAt)}`}
        avatarName={formatRevenuePaymentTypes(transaction)}
        avatarTone={statusToneFor(transaction.paymentStatus)}
        status={statusLabel}
        statusTone={statusToneFor(transaction.paymentStatus)}
      />

      <MobileSummaryPanel
        title="Receipt amount"
        value={formatTzs(amount)}
        description={`Payment status: ${statusLabel}`}
        tone={amountTone(transaction.paymentStatus)}
        icon={Banknote}
        footer={
          <View style={styles.summaryFooter}>
            <MobileStatusBadge status={statusLabel} tone={statusToneFor(transaction.paymentStatus)} />
            {transaction.dueDate ? <MobileStatusBadge status="Due" label={`Due ${formatDate(transaction.dueDate)}`} tone="warning" /> : null}
          </View>
        }
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Payment lines" value={formatNumber(paymentEntries.length)} description="Breakdown items" tone="blue" icon={ReceiptText} />
        </MobileKpiGridItem>
        {Number(transaction.paymentDetails?.SHARE_PURCHASE || 0) > 0 || Number(transaction.shareCount || 0) > 0 ? (
          <MobileKpiGridItem>
            <MobileKpiCard title={isSaccos ? 'Equity shares' : 'Shares'} value={formatNumber(transaction.shareCount || 0)} description={formatTzs(Number(transaction.totalShareValue || 0))} tone="green" icon={ShieldCheck} />
          </MobileKpiGridItem>
        ) : null}
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Payment breakdown
          </MobileText>
          <MobileStatusBadge status="Lines" label={`${paymentEntries.length || 0}`} tone="info" />
        </View>
        {paymentEntries.length ? (
          <View style={styles.paymentLines}>
            {paymentEntries.map(([type, value]) => (
              <View key={type} style={styles.paymentLine}>
                <View style={styles.paymentLabel}>
                  <ReceiptText color={theme.colors.text} size={18} strokeWidth={2.4} />
                  <MobileText variant="body" weight="bold" style={styles.paymentName}>
                    {labelFromPaymentType(type)}
                  </MobileText>
                </View>
                <MobileText variant="body" weight="bold">
                  {formatTzs(Number(value || 0))}
                </MobileText>
              </View>
            ))}
          </View>
        ) : (
          <MobileEmptyState title="No payment lines" description="This receipt has no payment detail records." />
        )}
      </MobileCard>

      <MobileCard compact>
        <MobileInfoRow label="Member" value={memberName} helper={transaction.membershipNumber || member?.membershipNumber || 'No membership number'} icon={UserRound} />
        <MobileInfoRow label="Transaction date" value={formatDateTime(transaction.transactionDate)} icon={CalendarDays} />
        <MobileInfoRow label="Due date" value={formatDate(transaction.dueDate)} helper="Shown only when the payment has a due date." icon={Clock3} />
        <MobileInfoRow label="Receipt ID" value={transaction.id} helper={shortId(transaction.id)} icon={Hash} />
        <MobileInfoRow label="Reference" value={transaction.referenceId || 'Not available'} helper={transaction.referenceType || 'No reference type'} icon={FileText} />
      </MobileCard>

      {transaction.description ? (
        <MobileCard compact>
          <MobileText variant="section" weight="bold">
            Description
          </MobileText>
          <MobileText variant="body" tone="secondary">
            {transaction.description}
          </MobileText>
        </MobileCard>
      ) : null}

      {metadataEntries.length ? (
        <MobileCard compact>
          <MobileText variant="section" weight="bold">
            Metadata
          </MobileText>
          <View>
            {metadataEntries.slice(0, 8).map(([key, value]) => (
              <MobileInfoRow key={key} label={labelFromPaymentType(key)} value={String(value || 'Not available')} icon={Hash} />
            ))}
          </View>
        </MobileCard>
      ) : null}

      <MobileButton
        label="Back to contributions"
        icon={ReceiptText}
        fullWidth
        onPress={() =>
          listRoute ? router.push({ pathname: '/work/route-preview', params: { routeId: listRoute.id } } as never) : router.back()
        }
      />
    </MobileScreen>
  );
}

function amountTone(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PAID' || normalized === 'PARTIALLY_PAID') return 'green';
  if (normalized === 'OVERDUE' || normalized === 'FAILED' || normalized === 'CANCELLED') return 'red';
  if (normalized === 'PENDING' || normalized === 'UNPAID') return 'orange';
  return 'blue';
}

function shortId(value?: string | null) {
  return value ? `${value.slice(0, 8)}...${value.slice(-4)}` : 'Not available';
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-TZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const styles = StyleSheet.create({
  summaryFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  paymentLines: {
    gap: 10,
  },
  paymentLine: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  paymentLabel: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paymentName: {
    flex: 1,
  },
});
