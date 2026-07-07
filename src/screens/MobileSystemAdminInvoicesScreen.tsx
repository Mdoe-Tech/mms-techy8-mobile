import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Filter,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
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
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  generateNaneBillingInvoice,
  listAdminBillingSubscriptions,
  listNaneBillingInvoices,
  markNaneBillingInvoicePaid,
  markNaneBillingInvoiceUnpaid,
  type AdminBillingSubscription,
  type NaneBillingInvoice,
  type NaneBillingInvoiceStatus,
} from '@/services/system-admin-billing-service';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, initialsFromName } from '@/utils/format';
import { labelFromStatus, statusToneFor, type KpiTone, type StatusTone } from '@/theme/tokens';

type InvoiceTab = 'ALL' | NaneBillingInvoiceStatus;
type InvoiceSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'due-asc' | 'status';
type InvoiceMode = 'detail' | 'filters' | 'generate' | 'paid' | 'unpaid';
type ConfirmAction =
  | { type: 'status'; invoice: NaneBillingInvoice; action: 'paid' | 'unpaid' }
  | { type: 'generate' }
  | null;

type MobileSystemAdminInvoicesScreenProps = {
  initialStatus?: InvoiceTab;
  initialMode?: InvoiceMode;
  initialAssociationId?: string;
};

type InvoiceGenerateForm = {
  subscriptionId: string;
  issueDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  notes: string;
};

const invoiceTabs: { value: InvoiceTab; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Late' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'CANCELLED', label: 'Void' },
];

const sortOptions = [
  { value: 'date-desc', label: 'Newest first', description: 'Latest invoice issue date first.' },
  { value: 'date-asc', label: 'Oldest first', description: 'Earliest invoice issue date first.' },
  { value: 'amount-desc', label: 'Highest amount', description: 'Largest billing values first.' },
  { value: 'amount-asc', label: 'Lowest amount', description: 'Smallest billing values first.' },
  { value: 'due-asc', label: 'Due soon', description: 'Earliest due date first.' },
  { value: 'status', label: 'Status priority', description: 'Late, issued, draft, paid, then void.' },
];

const emptyGenerateForm: InvoiceGenerateForm = {
  subscriptionId: '',
  issueDate: '',
  dueDate: '',
  periodStart: '',
  periodEnd: '',
  notes: '',
};

export default function MobileSystemAdminInvoicesScreen({
  initialStatus = 'ALL',
  initialMode,
  initialAssociationId = '',
}: MobileSystemAdminInvoicesScreenProps = {}) {
  const { activeView, user } = useAuth();
  const [activeStatus, setActiveStatus] = useState<InvoiceTab>(initialStatus);
  const [selectedAssociationId, setSelectedAssociationId] = useState(initialAssociationId);
  const [rows, setRows] = useState<NaneBillingInvoice[]>([]);
  const [allRows, setAllRows] = useState<NaneBillingInvoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminBillingSubscription[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSheetOpen, setFilterSheetOpen] = useState(initialMode === 'filters');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [generateSheetOpen, setGenerateSheetOpen] = useState(initialMode === 'generate');
  const [sortValue, setSortValue] = useState<InvoiceSort>('date-desc');
  const [selectedInvoice, setSelectedInvoice] = useState<NaneBillingInvoice | null>(null);
  const [pendingAction, setPendingAction] = useState<ConfirmAction>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [generateForm, setGenerateForm] = useState<InvoiceGenerateForm>(emptyGenerateForm);
  const handledInitialModeRef = useRef(false);

  const loadInvoices = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setNotice(null);

      try {
        const [invoicePage, subscriptionPage] = await Promise.all([
          listNaneBillingInvoices({
            associationId: selectedAssociationId || undefined,
            status: activeStatus === 'ALL' ? undefined : activeStatus,
            size: 100,
          }),
          listAdminBillingSubscriptions({ size: 300 }),
        ]);
        setRows(invoicePage.content);
        setSubscriptions(subscriptionPage.content);
        setTotalElements(Math.max(invoicePage.totalElements, invoicePage.content.length));

        if (activeStatus === 'ALL' && !selectedAssociationId) {
          setAllRows(invoicePage.content);
        } else if (!allRows.length) {
          const allPage = await listNaneBillingInvoices({ size: 100 });
          setAllRows(allPage.content);
        }
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load platform invoices.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeStatus, allRows.length, selectedAssociationId],
  );

  useEffect(() => {
    if (activeView !== 'SYSTEM_ADMIN') return undefined;
    const timer = setTimeout(() => {
      void loadInvoices('initial');
    }, 0);
    return () => clearTimeout(timer);
  }, [activeView, loadInvoices]);

  useEffect(() => {
    if (handledInitialModeRef.current || loading) return undefined;
    handledInitialModeRef.current = true;
    const timer = setTimeout(() => {
      if (initialMode === 'detail' && rows[0]) setSelectedInvoice(rows[0]);
      if ((initialMode === 'paid' || initialMode === 'unpaid') && rows[0]) {
        openStatusAction(rows[0], initialMode);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [initialMode, loading, rows]);

  useEffect(() => {
    if (!generateSheetOpen || generateForm.subscriptionId || !subscriptions.length) return undefined;
    const timer = setTimeout(() => {
      const preferred = subscriptions.find((subscription) => selectedAssociationId && subscription.associationId === selectedAssociationId) || subscriptions[0];
      setGenerateForm({
        subscriptionId: preferred.id,
        issueDate: '',
        dueDate: preferred.nextInvoiceDate || '',
        periodStart: preferred.currentPeriodStart || '',
        periodEnd: preferred.currentPeriodEnd || '',
        notes: '',
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [generateForm.subscriptionId, generateSheetOpen, selectedAssociationId, subscriptions]);

  const dashboardRows = allRows.length ? allRows : rows;
  const stats = useMemo(() => aggregateInvoices(dashboardRows), [dashboardRows]);
  const associationOptions = useMemo(() => buildAssociationOptions(subscriptions, dashboardRows), [dashboardRows, subscriptions]);
  const subscriptionOptions = useMemo(() => buildSubscriptionOptions(subscriptions, selectedAssociationId), [selectedAssociationId, subscriptions]);
  const selectedSubscription = useMemo(
    () => subscriptions.find((subscription) => subscription.id === generateForm.subscriptionId) || null,
    [generateForm.subscriptionId, subscriptions],
  );
  const filteredRows = useMemo(() => filterInvoices(rows, searchTerm), [rows, searchTerm]);
  const visibleRows = useMemo(() => sortInvoices(filteredRows, sortValue), [filteredRows, sortValue]);
  const listItems = useMemo<MobileDataListItem[]>(() => visibleRows.map(invoiceListItem), [visibleRows]);
  const selectedAssociationLabel = selectedAssociationId ? associationOptions.find((option) => option.value === selectedAssociationId)?.label || 'Selected association' : 'All associations';
  const activeFilterCount = selectedAssociationId ? 1 : 0;
  const collectionRate = stats.totalAmount > 0 ? Math.round((stats.paidAmount / stats.totalAmount) * 100) : 0;
  const health = invoiceHealth(stats);
  const tabs = useMemo(
    () =>
      invoiceTabs.map((tab) => ({
        value: tab.value,
        label: tab.label,
        count: countForStatus(tab.value, stats),
      })),
    [stats],
  );

  if (activeView !== 'SYSTEM_ADMIN') {
    return <AccessDeniedScreen title="Platform invoices" description="Platform invoice reconciliation is available only to system administrators." />;
  }

  if (loading && rows.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading platform invoices" />;
  }

  if (error && rows.length === 0) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Platform billing"
          title="Platform invoices"
          subtitle="Nane subscription billing"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadInvoices('refresh')} />}
        />
        <MobileErrorState title="Invoices unavailable" description={error} retryLabel="Retry" onRetry={() => void loadInvoices('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Platform billing"
        title="Platform invoices"
        subtitle={user?.fullName ? `${user.fullName} · reconciliation` : 'Nane subscription reconciliation'}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh invoices" variant="secondary" disabled={refreshing} onPress={() => void loadInvoices('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Platform invoices" description={notice} tone="success" /> : null}

      <MobileSummaryPanel
        title={health.title}
        value={formatCurrency(stats.totalAmount)}
        description={`${formatNumber(rows.length)} of ${formatNumber(totalElements)} loaded · ${formatNumber(stats.unpaidCount)} unpaid · ${collectionRate}% collected`}
        tone={health.tone}
        icon={ReceiptText}
      />

      <MobileStatusTabs tabs={tabs} value={activeStatus} onChange={(value) => setActiveStatus(value as InvoiceTab)} />
      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Find invoices" />

      <View style={styles.actionsRow}>
        <MobileButton
          label={activeFilterCount ? 'Association 1' : 'Association'}
          icon={Filter}
          size="sm"
          variant={activeFilterCount ? 'primary' : 'secondary'}
          onPress={() => setFilterSheetOpen(true)}
        />
        <MobileButton label="Sort" icon={SlidersHorizontal} size="sm" variant="secondary" onPress={() => setSortSheetOpen(true)} />
        <MobileButton label="Export" icon={Download} size="sm" variant="secondary" loading={exporting} disabled={!visibleRows.length} onPress={() => void exportRows()} />
      </View>

      <MobileButton
        label="Generate invoice"
        icon={Plus}
        variant="primary"
        fullWidth
        disabled={!subscriptions.length}
        onPress={() => {
          seedGenerateForm();
          setGenerateSheetOpen(true);
        }}
      />

      {listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const invoice = visibleRows.find((row) => row.id === item.id);
            if (invoice) setSelectedInvoice(invoice);
          }}
        />
      ) : (
        <MobileEmptyState
          title="No platform invoices found"
          description={searchTerm || activeStatus !== 'ALL' || selectedAssociationId ? 'Adjust search, status, or association filters.' : 'Generated Nane subscription invoices will appear here for reconciliation.'}
          actionLabel={searchTerm || activeStatus !== 'ALL' || selectedAssociationId ? 'Reset filters' : undefined}
          onAction={searchTerm || activeStatus !== 'ALL' || selectedAssociationId ? resetAllFilters : undefined}
        />
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Invoices" value={formatNumber(stats.total)} description={selectedAssociationLabel} tone="blue" icon={ReceiptText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Paid" value={formatCurrency(stats.paidAmount)} description={`${formatNumber(stats.paidCount)} reconciled`} tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Unpaid" value={formatCurrency(stats.unpaidAmount)} description={`${formatNumber(stats.unpaidCount)} open`} tone={stats.unpaidCount ? 'orange' : 'slate'} icon={CreditCard} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Late" value={formatNumber(stats.overdueCount)} description="Overdue invoices" tone={stats.overdueCount ? 'red' : 'slate'} icon={CalendarDays} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      {renderDetailSheet()}
      {renderStatusActionSheet()}
      {renderGenerateSheet()}
      {renderConfirmSheet()}
      {renderFilterSheet()}
      <MobileSortSheet visible={sortSheetOpen} value={sortValue} options={sortOptions} onChange={(value) => setSortValue(value as InvoiceSort)} onClose={() => setSortSheetOpen(false)} />
    </MobileScreen>
  );

  function renderDetailSheet() {
    const invoice = selectedInvoice;
    return (
      <MobileSheet visible={Boolean(invoice)} title="Platform invoice" description={invoice?.invoiceNumber || 'Invoice details'} onClose={() => setSelectedInvoice(null)}>
        {invoice ? (
          <>
            <MobileInfoRow label="Association" value={invoice.associationName || 'Unknown association'} helper={invoice.associationType || invoice.associationId} icon={Building2} status={invoice.status} />
            <MobileInfoRow label="Plan" value={invoice.planName || 'No plan'} helper={`${invoice.billingCycle || 'Cycle'} · ${invoice.planCode || 'No code'}`} icon={FileText} />
            <MobileInfoRow label="Period" value={`${formatDate(invoice.periodStart)} to ${formatDate(invoice.periodEnd)}`} helper={`Issued ${formatDate(invoice.issueDate)} · Due ${formatDate(invoice.dueDate)}`} icon={CalendarDays} />
            <MobileInfoRow label="Amount" value={formatCurrency(toNumber(invoice.totalAmount), invoice.currency)} helper={`Subtotal ${formatCurrency(toNumber(invoice.subtotalAmount), invoice.currency)} · Tax ${formatCurrency(toNumber(invoice.taxAmount), invoice.currency)}`} icon={CreditCard} />
            {invoice.paidAt || invoice.paymentReference ? <MobileInfoRow label="Payment" value={formatDate(invoice.paidAt)} helper={invoice.paymentReference || undefined} icon={CheckCircle2} /> : null}
            {invoice.reconciliationNotes || invoice.notes ? <MobileInfoRow label="Notes" value={invoice.reconciliationNotes || invoice.notes || 'No notes'} icon={FileText} /> : null}
            {(invoice.items || []).slice(0, 3).map((item) => (
              <MobileInfoRow key={item.id || item.description} label="Line item" value={item.description || item.itemCode || 'Invoice item'} helper={`${formatNumber(toNumber(item.quantity))} × ${formatCurrency(toNumber(item.unitPrice), invoice.currency)} · ${formatCurrency(toNumber(item.totalAmount), invoice.currency)}`} icon={ReceiptText} />
            ))}
            <View style={styles.actionsRow}>
              {invoice.status === 'PAID' ? (
                <MobileButton label="Mark unpaid" icon={XCircle} variant="secondary" size="sm" onPress={() => openStatusAction(invoice, 'unpaid')} />
              ) : invoice.status !== 'CANCELLED' ? (
                <MobileButton label="Mark paid" icon={CheckCircle2} size="sm" onPress={() => openStatusAction(invoice, 'paid')} />
              ) : null}
            </View>
          </>
        ) : null}
      </MobileSheet>
    );
  }

  function renderStatusActionSheet() {
    const target = pendingAction?.type === 'status' ? pendingAction : null;
    return (
      <MobileSheet
        visible={Boolean(target)}
        title={target?.action === 'paid' ? 'Mark invoice paid' : 'Mark invoice unpaid'}
        description={target?.invoice.invoiceNumber || 'Invoice reconciliation'}
        onClose={() => {
          setPendingAction(null);
          setConfirmAction(null);
        }}
      >
        {target ? (
          <MobileFormSection title="Reconciliation note" description="Confirm the invoice and record the manual reconciliation context.">
            <MobileInfoRow label="Invoice" value={target.invoice.invoiceNumber || shortId(target.invoice.id)} helper={target.invoice.associationName} icon={ReceiptText} status={target.invoice.status} />
            <MobileInfoRow label="Amount" value={formatCurrency(toNumber(target.invoice.totalAmount), target.invoice.currency)} helper={`Due ${formatDate(target.invoice.dueDate)}`} icon={CreditCard} />
            {target.action === 'paid' ? (
              <MobileTextInput label="Payment reference" value={paymentReference} onChangeText={setPaymentReference} placeholder="Bank, M-Pesa, or manual reference" icon={CheckCircle2} />
            ) : null}
            <MobileTextInput label="Notes" value={reconciliationNotes} onChangeText={setReconciliationNotes} placeholder="Optional reconciliation note" multiline numberOfLines={3} icon={FileText} />
            <MobileButton label={target.action === 'paid' ? 'Mark paid' : 'Mark unpaid'} icon={target.action === 'paid' ? CheckCircle2 : XCircle} variant={target.action === 'paid' ? 'primary' : 'secondary'} fullWidth onPress={() => setConfirmAction(target)} />
          </MobileFormSection>
        ) : null}
      </MobileSheet>
    );
  }

  function renderGenerateSheet() {
    return (
      <MobileSheet visible={generateSheetOpen} title="Generate invoice" description="Generate the selected subscription period invoice." onClose={() => setGenerateSheetOpen(false)}>
        <MobileFormSection title="Subscription" description="Invoices are idempotent for the selected subscription period.">
          <MobileSelect
            label="Subscription"
            value={generateForm.subscriptionId}
            options={subscriptionOptions}
            onChange={(value) => {
              const subscription = subscriptions.find((item) => item.id === value);
              setGenerateForm({
                subscriptionId: value,
                issueDate: '',
                dueDate: subscription?.nextInvoiceDate || '',
                periodStart: subscription?.currentPeriodStart || '',
                periodEnd: subscription?.currentPeriodEnd || '',
                notes: '',
              });
            }}
            placeholder="Select subscription"
            helperText={subscriptionOptions.length ? 'Choose the tenant subscription to invoice.' : 'No subscriptions are available for this filter.'}
          />
          {selectedSubscription ? (
            <>
              <MobileInfoRow label="Association" value={selectedSubscription.associationName} helper={selectedSubscription.associationType || selectedSubscription.associationId} icon={Building2} status={selectedSubscription.status} />
              <MobileInfoRow label="Plan" value={selectedSubscription.plan?.name || 'No plan'} helper={`${selectedSubscription.billingCycle} · ${formatCurrency(toNumber(selectedSubscription.priceAmount), selectedSubscription.currency)}`} icon={FileText} />
            </>
          ) : null}
          <MobileTextInput label="Issue date" value={generateForm.issueDate} onChangeText={(value) => setGenerateForm((current) => ({ ...current, issueDate: value }))} placeholder="YYYY-MM-DD" icon={CalendarDays} />
          <MobileTextInput label="Due date" value={generateForm.dueDate} onChangeText={(value) => setGenerateForm((current) => ({ ...current, dueDate: value }))} placeholder="YYYY-MM-DD" icon={CalendarDays} />
          <MobileTextInput label="Period start" value={generateForm.periodStart} onChangeText={(value) => setGenerateForm((current) => ({ ...current, periodStart: value }))} placeholder="YYYY-MM-DD" icon={CalendarDays} />
          <MobileTextInput label="Period end" value={generateForm.periodEnd} onChangeText={(value) => setGenerateForm((current) => ({ ...current, periodEnd: value }))} placeholder="YYYY-MM-DD" icon={CalendarDays} />
          <MobileTextInput label="Notes" value={generateForm.notes} onChangeText={(value) => setGenerateForm((current) => ({ ...current, notes: value }))} placeholder="Optional invoice note" multiline numberOfLines={3} icon={FileText} />
          <MobileButton label="Review generation" icon={ReceiptText} fullWidth disabled={!generateForm.subscriptionId} onPress={() => setConfirmAction({ type: 'generate' })} />
        </MobileFormSection>
      </MobileSheet>
    );
  }

  function renderConfirmSheet() {
    return (
      <MobileConfirmSheet
        visible={Boolean(confirmAction)}
        title={confirmTitle(confirmAction)}
        description={confirmDescription(confirmAction, selectedSubscription)}
        confirmLabel={confirmLabel(confirmAction)}
        destructive={confirmAction?.type === 'status' && confirmAction.action === 'unpaid'}
        loading={processing}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void submitConfirmAction()}
      />
    );
  }

  function renderFilterSheet() {
    return (
      <MobileSheet visible={filterSheetOpen} title="Filter invoices" description="Filter platform invoices by tenant association." onClose={() => setFilterSheetOpen(false)}>
        <MobileFormSection title="Association" description="Status tabs still use the platform invoice status endpoint.">
          <MobileSelect label="Association" value={selectedAssociationId} options={associationOptions} onChange={setSelectedAssociationId} placeholder="All associations" />
          <View style={styles.actionsRow}>
            <MobileButton label="Reset" icon={RotateCcw} variant="secondary" onPress={() => setSelectedAssociationId('')} />
            <MobileButton label="Apply" icon={Filter} fullWidth style={styles.flexButton} onPress={() => setFilterSheetOpen(false)} />
          </View>
        </MobileFormSection>
      </MobileSheet>
    );
  }

  function openStatusAction(invoice: NaneBillingInvoice, action: 'paid' | 'unpaid') {
    setSelectedInvoice(null);
    setPaymentReference(action === 'paid' ? `Manual ${invoice.invoiceNumber}` : '');
    setReconciliationNotes('');
    setPendingAction({ type: 'status', invoice, action });
  }

  function seedGenerateForm() {
    const preferred = subscriptions.find((subscription) => selectedAssociationId && subscription.associationId === selectedAssociationId) || subscriptions[0];
    setGenerateForm(
      preferred
        ? {
            subscriptionId: preferred.id,
            issueDate: '',
            dueDate: preferred.nextInvoiceDate || '',
            periodStart: preferred.currentPeriodStart || '',
            periodEnd: preferred.currentPeriodEnd || '',
            notes: '',
          }
        : emptyGenerateForm,
    );
  }

  async function submitConfirmAction() {
    const target = confirmAction;
    if (!target) return;
    setProcessing(true);
    setError(null);
    setNotice(null);
    try {
      if (target.type === 'generate') {
        const invoice = await generateNaneBillingInvoice({
          subscriptionId: generateForm.subscriptionId,
          issueDate: generateForm.issueDate || undefined,
          dueDate: generateForm.dueDate || undefined,
          periodStart: generateForm.periodStart || undefined,
          periodEnd: generateForm.periodEnd || undefined,
          notes: generateForm.notes || undefined,
        });
        setNotice(`${invoice.invoiceNumber || 'Invoice'} generated.`);
        setGenerateSheetOpen(false);
      } else if (target.action === 'paid') {
        const invoice = await markNaneBillingInvoicePaid(target.invoice.id, {
          paymentReference: paymentReference || undefined,
          notes: reconciliationNotes || undefined,
        });
        setNotice(`${invoice.invoiceNumber || 'Invoice'} marked paid.`);
        setPendingAction(null);
      } else {
        const invoice = await markNaneBillingInvoiceUnpaid(target.invoice.id, {
          notes: reconciliationNotes || undefined,
        });
        setNotice(`${invoice.invoiceNumber || 'Invoice'} marked unpaid.`);
        setPendingAction(null);
      }
      setConfirmAction(null);
      await loadInvoices('refresh');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update platform invoice.'));
    } finally {
      setProcessing(false);
    }
  }

  async function exportRows() {
    if (!visibleRows.length) return;
    setExporting(true);
    setNotice(null);
    try {
      const csv = toCsv(visibleRows);
      const fileUri = `${FileSystem.cacheDirectory || ''}system-admin-platform-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export platform invoices' });
      } else {
        setNotice(`CSV saved to ${fileUri}`);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not export invoices.'));
    } finally {
      setExporting(false);
    }
  }

  function resetAllFilters() {
    setSearchTerm('');
    setActiveStatus('ALL');
    setSelectedAssociationId('');
  }
}

function aggregateInvoices(invoices: NaneBillingInvoice[]) {
  return invoices.reduce(
    (acc, invoice) => {
      const amount = toNumber(invoice.totalAmount);
      acc.total += 1;
      acc.totalAmount += amount;
      if (invoice.status === 'PAID') {
        acc.paidCount += 1;
        acc.paidAmount += amount;
      } else if (invoice.status !== 'CANCELLED') {
        acc.unpaidCount += 1;
        acc.unpaidAmount += amount;
      }
      if (invoice.status === 'OVERDUE') acc.overdueCount += 1;
      if (invoice.status === 'ISSUED') acc.issuedCount += 1;
      if (invoice.status === 'DRAFT') acc.draftCount += 1;
      if (invoice.status === 'CANCELLED') acc.cancelledCount += 1;
      return acc;
    },
    {
      total: 0,
      totalAmount: 0,
      paidCount: 0,
      paidAmount: 0,
      unpaidCount: 0,
      unpaidAmount: 0,
      overdueCount: 0,
      issuedCount: 0,
      draftCount: 0,
      cancelledCount: 0,
    },
  );
}

function invoiceHealth(stats: ReturnType<typeof aggregateInvoices>): { title: string; tone: KpiTone } {
  if (stats.overdueCount) return { title: 'Overdue exposure', tone: 'red' };
  if (stats.unpaidCount) return { title: 'Invoices awaiting payment', tone: 'orange' };
  if (stats.total) return { title: 'Invoices reconciled', tone: 'green' };
  return { title: 'No invoices loaded', tone: 'slate' };
}

function countForStatus(status: InvoiceTab, stats: ReturnType<typeof aggregateInvoices>) {
  if (status === 'ALL') return stats.total;
  if (status === 'PAID') return stats.paidCount;
  if (status === 'ISSUED') return stats.issuedCount;
  if (status === 'OVERDUE') return stats.overdueCount;
  if (status === 'DRAFT') return stats.draftCount;
  if (status === 'CANCELLED') return stats.cancelledCount;
  return 0;
}

function buildAssociationOptions(subscriptions: AdminBillingSubscription[], invoices: NaneBillingInvoice[]) {
  const map = new Map<string, string>();
  subscriptions.forEach((subscription) => {
    if (subscription.associationId) map.set(subscription.associationId, `${subscription.associationName} (${subscription.associationType || 'Unknown'})`);
  });
  invoices.forEach((invoice) => {
    if (invoice.associationId) map.set(invoice.associationId, `${invoice.associationName || 'Association'} (${invoice.associationType || 'Unknown'})`);
  });
  return [{ value: '', label: 'All associations' }, ...Array.from(map.entries()).map(([value, label]) => ({ value, label }))];
}

function buildSubscriptionOptions(subscriptions: AdminBillingSubscription[], associationId: string) {
  return subscriptions
    .filter((subscription) => !associationId || subscription.associationId === associationId)
    .map((subscription) => ({
      value: subscription.id,
      label: `${subscription.associationName} · ${subscription.plan?.name || 'No plan'} · ${subscription.billingCycle}`,
    }));
}

function filterInvoices(invoices: NaneBillingInvoice[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return invoices;
  return invoices.filter((invoice) =>
    [
      invoice.invoiceNumber,
      invoice.associationName,
      invoice.associationType,
      invoice.planName,
      invoice.planCode,
      invoice.status,
      invoice.paymentReference,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized)),
  );
}

function sortInvoices(invoices: NaneBillingInvoice[], sort: InvoiceSort) {
  const rows = [...invoices];
  if (sort === 'amount-desc') return rows.sort((a, b) => toNumber(b.totalAmount) - toNumber(a.totalAmount));
  if (sort === 'amount-asc') return rows.sort((a, b) => toNumber(a.totalAmount) - toNumber(b.totalAmount));
  if (sort === 'date-asc') return rows.sort((a, b) => dateValue(a.issueDate || a.createdAt) - dateValue(b.issueDate || b.createdAt));
  if (sort === 'due-asc') return rows.sort((a, b) => dateValue(a.dueDate) - dateValue(b.dueDate));
  if (sort === 'status') return rows.sort((a, b) => statusPriority(a.status) - statusPriority(b.status));
  return rows.sort((a, b) => dateValue(b.issueDate || b.createdAt) - dateValue(a.issueDate || a.createdAt));
}

function invoiceListItem(invoice: NaneBillingInvoice): MobileDataListItem {
  return {
    id: invoice.id,
    title: invoice.invoiceNumber || shortId(invoice.id),
    subtitle: `${invoice.associationName || 'Association'} · ${invoice.planName || 'Plan'}`,
    meta: `${labelFromStatus(invoice.type || 'Invoice')} · Due ${formatDate(invoice.dueDate)}`,
    amount: formatCurrency(toNumber(invoice.totalAmount), invoice.currency),
    status: invoice.status || 'ISSUED',
    statusLabel: labelFromStatus(invoice.status || 'ISSUED'),
    statusTone: invoiceStatusTone(invoice.status),
    initials: initialsFromName(invoice.associationName || invoice.invoiceNumber || 'Invoice'),
    accent: invoiceStatusTone(invoice.status),
  };
}

function invoiceStatusTone(status?: string | null): StatusTone {
  if (status === 'PAID') return 'success';
  if (status === 'OVERDUE') return 'danger';
  if (status === 'ISSUED') return 'warning';
  if (status === 'DRAFT') return 'review';
  if (status === 'CANCELLED') return 'neutral';
  return statusToneFor(status || 'Pending');
}

function statusPriority(status?: string | null) {
  if (status === 'OVERDUE') return 0;
  if (status === 'ISSUED') return 1;
  if (status === 'DRAFT') return 2;
  if (status === 'PAID') return 3;
  if (status === 'CANCELLED') return 4;
  return 5;
}

function confirmTitle(action: ConfirmAction) {
  if (!action) return 'Confirm action';
  if (action.type === 'generate') return 'Generate platform invoice';
  return action.action === 'paid' ? 'Mark invoice paid' : 'Mark invoice unpaid';
}

function confirmLabel(action: ConfirmAction) {
  if (!action) return 'Confirm';
  if (action.type === 'generate') return 'Generate';
  return action.action === 'paid' ? 'Mark paid' : 'Mark unpaid';
}

function confirmDescription(action: ConfirmAction, subscription: AdminBillingSubscription | null) {
  if (!action) return 'Confirm this platform invoice update.';
  if (action.type === 'generate') {
    return `Generate a platform invoice for ${subscription?.associationName || 'the selected subscription'}. This may create or return the current period invoice.`;
  }
  return `${confirmLabel(action)} ${action.invoice.invoiceNumber || shortId(action.invoice.id)} for ${action.invoice.associationName || 'the selected association'}.`;
}

function toCsv(rows: NaneBillingInvoice[]) {
  const header = ['Invoice', 'Association', 'Plan', 'Status', 'Type', 'Issue Date', 'Due Date', 'Period Start', 'Period End', 'Paid At', 'Currency', 'Subtotal', 'Tax', 'Total', 'Payment Reference'];
  return [header, ...rows.map((invoice) => [
    invoice.invoiceNumber,
    invoice.associationName,
    invoice.planName,
    invoice.status,
    invoice.type,
    invoice.issueDate || '',
    invoice.dueDate || '',
    invoice.periodStart || '',
    invoice.periodEnd || '',
    invoice.paidAt || '',
    invoice.currency,
    String(toNumber(invoice.subtotalAmount)),
    String(toNumber(invoice.taxAmount)),
    String(toNumber(invoice.totalAmount)),
    invoice.paymentReference || '',
  ])]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}

function csvCell(value: string) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function apiErrorMessage(error: unknown, fallback: string) {
  const message = getApiErrorMessage(error);
  return message === 'An unexpected error occurred' ? fallback : message;
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function shortId(id?: string | null) {
  return id ? id.slice(0, 8) : 'Unknown';
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  flexButton: {
    flex: 1,
  },
});
