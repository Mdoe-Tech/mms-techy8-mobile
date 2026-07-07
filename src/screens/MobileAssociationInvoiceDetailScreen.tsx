import { router } from 'expo-router';
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  ExternalLink,
  FileText,
  ReceiptText,
  RefreshCw,
  Send,
  Share2,
  Trash2,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';

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
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  cancelAssociationInvoice,
  createInvoicePaymentLink,
  deleteAssociationInvoice,
  generateVefdReceiptForTransaction,
  getInvoice,
  getVefdReceiptForTransaction,
  issueAssociationInvoice,
  type Invoice,
  type VefdReceipt,
} from '@/services/invoice-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type MobileAssociationInvoiceDetailScreenProps = {
  invoiceId?: string;
};

export default function MobileAssociationInvoiceDetailScreen({ invoiceId }: MobileAssociationInvoiceDetailScreenProps) {
  const { activeView, user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [receipt, setReceipt] = useState<VefdReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = useMemo(() => hasInvoiceManagePermission(user), [user]);

  const loadInvoice = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!invoiceId) {
        setLoading(false);
        return;
      }
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const loaded = await getInvoice(invoiceId);
        setInvoice(loaded);
        if (loaded.revenueTransactionId) {
          try {
            setReceipt(await getVefdReceiptForTransaction(loaded.revenueTransactionId));
          } catch {
            setReceipt(null);
          }
        } else {
          setReceipt(null);
        }
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [invoiceId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadInvoice());
  }, [loadInvoice]);

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Invoice detail" description="This native page is available for association admin workspaces only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="detail" message="Loading invoice detail" />;
  }

  if (!invoiceId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Billing" title="Invoice detail" subtitle="Invoice context unavailable" onBack={() => router.back()} />
        <MobileEmptyState title="Invoice not selected" description="Open an invoice from the association invoice register." />
      </MobileScreen>
    );
  }

  if (error && !invoice) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Billing"
          title="Invoice detail"
          subtitle="Could not load invoice"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadInvoice('refresh')} />}
        />
        <MobileErrorState title="Invoice could not load" description={error} retryLabel="Retry" onRetry={() => void loadInvoice('refresh')} />
      </MobileScreen>
    );
  }

  if (!invoice) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Billing" title="Invoice detail" subtitle="Invoice not found" onBack={() => router.back()} />
        <MobileEmptyState title="Invoice not found" description="The invoice does not exist or has been removed." />
      </MobileScreen>
    );
  }

  const status = normalizeStatus(invoice.status);
  const canDelete = canManage && (status === 'DRAFT' || status === 'CANCELLED' || status === 'CANCELED');
  const canChange = canManage && status !== 'PAID' && status !== 'CANCELLED' && status !== 'CANCELED';
  const receiptEligible = status === 'PAID' && Boolean(invoice.revenueTransactionId) && !receipt && !invoice.receiptNumber;

  const sharePaymentLink = async () => {
    setWorking(true);
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
      setWorking(false);
    }
  };

  const issueInvoice = async () => {
    setWorking(true);
    setError(null);
    try {
      setInvoice(await issueAssociationInvoice(invoice.id));
      setNotice('Invoice issued.');
      await loadInvoice('refresh');
    } catch (issueError) {
      setError(getApiErrorMessage(issueError));
    } finally {
      setWorking(false);
    }
  };

  const cancelInvoice = async () => {
    setWorking(true);
    setError(null);
    try {
      setInvoice(await cancelAssociationInvoice(invoice.id));
      setCancelOpen(false);
      setNotice('Invoice cancelled.');
      await loadInvoice('refresh');
    } catch (cancelError) {
      setError(getApiErrorMessage(cancelError));
    } finally {
      setWorking(false);
    }
  };

  const deleteInvoice = async () => {
    setWorking(true);
    setError(null);
    try {
      await deleteAssociationInvoice(invoice.id);
      setDeleteOpen(false);
      setNotice('Invoice deleted.');
      router.back();
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setWorking(false);
    }
  };

  const generateReceipt = async () => {
    if (!invoice.revenueTransactionId) {
      setError('This invoice has no linked paid transaction.');
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await generateVefdReceiptForTransaction(invoice.revenueTransactionId);
      setNotice('VFD receipt generated.');
      await loadInvoice('refresh');
    } catch (receiptError) {
      setError(getApiErrorMessage(receiptError));
    } finally {
      setWorking(false);
    }
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Billing"
        title={invoice.invoiceNumber || 'Invoice detail'}
        subtitle={`${labelFromEnum(invoice.type || 'GENERAL')} · ${formatDate(invoice.issueDate || invoice.createdAt)}`}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" variant="secondary" disabled={refreshing} onPress={() => void loadInvoice('refresh')} />}
      />

      {notice ? <MobileToast title={notice} tone="success" /> : null}
      {error ? <MobileToast title="Invoice action failed" description={error} tone="danger" /> : null}

      <MobileDetailHeader
        title={billToLabel(invoice)}
        subtitle={invoice.invoiceNumber || invoice.id}
        avatarName={billToLabel(invoice) || 'Invoice'}
        avatarTone={invoiceTone(invoice)}
        status={isInvoiceOverdue(invoice) && status !== 'PAID' ? 'Overdue' : invoice.status || 'Draft'}
        eyebrow={invoice.membershipNumber || invoice.billToEmail || invoice.memberEmail || 'Manual billing contact'}
      />

      <MobileSummaryPanel
        title="Invoice total"
        value={formatMoney(invoice.totalAmount, invoice.currency)}
        description={`Outstanding status: ${isInvoiceOverdue(invoice) ? 'Overdue' : labelFromEnum(invoice.status || 'Draft')}`}
        tone={summaryTone(invoice)}
        icon={ReceiptText}
      />

      <View style={styles.actions}>
        {canChange ? <MobileButton label="Pay link" icon={Share2} variant="secondary" size="sm" loading={working} onPress={() => void sharePaymentLink()} /> : null}
        {canManage && status === 'DRAFT' ? <MobileButton label="Issue" icon={Send} size="sm" loading={working} onPress={() => void issueInvoice()} /> : null}
        {receiptEligible ? <MobileButton label="Issue VFD" icon={ReceiptText} size="sm" loading={working} onPress={() => void generateReceipt()} /> : null}
        {canChange ? <MobileButton label="Cancel" icon={Ban} variant="secondary" size="sm" loading={working} onPress={() => setCancelOpen(true)} /> : null}
        {canDelete ? <MobileButton label="Delete" icon={Trash2} variant="danger" size="sm" loading={working} onPress={() => setDeleteOpen(true)} /> : null}
      </View>

      <MobileCard compact>
        <MobileInfoRow label="Bill to" value={billToLabel(invoice)} helper={invoice.billToEmail || invoice.memberEmail || 'No email recorded'} icon={Users} />
        <MobileInfoRow label="Contact" value={invoice.billToPhone || invoice.memberPhone || 'No phone recorded'} helper={invoice.billToAddress || 'No address recorded'} icon={Users} />
        <MobileInfoRow label="Membership" value={invoice.membershipNumber || 'Not linked'} helper={invoice.memberId || 'Manual or consolidated invoice'} icon={FileText} />
        <MobileInfoRow label="Dates" value={`Issued ${formatDate(invoice.issueDate || invoice.createdAt)}`} helper={`Due ${formatDate(invoice.dueDate)}${invoice.paidAt ? ` · Paid ${formatDate(invoice.paidAt)}` : ''}`} icon={CalendarDays} />
      </MobileCard>

      <InvoiceItemsCard invoice={invoice} />

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            TRA / VFD receipt
          </MobileText>
          <MobileStatusBadge status={receipt || invoice.receiptNumber ? 'Issued' : receiptEligible ? 'Ready' : 'Pending'} tone={receipt || invoice.receiptNumber ? 'success' : receiptEligible ? 'primary' : 'neutral'} />
        </View>
        <MobileInfoRow label="Receipt number" value={receipt?.receiptNumber || invoice.receiptNumber || 'Not issued'} helper={receipt?.verificationCode || invoice.traCode || 'No verification code'} icon={ReceiptText} />
        <MobileInfoRow label="Transaction" value={invoice.revenueTransactionId || 'No linked transaction'} helper={invoice.zNum || receipt?.znum || 'No Z number'} icon={FileText} />
        {receipt?.link || invoice.traLink ? (
          <MobileButton label="Open verification" icon={ExternalLink} variant="secondary" size="sm" onPress={() => void Linking.openURL((receipt?.link || invoice.traLink) as string)} />
        ) : null}
      </MobileCard>

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

      <MobileButton label="Back to invoices" icon={ArrowLeft} variant="secondary" onPress={() => router.back()} fullWidth />

      <MobileConfirmSheet
        visible={cancelOpen}
        title="Cancel invoice?"
        description={`${invoice.invoiceNumber || 'This invoice'} will no longer be payable.`}
        confirmLabel={working ? 'Cancelling...' : 'Cancel invoice'}
        destructive
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => void cancelInvoice()}
      />

      <MobileConfirmSheet
        visible={deleteOpen}
        title="Delete invoice?"
        description={`${invoice.invoiceNumber || 'This invoice'} will be removed. Only draft or cancelled invoices can be deleted.`}
        confirmLabel={working ? 'Deleting...' : 'Delete'}
        destructive
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void deleteInvoice()}
      />
    </MobileScreen>
  );
}

function InvoiceItemsCard({ invoice }: { invoice: Invoice }) {
  const items = invoice.items || [];
  return (
    <MobileCard compact>
      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Invoice items
        </MobileText>
        <MobileStatusBadge status={`${formatNumber(items.length)} item${items.length === 1 ? '' : 's'}`} tone="neutral" />
      </View>
      {items.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.itemsWrap}>
            {items.map((item, index) => (
              <View key={item.id || `${item.description}-${index}`} style={styles.itemRow}>
                <View style={styles.itemCopy}>
                  <MobileText variant="body" weight="bold">
                    {item.description || `Item ${index + 1}`}
                  </MobileText>
                  <MobileText variant="small" tone="secondary">
                    Qty {formatNumber(Number(item.quantity || 1))} · Unit {formatMoney(item.unitPrice, invoice.currency)} · Tax {formatMoney(item.taxAmount, invoice.currency)}
                  </MobileText>
                </View>
                <MobileText variant="body" weight="bold">
                  {formatMoney(item.totalAmount, invoice.currency)}
                </MobileText>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <MobileText variant="small" tone="secondary">
          No invoice item lines were returned.
        </MobileText>
      )}
      <View style={styles.totals}>
        <MobileInfoRow label="Subtotal" value={formatMoney(invoice.netAmount || invoice.totalAmount, invoice.currency)} icon={FileText} />
        <MobileInfoRow label="Tax" value={formatMoney(invoice.taxAmount, invoice.currency)} icon={ReceiptText} />
        <MobileInfoRow label="Total" value={formatMoney(invoice.totalAmount, invoice.currency)} icon={ReceiptText} status={invoice.status || 'Draft'} />
      </View>
    </MobileCard>
  );
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

function summaryTone(invoice: Invoice) {
  const tone = invoiceTone(invoice);
  if (tone === 'danger') return 'red';
  if (tone === 'success') return 'green';
  if (tone === 'warning') return 'orange';
  if (tone === 'info') return 'teal';
  return 'blue';
}

function formatMoney(value?: number | string | null, currency?: string | null) {
  return formatCurrency(moneyNumber(value), currency || 'TZS');
}

function moneyNumber(value?: number | string | null) {
  const numberValue = typeof value === 'number' ? value : Number(String(value || '0').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numberValue) ? numberValue : 0;
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  itemsWrap: {
    minWidth: 320,
    gap: 2,
  },
  itemRow: {
    minWidth: 320,
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
  totals: {
    paddingTop: 8,
  },
});
