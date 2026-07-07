import { router } from 'expo-router';
import {
  Banknote,
  CalendarDays,
  CreditCard,
  Edit3,
  FileText,
  Hash,
  ReceiptText,
  RefreshCw,
  Trash2,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
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
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  deleteAssociationGeneralRevenue,
  getAssociationGeneralRevenue,
  type GeneralRevenue,
} from '@/services/general-revenue-service';
import type { KpiTone, StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';

type MobileRevenueDetailScreenProps = {
  revenueId?: string | null;
};

export default function MobileRevenueDetailScreen({ revenueId }: MobileRevenueDetailScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const [revenue, setRevenue] = useState<GeneralRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageRevenue = useMemo(() => hasRevenueManagePermission(user), [user]);
  const manageRoute = getRouteByPath('/associations/revenue/manage');
  const editRoute = getRouteByPath('/associations/revenue/:id/edit');

  const loadRevenue = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId || !revenueId) {
        setLoading(false);
        if (!revenueId) setError('Revenue context is missing.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const loaded = await getAssociationGeneralRevenue(associationId, revenueId);
        setRevenue(loaded);
      } catch (loadError) {
        setRevenue(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, revenueId],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadRevenue();
    });
    return () => {
      active = false;
    };
  }, [loadRevenue]);

  const goToManage = (selectedRevenue?: GeneralRevenue | null) => {
    if (!manageRoute) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/work/route-preview',
      params: {
        routeId: manageRoute.id,
        revenueId: selectedRevenue?.id,
        id: selectedRevenue?.id,
      },
    } as never);
  };

  const goToEdit = () => {
    if (!revenue || !editRoute) return;
    router.push({
      pathname: '/work/route-preview',
      params: {
        routeId: editRoute.id,
        revenueId: revenue.id,
        id: revenue.id,
      },
    } as never);
  };

  const deleteRevenue = async () => {
    if (!associationId || !revenue) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAssociationGeneralRevenue(associationId, revenue.id);
      setConfirmDelete(false);
      goToManage();
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Revenue details" description="Revenue details are available from the association admin workspace." />;
  }

  if (!revenueId) {
    return (
      <MobileScreen>
        <MobilePageHeader eyebrow="Financials" title="Revenue details" subtitle="Missing revenue context" onBack={() => router.back()} />
        <MobileEmptyState
          title="No revenue selected"
          description="Open this screen from the revenue list so the record ID is available."
          actionLabel="Back to revenue"
          onAction={() => goToManage()}
        />
      </MobileScreen>
    );
  }

  if (loading && !revenue) {
    return <MobilePageLoadingState kind="detail" message="Loading revenue details" />;
  }

  if (error && !revenue) {
    return (
      <MobileScreen>
        <MobilePageHeader
          eyebrow="Financials"
          title="Revenue details"
          subtitle={shortId(revenueId)}
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadRevenue('refresh')} />}
        />
        <MobileErrorState title="Revenue could not load" description={error} retryLabel="Retry" onRetry={() => void loadRevenue('refresh')} />
      </MobileScreen>
    );
  }

  if (!revenue) {
    return (
      <MobileScreen>
        <MobilePageHeader eyebrow="Financials" title="Revenue details" subtitle={shortId(revenueId)} onBack={() => router.back()} />
        <MobileEmptyState title="Revenue not found" description="The selected revenue record was not returned by the server." />
      </MobileScreen>
    );
  }

  const categoryName = revenue.revenueCategory?.name || 'Uncategorized';
  const revenueTone = toneForRevenue(revenue);
  const summaryTone = amountTone(revenue);
  const receipted = Boolean(revenue.receiptPath);

  return (
    <MobileScreen>
      <MobilePageHeader
        eyebrow="Financials"
        title="Revenue details"
        subtitle={shortId(revenue.id)}
        onBack={() => goToManage(revenue)}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh revenue"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadRevenue('refresh')}
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh failed" label={error} tone="warning" /> : null}

      <MobileDetailHeader
        eyebrow="Revenue record"
        title={categoryName}
        subtitle={`${revenue.sourceName || 'Source not recorded'} · ${formatDate(revenue.transactionDate)}`}
        avatarName={categoryName}
        avatarTone={revenueTone}
        status={receipted ? 'Receipted' : labelFromEnum(revenue.paymentMethod)}
      />

      <MobileSummaryPanel
        title="Revenue amount"
        value={formatCurrency(revenue.amount)}
        description={labelFromEnum(revenue.paymentMethod)}
        tone={summaryTone}
        icon={Banknote}
        footer={
          <View style={styles.summaryFooter}>
            <MobileStatusBadge status={categoryName} tone={revenueTone} />
            <MobileStatusBadge status={receipted ? 'Receipted' : 'No Receipt'} tone={receipted ? 'success' : 'warning'} />
          </View>
        }
      />

      <View style={styles.actions}>
        <MobileButton label="Edit" icon={Edit3} variant="secondary" onPress={goToEdit} size="sm" />
        {canManageRevenue ? (
          <MobileButton
            label="Delete"
            icon={Trash2}
            variant="danger"
            onPress={() => setConfirmDelete(true)}
            loading={deleting}
            size="sm"
          />
        ) : null}
      </View>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Transaction overview
          </MobileText>
          <MobileStatusBadge status="Revenue" tone="success" />
        </View>
        <MobileInfoRow label="Category" value={categoryName} icon={ReceiptText} status={categoryName} />
        <MobileInfoRow label="Transaction Date" value={formatDate(revenue.transactionDate)} icon={CalendarDays} />
        <MobileInfoRow label="Source" value={revenue.sourceName || 'Not recorded'} icon={UserRound} />
        <MobileInfoRow label="Payment Method" value={labelFromEnum(revenue.paymentMethod)} icon={CreditCard} />
        <MobileInfoRow label="Reference Number" value={revenue.referenceNumber || 'Not recorded'} icon={Hash} />
      </MobileCard>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Receipt evidence
          </MobileText>
          <MobileStatusBadge status={receipted ? 'Attached' : 'Missing'} tone={receipted ? 'success' : 'warning'} />
        </View>
        <MobileInfoRow
          label="Receipt Path"
          value={revenue.receiptPath || 'Not attached'}
          helper={receipted ? 'The path is preserved for the file/document pass.' : 'Attach receipt evidence when available.'}
          icon={FileText}
        />
      </MobileCard>

      {revenue.description || revenue.notes ? (
        <MobileCard compact>
          <MobileText variant="section" weight="bold">
            Description and notes
          </MobileText>
          {revenue.description ? (
            <View style={styles.copyBlock}>
              <MobileText variant="small" tone="secondary" weight="bold">
                Description
              </MobileText>
              <MobileText variant="body" tone="secondary">
                {revenue.description}
              </MobileText>
            </View>
          ) : null}
          {revenue.notes ? (
            <View style={styles.copyBlock}>
              <MobileText variant="small" tone="secondary" weight="bold">
                Notes
              </MobileText>
              <MobileText variant="body" tone="secondary">
                {revenue.notes}
              </MobileText>
            </View>
          ) : null}
        </MobileCard>
      ) : null}

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Audit metadata
          </MobileText>
          <MobileStatusBadge status="Version" label={String(revenue.version ?? 1)} tone="neutral" />
        </View>
        <MobileInfoRow label="Revenue ID" value={revenue.id} helper={shortId(revenue.id)} icon={Hash} />
        <MobileInfoRow label="Recorded By" value={revenue.recordedBy?.fullName || revenue.recordedBy?.username || 'Not recorded'} icon={UserRound} />
        <MobileInfoRow label="Created" value={formatDate(revenue.createdAt)} icon={CalendarDays} />
        <MobileInfoRow label="Updated" value={formatDate(revenue.updatedAt)} icon={CalendarDays} />
      </MobileCard>

      <MobileConfirmSheet
        visible={confirmDelete}
        title="Delete revenue record"
        description={`Delete ${categoryName} for ${formatCurrency(revenue.amount)}? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={deleteRevenue}
      />
    </MobileScreen>
  );
}

function hasRevenueManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    [
      'finance.transactions.update',
      'finance.transactions.delete',
      'finance_manage',
      'association_admin',
      'admin',
    ].includes(value),
  );
}

function toneForRevenue(revenue: GeneralRevenue): StatusTone {
  if (revenue.receiptPath) return 'success';
  if (revenue.amount >= 1_000_000) return 'paid';
  if (revenue.amount >= 250_000) return 'primary';
  if (revenue.paymentMethod) return 'info';
  return 'warning';
}

function amountTone(revenue: GeneralRevenue): KpiTone {
  if (revenue.amount >= 1_000_000) return 'green';
  if (revenue.amount >= 250_000) return 'teal';
  return 'blue';
}

function labelFromEnum(value?: string | null) {
  if (!value) return 'Not recorded';
  return value
    .toLowerCase()
    .split(/[_-]+/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function shortId(value?: string | null) {
  if (!value) return 'No ID';
  return value.length <= 12 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
}

const styles = StyleSheet.create({
  summaryFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  copyBlock: {
    gap: 4,
  },
});
