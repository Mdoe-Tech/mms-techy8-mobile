import { router } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAmountInput,
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileFilterControls,
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
  MobileSheet,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getAllSystemAdminAssociationMetrics,
  type SystemAdminAssociationMetricsRow,
} from '@/services/dashboard-service';
import {
  createSystemAdminBillingInvoice,
  listSystemAdminBillingInvoices,
  markSystemAdminBillingInvoicePaid,
  markSystemAdminBillingInvoiceUnpaid,
  type SystemAdminBillingInvoice,
} from '@/services/system-admin-billing-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type InvoiceFilter = 'all' | 'paid' | 'unpaid' | 'overdue' | 'cancelled';
type InitialMode = 'invoice' | 'detail';
type PendingStatusAction = {
  invoice: SystemAdminBillingInvoice;
  nextStatus: 'PAID' | 'UNPAID';
} | null;

type InvoiceFormState = {
  description: string;
  amount: string;
  dueDate: string;
  billToName: string;
  billToEmail: string;
  billToPhone: string;
  billToAddress: string;
  notes: string;
};

type MobileSystemAdminClientsScreenProps = {
  initialAssociationId?: string;
  initialMode?: InitialMode;
};

const emptyInvoiceForm: InvoiceFormState = {
  description: '',
  amount: '',
  dueDate: '',
  billToName: '',
  billToEmail: '',
  billToPhone: '',
  billToAddress: '',
  notes: '',
};

const sampleInvoiceForm: InvoiceFormState = {
  description: 'Platform service fee',
  amount: '25000',
  dueDate: '2026-07-31',
  billToName: '',
  billToEmail: '',
  billToPhone: '',
  billToAddress: '',
  notes: 'Generated from mobile route preview.',
};

export default function MobileSystemAdminClientsScreen({
  initialAssociationId,
  initialMode,
}: MobileSystemAdminClientsScreenProps = {}) {
  const { activeView } = useAuth();
  const [associations, setAssociations] = useState<SystemAdminAssociationMetricsRow[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState(initialAssociationId || '');
  const [invoices, setInvoices] = useState<SystemAdminBillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [associationPickerOpen, setAssociationPickerOpen] = useState(false);
  const [associationSearch, setAssociationSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<SystemAdminBillingInvoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(initialMode === 'invoice');
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>(() => (initialMode === 'invoice' ? sampleInvoiceForm : emptyInvoiceForm));
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof InvoiceFormState, string>>>({});
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [pendingStatusAction, setPendingStatusAction] = useState<PendingStatusAction>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const handledInitialModeRef = useRef(false);

  const selectedAssociation = useMemo(
    () => associations.find((association) => association.associationId === selectedAssociationId) || null,
    [associations, selectedAssociationId],
  );

  const loadAssociations = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const response = await getAllSystemAdminAssociationMetrics({ size: 100 });
        const rows = response.rows;
        setAssociations(rows);
        setSelectedAssociationId((current) => {
          if (current && rows.some((row) => row.associationId === current)) return current;
          return rows.find((row) => row.associationName === 'Generic Association')?.associationId || rows[0]?.associationId || '';
        });
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
        if (mode === 'initial') setAssociations([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  const loadInvoices = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!selectedAssociationId) {
        setInvoices([]);
        return;
      }
      if (mode === 'refresh') setRefreshing(true);
      setLoadingInvoices(true);
      setError(null);

      try {
        const page = await listSystemAdminBillingInvoices(selectedAssociationId, { size: 100 });
        setInvoices(page.invoices);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
        setInvoices([]);
      } finally {
        setLoadingInvoices(false);
        if (mode === 'refresh') setRefreshing(false);
      }
    },
    [selectedAssociationId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadAssociations('initial'));
  }, [loadAssociations]);

  useEffect(() => {
    if (!selectedAssociationId) return;
    void Promise.resolve().then(() => loadInvoices('initial'));
  }, [loadInvoices, selectedAssociationId]);

  useEffect(() => {
    if (handledInitialModeRef.current || loading || loadingInvoices || !invoices.length || initialMode !== 'detail') return;
    handledInitialModeRef.current = true;
    setSelectedInvoice(invoices[0]);
    setDetailOpen(true);
  }, [initialMode, invoices, loading, loadingInvoices]);

  const filteredAssociations = useMemo(() => {
    const query = associationSearch.trim().toLowerCase();
    if (!query) return associations;
    return associations.filter((association) => (
      [association.associationName, association.associationType, association.schemaName, association.adminEmail]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    ));
  }, [associationSearch, associations]);

  const invoiceStats = useMemo(() => aggregateInvoices(invoices), [invoices]);
  const invoiceTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: invoices.length },
      { value: 'paid', label: 'Paid', count: invoiceStats.paid },
      { value: 'unpaid', label: 'Unpaid', count: invoiceStats.unpaid },
      { value: 'overdue', label: 'Late', count: invoiceStats.overdue },
      { value: 'cancelled', label: 'Cancelled', count: invoiceStats.cancelled },
    ],
    [invoiceStats, invoices.length],
  );

  const filteredInvoices = useMemo(() => {
    const query = invoiceSearch.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const status = normalizeStatus(invoice.status);
      if (filter === 'paid' && status !== 'PAID') return false;
      if (filter === 'unpaid' && !isUnpaidInvoice(invoice)) return false;
      if (filter === 'overdue' && status !== 'OVERDUE') return false;
      if (filter === 'cancelled' && status !== 'CANCELLED') return false;
      if (!query) return true;
      return [
        invoice.invoiceNumber,
        invoice.billToName,
        invoice.billToEmail,
        invoice.memberName,
        invoice.type,
        invoice.status,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    });
  }, [filter, invoiceSearch, invoices]);

  const associationItems = useMemo<MobileDataListItem[]>(
    () => filteredAssociations.map((association) => ({
      id: association.associationId,
      title: association.associationName,
      subtitle: [association.associationType || 'Association', association.schemaName ? 'Workspace key available' : 'Workspace key pending'].join(' · '),
      meta: `${formatNumber(association.totalMembers)} members`,
      amount: formatCurrency(association.revenuePaidAmountTotal || association.revenuePaidAmount30d || 0),
      status: association.accountStatus || 'ACTIVE',
      statusTone: association.accountStatus === 'DISABLED' ? 'danger' : 'success',
      accent: association.accountStatus === 'DISABLED' ? 'danger' : 'primary',
    })),
    [filteredAssociations],
  );

  const invoiceItems = useMemo<MobileDataListItem[]>(
    () => filteredInvoices.map((invoice) => ({
      id: invoice.id,
      title: invoice.invoiceNumber || 'Invoice',
      subtitle: invoice.billToName || invoice.memberName || selectedAssociation?.associationName || 'Association invoice',
      meta: [invoice.type || 'GENERAL', `Due ${formatDate(invoice.dueDate)}`].join(' · '),
      amount: formatCurrency(Number(invoice.totalAmount || 0), invoice.currency || 'TZS'),
      status: invoice.status || 'ISSUED',
      statusTone: invoiceStatusTone(invoice.status),
      accent: invoiceStatusTone(invoice.status),
    })),
    [filteredInvoices, selectedAssociation?.associationName],
  );

  const openAssociation = (item: MobileDataListItem) => {
    setSelectedAssociationId(item.id);
    setAssociationPickerOpen(false);
    setSelectedInvoice(null);
    setDetailOpen(false);
    setInvoiceSearch('');
    setFilter('all');
    setInvoices([]);
  };

  const openInvoice = (item: MobileDataListItem) => {
    const invoice = invoices.find((entry) => entry.id === item.id);
    if (!invoice) return;
    setSelectedInvoice(invoice);
    setDetailOpen(true);
  };

  const openInvoiceForm = () => {
    setInvoiceForm({
      ...emptyInvoiceForm,
      billToName: selectedAssociation?.associationName || '',
    });
    setFormErrors({});
    setInvoiceFormOpen(true);
    setDetailOpen(false);
    setNotice(null);
  };

  const updateInvoiceForm = <K extends keyof InvoiceFormState>(field: K, value: InvoiceFormState[K]) => {
    setInvoiceForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setNotice(null);
  };

  const createInvoice = async () => {
    if (!selectedAssociationId) return;
    const errors = validateInvoiceForm(invoiceForm);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const amount = Number(invoiceForm.amount);
    setSavingInvoice(true);
    setError(null);
    setNotice(null);
    try {
      await createSystemAdminBillingInvoice(selectedAssociationId, {
        status: 'ISSUED',
        type: 'GENERAL',
        currency: 'TZS',
        dueDate: invoiceForm.dueDate.trim() || undefined,
        notes: invoiceForm.notes.trim() || undefined,
        billToName: invoiceForm.billToName.trim() || selectedAssociation?.associationName || undefined,
        billToEmail: invoiceForm.billToEmail.trim() || undefined,
        billToPhone: invoiceForm.billToPhone.trim() || undefined,
        billToAddress: invoiceForm.billToAddress.trim() || undefined,
        items: [{
          description: invoiceForm.description.trim(),
          quantity: 1,
          unitPrice: amount,
          totalAmount: amount,
        }],
      });
      setNotice('Invoice created.');
      setInvoiceFormOpen(false);
      setInvoiceForm(emptyInvoiceForm);
      await loadInvoices('refresh');
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setSavingInvoice(false);
    }
  };

  const confirmStatusUpdate = async () => {
    if (!pendingStatusAction || !selectedAssociationId) return;
    setUpdatingStatus(true);
    setError(null);
    setNotice(null);
    try {
      const updated = pendingStatusAction.nextStatus === 'PAID'
        ? await markSystemAdminBillingInvoicePaid(selectedAssociationId, pendingStatusAction.invoice.id)
        : await markSystemAdminBillingInvoiceUnpaid(selectedAssociationId, pendingStatusAction.invoice.id);
      setInvoices((current) => current.map((invoice) => (invoice.id === updated.id ? updated : invoice)));
      setSelectedInvoice((current) => (current?.id === updated.id ? updated : current));
      setNotice(`Invoice ${updated.invoiceNumber || ''} marked ${updated.status || pendingStatusAction.nextStatus}.`.trim());
      setPendingStatusAction(null);
    } catch (statusError) {
      setError(getApiErrorMessage(statusError));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const refreshAll = async () => {
    await loadAssociations('refresh');
    await loadInvoices('refresh');
  };

  if (activeView !== 'SYSTEM_ADMIN') {
    return <AccessDeniedScreen title="Platform clients" description="Association billing clients are available from the system admin workspace only." />;
  }

  if (loading && associations.length === 0) {
    return <MobilePageLoadingState kind="dashboard" message="Loading billing clients" />;
  }

  if (invoiceFormOpen) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Platform billing"
          title="New invoice"
          subtitle={selectedAssociation?.associationName || 'Select an association first'}
          onBack={() => setInvoiceFormOpen(false)}
        />
        {error ? <MobileErrorState title="Invoice issue" description={error} retryLabel="Dismiss" onRetry={() => setError(null)} /> : null}

        <MobileCard compact accent="blue">
          <View style={styles.summaryRow}>
            <ReceiptText color="#2563EB" size={20} />
            <View style={styles.flex}>
              <MobileText variant="body" weight="bold">
                Association invoice
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Creates an invoice inside the selected association tenant.
              </MobileText>
            </View>
            <MobileStatusBadge status="Issued" tone="primary" />
          </View>
        </MobileCard>

        <MobileFormSection title="Invoice details" description="Description, amount, due date, and optional notes.">
          <MobileTextInput
            label="Description"
            value={invoiceForm.description}
            onChangeText={(description) => updateInvoiceForm('description', description)}
            placeholder="Service fee, platform subscription"
            icon={FileText}
            error={formErrors.description}
            disabled={savingInvoice}
          />
          <MobileAmountInput
            label="Amount"
            value={invoiceForm.amount}
            onChangeText={(amount) => updateInvoiceForm('amount', amount)}
            error={formErrors.amount}
            helperText="TZS amount billed to the association."
            disabled={savingInvoice}
          />
          <MobileTextInput
            label="Due date"
            value={invoiceForm.dueDate}
            onChangeText={(dueDate) => updateInvoiceForm('dueDate', dueDate)}
            placeholder="YYYY-MM-DD"
            icon={Clock}
            keyboardType="number-pad"
            error={formErrors.dueDate}
            disabled={savingInvoice}
          />
          <MobileTextInput
            label="Notes"
            value={invoiceForm.notes}
            onChangeText={(notes) => updateInvoiceForm('notes', notes)}
            placeholder="Optional invoice note"
            icon={ReceiptText}
            disabled={savingInvoice}
            multiline
            numberOfLines={3}
          />
        </MobileFormSection>

        <MobileFormSection title="Bill-to contact" description="Defaults to the selected association and can be refined before saving.">
          <MobileTextInput
            label="Bill to"
            value={invoiceForm.billToName}
            onChangeText={(billToName) => updateInvoiceForm('billToName', billToName)}
            placeholder={selectedAssociation?.associationName || 'Bill-to name'}
            icon={Building2}
            disabled={savingInvoice}
          />
          <MobileTextInput
            label="Email"
            value={invoiceForm.billToEmail}
            onChangeText={(billToEmail) => updateInvoiceForm('billToEmail', billToEmail)}
            placeholder="billing@example.com"
            icon={Mail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={formErrors.billToEmail}
            disabled={savingInvoice}
          />
          <MobileTextInput
            label="Phone"
            value={invoiceForm.billToPhone}
            onChangeText={(billToPhone) => updateInvoiceForm('billToPhone', billToPhone)}
            placeholder="+255..."
            icon={Phone}
            keyboardType="phone-pad"
            disabled={savingInvoice}
          />
          <MobileTextInput
            label="Address"
            value={invoiceForm.billToAddress}
            onChangeText={(billToAddress) => updateInvoiceForm('billToAddress', billToAddress)}
            placeholder="Physical or postal address"
            icon={MapPin}
            disabled={savingInvoice}
            multiline
            numberOfLines={3}
          />
        </MobileFormSection>

        <View style={styles.actions}>
          <MobileButton label="Cancel" icon={ArrowLeft} variant="secondary" fullWidth disabled={savingInvoice} onPress={() => setInvoiceFormOpen(false)} />
          <MobileButton label="Create invoice" icon={Plus} fullWidth loading={savingInvoice} disabled={savingInvoice || !selectedAssociationId} onPress={() => void createInvoice()} />
        </View>
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Platform billing"
        title="Clients"
        subtitle="Association billing and invoice reconciliation"
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh"
            variant="secondary"
            disabled={refreshing || loadingInvoices}
            onPress={() => void refreshAll()}
          />
        }
      />

      {error ? <MobileErrorState title="Billing clients issue" description={error} onRetry={() => void refreshAll()} /> : null}
      {notice ? <MobileToast title={notice} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Associations" value={formatNumber(associations.length)} description="Billing tenants" icon={Building2} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Invoices" value={formatNumber(invoices.length)} description="Selected association" icon={FileText} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Paid" value={formatNumber(invoiceStats.paid)} description={formatCurrency(invoiceStats.paidAmount)} icon={CheckCircle2} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Unpaid" value={formatCurrency(invoiceStats.unpaidAmount)} description={`${formatNumber(invoiceStats.unpaid)} open invoices`} icon={Clock} tone={invoiceStats.unpaid ? 'orange' : 'slate'} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact accent="blue" style={styles.selectedCard}>
        <View style={styles.summaryRow}>
          <Building2 color="#2563EB" size={20} />
          <View style={styles.flex}>
            <MobileText variant="body" weight="bold" numberOfLines={1}>
              {selectedAssociation?.associationName || 'No association selected'}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {selectedAssociation
                ? `${selectedAssociation.associationType || 'Association'} · ${selectedAssociation.schemaName ? 'Workspace key available' : 'Workspace key pending'}`
                : 'Choose an association to view invoices.'}
            </MobileText>
          </View>
          <MobileButton label="Change" icon={Search} size="sm" variant="secondary" onPress={() => setAssociationPickerOpen(true)} />
        </View>
      </MobileCard>

      <MobileFilterControls
        searchValue={invoiceSearch}
        onSearchChange={setInvoiceSearch}
        searchPlaceholder="Find invoice"
        tabs={invoiceTabs}
        value={filter}
        onChange={(value) => setFilter(value as InvoiceFilter)}
        primaryAction={{ label: 'New invoice', icon: Plus, disabled: !selectedAssociationId, onPress: openInvoiceForm }}
      />

      {loadingInvoices ? (
        <MobilePageLoadingState kind="list" message="Loading invoices" />
      ) : invoiceItems.length === 0 ? (
        <MobileEmptyState
          title="No invoices found"
          description={invoiceSearch ? 'Adjust the search or switch invoice status.' : 'This association does not have billing invoices yet.'}
          actionLabel={selectedAssociationId ? 'New invoice' : undefined}
          onAction={selectedAssociationId ? openInvoiceForm : undefined}
        />
      ) : (
        <MobileDataList items={invoiceItems} onPressItem={openInvoice} />
      )}

      <MobileSheet visible={associationPickerOpen} title="Association clients" description="Switch the billing workspace." onClose={() => setAssociationPickerOpen(false)}>
        <MobileSearchToolbar value={associationSearch} onChange={setAssociationSearch} placeholder="Find association" />
        {associationItems.length ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
            <MobileDataList items={associationItems} onPressItem={openAssociation} />
          </ScrollView>
        ) : (
          <MobileEmptyState title="No associations found" description="Adjust the search term." />
        )}
      </MobileSheet>

      <MobileSheet
        visible={detailOpen}
        title={selectedInvoice?.invoiceNumber || 'Invoice details'}
        description={selectedInvoice?.billToName || selectedAssociation?.associationName || 'Association invoice'}
        onClose={() => setDetailOpen(false)}
      >
        {selectedInvoice ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
            <View style={styles.sheetBadges}>
              <MobileStatusBadge status={selectedInvoice.status || 'ISSUED'} tone={invoiceStatusTone(selectedInvoice.status)} />
              <MobileStatusBadge status={selectedInvoice.type || 'GENERAL'} tone="info" />
            </View>
            <MobileCard compact>
              <MobileInfoRow label="Amount" value={formatCurrency(Number(selectedInvoice.totalAmount || 0), selectedInvoice.currency || 'TZS')} icon={ReceiptText} />
              <MobileInfoRow label="Bill to" value={selectedInvoice.billToName || selectedAssociation?.associationName || 'Not recorded'} icon={Building2} />
              <MobileInfoRow label="Email" value={selectedInvoice.billToEmail || selectedInvoice.memberEmail || 'Not recorded'} icon={Mail} />
              <MobileInfoRow label="Phone" value={selectedInvoice.billToPhone || selectedInvoice.memberPhone || 'Not recorded'} icon={Phone} />
              <MobileInfoRow label="Issue date" value={formatDate(selectedInvoice.issueDate)} icon={FileText} />
              <MobileInfoRow label="Due date" value={formatDate(selectedInvoice.dueDate)} icon={Clock} />
              <MobileInfoRow label="Paid at" value={formatDate(selectedInvoice.paidAt)} icon={CheckCircle2} />
              <MobileInfoRow label="Notes" value={selectedInvoice.notes || 'Not recorded'} />
            </MobileCard>
            <View style={styles.actions}>
              {normalizeStatus(selectedInvoice.status) === 'PAID' ? (
                <MobileButton
                  label="Mark unpaid"
                  icon={XCircle}
                  variant="secondary"
                  fullWidth
                  disabled={updatingStatus || normalizeStatus(selectedInvoice.status) === 'CANCELLED'}
                  onPress={() => setPendingStatusAction({ invoice: selectedInvoice, nextStatus: 'UNPAID' })}
                />
              ) : (
                <MobileButton
                  label="Mark paid"
                  icon={CheckCircle2}
                  fullWidth
                  disabled={updatingStatus || normalizeStatus(selectedInvoice.status) === 'CANCELLED'}
                  onPress={() => setPendingStatusAction({ invoice: selectedInvoice, nextStatus: 'PAID' })}
                />
              )}
            </View>
          </ScrollView>
        ) : null}
      </MobileSheet>

      <MobileConfirmSheet
        visible={Boolean(pendingStatusAction)}
        title={pendingStatusAction?.nextStatus === 'PAID' ? 'Mark invoice paid' : 'Mark invoice unpaid'}
        description={`${pendingStatusAction?.invoice.invoiceNumber || 'This invoice'} will be marked ${pendingStatusAction?.nextStatus === 'PAID' ? 'paid' : 'unpaid'} for ${selectedAssociation?.associationName || 'the selected association'}.`}
        confirmLabel={pendingStatusAction?.nextStatus === 'PAID' ? 'Mark paid' : 'Mark unpaid'}
        loading={updatingStatus}
        onCancel={() => setPendingStatusAction(null)}
        onConfirm={() => void confirmStatusUpdate()}
      />
    </MobileScreen>
  );
}

function aggregateInvoices(invoices: SystemAdminBillingInvoice[]) {
  return invoices.reduce(
    (totals, invoice) => {
      const status = normalizeStatus(invoice.status);
      const amount = Number(invoice.totalAmount || 0);
      totals.totalAmount += amount;
      if (status === 'PAID') {
        totals.paid += 1;
        totals.paidAmount += amount;
      } else if (status === 'CANCELLED') {
        totals.cancelled += 1;
      } else {
        totals.unpaid += 1;
        totals.unpaidAmount += amount;
        if (status === 'OVERDUE') totals.overdue += 1;
      }
      return totals;
    },
    { paid: 0, unpaid: 0, overdue: 0, cancelled: 0, paidAmount: 0, unpaidAmount: 0, totalAmount: 0 },
  );
}

function validateInvoiceForm(form: InvoiceFormState) {
  const errors: Partial<Record<keyof InvoiceFormState, string>> = {};
  const amount = Number(form.amount);
  if (!form.description.trim()) errors.description = 'Description is required.';
  if (!form.amount.trim()) errors.amount = 'Amount is required.';
  else if (!Number.isFinite(amount) || amount <= 0) errors.amount = 'Enter an amount greater than zero.';
  if (form.dueDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate.trim())) errors.dueDate = 'Use YYYY-MM-DD format.';
  if (form.billToEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.billToEmail.trim())) {
    errors.billToEmail = 'Enter a valid email address.';
  }
  return errors;
}

function normalizeStatus(status?: string | null) {
  return String(status || 'ISSUED').trim().toUpperCase();
}

function isUnpaidInvoice(invoice: SystemAdminBillingInvoice) {
  const status = normalizeStatus(invoice.status);
  return status !== 'PAID' && status !== 'CANCELLED';
}

function invoiceStatusTone(status?: string | null): StatusTone {
  const normalized = normalizeStatus(status);
  if (normalized === 'PAID') return 'success';
  if (normalized === 'CANCELLED') return 'danger';
  if (normalized === 'OVERDUE') return 'warning';
  if (normalized === 'DRAFT') return 'neutral';
  return 'primary';
}

const styles = StyleSheet.create({
  selectedCard: {
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  sheetScroll: {
    gap: 12,
    paddingBottom: 16,
  },
  sheetBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actions: {
    gap: 10,
  },
});
