import { router, useLocalSearchParams } from 'expo-router';
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  FileText,
  Plus,
  ReceiptText,
  RefreshCw,
  Send,
  Share2,
  Trash2,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAmountInput,
  MobileButton,
  MobileCard,
  MobileCheckboxRow,
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
  MobileReportExportButton,
  MobileScreen,
  MobileSelect,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAssociationClients, type AssociationClient } from '@/services/client-service';
import {
  cancelAssociationInvoice,
  createAssociationInvoice,
  createInvoicePaymentLink,
  deleteAssociationInvoice,
  generateBulkVefdReceipts,
  generateVefdReceiptForTransaction,
  getAssociationInvoices,
  getInvoice,
  issueAssociationInvoice,
  updateAssociationInvoice,
  type Invoice,
  type InvoiceItem,
} from '@/services/invoice-service';
import { getAllAssociationMembers, type AssociationMember } from '@/services/member-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, initialsFromName } from '@/utils/format';

type InvoiceFilter = 'ALL' | 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
type SortOption = 'createdDesc' | 'dueAsc' | 'amountDesc' | 'statusAsc' | 'numberAsc';
type FormMode = 'create' | 'edit' | null;
type BillingMode = 'member' | 'client' | 'manual';

type InvoiceFormState = {
  description: string;
  amount: string;
  dueDate: string;
  notes: string;
  billingMode: BillingMode;
  memberSearch: string;
  selectedMemberIds: string[];
  selectedClientId: string;
  billToName: string;
  billToEmail: string;
  billToPhone: string;
  billToAddress: string;
  billToTin: string;
  billToVrn: string;
};

const PAGE_SIZE = 1000;

const sortOptions = [
  { value: 'createdDesc', label: 'Newest invoices', description: 'Recently created invoices first.' },
  { value: 'dueAsc', label: 'Due date', description: 'Earliest due dates first.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest invoice totals first.' },
  { value: 'statusAsc', label: 'Status', description: 'Group invoices by status.' },
  { value: 'numberAsc', label: 'Invoice number', description: 'Smallest invoice number first.' },
];

const emptyForm = (): InvoiceFormState => ({
  description: '',
  amount: '',
  dueDate: '',
  notes: '',
  billingMode: 'member',
  memberSearch: '',
  selectedMemberIds: [],
  selectedClientId: '',
  billToName: '',
  billToEmail: '',
  billToPhone: '',
  billToAddress: '',
  billToTin: '',
  billToVrn: '',
});

export default function MobileAssociationInvoicesScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const initialMode = firstParam(params.mode);
  const initialInvoiceId = firstParam(params.invoiceId) || firstParam(params.id);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [clients, setClients] = useState<AssociationClient[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(() => (initialMode === 'create' ? 'create' : null));
  const [form, setForm] = useState<InvoiceFormState>(() => emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InvoiceFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('createdDesc');
  const [sortOpen, setSortOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialDetailConsumed = useRef(false);

  const canManageInvoices = useMemo(() => hasInvoiceManagePermission(user), [user]);
  const detailRoute = getRouteByPath('/associations/invoices/:id');

  const loadInvoices = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);

      setError(null);
      try {
        const [invoicePage, memberPage, clientPage] = await Promise.all([
          getAssociationInvoices({ size: PAGE_SIZE, sort: 'createdAt,desc' }),
          getAllAssociationMembers(associationId, { size: 250 }),
          getAssociationClients({ size: 100, sort: 'name,asc' }),
        ]);
        setInvoices((invoicePage.content || []).filter((invoice) => Boolean(invoice?.id)));
        setMembers(memberPage.content || []);
        setClients(clientPage.clients || []);
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
    void Promise.resolve().then(() => loadInvoices());
  }, [loadInvoices]);

  const openInvoice = useCallback(
    async (invoiceId: string) => {
      setError(null);
      const shallow = invoices.find((invoice) => invoice.id === invoiceId) || null;
      setSelectedInvoice(shallow);
      setDetailOpen(true);
      try {
        setSelectedInvoice(await getInvoice(invoiceId));
      } catch (openError) {
        setError(getApiErrorMessage(openError));
      }
    },
    [invoices],
  );

  useEffect(() => {
    if (!initialInvoiceId || initialDetailConsumed.current || invoices.length === 0) return;
    const invoice = invoices.find((item) => item.id === initialInvoiceId);
    if (!invoice) return;
    initialDetailConsumed.current = true;
    const timer = setTimeout(() => {
      void openInvoice(invoice.id);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialInvoiceId, invoices, openInvoice]);

  const metrics = useMemo(() => {
    const paid = invoices.filter((invoice) => normalizeStatus(invoice.status) === 'PAID');
    const open = invoices.filter((invoice) => !['PAID', 'CANCELLED', 'CANCELED'].includes(normalizeStatus(invoice.status)));
    const overdue = invoices.filter((invoice) => isInvoiceOverdue(invoice));
    return {
      total: invoices.length,
      paid: paid.length,
      open: open.length,
      overdue: overdue.length,
      totalAmount: invoices.reduce((sum, invoice) => sum + moneyNumber(invoice.totalAmount), 0),
      outstanding: open.reduce((sum, invoice) => sum + moneyNumber(invoice.totalAmount), 0),
    };
  }, [invoices]);

  const tabs = useMemo(() => {
    const counts = new Map<string, number>();
    invoices.forEach((invoice) => counts.set(normalizeStatus(invoice.status), (counts.get(normalizeStatus(invoice.status)) || 0) + 1));
    return [
      { value: 'ALL', label: 'All', count: invoices.length },
      { value: 'ISSUED', label: 'Issued', count: counts.get('ISSUED') || 0 },
      { value: 'PAID', label: 'Paid', count: counts.get('PAID') || 0 },
      { value: 'OVERDUE', label: 'Overdue', count: metrics.overdue },
      { value: 'DRAFT', label: 'Draft', count: counts.get('DRAFT') || 0 },
      { value: 'CANCELLED', label: 'Cancelled', count: (counts.get('CANCELLED') || 0) + (counts.get('CANCELED') || 0) },
    ].filter((tab) => tab.value === 'ALL' || tab.count > 0);
  }, [invoices, metrics.overdue]);

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices
      .filter((invoice) => {
        const status = normalizeStatus(invoice.status);
        const statusMatches =
          filter === 'ALL' ||
          status === filter ||
          (filter === 'OVERDUE' && isInvoiceOverdue(invoice)) ||
          (filter === 'CANCELLED' && status === 'CANCELED');
        if (!statusMatches) return false;
        if (!term) return true;
        return [
          invoice.invoiceNumber,
          invoice.memberName,
          invoice.membershipNumber,
          invoice.memberEmail,
          invoice.billToName,
          invoice.billToEmail,
          invoice.type,
          invoice.status,
          invoice.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .sort((left, right) => compareInvoices(left, right, sortBy));
  }, [filter, invoices, search, sortBy]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredInvoices.map((invoice) => ({
        id: invoice.id,
        title: invoice.invoiceNumber || 'Invoice',
        subtitle: `${billToLabel(invoice)} · Due ${formatDate(invoice.dueDate || invoice.issueDate)}`,
        meta: `${labelFromEnum(invoice.type || 'GENERAL')} · ${invoice.memberCount ? `${formatNumber(invoice.memberCount)} members` : invoice.membershipNumber || 'No member ref'}`,
        amount: formatMoney(invoice.totalAmount, invoice.currency),
        status: isInvoiceOverdue(invoice) && normalizeStatus(invoice.status) !== 'PAID' ? 'Overdue' : invoice.status || 'Draft',
        statusTone: invoiceTone(invoice),
        initials: initialsFromName(billToLabel(invoice) || invoice.invoiceNumber || 'IN'),
        accent: invoiceTone(invoice),
      })),
    [filteredInvoices],
  );

  const invoiceReportOptions = useMemo(
    () => ({
      title: 'Association Invoices',
      associationName: user?.associationName || 'Association',
      purpose: 'A current-view report of invoices, billing recipients, payment status, due dates, and totals.',
      rows: filteredInvoices,
      fileName: 'nane-association-invoices',
      metrics: [
        { label: 'Total invoiced', value: formatMoney(metrics.totalAmount), helper: `${formatNumber(metrics.total)} invoices` },
        { label: 'Outstanding', value: formatMoney(metrics.outstanding), helper: `${formatNumber(metrics.open)} open invoices` },
        { label: 'Paid', value: formatNumber(metrics.paid), helper: 'Paid invoices' },
        { label: 'Overdue', value: formatNumber(metrics.overdue), helper: 'Past due and unpaid' },
      ],
      filters: [
        { label: 'Search', value: search || 'All' },
        { label: 'Status', value: tabs.find((tab) => tab.value === filter)?.label || filter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortBy)?.label || sortBy },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: Invoice, index: number) => index + 1 },
        { key: 'invoiceNumber', label: 'Invoice No.', width: '13%', value: (row: Invoice) => row.invoiceNumber || '-' },
        { key: 'status', label: 'Status', width: '10%', value: (row: Invoice) => (isInvoiceOverdue(row) && normalizeStatus(row.status) !== 'PAID' ? 'Overdue' : row.status || 'Draft') },
        { key: 'billTo', label: 'Bill To', width: '18%', value: (row: Invoice) => billToLabel(row) },
        { key: 'membershipNumber', label: 'Membership No.', width: '12%', value: (row: Invoice) => row.membershipNumber || '-' },
        { key: 'issueDate', label: 'Issue Date', width: '11%', value: (row: Invoice) => formatDate(row.issueDate || row.createdAt) },
        { key: 'dueDate', label: 'Due Date', width: '11%', value: (row: Invoice) => formatDate(row.dueDate) },
        { key: 'paidAt', label: 'Paid At', width: '11%', value: (row: Invoice) => formatDate(row.paidAt) },
        { key: 'type', label: 'Type', width: '11%', value: (row: Invoice) => labelFromEnum(row.type || 'GENERAL') },
        { key: 'totalAmount', label: 'Total', align: 'right' as const, width: '12%', value: (row: Invoice) => formatMoney(row.totalAmount, row.currency) },
      ],
    }),
    [filter, filteredInvoices, metrics, search, sortBy, tabs, user?.associationName],
  );

  const eligibleReceiptInvoices = useMemo(
    () => invoices.filter((invoice) => isReceiptEligible(invoice) && selectedReceiptIds.includes(invoice.id)),
    [invoices, selectedReceiptIds],
  );

  const memberSearchResults = useMemo(() => {
    const term = form.memberSearch.trim().toLowerCase();
    if (form.billingMode !== 'member' || term.length < 2) return [];
    return members
      .filter((member) => !form.selectedMemberIds.includes(member.id))
      .filter((member) =>
        [
          member.fullLegalName,
          member.membershipNumber,
          member.employeeId,
          member.contactInfo?.email,
          member.contactInfo?.phoneNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 8);
  }, [form.billingMode, form.memberSearch, form.selectedMemberIds, members]);

  const selectedMembers = useMemo(
    () => members.filter((member) => form.selectedMemberIds.includes(member.id)),
    [form.selectedMemberIds, members],
  );

  const selectedClient = clients.find((client) => client.id === form.selectedClientId);

  const openCreate = () => {
    setForm(emptyForm());
    setErrors({});
    setNotice(null);
    setError(null);
    setSelectedInvoice(null);
    setDetailOpen(false);
    setFormMode('create');
  };

  const openEdit = (invoice: Invoice) => {
    setForm(formFromInvoice(invoice));
    setErrors({});
    setNotice(null);
    setError(null);
    setSelectedInvoice(invoice);
    setDetailOpen(false);
    setFormMode('edit');
  };

  const updateForm = <K extends keyof InvoiceFormState>(field: K, value: InvoiceFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const selectClient = (clientId: string) => {
    const client = clients.find((item) => item.id === clientId);
    updateForm('selectedClientId', clientId);
    if (client) {
      setForm((current) => ({
        ...current,
        selectedClientId: clientId,
        billToName: client.name,
        billToEmail: client.email || '',
        billToPhone: client.phoneNumber || '',
        billToAddress: client.address || '',
        billToTin: client.tin || '',
        billToVrn: client.vrn || '',
      }));
    }
  };

  const saveInvoice = async () => {
    if (!canManageInvoices) return;
    const validation = validateForm(form, formMode);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      setError('Please correct the highlighted invoice fields before saving.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const amount = moneyNumber(form.amount);
      const items: InvoiceItem[] = [
        {
          description: form.description.trim(),
          quantity: 1,
          unitPrice: amount,
          netAmount: amount,
          taxAmount: 0,
          totalAmount: amount,
        },
      ];

      const payload = {
        type: 'GENERAL',
        status: 'ISSUED',
        currency: 'TZS',
        dueDate: textOrNull(form.dueDate),
        notes: textOrNull(form.notes),
        items,
        memberId: form.billingMode === 'member' && form.selectedMemberIds.length === 1 ? form.selectedMemberIds[0] : undefined,
        memberIds: form.billingMode === 'member' && form.selectedMemberIds.length > 1 ? form.selectedMemberIds : undefined,
        isConsolidated: form.billingMode === 'member' && form.selectedMemberIds.length > 1,
        billToName: form.billingMode === 'member' ? undefined : textOrNull(form.billToName),
        billToEmail: form.billingMode === 'member' ? undefined : textOrNull(form.billToEmail),
        billToPhone: form.billingMode === 'member' ? undefined : textOrNull(form.billToPhone),
        billToAddress: form.billingMode === 'member' ? undefined : textOrNull(form.billToAddress),
        billToTin: form.billingMode === 'member' ? undefined : textOrNull(form.billToTin),
        billToVrn: form.billingMode === 'member' ? undefined : textOrNull(form.billToVrn),
      };

      const saved =
        formMode === 'edit' && selectedInvoice
          ? await updateAssociationInvoice(selectedInvoice.id, {
              dueDate: textOrNull(form.dueDate),
              notes: textOrNull(form.notes),
              billToName: textOrNull(form.billToName),
              billToEmail: textOrNull(form.billToEmail),
              billToPhone: textOrNull(form.billToPhone),
              billToAddress: textOrNull(form.billToAddress),
              billToTin: textOrNull(form.billToTin),
              billToVrn: textOrNull(form.billToVrn),
            })
          : await createAssociationInvoice(payload);

      setNotice(`Invoice ${saved.invoiceNumber || ''} saved successfully.`.trim());
      setSelectedInvoice(saved);
      setFormMode(null);
      await loadInvoices('refresh');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const sharePaymentLink = async (invoice: Invoice) => {
    setWorkingId(invoice.id);
    setError(null);
    setNotice(null);
    try {
      const response = await createInvoicePaymentLink(invoice.id);
      if (!response.link) {
        setError('The server did not return a payment link.');
        return;
      }
      await Share.share({ title: invoice.invoiceNumber || 'Invoice payment link', message: response.link, url: response.link });
      setNotice('Payment link is ready to share.');
    } catch (linkError) {
      setError(getApiErrorMessage(linkError));
    } finally {
      setWorkingId(null);
    }
  };

  const issueInvoice = async (invoice: Invoice) => {
    setWorkingId(invoice.id);
    setError(null);
    try {
      const updated = await issueAssociationInvoice(invoice.id);
      setSelectedInvoice(updated);
      setNotice(`${updated.invoiceNumber || 'Invoice'} issued.`);
      await loadInvoices('refresh');
    } catch (issueError) {
      setError(getApiErrorMessage(issueError));
    } finally {
      setWorkingId(null);
    }
  };

  const cancelInvoice = async () => {
    if (!cancelTarget) return;
    setWorkingId(cancelTarget.id);
    setError(null);
    try {
      const updated = await cancelAssociationInvoice(cancelTarget.id);
      setCancelTarget(null);
      setSelectedInvoice(updated);
      setNotice(`${updated.invoiceNumber || 'Invoice'} cancelled.`);
      await loadInvoices('refresh');
    } catch (cancelError) {
      setError(getApiErrorMessage(cancelError));
    } finally {
      setWorkingId(null);
    }
  };

  const deleteInvoice = async () => {
    if (!deleteTarget) return;
    setWorkingId(deleteTarget.id);
    setError(null);
    try {
      await deleteAssociationInvoice(deleteTarget.id);
      setNotice(`${deleteTarget.invoiceNumber || 'Invoice'} deleted.`);
      setDeleteTarget(null);
      setSelectedInvoice(null);
      setDetailOpen(false);
      await loadInvoices('refresh');
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setWorkingId(null);
    }
  };

  const generateReceipt = async (invoice: Invoice) => {
    if (!invoice.revenueTransactionId) {
      setError('This invoice has no linked paid transaction.');
      return;
    }

    setWorkingId(invoice.id);
    setError(null);
    try {
      await generateVefdReceiptForTransaction(invoice.revenueTransactionId);
      setNotice(`VFD receipt generated for ${invoice.invoiceNumber || 'invoice'}.`);
      await loadInvoices('refresh');
      setSelectedInvoice(await getInvoice(invoice.id));
    } catch (receiptError) {
      setError(getApiErrorMessage(receiptError));
    } finally {
      setWorkingId(null);
    }
  };

  const generateSelectedReceipts = async () => {
    const transactionIds = eligibleReceiptInvoices
      .map((invoice) => invoice.revenueTransactionId)
      .filter((value): value is string => Boolean(value));
    if (transactionIds.length === 0) {
      setError('Select paid invoices with linked transactions before generating VFD receipts.');
      return;
    }

    setBulkProcessing(true);
    setError(null);
    try {
      const result = await generateBulkVefdReceipts(transactionIds);
      setNotice(`VFD bulk generation finished: ${formatNumber(Number(result.success || 0))} success, ${formatNumber(Number(result.failed || 0))} failed.`);
      setSelectedReceiptIds([]);
      await loadInvoices('refresh');
    } catch (bulkError) {
      setError(getApiErrorMessage(bulkError));
    } finally {
      setBulkProcessing(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association invoices" description="This native page is available for association admin workspaces only." />;
  }

  if (loading && invoices.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading association invoices" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Billing" title="Association invoices" subtitle="Association context unavailable" />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before opening invoices." />
      </MobileScreen>
    );
  }

  if (error && invoices.length === 0) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Billing"
          title="Association invoices"
          subtitle="Could not load invoice register"
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadInvoices('refresh')} />}
        />
        <MobileErrorState title="Invoices could not load" description={error} retryLabel="Retry" onRetry={() => void loadInvoices('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Billing"
        title="Association invoices"
        subtitle={`${formatNumber(invoices.length)} invoices · ${formatMoney(metrics.outstanding)} outstanding`}
        onBack={() => router.back()}
        rightAction={canManageInvoices ? <MobileButton label="New" icon={Plus} size="sm" onPress={openCreate} /> : undefined}
      />

      {notice ? <MobileToast title={notice} tone="success" /> : null}
      {error ? <MobileToast title="Invoice action failed" description={error} tone="danger" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total invoiced" value={formatMoney(metrics.totalAmount)} description={`${formatNumber(metrics.total)} invoices`} icon={ReceiptText} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Outstanding" value={formatMoney(metrics.outstanding)} description={`${formatNumber(metrics.open)} open invoices`} icon={FileText} tone="orange" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Paid" value={formatNumber(metrics.paid)} description="Paid invoices" icon={CheckCircle2} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Overdue" value={formatNumber(metrics.overdue)} description="Past due and unpaid" icon={CalendarDays} tone="red" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFilterControls
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search invoice, member..."
        onFilterPress={() => setSortOpen(true)}
        filterLabel="Sort"
        tabs={tabs}
        value={filter}
        onChange={(value) => setFilter(value as InvoiceFilter)}
        secondaryActions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'secondary', loading: refreshing, onPress: () => void loadInvoices('refresh') },
          eligibleReceiptInvoices.length > 0
            ? { label: `VFD ${eligibleReceiptInvoices.length}`, icon: ReceiptText, loading: bulkProcessing, onPress: () => void generateSelectedReceipts() }
            : null,
        ]}
        actionSlot={<MobileReportExportButton fullWidth options={invoiceReportOptions} onError={(exportError) => setError(getApiErrorMessage(exportError))} />}
      />

      {listItems.length > 0 ? (
        <>
          <MobileDataList items={listItems} onPressItem={(item) => void openInvoice(item.id)} />
          <MobileText variant="small" tone="secondary">
            {formatNumber(filteredInvoices.length)} of {formatNumber(invoices.length)} invoices shown.
          </MobileText>
        </>
      ) : (
        <MobileEmptyState
          title={invoices.length === 0 ? 'No invoices yet' : 'No matching invoices'}
          description={invoices.length === 0 ? 'Create an invoice for a member or external billing contact.' : 'Adjust search, status, or sort filters.'}
          actionLabel={canManageInvoices && invoices.length === 0 ? 'Create invoice' : undefined}
          onAction={canManageInvoices && invoices.length === 0 ? openCreate : undefined}
        />
      )}

      <MobileSortSheet
        visible={sortOpen}
        options={sortOptions}
        value={sortBy}
        onChange={(value) => setSortBy(value as SortOption)}
        onClose={() => setSortOpen(false)}
      />

      {selectedInvoice && detailOpen ? (
        <InvoiceDetailSheet
          invoice={selectedInvoice}
          selectedForReceipt={selectedReceiptIds.includes(selectedInvoice.id)}
          canManage={canManageInvoices}
          working={workingId === selectedInvoice.id}
          onClose={() => setDetailOpen(false)}
          onView={() =>
            detailRoute
              ? router.push({ pathname: '/work/route-preview', params: { routeId: detailRoute.id, invoiceId: selectedInvoice.id, id: selectedInvoice.id } } as never)
              : undefined
          }
          onEdit={() => openEdit(selectedInvoice)}
          onPayLink={() => void sharePaymentLink(selectedInvoice)}
          onIssue={() => void issueInvoice(selectedInvoice)}
          onCancel={() => setCancelTarget(selectedInvoice)}
          onDelete={() => setDeleteTarget(selectedInvoice)}
          onGenerateReceipt={() => void generateReceipt(selectedInvoice)}
          onToggleReceiptSelection={() =>
            setSelectedReceiptIds((current) =>
              current.includes(selectedInvoice.id)
                ? current.filter((id) => id !== selectedInvoice.id)
                : [...current, selectedInvoice.id],
            )
          }
        />
      ) : null}

      {formMode ? (
        <InvoiceFormSheet
          mode={formMode}
          form={form}
          errors={errors}
          members={members}
          clients={clients}
          selectedMembers={selectedMembers}
          selectedClient={selectedClient}
          memberSearchResults={memberSearchResults}
          saving={saving}
          canManage={canManageInvoices}
          onClose={() => setFormMode(null)}
          onSave={() => void saveInvoice()}
          onChange={updateForm}
          onSelectClient={selectClient}
          onAddMember={(member) =>
            setForm((current) => ({
              ...current,
              selectedMemberIds: current.selectedMemberIds.includes(member.id) ? current.selectedMemberIds : [...current.selectedMemberIds, member.id],
              memberSearch: '',
            }))
          }
          onRemoveMember={(memberId) =>
            setForm((current) => ({
              ...current,
              selectedMemberIds: current.selectedMemberIds.filter((id) => id !== memberId),
            }))
          }
        />
      ) : null}

      <MobileConfirmSheet
        visible={Boolean(deleteTarget)}
        title="Delete invoice?"
        description={
          deleteTarget
            ? `${deleteTarget.invoiceNumber || 'This invoice'} will be removed. Only draft or cancelled invoices can be deleted.`
            : ''
        }
        confirmLabel={workingId === deleteTarget?.id ? 'Deleting...' : 'Delete'}
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void deleteInvoice()}
      />

      <MobileConfirmSheet
        visible={Boolean(cancelTarget)}
        title="Cancel invoice?"
        description={cancelTarget ? `${cancelTarget.invoiceNumber || 'This invoice'} will no longer be payable.` : ''}
        confirmLabel={workingId === cancelTarget?.id ? 'Cancelling...' : 'Cancel invoice'}
        destructive
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => void cancelInvoice()}
      />
    </MobileScreen>
  );
}

function InvoiceDetailSheet({
  invoice,
  selectedForReceipt,
  canManage,
  working,
  onClose,
  onView,
  onEdit,
  onPayLink,
  onIssue,
  onCancel,
  onDelete,
  onGenerateReceipt,
  onToggleReceiptSelection,
}: {
  invoice: Invoice;
  selectedForReceipt: boolean;
  canManage: boolean;
  working: boolean;
  onClose: () => void;
  onView: () => void;
  onEdit: () => void;
  onPayLink: () => void;
  onIssue: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onGenerateReceipt: () => void;
  onToggleReceiptSelection: () => void;
}) {
  const status = normalizeStatus(invoice.status);
  const canDelete = status === 'DRAFT' || status === 'CANCELLED' || status === 'CANCELED';
  const canChange = canManage && status !== 'PAID' && status !== 'CANCELLED' && status !== 'CANCELED';
  const receiptEligible = isReceiptEligible(invoice);

  return (
    <MobileSheet visible title={invoice.invoiceNumber || 'Invoice'} description={`${labelFromEnum(invoice.type || 'GENERAL')} · ${billToLabel(invoice)}`} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
        <MobileCard compact accent={invoiceTone(invoice) === 'danger' ? 'red' : invoiceTone(invoice) === 'success' ? 'green' : 'blue'}>
          <View style={styles.detailHero}>
            <View style={styles.detailHeroText}>
              <MobileText variant="value" weight="bold">
                {formatMoney(invoice.totalAmount, invoice.currency)}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Due {formatDate(invoice.dueDate || invoice.issueDate)} · Issued {formatDate(invoice.issueDate || invoice.createdAt)}
              </MobileText>
            </View>
            <MobileStatusBadge status={isInvoiceOverdue(invoice) && status !== 'PAID' ? 'Overdue' : invoice.status || 'Draft'} tone={invoiceTone(invoice)} />
          </View>
        </MobileCard>

        <View style={styles.actionGrid}>
          <MobileButton label="View" icon={Eye} variant="secondary" size="sm" onPress={onView} />
          {canManage ? <MobileButton label="Edit" icon={Edit3} variant="secondary" size="sm" onPress={onEdit} disabled={status === 'PAID'} /> : null}
          {canChange ? <MobileButton label="Pay link" icon={Share2} variant="secondary" size="sm" loading={working} onPress={onPayLink} /> : null}
          {canManage && status === 'DRAFT' ? <MobileButton label="Issue" icon={Send} size="sm" loading={working} onPress={onIssue} /> : null}
          {canManage && receiptEligible ? <MobileButton label="VFD" icon={ReceiptText} size="sm" loading={working} onPress={onGenerateReceipt} /> : null}
          {canManage && receiptEligible ? (
            <MobileButton
              label={selectedForReceipt ? 'Selected' : 'Select VFD'}
              icon={selectedForReceipt ? CheckCircle2 : Copy}
              variant="secondary"
              size="sm"
              onPress={onToggleReceiptSelection}
            />
          ) : null}
          {canChange ? <MobileButton label="Cancel" icon={Ban} variant="secondary" size="sm" loading={working} onPress={onCancel} /> : null}
          {canManage && canDelete ? <MobileButton label="Delete" icon={Trash2} variant="danger" size="sm" loading={working} onPress={onDelete} /> : null}
        </View>

        <MobileCard compact>
          <MobileInfoRow label="Bill to" value={billToLabel(invoice)} helper={invoice.billToEmail || invoice.memberEmail || 'No email recorded'} icon={Users} />
          <MobileInfoRow label="Membership" value={invoice.membershipNumber || 'Not linked'} helper={invoice.memberId || 'Manual or client invoice'} icon={FileText} />
          <MobileInfoRow label="Dates" value={`Issue ${formatDate(invoice.issueDate || invoice.createdAt)}`} helper={`Due ${formatDate(invoice.dueDate)}${invoice.paidAt ? ` · Paid ${formatDate(invoice.paidAt)}` : ''}`} icon={CalendarDays} />
          <MobileInfoRow label="TRA receipt" value={invoice.receiptNumber || 'Not issued'} helper={invoice.revenueTransactionId || 'No linked payment transaction'} icon={ReceiptText} status={invoice.receiptNumber ? 'Completed' : receiptEligible ? 'Ready' : 'Pending'} />
        </MobileCard>

        <InvoiceItemsCard invoice={invoice} />

        {invoice.notes ? (
          <MobileCard compact>
            <MobileText variant="section" weight="bold">
              Notes
            </MobileText>
            <MobileText variant="body" tone="secondary">
              {invoice.notes}
            </MobileText>
          </MobileCard>
        ) : null}
      </ScrollView>
    </MobileSheet>
  );
}

function InvoiceFormSheet({
  mode,
  form,
  errors,
  members,
  clients,
  selectedMembers,
  selectedClient,
  memberSearchResults,
  saving,
  canManage,
  onClose,
  onSave,
  onChange,
  onSelectClient,
  onAddMember,
  onRemoveMember,
}: {
  mode: 'create' | 'edit';
  form: InvoiceFormState;
  errors: Record<string, string>;
  members: AssociationMember[];
  clients: AssociationClient[];
  selectedMembers: AssociationMember[];
  selectedClient?: AssociationClient;
  memberSearchResults: AssociationMember[];
  saving: boolean;
  canManage: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: <K extends keyof InvoiceFormState>(field: K, value: InvoiceFormState[K]) => void;
  onSelectClient: (clientId: string) => void;
  onAddMember: (member: AssociationMember) => void;
  onRemoveMember: (memberId: string) => void;
}) {
  const editMode = mode === 'edit';
  return (
    <MobileSheet visible title={editMode ? 'Edit invoice' : 'Create invoice'} description={editMode ? 'Update billing details before payment.' : 'Bill members, clients, or manual contacts.'} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
        {!canManage ? <MobileToast title="Read only" description="Your account cannot manage invoices." tone="warning" /> : null}

        {!editMode ? (
          <MobileFormSection title="Invoice item" description="Create one clear billing line. More complex item editing remains available on web.">
            <MobileTextInput
              label="Description"
              value={form.description}
              onChangeText={(value) => onChange('description', value)}
              placeholder="Membership service, event fee, document fee..."
              error={errors.description}
              icon={FileText}
            />
            <MobileAmountInput
              label="Amount"
              value={form.amount}
              onChangeText={(value) => onChange('amount', value)}
              helperText="Enter the invoice total in TZS."
              error={errors.amount}
            />
          </MobileFormSection>
        ) : null}

        <MobileFormSection title="Billing target" description={editMode ? 'Update custom billing contact and due date.' : 'Select members, a client, or enter manual billing details.'}>
          {!editMode ? (
            <MobileSelect
              label="Bill to"
              value={form.billingMode}
              onChange={(value) => onChange('billingMode', value as BillingMode)}
              options={[
                { value: 'member', label: 'Member invoice' },
                { value: 'client', label: 'Client invoice' },
                { value: 'manual', label: 'Manual billing contact' },
              ]}
            />
          ) : null}

          {form.billingMode === 'member' && !editMode ? (
            <>
              <MobileTextInput
                label="Find members"
                value={form.memberSearch}
                onChangeText={(value) => onChange('memberSearch', value)}
                placeholder="Search name, number, phone..."
                helperText={`${formatNumber(members.length)} members loaded. Select one or more for a consolidated invoice.`}
                error={errors.selectedMemberIds}
                icon={Users}
              />
              {selectedMembers.map((member) => (
                <MobileCheckboxRow
                  key={member.id}
                  label={member.fullLegalName || 'Selected member'}
                  description={member.membershipNumber || member.contactInfo?.phoneNumber || 'Selected for this invoice'}
                  checked
                  onChange={() => onRemoveMember(member.id)}
                />
              ))}
              {memberSearchResults.map((member) => (
                <MobileCheckboxRow
                  key={member.id}
                  label={member.fullLegalName || 'Member'}
                  description={member.membershipNumber || member.contactInfo?.phoneNumber || member.contactInfo?.email || 'No member reference'}
                  checked={false}
                  onChange={() => onAddMember(member)}
                />
              ))}
            </>
          ) : null}

          {form.billingMode === 'client' && !editMode ? (
            <MobileSelect
              label="Client"
              value={form.selectedClientId}
              onChange={onSelectClient}
              placeholder="Select client"
              options={clients.map((client) => ({ value: client.id, label: client.name }))}
            />
          ) : null}

          {(form.billingMode !== 'member' || editMode) ? (
            <>
              {selectedClient ? (
                <MobileToast title={selectedClient.name} description="Client details copied into billing fields." tone="info" />
              ) : null}
              <MobileTextInput label="Bill-to name" value={form.billToName} onChangeText={(value) => onChange('billToName', value)} placeholder="Company or payer name" error={errors.billToName} />
              <MobileTextInput label="Bill-to email" value={form.billToEmail} onChangeText={(value) => onChange('billToEmail', value)} placeholder="billing@example.com" keyboardType="email-address" />
              <MobileTextInput label="Bill-to phone" value={form.billToPhone} onChangeText={(value) => onChange('billToPhone', value)} placeholder="+255..." keyboardType="phone-pad" />
              <MobileTextInput label="Bill-to address" value={form.billToAddress} onChangeText={(value) => onChange('billToAddress', value)} placeholder="Address" multiline />
              <View style={styles.twoCol}>
                <View style={styles.flex}>
                  <MobileTextInput label="TIN" value={form.billToTin} onChangeText={(value) => onChange('billToTin', value)} placeholder="Optional" />
                </View>
                <View style={styles.flex}>
                  <MobileTextInput label="VRN" value={form.billToVrn} onChangeText={(value) => onChange('billToVrn', value)} placeholder="Optional" />
                </View>
              </View>
            </>
          ) : null}
        </MobileFormSection>

        <MobileFormSection title="Dates and notes" description="Due date is optional, but recommended for follow-up and overdue reporting.">
          <MobileTextInput
            label="Due date"
            value={form.dueDate}
            onChangeText={(value) => onChange('dueDate', value)}
            placeholder="YYYY-MM-DD"
            helperText="Use ISO date format, for example 2026-07-31."
            error={errors.dueDate}
            icon={CalendarDays}
          />
          <MobileTextInput label="Notes" value={form.notes} onChangeText={(value) => onChange('notes', value)} placeholder="Additional invoice notes..." multiline />
        </MobileFormSection>

        <View style={styles.formActions}>
          <MobileButton label="Cancel" variant="secondary" onPress={onClose} />
          <MobileButton label={editMode ? 'Save changes' : 'Create invoice'} icon={editMode ? Edit3 : Plus} loading={saving} disabled={!canManage} onPress={onSave} fullWidth style={styles.flex} />
        </View>
      </ScrollView>
    </MobileSheet>
  );
}

function InvoiceItemsCard({ invoice }: { invoice: Invoice }) {
  const items = invoice.items || [];
  return (
    <MobileCard compact>
      <View style={styles.sectionRow}>
        <MobileText variant="section" weight="bold">
          Invoice items
        </MobileText>
        <MobileStatusBadge status={`${items.length || 0} item${items.length === 1 ? '' : 's'}`} tone="neutral" />
      </View>
      {items.length > 0 ? (
        items.map((item, index) => (
          <View key={item.id || `${item.description}-${index}`} style={styles.itemRow}>
            <View style={styles.itemCopy}>
              <MobileText variant="body" weight="bold">
                {item.description || `Item ${index + 1}`}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Qty {formatNumber(Number(item.quantity || 1))} · Unit {formatMoney(item.unitPrice, invoice.currency)}
              </MobileText>
            </View>
            <MobileText variant="body" weight="bold">
              {formatMoney(item.totalAmount, invoice.currency)}
            </MobileText>
          </View>
        ))
      ) : (
        <MobileText variant="small" tone="secondary">
          No invoice item lines were returned.
        </MobileText>
      )}
      <View style={styles.totalBlock}>
        <MobileInfoRow label="Subtotal" value={formatMoney(invoice.netAmount || invoice.totalAmount, invoice.currency)} icon={FileText} />
        <MobileInfoRow label="Tax" value={formatMoney(invoice.taxAmount, invoice.currency)} icon={ReceiptText} />
        <MobileInfoRow label="Total" value={formatMoney(invoice.totalAmount, invoice.currency)} icon={ReceiptText} status={invoice.status || 'Draft'} />
      </View>
    </MobileCard>
  );
}

function validateForm(form: InvoiceFormState, mode: FormMode) {
  const errors: Record<string, string> = {};
  if (mode !== 'edit') {
    if (!form.description.trim()) errors.description = 'Description is required.';
    if (moneyNumber(form.amount) <= 0) errors.amount = 'Amount must be greater than zero.';
    if (form.billingMode === 'member' && form.selectedMemberIds.length === 0) errors.selectedMemberIds = 'Select at least one member.';
  }
  if ((form.billingMode === 'client' || form.billingMode === 'manual' || mode === 'edit') && !form.billToName.trim()) {
    errors.billToName = 'Billing name is required for client/manual invoices.';
  }
  if (form.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) errors.dueDate = 'Use YYYY-MM-DD.';
  return errors;
}

function formFromInvoice(invoice: Invoice): InvoiceFormState {
  const firstItem = invoice.items?.[0];
  return {
    ...emptyForm(),
    description: firstItem?.description || '',
    amount: String(firstItem?.totalAmount || invoice.totalAmount || ''),
    dueDate: dateOnly(invoice.dueDate),
    notes: invoice.notes || '',
    billingMode: invoice.memberId ? 'member' : 'manual',
    selectedMemberIds: invoice.memberIds?.length ? invoice.memberIds : invoice.memberId ? [invoice.memberId] : [],
    billToName: invoice.billToName || invoice.memberName || '',
    billToEmail: invoice.billToEmail || invoice.memberEmail || '',
    billToPhone: invoice.billToPhone || invoice.memberPhone || '',
    billToAddress: invoice.billToAddress || '',
    billToTin: invoice.billToTin || '',
    billToVrn: invoice.billToVrn || '',
  };
}

function compareInvoices(left: Invoice, right: Invoice, sortBy: SortOption) {
  if (sortBy === 'dueAsc') return dateTime(left.dueDate) - dateTime(right.dueDate);
  if (sortBy === 'amountDesc') return moneyNumber(right.totalAmount) - moneyNumber(left.totalAmount);
  if (sortBy === 'statusAsc') return normalizeStatus(left.status).localeCompare(normalizeStatus(right.status));
  if (sortBy === 'numberAsc') return String(left.invoiceNumber || '').localeCompare(String(right.invoiceNumber || ''));
  return dateTime(right.createdAt || right.issueDate) - dateTime(left.createdAt || left.issueDate);
}

function isReceiptEligible(invoice: Invoice) {
  return normalizeStatus(invoice.status) === 'PAID' && Boolean(invoice.revenueTransactionId) && !invoice.receiptNumber;
}

function isInvoiceOverdue(invoice: Invoice) {
  const status = normalizeStatus(invoice.status);
  if (status === 'PAID' || status === 'CANCELLED' || status === 'CANCELED') return false;
  if (!invoice.dueDate) return false;
  const due = new Date(`${invoice.dueDate.slice(0, 10)}T23:59:59`);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}

function invoiceTone(invoice: Invoice): StatusTone {
  if (isInvoiceOverdue(invoice)) return 'danger';
  const status = normalizeStatus(invoice.status);
  if (status === 'PAID') return 'success';
  if (status === 'ISSUED') return 'primary';
  if (status === 'DRAFT') return 'warning';
  if (status === 'CANCELLED' || status === 'CANCELED') return 'neutral';
  return 'info';
}

function hasInvoiceManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    [
      'invoices_manage',
      'invoices.manage',
      'finance.transactions.create',
      'finance.transactions.update',
      'finance.transactions.delete',
      'admin',
      'association_admin',
      'chairperson',
      'treasurer',
    ].includes(value),
  );
}

function billToLabel(invoice: Invoice) {
  return invoice.billToName || invoice.memberName || (invoice.memberCount ? `${formatNumber(invoice.memberCount)} members` : 'Manual invoice');
}

function normalizeStatus(status?: string | null) {
  return (status || 'DRAFT').toUpperCase();
}

function labelFromEnum(value?: string | null) {
  return (value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMoney(value?: number | string | null, currency?: string | null) {
  return formatCurrency(moneyNumber(value), currency || 'TZS');
}

function moneyNumber(value?: number | string | null) {
  const numberValue = typeof value === 'number' ? value : Number(String(value || '0').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function dateTime(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function textOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  sheetScroll: {
    gap: 14,
    paddingBottom: 14,
  },
  detailHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailHeroText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  totalBlock: {
    gap: 2,
    paddingTop: 8,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
});
