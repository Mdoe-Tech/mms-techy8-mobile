import { router } from 'expo-router';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Hash,
  ReceiptText,
  RefreshCw,
  Share2,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
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
  MobileLoadingState,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  createCurrentMemberInvoicePaymentLink,
  getCurrentMemberInvoice,
  type Invoice,
  type InvoiceItem,
} from '@/services/invoice-service';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import { labelFromStatus, statusToneFor, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type MobileMemberInvoiceDetailScreenProps = {
  invoiceId?: string | null;
};

export default function MobileMemberInvoiceDetailScreen({ invoiceId }: MobileMemberInvoiceDetailScreenProps) {
  const { activeView, user } = useAuth();
  const userId = user?.userId;
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingPayLink, setCreatingPayLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const listRoute = getRouteByPath('/member/invoices');

  const loadInvoice = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!invoiceId) {
        setLoading(false);
        setError('Invoice identifier is missing.');
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
        const [loadedMember, loadedInvoice] = await Promise.all([
          getCurrentMemberByUserId(userId),
          getCurrentMemberInvoice(invoiceId),
        ]);

        const invoiceMemberIds = loadedInvoice.memberIds || [];
        const belongsToMember =
          !loadedInvoice.memberId ||
          loadedInvoice.memberId === loadedMember.id ||
          invoiceMemberIds.includes(loadedMember.id);
        if (!belongsToMember) {
          throw new Error('This invoice does not belong to the signed-in member.');
        }

        setMember(loadedMember);
        setInvoice(loadedInvoice);
      } catch (loadError) {
        setMember(null);
        setInvoice(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [invoiceId, userId],
  );

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(() => loadInvoice());
    }
  }, [activeView, loadInvoice]);

  const items = useMemo(() => invoice?.items || [], [invoice?.items]);
  const itemRows = useMemo(() => buildItemRows(items, invoice?.currency), [invoice?.currency, items]);
  const isPayable = invoice ? isOpenInvoice(invoice) : false;
  const invoiceLabel = invoice?.invoiceNumber || shortInvoiceId(invoiceId);
  const status = invoice?.status || 'Unknown';
  const statusLabel = labelFromStatus(status);
  const memberName = invoice?.memberName || member?.fullLegalName || user?.fullName || 'Current member';

  const openList = useCallback(() => {
    if (listRoute) {
      router.push({ pathname: '/work/route-preview', params: { routeId: listRoute.id } } as never);
    } else {
      router.back();
    }
  }, [listRoute]);

  const sharePaymentLink = useCallback(async () => {
    if (!invoice) return;

    setCreatingPayLink(true);
    setNotice(null);
    setError(null);
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
    } catch (payLinkError) {
      setError(getApiErrorMessage(payLinkError));
    } finally {
      setCreatingPayLink(false);
    }
  }, [invoice]);

  if (activeView !== 'MEMBER') {
    return <AccessDeniedScreen title="Invoice detail" description="This native invoice detail is available from the member portal workspace." />;
  }

  if (!invoiceId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Member portal" title="Invoice detail" subtitle="Missing invoice context" onBack={() => router.back()} />
        <MobileEmptyState
          title="No invoice selected"
          description="Open an invoice from My invoices so the invoice ID is available."
          actionLabel="Back to invoices"
          onAction={openList}
        />
      </MobileScreen>
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="detail" message="Loading invoice detail" />;
  }

  if (error && !invoice) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="Invoice detail"
          subtitle="Invoice unavailable"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry invoice" variant="secondary" onPress={() => void loadInvoice('refresh')} />}
        />
        <MobileErrorState title="Invoice detail could not load" description={error} retryLabel="Retry" onRetry={() => void loadInvoice('refresh')} />
      </MobileScreen>
    );
  }

  if (!invoice) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Member portal" title="Invoice detail" onBack={() => router.back()} />
        <MobileEmptyState title="Invoice not found" description="The requested invoice could not be found for this member." actionLabel="Back" onAction={openList} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="Invoice detail"
        subtitle={member?.associationName || user?.associationName || invoice.associationName || 'Billing self-service'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh invoice"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadInvoice('refresh')}
          />
        }
      />

      {notice ? <MobileToast title="Invoice" description={notice} tone="success" /> : null}
      {error ? <MobileToast title="Invoice action failed" description={error} tone="danger" /> : null}

      <MobileDetailHeader
        eyebrow="Invoice"
        title={invoiceLabel}
        subtitle={`${invoice.type || 'General'} · ${memberName}`}
        status={status}
        statusLabel={statusLabel}
        statusTone={statusToneFor(status)}
        avatarName={invoiceLabel}
        avatarTone={toneForInvoice(invoice)}
      />

      <MobileSummaryPanel
        title={isPayable ? 'Amount due' : statusLabel}
        value={formatMoney(invoice.totalAmount, invoice.currency)}
        description={
          isPayable
            ? `${invoice.dueDate ? `Due ${formatDate(invoice.dueDate)}` : 'Due date not set'} · ${invoice.currency || 'TZS'}`
            : `${invoice.paidAt ? `Paid ${formatDate(invoice.paidAt)}` : 'No payment required'}`
        }
        tone={isPayable ? (normalizeStatus(invoice.status) === 'OVERDUE' ? 'red' : 'orange') : 'green'}
        icon={Banknote}
        footer={
          <View style={styles.summaryFooter}>
            <MobileStatusBadge status={status} label={statusLabel} />
            {refreshing ? <MobileLoadingState compact message="Refreshing" /> : null}
          </View>
        }
      />

      <View style={styles.actionRow}>
        {isPayable ? (
          <MobileButton
            label="Share payment link"
            icon={Share2}
            fullWidth
            loading={creatingPayLink}
            onPress={() => void sharePaymentLink()}
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

      <MobileCard compact>
        <MobileInfoRow label="Issue date" value={formatDate(invoice.issueDate || invoice.createdAt)} icon={CalendarDays} />
        <MobileInfoRow label="Due date" value={formatDate(invoice.dueDate)} icon={Clock3} />
        <MobileInfoRow label="Paid date" value={formatDate(invoice.paidAt)} icon={CheckCircle2} />
        <MobileInfoRow label="Invoice ID" value={shortInvoiceId(invoice.id)} helper={invoice.id} icon={Hash} />
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Subtotal" value={formatMoney(invoice.netAmount || invoice.totalAmount, invoice.currency)} description="Before tax" tone="blue" icon={ReceiptText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Tax" value={formatMoney(invoice.taxAmount, invoice.currency)} description="Tax amount" tone="slate" icon={FileText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Items" value={formatNumber(items.length)} description="Invoice lines" tone="purple" icon={ReceiptText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Status" value={statusLabel} description="Current billing state" tone={isPayable ? 'orange' : 'green'} icon={statusIcon(status)} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Line items
        </MobileText>
        <MobileStatusBadge status="Items" label={formatNumber(items.length)} tone="neutral" />
      </View>

      {itemRows.length ? (
        <MobileDataList items={itemRows} showChevron={false} />
      ) : (
        <MobileEmptyState title="No line items" description="This invoice has no item breakdown from the server." />
      )}

      <MobileCard compact>
        <MobileInfoRow
          label="Billed to"
          value={invoice.billToName || invoice.memberName || memberName}
          helper={invoice.membershipNumber || member?.membershipNumber || 'No membership number'}
          icon={UserRound}
          status={member?.status || 'Active'}
        />
        <MobileInfoRow label="Phone" value={invoice.billToPhone || invoice.memberPhone || member?.contactInfo?.phoneNumber || 'Not available'} icon={FileText} />
        <MobileInfoRow label="Email" value={invoice.billToEmail || invoice.memberEmail || member?.contactInfo?.email || 'Not available'} icon={FileText} />
      </MobileCard>

      {invoice.receiptNumber || invoice.traCode || invoice.traLink ? (
        <MobileCard compact>
          <MobileInfoRow label="Receipt" value={invoice.receiptNumber || invoice.traCode || 'TRA receipt'} icon={ReceiptText} status="Verified" />
          <MobileInfoRow label="TRA link" value={invoice.traLink ? 'Available' : 'Not available'} icon={ExternalLink} />
        </MobileCard>
      ) : null}

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
    </MobileScreen>
  );
}

function buildItemRows(items: InvoiceItem[], currency?: string | null): MobileDataListItem[] {
  return items.map((item, index) => ({
    id: item.id || `${item.description || 'item'}-${index}`,
    title: item.description || `Item ${index + 1}`,
    subtitle: item.itemCode ? `Code ${item.itemCode}` : `Quantity ${formatNumber(moneyNumber(item.quantity || 1))}`,
    meta: `${formatMoney(item.unitPrice, currency)} each`,
    amount: formatMoney(item.totalAmount, currency),
    status: item.taxAmount && moneyNumber(item.taxAmount) > 0 ? 'Taxed' : 'No tax',
    statusTone: item.taxAmount && moneyNumber(item.taxAmount) > 0 ? 'info' : 'neutral',
    accent: 'primary',
  }));
}

function isOpenInvoice(invoice: Invoice) {
  return !['PAID', 'CANCELLED', 'CANCELED'].includes(normalizeStatus(invoice.status));
}

function toneForInvoice(invoice: Invoice): StatusTone {
  const status = normalizeStatus(invoice.status);
  if (status === 'PAID') return 'paid';
  if (status === 'OVERDUE') return 'danger';
  if (['ISSUED', 'PENDING', 'UNPAID', 'PARTIAL'].includes(status)) return 'warning';
  if (status === 'DRAFT') return 'review';
  if (['CANCELLED', 'CANCELED'].includes(status)) return 'neutral';
  return 'primary';
}

function statusIcon(status?: string | null) {
  const normalized = normalizeStatus(status);
  if (normalized === 'PAID') return CheckCircle2;
  if (normalized === 'OVERDUE') return AlertTriangle;
  if (['ISSUED', 'PENDING', 'UNPAID', 'PARTIAL'].includes(normalized)) return Clock3;
  return FileText;
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

function shortInvoiceId(id?: string | null) {
  if (!id) return 'Invoice';
  return `Invoice ${id.slice(0, 8)}`;
}

const styles = StyleSheet.create({
  summaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionRow: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
