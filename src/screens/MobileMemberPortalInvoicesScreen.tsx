import { router } from 'expo-router';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  ReceiptText,
  RefreshCw,
  Share2,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobileLoadingState,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import {
  createCurrentMemberInvoicePaymentLink,
  getCurrentMemberInvoice,
  getCurrentMemberInvoices,
  type Invoice,
} from '@/services/invoice-service';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { statusToneFor, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type InvoiceTab = 'open' | 'all' | 'paid' | 'issued' | 'overdue' | 'draft' | 'cancelled';
type InvoiceSort = 'createdDesc' | 'dueAsc' | 'amountDesc' | 'statusAsc';

const PAGE_SIZE = 25;

const invoiceSortOptions = [
  { value: 'createdDesc', label: 'Newest invoice', description: 'Latest invoices first.' },
  { value: 'dueAsc', label: 'Due soon', description: 'Open invoices with the nearest due date first.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest invoice totals first.' },
  { value: 'statusAsc', label: 'Status', description: 'Group invoices by billing status.' },
];

export default function MobileMemberPortalInvoicesScreen() {
  const { activeView, user } = useAuth();
  const userId = user?.userId;
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageNumber, setPageNumber] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<InvoiceTab>('open');
  const [sortValue, setSortValue] = useState<InvoiceSort>('createdDesc');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creatingPayLinkId, setCreatingPayLinkId] = useState<string | null>(null);

  const loadInvoices = useCallback(
    async (mode: 'initial' | 'refresh' | 'more' = 'initial', requestedPage = 0) => {
      if (!userId) {
        setLoading(false);
        setError('Member session is missing the user identifier.');
        return;
      }

      const nextPage = mode === 'more' ? requestedPage : 0;
      if (mode === 'more') {
        setLoadingMore(true);
      } else if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const sort = sortValue === 'dueAsc' ? 'dueDate,asc' : sortValue === 'amountDesc' ? 'totalAmount,desc' : 'createdAt,desc';
        const [loadedMember, invoicePage] =
          mode === 'more'
            ? [null, await getCurrentMemberInvoices({ page: nextPage, size: PAGE_SIZE, sort })]
            : await Promise.all([
                getCurrentMemberByUserId(userId),
                getCurrentMemberInvoices({ page: nextPage, size: PAGE_SIZE, sort }),
              ]);

        if (loadedMember) {
          setMember(loadedMember);
        }

        setInvoices((current) => {
          const nextContent = invoicePage.content || [];
          if (mode !== 'more') return nextContent;
          const seen = new Set(current.map((invoice) => invoice.id));
          return [...current, ...nextContent.filter((invoice) => !seen.has(invoice.id))];
        });
        setTotalElements(invoicePage.totalElements || invoicePage.content.length);
        setTotalPages(Math.max(1, invoicePage.totalPages || 1));
        setPageNumber(invoicePage.number || nextPage);
      } catch (loadError) {
        if (mode !== 'more') {
          setMember(null);
          setInvoices([]);
        }
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [sortValue, userId],
  );

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(() => loadInvoices());
    }
  }, [activeView, loadInvoices]);

  const metrics = useMemo(() => summarizeInvoices(invoices, totalElements), [invoices, totalElements]);
  const tabCounts = useMemo(() => countTabs(invoices), [invoices]);
  const tabs = useMemo(
    () =>
      [
        { value: 'open', label: 'Open', count: tabCounts.open },
        { value: 'all', label: 'All', count: totalElements || invoices.length },
        { value: 'paid', label: 'Paid', count: tabCounts.paid },
        { value: 'issued', label: 'Pending', count: tabCounts.issued },
        { value: 'overdue', label: 'Overdue', count: tabCounts.overdue },
        { value: 'draft', label: 'Draft', count: tabCounts.draft },
        { value: 'cancelled', label: 'Cancelled', count: tabCounts.cancelled },
      ].filter((tab) => tab.value === 'open' || tab.value === 'all' || tab.count > 0 || tab.value === activeTab),
    [activeTab, invoices.length, tabCounts, totalElements],
  );

  const visibleInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = invoices.filter((invoice) => {
      const matchesTab = invoiceMatchesTab(invoice, activeTab);
      const searchable = [
        invoice.invoiceNumber,
        invoice.type,
        invoice.status,
        invoice.notes,
        invoice.associationName,
        invoice.receiptNumber,
        invoice.traCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesTab && (!term || searchable.includes(term));
    });
    return sortInvoices(filtered, sortValue);
  }, [activeTab, invoices, search, sortValue]);

  const invoiceItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleInvoices.map((invoice) => ({
        id: invoice.id,
        title: invoice.invoiceNumber || shortInvoiceId(invoice.id),
        subtitle: invoiceSubtitle(invoice),
        meta: invoice.paidAt
          ? `Paid ${formatDate(invoice.paidAt)}`
          : invoice.dueDate
            ? `Due ${formatDate(invoice.dueDate)}`
            : `Issued ${formatDate(invoice.issueDate || invoice.createdAt)}`,
        amount: formatMoney(invoice.totalAmount, invoice.currency),
        status: invoice.status || 'Unknown',
        statusTone: statusToneFor(invoice.status),
        accent: toneForInvoice(invoice),
      })),
    [visibleInvoices],
  );

  const hasMore = invoices.length < totalElements && pageNumber + 1 < totalPages;
  const memberName = member?.fullLegalName || user?.fullName || 'Current member';
  const membershipNumber = member?.membershipNumber || 'No membership number';
  const currentSortLabel = invoiceSortOptions.find((option) => option.value === sortValue)?.label || 'Sort records';

  const openInvoice = useCallback(
    async (invoiceId: string) => {
      const current = invoices.find((invoice) => invoice.id === invoiceId) || null;
      setSelectedInvoice(current);
      setDetailLoading(true);
      setError(null);
      try {
        const detail = await getCurrentMemberInvoice(invoiceId);
        setSelectedInvoice(detail);
      } catch (detailError) {
        setError(getApiErrorMessage(detailError));
      } finally {
        setDetailLoading(false);
      }
    },
    [invoices],
  );

  const createPaymentLink = useCallback(async (invoice: Invoice) => {
    setCreatingPayLinkId(invoice.id);
    setError(null);
    setNotice(null);
    try {
      const response = await createCurrentMemberInvoicePaymentLink(invoice.id);
      if (!response.link) {
        setError('The server did not return a payment link for this invoice.');
        return;
      }
      await Share.share({
        title: invoice.invoiceNumber || 'Invoice payment link',
        message: response.link,
        url: response.link,
      });
      setNotice('Payment link is ready.');
    } catch (linkError) {
      setError(getApiErrorMessage(linkError));
    } finally {
      setCreatingPayLinkId(null);
    }
  }, []);

  if (activeView !== 'MEMBER') {
    return <AccessDeniedScreen title="My invoices" description="This native invoice register is available from the member portal workspace." />;
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="list" message="Loading your invoices" />;
  }

  if (error && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="My invoices"
          subtitle="Invoice register unavailable"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry invoices" variant="secondary" onPress={() => void loadInvoices('refresh')} />}
        />
        <MobileErrorState title="Invoices could not load" description={error} retryLabel="Retry" onRetry={() => void loadInvoices('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="My invoices"
        subtitle={member?.associationName || user?.associationName || 'Billing self-service'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh invoices"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadInvoices('refresh')}
          />
        }
      />

      {notice ? <MobileToast title="Invoices" description={notice} tone="success" /> : null}
      {error && member ? <MobileToast title="Invoice action failed" description={error} tone="danger" /> : null}

      <MobileCard compact style={styles.identityCard}>
        <MobileInfoRow
          label="Member"
          value={memberName}
          helper={`${membershipNumber} · ${member?.associationName || user?.associationName || 'Current association'}`}
          icon={ReceiptText}
          status={member?.status || 'Active'}
        />
      </MobileCard>

      <MobileSummaryPanel
        title="Outstanding invoices"
        value={formatMoney(metrics.outstanding, metrics.currency)}
        description={`${formatNumber(metrics.open)} open from ${formatNumber(metrics.total)} total invoice(s).`}
        tone={metrics.overdue ? 'red' : metrics.open ? 'orange' : 'green'}
        icon={Banknote}
        footer={
          <View style={styles.summaryFooter}>
            <MobileStatusBadge
              status={metrics.nextDue ? 'Pending' : 'Paid'}
              label={metrics.nextDue ? `Next due ${formatDate(metrics.nextDue)}` : 'All settled'}
              tone={metrics.nextDue ? 'warning' : 'success'}
            />
            {refreshing ? <MobileLoadingState compact message="Refreshing" /> : null}
          </View>
        }
      />

      <MobileSearchToolbar
        value={search}
        onChange={setSearch}
        placeholder="Search..."
        onFilterPress={() => setSortOpen(true)}
        filterLabel="Sort"
      />
      <MobileStatusTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as InvoiceTab)} />

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitle}>
          <MobileText variant="section" weight="bold">
            Invoice records
          </MobileText>
          <MobileText variant="small" tone="secondary">
            {currentSortLabel} · {formatNumber(invoices.length)} loaded
            {totalElements ? ` of ${formatNumber(totalElements)}` : ''}
          </MobileText>
        </View>
        <MobileStatusBadge status="Invoices" label={`${formatNumber(visibleInvoices.length)} visible`} tone="primary" />
      </View>

      {invoiceItems.length ? (
        <>
          <MobileDataList items={invoiceItems} onPressItem={(item) => void openInvoice(item.id)} />
          {hasMore ? (
            <MobileButton
              label="Load more invoices"
              variant="secondary"
              icon={RefreshCw}
              loading={loadingMore}
              onPress={() => void loadInvoices('more', pageNumber + 1)}
            />
          ) : null}
        </>
      ) : (
        <MobileEmptyState
          title={search || activeTab !== 'open' ? 'No invoices match' : 'No open invoices'}
          description={
            search || activeTab !== 'open'
              ? 'Adjust the search text, status tab, or sort option.'
              : 'There are no unpaid invoices for this member account right now.'
          }
          actionLabel="Refresh"
          onAction={() => void loadInvoices('refresh')}
        />
      )}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total" value={formatNumber(metrics.total)} description="Invoice records" tone="blue" icon={FileText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Paid" value={formatNumber(metrics.paid)} description="Settled invoices" tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Overdue" value={formatNumber(metrics.overdue)} description="Needs attention" tone="red" icon={AlertTriangle} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Loaded" value={formatNumber(invoices.length)} description="Available on device" tone="slate" icon={Clock3} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <InvoicePreviewSheet
        invoice={selectedInvoice}
        loading={detailLoading}
        creatingPayLink={creatingPayLinkId === selectedInvoice?.id}
        onClose={() => setSelectedInvoice(null)}
        onCreatePaymentLink={createPaymentLink}
      />

      <MobileSortSheet
        visible={sortOpen}
        value={sortValue}
        options={invoiceSortOptions}
        onChange={(value) => setSortValue(value as InvoiceSort)}
        onClose={() => setSortOpen(false)}
      />
    </MobileScreen>
  );
}

type InvoicePreviewSheetProps = {
  invoice: Invoice | null;
  loading: boolean;
  creatingPayLink: boolean;
  onClose: () => void;
  onCreatePaymentLink: (invoice: Invoice) => Promise<void>;
};

function InvoicePreviewSheet({
  invoice,
  loading,
  creatingPayLink,
  onClose,
  onCreatePaymentLink,
}: InvoicePreviewSheetProps) {
  if (!invoice) return null;

  const isPayable = isOpenInvoice(invoice);
  const items = invoice.items || [];

  return (
    <MobileSheet
      visible={Boolean(invoice)}
      title={invoice.invoiceNumber || shortInvoiceId(invoice.id)}
      description={`${invoice.type || 'Invoice'} · ${formatMoney(invoice.totalAmount, invoice.currency)}`}
      onClose={onClose}
    >
      <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.sheetContent}>
          <View style={styles.invoiceHeader}>
            <MobileStatusBadge status={invoice.status || 'Unknown'} />
            <MobileText variant="value" weight="bold" adjustsFontSizeToFit numberOfLines={1}>
              {formatMoney(invoice.totalAmount, invoice.currency)}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {invoice.invoiceNumber || shortInvoiceId(invoice.id)}
            </MobileText>
            {loading ? <MobileLoadingState compact message="Refreshing details" /> : null}
          </View>

          <MobileCard compact>
            <MobileInfoRow label="Issue date" value={formatDate(invoice.issueDate || invoice.createdAt)} icon={CalendarDays} />
            <MobileInfoRow label="Due date" value={formatDate(invoice.dueDate)} icon={Clock3} />
            <MobileInfoRow label="Paid date" value={formatDate(invoice.paidAt)} icon={CheckCircle2} />
          </MobileCard>

          <MobileCard compact>
            <MobileInfoRow label="Subtotal" value={formatMoney(invoice.netAmount || invoice.totalAmount, invoice.currency)} icon={ReceiptText} />
            <MobileInfoRow label="Tax" value={formatMoney(invoice.taxAmount, invoice.currency)} icon={Banknote} />
            <MobileInfoRow label="Total" value={formatMoney(invoice.totalAmount, invoice.currency)} icon={FileText} status={invoice.status || 'Unknown'} />
          </MobileCard>

          <View style={styles.sectionHeader}>
            <MobileText variant="section" weight="bold">
              Line items
            </MobileText>
            <MobileStatusBadge status="Items" label={formatNumber(items.length)} tone="neutral" />
          </View>

          {items.length ? (
            <View style={styles.stack}>
              {items.map((item, index) => (
                <MobileCard key={item.id || `${item.description || 'item'}-${index}`} compact>
                  <MobileText variant="body" weight="bold" numberOfLines={2}>
                    {item.description || `Item ${index + 1}`}
                  </MobileText>
                  <View style={styles.itemMeta}>
                    <MobileText variant="small" tone="secondary">
                      Qty {formatNumber(moneyNumber(item.quantity || 1))}
                    </MobileText>
                    <MobileText variant="small" weight="bold" numberOfLines={1}>
                      {formatMoney(item.totalAmount, invoice.currency)}
                    </MobileText>
                  </View>
                </MobileCard>
              ))}
            </View>
          ) : (
            <MobileEmptyState title="No line items" description="This invoice has no item breakdown from the server." />
          )}

          {invoice.notes ? (
            <MobileCard compact>
              <MobileText variant="small" weight="bold">
                Notes
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {invoice.notes}
              </MobileText>
            </MobileCard>
          ) : null}

          <View style={styles.sheetActions}>
            {isPayable ? (
              <MobileButton
                label="Share payment link"
                icon={Share2}
                fullWidth
                loading={creatingPayLink}
                onPress={() => void onCreatePaymentLink(invoice)}
              />
            ) : null}
            {invoice.traLink ? (
              <MobileButton
                label="Open TRA receipt"
                icon={ExternalLink}
                variant="secondary"
                fullWidth
                onPress={() => invoice.traLink && Linking.openURL(invoice.traLink)}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </MobileSheet>
  );
}

function summarizeInvoices(invoices: Invoice[], serverTotal: number) {
  const paid = invoices.filter((invoice) => normalizeStatus(invoice.status) === 'PAID').length;
  const overdue = invoices.filter((invoice) => normalizeStatus(invoice.status) === 'OVERDUE').length;
  const openInvoices = invoices.filter(isOpenInvoice);
  const outstanding = openInvoices.reduce((sum, invoice) => sum + moneyNumber(invoice.totalAmount), 0);
  const nextDue = openInvoices
    .map((invoice) => invoice.dueDate)
    .filter(Boolean)
    .sort((a, b) => new Date(String(a)).getTime() - new Date(String(b)).getTime())[0];

  return {
    total: serverTotal || invoices.length,
    paid,
    open: openInvoices.length,
    overdue,
    outstanding,
    nextDue,
    currency: invoices[0]?.currency || 'TZS',
  };
}

function countTabs(invoices: Invoice[]): Record<InvoiceTab, number> {
  return invoices.reduce<Record<InvoiceTab, number>>(
    (counts, invoice) => {
      if (isOpenInvoice(invoice)) counts.open += 1;
      counts.all += 1;
      if (normalizeStatus(invoice.status) === 'PAID') counts.paid += 1;
      if (['ISSUED', 'PENDING', 'UNPAID', 'PARTIAL'].includes(normalizeStatus(invoice.status))) counts.issued += 1;
      if (normalizeStatus(invoice.status) === 'OVERDUE') counts.overdue += 1;
      if (normalizeStatus(invoice.status) === 'DRAFT') counts.draft += 1;
      if (isCancelledInvoice(invoice)) counts.cancelled += 1;
      return counts;
    },
    { open: 0, all: 0, paid: 0, issued: 0, overdue: 0, draft: 0, cancelled: 0 },
  );
}

function invoiceMatchesTab(invoice: Invoice, tab: InvoiceTab) {
  const status = normalizeStatus(invoice.status);
  if (tab === 'all') return true;
  if (tab === 'open') return isOpenInvoice(invoice);
  if (tab === 'paid') return status === 'PAID';
  if (tab === 'issued') return ['ISSUED', 'PENDING', 'UNPAID', 'PARTIAL'].includes(status);
  if (tab === 'overdue') return status === 'OVERDUE';
  if (tab === 'draft') return status === 'DRAFT';
  if (tab === 'cancelled') return isCancelledInvoice(invoice);
  return true;
}

function sortInvoices(invoices: Invoice[], sortValue: InvoiceSort) {
  return [...invoices].sort((a, b) => {
    if (sortValue === 'dueAsc') return dateValue(a.dueDate || a.issueDate || a.createdAt) - dateValue(b.dueDate || b.issueDate || b.createdAt);
    if (sortValue === 'amountDesc') return moneyNumber(b.totalAmount) - moneyNumber(a.totalAmount);
    if (sortValue === 'statusAsc') return normalizeStatus(a.status).localeCompare(normalizeStatus(b.status));
    return dateValue(b.createdAt || b.issueDate || b.dueDate) - dateValue(a.createdAt || a.issueDate || a.dueDate);
  });
}

function isOpenInvoice(invoice: Invoice) {
  const status = normalizeStatus(invoice.status);
  return !['PAID', 'CANCELLED', 'CANCELED'].includes(status);
}

function isCancelledInvoice(invoice: Invoice) {
  return ['CANCELLED', 'CANCELED'].includes(normalizeStatus(invoice.status));
}

function invoiceSubtitle(invoice: Invoice) {
  const type = invoice.type || 'Invoice';
  if (invoice.dueDate) return `${type} · Due ${formatDate(invoice.dueDate)}`;
  return `${type} · Issued ${formatDate(invoice.issueDate || invoice.createdAt)}`;
}

function toneForInvoice(invoice: Invoice): StatusTone {
  const status = normalizeStatus(invoice.status);
  if (status === 'PAID') return 'paid';
  if (status === 'OVERDUE') return 'danger';
  if (['ISSUED', 'PENDING', 'UNPAID', 'PARTIAL'].includes(status)) return 'warning';
  if (status === 'DRAFT') return 'review';
  if (isCancelledInvoice(invoice)) return 'neutral';
  return 'primary';
}

function normalizeStatus(status?: string | null) {
  return String(status || 'UNKNOWN').trim().replace(/[\s-]+/g, '_').toUpperCase();
}

function moneyNumber(value?: number | string | null) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoney(value?: number | string | null, currency?: string | null) {
  return formatCurrency(moneyNumber(value), currency || 'TZS');
}

function dateValue(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function shortInvoiceId(id?: string | null) {
  if (!id) return 'Invoice';
  return `Invoice ${id.slice(0, 8)}`;
}

const styles = StyleSheet.create({
  identityCard: {
    marginTop: -2,
  },
  summaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
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
  sheetScroll: {
    maxHeight: 560,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 10,
  },
  invoiceHeader: {
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  stack: {
    gap: 10,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  sheetActions: {
    gap: 10,
  },
});
