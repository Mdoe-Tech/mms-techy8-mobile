import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarDays,
  Clock3,
  FileText,
  Hash,
  ReceiptText,
  RefreshCw,
  UserRound,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDetailHeader,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileInfoRow,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import {
  formatRevenuePaymentTypes,
  getRevenueTransaction,
  getRevenueTransactionTotal,
  labelFromPaymentType,
  type RevenueTransaction,
} from '@/services/revenue-transaction-service';
import { labelFromStatus, statusToneFor } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatTzs } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type MobileRevenueTransactionDetailScreenProps = {
  transactionId?: string | null;
};

export default function MobileRevenueTransactionDetailScreen({ transactionId }: MobileRevenueTransactionDetailScreenProps) {
  const { activeView } = useAuth();
  const [transaction, setTransaction] = useState<RevenueTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTransaction = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!transactionId) {
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
        const response = await getRevenueTransaction(transactionId);
        setTransaction(response);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
        setTransaction(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [transactionId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadTransaction());
  }, [loadTransaction]);

  const paymentEntries = useMemo(() => Object.entries(transaction?.paymentDetails || {}), [transaction?.paymentDetails]);
  const metadataEntries = useMemo(() => Object.entries(transaction?.metadata || {}).filter(([, value]) => value), [transaction?.metadata]);
  const amount = transaction ? getRevenueTransactionTotal(transaction) : 0;
  const statusLabel = labelFromStatus(transaction?.paymentStatus);
  const detailRoute = getRouteByPath('/associations/revenue-transactions');
  const memberRoute = getRouteByPath('/associations/members/:memberId');

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Transaction details"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (!transactionId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Transaction details" subtitle="Missing transaction context" onBack={() => router.back()} />
        <MobileEmptyState
          title="No transaction selected"
          description="Open this screen from the transaction ledger so the record ID is available."
          actionLabel="Back to ledger"
          onAction={() =>
            detailRoute ? router.push({ pathname: '/work/route-preview', params: { routeId: detailRoute.id } } as never) : router.back()
          }
        />
      </MobileScreen>
    );
  }

  if (loading && !transaction) {
    return <MobilePageLoadingState kind="detail" message="Loading transaction receipt" />;
  }

  if (error && !transaction) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Finance"
          title="Transaction details"
          subtitle={shortId(transactionId)}
          onBack={() => router.back()}
          rightAction={
            <MobileIconButton
              icon={RefreshCw}
              label="Retry"
              variant="secondary"
              disabled={refreshing}
              onPress={() => void loadTransaction('refresh')}
            />
          }
        />
        <MobileErrorState title="Transaction could not load" description={error} retryLabel="Retry" onRetry={() => void loadTransaction('refresh')} />
      </MobileScreen>
    );
  }

  if (!transaction) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Transaction details" subtitle={shortId(transactionId)} onBack={() => router.back()} />
        <MobileEmptyState title="Transaction not found" description="The selected transaction was not returned by the server." />
      </MobileScreen>
    );
  }

  const memberName = transaction.memberFullName || transaction.membershipNumber || 'Unassigned member';

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Transaction receipt"
        subtitle={shortId(transaction.id)}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh transaction"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadTransaction('refresh')}
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh failed" label={error} tone="warning" /> : null}

      <MobileDetailHeader
        eyebrow="Revenue transaction"
        title={memberName}
        subtitle={`${formatRevenuePaymentTypes(transaction)} · ${formatDate(transaction.transactionDate || transaction.createdAt)}`}
        avatarName={memberName}
        avatarTone={statusToneFor(transaction.paymentStatus)}
        status={statusLabel}
      />

      <MobileSummaryPanel
        title="Total amount"
        value={formatTzs(amount)}
        description={`Status: ${statusLabel}`}
        tone={amountTone(transaction.paymentStatus)}
        icon={Banknote}
        footer={
          <View style={styles.summaryFooter}>
            <MobileStatusBadge status={statusLabel} tone={statusToneFor(transaction.paymentStatus)} />
            {transaction.dueDate ? <MobileStatusBadge status="Due" label={`Due ${formatDate(transaction.dueDate)}`} tone="warning" /> : null}
          </View>
        }
      />

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Payment breakdown
          </MobileText>
          <MobileStatusBadge status="Published" label={`${paymentEntries.length || 0} line${paymentEntries.length === 1 ? '' : 's'}`} tone="info" />
        </View>
        {paymentEntries.length ? (
          <View style={styles.paymentLines}>
            {paymentEntries.map(([type, value]) => (
              <View key={type} style={styles.paymentLine}>
                <View style={styles.paymentLabel}>
                  <ReceiptText size={18} strokeWidth={2.4} />
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
          <MobileEmptyState title="No payment lines" description="This transaction has no payment detail records." />
        )}
      </MobileCard>

      <MobileCard compact>
        <MobileInfoRow label="Member" value={memberName} helper={transaction.membershipNumber || 'No membership number'} icon={UserRound} />
        <MobileInfoRow label="Transaction date" value={formatDateTime(transaction.transactionDate)} icon={CalendarDays} />
        <MobileInfoRow label="Due date" value={formatDate(transaction.dueDate)} helper="Shown only when the payment has a due date." icon={Clock3} />
        <MobileInfoRow label="Transaction ID" value={transaction.id} helper={shortId(transaction.id)} icon={Hash} />
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

      <View style={styles.actions}>
        {transaction.memberId && memberRoute ? (
          <MobileButton
            label="View member"
            icon={UserRound}
            variant="secondary"
            fullWidth
            onPress={() =>
              router.push({ pathname: '/work/route-preview', params: { routeId: memberRoute.id, memberId: transaction.memberId } } as never)
            }
          />
        ) : null}
        <MobileButton
          label="Back to ledger"
          icon={ReceiptText}
          fullWidth
          onPress={() =>
            detailRoute ? router.push({ pathname: '/work/route-preview', params: { routeId: detailRoute.id } } as never) : router.back()
          }
        />
      </View>
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
  actions: {
    gap: 10,
  },
});
