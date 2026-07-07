import { router } from 'expo-router';
import {
  Banknote,
  CalendarDays,
  Copy,
  Edit3,
  FileText,
  Hash,
  ReceiptText,
  RefreshCw,
  Trash2,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useMemo, useState, useEffect } from 'react';
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
  deleteAssociationExpense,
  duplicateAssociationExpense,
  getAssociationExpense,
  type Expense,
} from '@/services/expense-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';

type MobileExpenseDetailScreenProps = {
  expenseId?: string | null;
};

type ConfirmAction = {
  kind: 'delete' | 'duplicate';
  expense: Expense;
} | null;

export default function MobileExpenseDetailScreen({ expenseId }: MobileExpenseDetailScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManageExpenses = useMemo(() => hasExpenseManagePermission(user), [user]);
  const manageRoute = getRouteByPath('/associations/expenses/manage');
  const editRoute = getRouteByPath('/associations/expenses/edit/:id');

  const loadExpense = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId || !expenseId) {
        setLoading(false);
        if (!expenseId) setError('Expense context is missing.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const loaded = await getAssociationExpense(associationId, expenseId);
        setExpense(loaded);
      } catch (loadError) {
        setExpense(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, expenseId],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadExpense();
    });
    return () => {
      active = false;
    };
  }, [loadExpense]);

  const goToManage = (selectedExpense?: Expense | null) => {
    if (!manageRoute) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/work/route-preview',
      params: {
        routeId: manageRoute.id,
        expenseId: selectedExpense?.id,
      },
    } as never);
  };

  const goToEdit = () => {
    if (!expense || !editRoute) return;
    router.push({
      pathname: '/work/route-preview',
      params: {
        routeId: editRoute.id,
        id: expense.id,
        expenseId: expense.id,
      },
    } as never);
  };

  const runConfirmedAction = async () => {
    if (!associationId || !confirmAction) return;
    const { kind, expense: selectedExpense } = confirmAction;
    setActionLoading(`${kind}:${selectedExpense.id}`);
    setError(null);
    setNotice(null);
    try {
      if (kind === 'delete') {
        await deleteAssociationExpense(associationId, selectedExpense.id);
        setConfirmAction(null);
        goToManage();
      } else {
        const duplicated = await duplicateAssociationExpense(associationId, selectedExpense.id);
        setExpense(duplicated);
        setNotice('Expense duplicated with today’s date.');
        setConfirmAction(null);
      }
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setActionLoading(null);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Expense details" description="Expense details are available from the association admin workspace." />;
  }

  if (!expenseId) {
    return (
      <MobileScreen>
        <MobilePageHeader eyebrow="Financials" title="Expense details" subtitle="Missing expense context" onBack={() => router.back()} />
        <MobileEmptyState
          title="No expense selected"
          description="Open this screen from the expense list so the record ID is available."
          actionLabel="Back to expenses"
          onAction={() => goToManage()}
        />
      </MobileScreen>
    );
  }

  if (loading && !expense) {
    return <MobilePageLoadingState kind="detail" message="Loading expense details" />;
  }

  if (error && !expense) {
    return (
      <MobileScreen>
        <MobilePageHeader
          eyebrow="Financials"
          title="Expense details"
          subtitle={shortId(expenseId)}
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadExpense('refresh')} />}
        />
        <MobileErrorState title="Expense could not load" description={error} retryLabel="Retry" onRetry={() => void loadExpense('refresh')} />
      </MobileScreen>
    );
  }

  if (!expense) {
    return (
      <MobileScreen>
        <MobilePageHeader eyebrow="Financials" title="Expense details" subtitle={shortId(expenseId)} onBack={() => router.back()} />
        <MobileEmptyState title="Expense not found" description="The selected expense was not returned by the server." />
      </MobileScreen>
    );
  }

  const categoryName = expense.expenseCategory?.name || 'Uncategorized';
  const documented = Boolean(expense.receiptPath || expense.supportingDocumentPath);
  const expenseTone = toneForExpense(expense);

  return (
    <MobileScreen>
      <MobilePageHeader
        eyebrow="Financials"
        title="Expense details"
        subtitle={shortId(expense.id)}
        onBack={() => goToManage(expense)}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh expense"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadExpense('refresh')}
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh failed" label={error} tone="warning" /> : null}
      {notice ? (
        <MobileCard compact accent="green">
          <View style={styles.noticeRow}>
            <MobileText variant="small" weight="bold" style={styles.noticeText}>
              {notice}
            </MobileText>
          </View>
        </MobileCard>
      ) : null}

      <MobileDetailHeader
        eyebrow="Expense record"
        title={categoryName}
        subtitle={`${expense.supplierName || 'Supplier not recorded'} · ${formatDate(expense.transactionDate)}`}
        avatarName={categoryName}
        avatarTone={expenseTone}
        status={documented ? 'Documented' : 'Missing Receipt'}
      />

      <MobileSummaryPanel
        title="Expense amount"
        value={formatCurrency(expense.amount)}
        description={labelFromEnum(expense.paymentMethod)}
        tone={amountTone(expense)}
        icon={Banknote}
        footer={
          <View style={styles.summaryFooter}>
            <MobileStatusBadge status={categoryName} tone={expenseTone} />
            <MobileStatusBadge status={documented ? 'Documented' : 'No Receipt'} tone={documented ? 'success' : 'warning'} />
          </View>
        }
      />

      <View style={styles.actions}>
        {canManageExpenses ? (
          <>
            <MobileButton label="Edit" icon={Edit3} variant="secondary" onPress={goToEdit} size="sm" />
            <MobileButton
              label="Duplicate"
              icon={Copy}
              variant="secondary"
              onPress={() => setConfirmAction({ kind: 'duplicate', expense })}
              loading={actionLoading === `duplicate:${expense.id}`}
              size="sm"
            />
            <MobileButton
              label="Delete"
              icon={Trash2}
              variant="danger"
              onPress={() => setConfirmAction({ kind: 'delete', expense })}
              loading={actionLoading === `delete:${expense.id}`}
              size="sm"
            />
          </>
        ) : null}
      </View>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Expense information
          </MobileText>
          <MobileStatusBadge status="Ledger" tone="primary" />
        </View>
        <MobileInfoRow label="Category" value={categoryName} icon={ReceiptText} status={categoryName} />
        <MobileInfoRow label="Transaction Date" value={formatDate(expense.transactionDate)} icon={CalendarDays} />
        <MobileInfoRow label="Supplier / Paid To" value={expense.supplierName || 'Not recorded'} icon={ReceiptText} />
        <MobileInfoRow label="Payment Method" value={labelFromEnum(expense.paymentMethod)} />
        <MobileInfoRow label="Recorded By" value={expense.recordedBy?.fullName || expense.recordedBy?.username || 'Not recorded'} icon={UserRound} />
      </MobileCard>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Supporting document
          </MobileText>
          <MobileStatusBadge status={documented ? 'Attached' : 'Missing'} tone={documented ? 'success' : 'warning'} />
        </View>
        <MobileInfoRow
          label="Document Path"
          value={expense.supportingDocumentPath || expense.receiptPath || 'Not attached'}
          helper={documented ? 'The path is preserved for the file/document pass.' : 'Attach supporting evidence when available.'}
          icon={FileText}
        />
      </MobileCard>

      {expense.description ? (
        <MobileCard compact>
          <MobileText variant="section" weight="bold">
            Description
          </MobileText>
          <MobileText variant="body" tone="secondary">
            {expense.description}
          </MobileText>
        </MobileCard>
      ) : null}

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Audit metadata
          </MobileText>
          <MobileStatusBadge status="Version" label={String(expense.version ?? 1)} tone="neutral" />
        </View>
        <MobileInfoRow label="Expense ID" value={expense.id} helper={shortId(expense.id)} icon={Hash} />
        <MobileInfoRow label="Created" value={formatDate(expense.createdAt)} icon={CalendarDays} />
        <MobileInfoRow label="Updated" value={formatDate(expense.updatedAt)} icon={CalendarDays} />
      </MobileCard>

      <MobileConfirmSheet
        visible={Boolean(confirmAction)}
        title={confirmTitle(confirmAction)}
        description={confirmDescription(confirmAction)}
        confirmLabel={confirmLabel(confirmAction, actionLoading)}
        destructive={confirmAction?.kind === 'delete'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={runConfirmedAction}
      />
    </MobileScreen>
  );
}

function hasExpenseManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    [
      'finance.transactions.create',
      'finance.transactions.update',
      'finance.transactions.delete',
      'expenses_manage',
      'finance_manage',
      'association_admin',
      'admin',
    ].includes(value),
  );
}

function toneForExpense(expense: Expense): StatusTone {
  if (expense.receiptPath || expense.supportingDocumentPath) return 'success';
  if (expense.amount >= 1_000_000) return 'danger';
  if (expense.amount >= 250_000) return 'warning';
  return 'primary';
}

function amountTone(expense: Expense) {
  if (expense.amount >= 1_000_000) return 'red';
  if (expense.amount >= 250_000) return 'orange';
  return 'blue';
}

function labelFromEnum(value?: string | null) {
  if (!value) return 'Not specified';
  if (value.includes('(')) return value.replace(/\s*\(.+\)\s*/g, '').trim();
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function shortId(value?: string | null) {
  if (!value) return 'No ID';
  return value.length <= 12 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function confirmTitle(action: ConfirmAction) {
  if (action?.kind === 'delete') return 'Delete expense';
  if (action?.kind === 'duplicate') return 'Duplicate expense';
  return 'Confirm action';
}

function confirmDescription(action: ConfirmAction) {
  if (!action) return '';
  const category = action.expense.expenseCategory?.name || 'this expense';
  if (action.kind === 'delete') return `Delete ${category} for ${formatCurrency(action.expense.amount)}? This cannot be undone.`;
  return `Create a copy of ${category} for ${formatCurrency(action.expense.amount)}? The duplicate will use today’s date and will not copy the receipt.`;
}

function confirmLabel(action: ConfirmAction, loading: string | null) {
  if (!action) return 'Confirm';
  if (loading === `${action.kind}:${action.expense.id}`) return 'Working...';
  if (action.kind === 'delete') return 'Delete';
  return 'Duplicate';
}

const styles = StyleSheet.create({
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  noticeText: {
    flex: 1,
    color: '#15803D',
  },
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
});
