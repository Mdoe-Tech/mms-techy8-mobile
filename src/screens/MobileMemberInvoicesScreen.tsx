import { router } from 'expo-router';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  Package,
  ReceiptText,
  RefreshCw,
  Share2,
  ShieldCheck,
  Zap,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
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
  MobileSearchToolbar,
  MobileSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import {
  createInvoicePaymentLink,
  createSubscriptionInvoiceForMember,
  generateVefdReceiptForTransaction,
  getInvoice,
  getMemberInvoices,
  getMembershipPackage,
  getVefdReceipts,
  type Invoice,
  type MembershipPackage,
  type VefdReceipt,
} from '@/services/invoice-service';
import { getAssociationMember, type AssociationMember } from '@/services/member-service';
import { statusToneFor } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type MobileMemberInvoicesScreenProps = {
  memberId?: string;
};

export default function MobileMemberInvoicesScreen({ memberId }: MobileMemberInvoicesScreenProps) {
  const { activeView } = useAuth();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [packageInfo, setPackageInfo] = useState<MembershipPackage | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<VefdReceipt[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [generatingReceiptId, setGeneratingReceiptId] = useState<string | null>(null);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadInvoices = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!memberId) {
        setError('Member context is missing.');
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
        const [memberResponse, invoiceResponse, receiptResponse] = await Promise.all([
          getAssociationMember(memberId),
          getMemberInvoices(memberId),
          getVefdReceipts(),
        ]);

        const invoiceList = invoiceResponse.content || [];
        const invoiceIds = new Set(invoiceList.map((invoice) => invoice.id));
        setMember(memberResponse);
        setInvoices(invoiceList);
        setReceipts((receiptResponse.content || []).filter((receipt) => receipt.invoiceId && invoiceIds.has(receipt.invoiceId)));

        if (memberResponse.packageId) {
          try {
            setPackageInfo(await getMembershipPackage(memberResponse.packageId));
          } catch {
            setPackageInfo(null);
          }
        } else {
          setPackageInfo(null);
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
    void Promise.resolve().then(() => loadInvoices());
  }, [loadInvoices]);

  const stats = useMemo(() => {
    const paid = invoices.filter((invoice) => normalizeStatus(invoice.status) === 'PAID');
    const pending = invoices.filter((invoice) => ['DRAFT', 'ISSUED', 'PENDING', 'UNPAID'].includes(normalizeStatus(invoice.status)));
    const overdue = invoices.filter((invoice) => normalizeStatus(invoice.status) === 'OVERDUE');
    const outstanding = invoices
      .filter((invoice) => !['PAID', 'CANCELLED', 'CANCELED'].includes(normalizeStatus(invoice.status)))
      .reduce((sum, invoice) => sum + moneyNumber(invoice.totalAmount), 0);

    return {
      total: invoices.length,
      paid: paid.length,
      pending: pending.length,
      overdue: overdue.length,
      outstanding,
    };
  }, [invoices]);

  const tabs = useMemo(() => {
    const counts = new Map<string, number>();
    invoices.forEach((invoice) => {
      const key = normalizeStatus(invoice.status);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const base = [
      { value: 'ALL', label: 'All', count: invoices.length },
      { value: 'PAID', label: 'Paid', count: counts.get('PAID') || 0 },
      { value: 'ISSUED', label: 'Issued', count: counts.get('ISSUED') || 0 },
      { value: 'DRAFT', label: 'Draft', count: counts.get('DRAFT') || 0 },
      { value: 'OVERDUE', label: 'Overdue', count: counts.get('OVERDUE') || 0 },
      { value: 'CANCELLED', label: 'Cancelled', count: (counts.get('CANCELLED') || 0) + (counts.get('CANCELED') || 0) },
    ];

    return base.filter((tab) => tab.value === 'ALL' || tab.count > 0);
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const currentStatus = normalizeStatus(invoice.status);
      const matchesStatus = status === 'ALL' || currentStatus === status || (status === 'CANCELLED' && currentStatus === 'CANCELED');
      const searchable = [
        invoice.invoiceNumber,
        invoice.type,
        invoice.status,
        invoice.currency,
        invoice.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!term || searchable.includes(term));
    });
  }, [invoices, search, status]);

  const invoiceItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredInvoices.map((invoice) => ({
        id: invoice.id,
        title: invoice.invoiceNumber || 'Invoice',
        subtitle: `${invoice.type || 'General'} · Due ${formatDate(invoice.dueDate || invoice.issueDate)}`,
        meta: invoice.paidAt ? `Paid ${formatDate(invoice.paidAt)}` : `Issued ${formatDate(invoice.issueDate || invoice.createdAt)}`,
        amount: formatMoney(invoice.totalAmount, invoice.currency),
        status: invoice.status || 'Draft',
        accent: invoiceAccent(invoice.status),
      })),
    [filteredInvoices],
  );

  const packageName = packageInfo?.name || member?.packageName || 'No package';
  const memberName = member?.fullLegalName || member?.contactInfo?.email || 'Member';
  const canGeneratePackageInvoice = Boolean(member?.packageId || packageInfo);
  const packageStatusLabel = !canGeneratePackageInvoice ? 'No package' : packageInfo?.active === false ? 'Inactive' : 'Ready';
  const packageStatusTone = !canGeneratePackageInvoice ? 'neutral' : packageInfo?.active === false ? 'danger' : 'success';

  const openInvoice = async (invoiceId: string) => {
    try {
      setSelectedInvoice(invoices.find((invoice) => invoice.id === invoiceId) || null);
      const response = await getInvoice(invoiceId);
      setSelectedInvoice(response);
    } catch (openError) {
      setNotice(null);
      setError(getApiErrorMessage(openError));
    }
  };

  const generateInvoice = async () => {
    if (!memberId) return;
    setCreatingInvoice(true);
    setError(null);
    setNotice(null);
    try {
      const response = await createSubscriptionInvoiceForMember(memberId);
      setNotice(`Invoice ${response.invoiceNumber || ''} generated successfully.`.trim());
      setConfirmGenerateOpen(false);
      await loadInvoices('refresh');
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    } finally {
      setCreatingInvoice(false);
    }
  };

  const sharePaymentLink = async (invoice: Invoice) => {
    setError(null);
    setNotice(null);
    try {
      const response = await createInvoicePaymentLink(invoice.id);
      if (!response.link) {
        setError('The server did not return a payment link.');
        return;
      }
      await Share.share({
        title: invoice.invoiceNumber || 'Invoice payment link',
        message: response.link,
        url: response.link,
      });
      setNotice('Payment link is ready to share.');
    } catch (shareError) {
      setError(getApiErrorMessage(shareError));
    }
  };

  const generateReceipt = async (invoice: Invoice) => {
    if (!invoice.revenueTransactionId) {
      setError('This invoice has no linked paid transaction.');
      return;
    }

    setGeneratingReceiptId(invoice.id);
    setError(null);
    setNotice(null);
    try {
      await generateVefdReceiptForTransaction(invoice.revenueTransactionId);
      setNotice('VEFD receipt generated successfully.');
      await loadInvoices('refresh');
    } catch (receiptError) {
      setError(getApiErrorMessage(receiptError));
    } finally {
      setGeneratingReceiptId(null);
    }
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Member invoices"
        description="This native invoice page is available for association admin workspaces only."
      />
    );
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="list" message="Loading member invoices" />;
  }

  if (error && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Billing"
          title="Member invoices"
          subtitle="Invoices could not be loaded"
          onBack={() => router.back()}
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
        title="Member invoices"
        subtitle={memberName}
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

      {member ? (
        <MobileDetailHeader
          title={memberName}
          subtitle={member.membershipNumber || member.employeeId || 'No membership number'}
          eyebrow="Subscription billing"
          status={member.status || 'Unknown'}
          avatarName={memberName}
        />
      ) : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Package" value={packageName} description="Current subscription" tone="blue" icon={Package} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total invoices" value={formatNumber(stats.total)} description="Billing records" tone="green" icon={FileText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Paid" value={formatNumber(stats.paid)} description="Settled invoices" tone="teal" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Outstanding" value={formatMoney(stats.outstanding, invoices[0]?.currency)} description={`${formatNumber(stats.pending)} pending`} tone="red" icon={Banknote} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitle}>
            <MobileText variant="section" weight="bold">
              Subscription package
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Pricing used when generating a member subscription invoice.
            </MobileText>
          </View>
          <MobileStatusBadge status={packageStatusLabel} label={packageStatusLabel} tone={packageStatusTone} />
        </View>
        <MobileInfoRow label="Package" value={packageName} helper={packageInfo?.description || 'Member subscription package'} icon={Package} />
        <MobileInfoRow label="Monthly" value={formatOptionalMoney(packageInfo?.monthlyAmount)} helper={`Annual ${formatOptionalMoney(packageInfo?.annualAmount)}`} icon={CalendarDays} />
        <MobileInfoRow label="Quarterly" value={formatOptionalMoney(packageInfo?.quarterlyAmount)} helper={`Weekly ${formatOptionalMoney(packageInfo?.weeklyAmount)}`} icon={ReceiptText} />
        <MobileButton
          label="Generate invoice"
          icon={ReceiptText}
          fullWidth
          disabled={!canGeneratePackageInvoice}
          loading={creatingInvoice}
          onPress={() => setConfirmGenerateOpen(true)}
        />
      </MobileCard>

      <MobileSearchToolbar value={search} onChange={setSearch} placeholder="Search invoices..." />
      <MobileStatusTabs tabs={tabs} value={status} onChange={setStatus} />

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Invoice records
        </MobileText>
        <MobileStatusBadge status="Invoices" label={`${formatNumber(filteredInvoices.length)} visible`} tone="primary" />
      </View>

      {invoiceItems.length ? (
        <MobileDataList items={invoiceItems} onPressItem={(item) => void openInvoice(item.id)} />
      ) : (
        <MobileEmptyState
          title={search || status !== 'ALL' ? 'No invoices match' : 'No invoices found'}
          description={
            search || status !== 'ALL'
              ? 'Change the search text or selected status.'
              : canGeneratePackageInvoice
                ? 'Generate a subscription invoice to start billing this member.'
                : 'Assign a package before subscription invoices can be generated.'
          }
          actionLabel={!search && status === 'ALL' && canGeneratePackageInvoice ? 'Generate invoice' : undefined}
          onAction={!search && status === 'ALL' && canGeneratePackageInvoice ? () => setConfirmGenerateOpen(true) : undefined}
        />
      )}

      {receipts.length ? (
        <>
          <View style={styles.sectionHeader}>
            <MobileText variant="section" weight="bold">
              VEFD receipts
            </MobileText>
            <MobileStatusBadge status="Verified" label={formatNumber(receipts.length)} tone="info" />
          </View>
          <View style={styles.stack}>
            {receipts.slice(0, 4).map((receipt) => (
              <MobileCard key={receipt.id} compact>
                <MobileInfoRow
                  label="Receipt"
                  value={receipt.receiptNumber || receipt.verificationCode || 'Receipt pending'}
                  helper={formatDate(receipt.createdAt || receipt.invoiceDate)}
                  icon={ShieldCheck}
                  status={receipt.status || 'Pending'}
                />
                <MobileInfoRow label="Amount" value={formatMoney(receipt.totalInclOfTax)} icon={Banknote} />
                {receipt.link ? (
                  <MobileButton
                    label="Open TRA link"
                    icon={ExternalLink}
                    variant="secondary"
                    size="sm"
                    onPress={() => receipt.link && Linking.openURL(receipt.link)}
                  />
                ) : null}
              </MobileCard>
            ))}
          </View>
        </>
      ) : null}

      <InvoiceDetailSheet
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onSharePaymentLink={sharePaymentLink}
        onGenerateReceipt={generateReceipt}
        generatingReceiptId={generatingReceiptId}
      />

      <MobileConfirmSheet
        visible={confirmGenerateOpen}
        title="Generate subscription invoice"
        description={`Create a new subscription invoice for ${memberName}. This uses the member's current package and billing setup.`}
        confirmLabel="Generate"
        onCancel={() => setConfirmGenerateOpen(false)}
        onConfirm={() => void generateInvoice()}
      />
    </MobileScreen>
  );
}

type InvoiceDetailSheetProps = {
  invoice: Invoice | null;
  onClose: () => void;
  onSharePaymentLink: (invoice: Invoice) => Promise<void>;
  onGenerateReceipt: (invoice: Invoice) => Promise<void>;
  generatingReceiptId: string | null;
};

function InvoiceDetailSheet({
  invoice,
  onClose,
  onSharePaymentLink,
  onGenerateReceipt,
  generatingReceiptId,
}: InvoiceDetailSheetProps) {
  if (!invoice) return null;

  const isPayable = !['PAID', 'CANCELLED', 'CANCELED'].includes(normalizeStatus(invoice.status));
  const canGenerateReceipt = normalizeStatus(invoice.status) === 'PAID' && Boolean(invoice.revenueTransactionId);
  const items = invoice.items || [];

  return (
    <MobileSheet
      visible={Boolean(invoice)}
      title={invoice.invoiceNumber || 'Invoice preview'}
      description={`${invoice.type || 'Invoice'} · ${formatMoney(invoice.totalAmount, invoice.currency)}`}
      onClose={onClose}
    >
      <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.sheetContent}>
          <View style={styles.invoiceHeader}>
            <MobileStatusBadge status={invoice.status || 'Draft'} />
            <MobileText variant="value" weight="bold" adjustsFontSizeToFit numberOfLines={1}>
              {formatMoney(invoice.totalAmount, invoice.currency)}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {invoice.invoiceNumber || 'No invoice number'}
            </MobileText>
          </View>

          <MobileCard compact>
            <MobileInfoRow label="Issue date" value={formatDate(invoice.issueDate || invoice.createdAt)} icon={CalendarDays} />
            <MobileInfoRow label="Due date" value={formatDate(invoice.dueDate)} icon={CalendarDays} />
            <MobileInfoRow label="Paid date" value={formatDate(invoice.paidAt)} icon={CheckCircle2} />
          </MobileCard>

          <MobileCard compact>
            <MobileInfoRow label="Subtotal" value={formatMoney(invoice.netAmount || invoice.totalAmount, invoice.currency)} icon={ReceiptText} />
            <MobileInfoRow label="Tax" value={formatMoney(invoice.taxAmount, invoice.currency)} icon={Banknote} />
            <MobileInfoRow label="Total" value={formatMoney(invoice.totalAmount, invoice.currency)} icon={FileText} status={invoice.status || 'Draft'} />
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
                <MobileCard key={item.id || `${item.description}-${index}`} compact>
                  <MobileText variant="body" weight="bold">
                    {item.description || `Item ${index + 1}`}
                  </MobileText>
                  <View style={styles.itemMeta}>
                    <MobileText variant="small" tone="secondary">
                      Qty {formatNumber(moneyNumber(item.quantity || 1))}
                    </MobileText>
                    <MobileText variant="small" weight="bold">
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
                label="Share pay link"
                icon={Share2}
                variant="primary"
                fullWidth
                onPress={() => void onSharePaymentLink(invoice)}
              />
            ) : null}
            {canGenerateReceipt ? (
              <MobileButton
                label="Generate VEFD"
                icon={Zap}
                variant="secondary"
                fullWidth
                loading={generatingReceiptId === invoice.id}
                onPress={() => void onGenerateReceipt(invoice)}
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

function normalizeStatus(status?: string | null) {
  return String(status || 'UNKNOWN').trim().toUpperCase();
}

function invoiceAccent(status?: string | null): MobileDataListItem['accent'] {
  return statusToneFor(status);
}

function moneyNumber(value?: number | string | null) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoney(value?: number | string | null, currency?: string | null) {
  return formatCurrency(moneyNumber(value), currency || 'TZS');
}

function formatOptionalMoney(value?: number | string | null, currency?: string | null) {
  if (value === undefined || value === null || value === '') return 'Not configured';
  return formatMoney(value, currency);
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    gap: 3,
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
