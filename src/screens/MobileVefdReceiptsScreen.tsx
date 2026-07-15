import { router } from 'expo-router';
import {
  AlertTriangle,
  Clock3,
  ExternalLink,
  FileCheck2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  MobileEmptyState,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileReportExportButton,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getCurrentAssociationInfo,
  getVefdReceiptsPage,
  type CurrentAssociationInfo,
  type VefdReceipt,
} from '@/services/invoice-service';
import { labelFromStatus, type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber, initialsFromName } from '@/utils/format';

type StatusFilter = 'all' | 'verified' | 'pending' | 'failed';
type SortOption = 'dateDesc' | 'dateAsc' | 'receiptAsc' | 'amountDesc' | 'taxDesc' | 'statusAsc';

const statusTabs: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'verified', label: 'Verified' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

const sortOptions = [
  { value: 'dateDesc', label: 'Newest receipt', description: 'Latest fiscal receipts first.' },
  { value: 'dateAsc', label: 'Oldest receipt', description: 'Earliest fiscal receipts first.' },
  { value: 'receiptAsc', label: 'Receipt number', description: 'Sort by receipt number.' },
  { value: 'amountDesc', label: 'Highest amount', description: 'Largest fiscal receipt totals first.' },
  { value: 'taxDesc', label: 'Highest VAT', description: 'Largest VAT amounts first.' },
  { value: 'statusAsc', label: 'Status', description: 'Group by verification state.' },
];

export default function MobileVefdReceiptsScreen() {
  const { activeView } = useAuth();
  const [receipts, setReceipts] = useState<VefdReceipt[]>([]);
  const [associationInfo, setAssociationInfo] = useState<CurrentAssociationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortValue, setSortValue] = useState<SortOption>('dateDesc');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<VefdReceipt | null>(null);

  const loadReceipts = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const [receiptPage, association] = await Promise.all([
        getVefdReceiptsPage(250),
        getCurrentAssociationInfo().catch(() => null),
      ]);
      setReceipts(receiptPage.content || []);
      setAssociationInfo(association);
    } catch (loadError) {
      setReceipts([]);
      setAssociationInfo(null);
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadReceipts();
    });
    return () => {
      active = false;
    };
  }, [loadReceipts]);

  const stats = useMemo(() => {
    const verified = receipts.filter((receipt) => receiptStatusKind(receipt.status) === 'verified').length;
    const pending = receipts.filter((receipt) => receiptStatusKind(receipt.status) === 'pending').length;
    const failed = receipts.filter((receipt) => receiptStatusKind(receipt.status) === 'failed').length;
    return {
      total: receipts.length,
      verified,
      pending,
      failed,
      totalAmount: receipts.reduce((sum, receipt) => sum + toNumber(receipt.totalInclOfTax), 0),
      totalTax: receipts.reduce((sum, receipt) => sum + toNumber(receipt.totalTax), 0),
    };
  }, [receipts]);

  const statusCounts = useMemo(
    () =>
      statusTabs.reduce<Record<StatusFilter, number>>((acc, tab) => {
        acc[tab.value] = tab.value === 'all' ? receipts.length : receipts.filter((receipt) => receiptStatusKind(receipt.status) === tab.value).length;
        return acc;
      }, {} as Record<StatusFilter, number>),
    [receipts],
  );

  const filteredReceipts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = receipts.filter((receipt) => {
      const matchesStatus = statusFilter === 'all' || receiptStatusKind(receipt.status) === statusFilter;
      const haystack = [
        receipt.receiptNumber,
        receipt.invoiceId,
        receipt.verificationCode,
        receipt.revenueTransactionId,
        receipt.status,
        receipt.znum,
        receipt.vrn,
        String(receipt.totalInclOfTax || ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
    return sortReceipts(rows, sortValue);
  }, [receipts, searchTerm, sortValue, statusFilter]);

  const listItems = useMemo(
    () =>
      filteredReceipts.map((receipt) => ({
        id: receipt.id,
        title: receipt.receiptNumber || 'Pending receipt',
        subtitle: `Invoice ${receipt.invoiceId || '-'} - ${receipt.verificationCode || 'No verification code'}`,
        meta: `${formatDate(receipt.receiptDate || receipt.invoiceDate || receipt.createdAt)} - ${receipt.receiptTime || 'time pending'}`,
        amount: formatCurrency(toNumber(receipt.totalInclOfTax)),
        status: receiptStatusLabel(receipt.status),
        statusTone: receiptStatusTone(receipt.status),
        accent: receiptStatusTone(receipt.status),
        initials: initialsFromName(receiptStatusLabel(receipt.status)),
      })),
    [filteredReceipts],
  );

  const receiptReportOptions = useMemo(
    () => ({
      title: 'VEFD Fiscal Receipts',
      associationName: associationInfo?.name || 'Association',
      purpose: 'A current-view report of fiscal receipts, VAT values, verification status, and TRA receipt references.',
      rows: filteredReceipts,
      fileName: 'nane-vefd-receipts',
      metrics: [
        { label: 'Total receipts', value: formatNumber(stats.total), helper: 'Fiscal records' },
        { label: 'Verified', value: formatNumber(stats.verified), helper: 'TRA accepted' },
        { label: 'Pending', value: formatNumber(stats.pending), helper: 'Awaiting verification' },
        { label: 'Total VAT', value: formatCurrency(stats.totalTax), helper: formatCurrency(stats.totalAmount) },
      ],
      filters: [
        { label: 'Search', value: searchTerm || 'All' },
        { label: 'Status', value: statusTabs.find((tab) => tab.value === statusFilter)?.label || statusFilter },
        { label: 'Sort', value: sortOptions.find((option) => option.value === sortValue)?.label || sortValue },
      ],
      columns: [
        { key: 'number', label: '#', align: 'center' as const, width: '5%', value: (_row: VefdReceipt, index: number) => index + 1 },
        { key: 'receiptNumber', label: 'Receipt No.', width: '13%', value: (row: VefdReceipt) => row.receiptNumber || '-' },
        { key: 'invoiceId', label: 'Invoice ID', width: '13%', value: (row: VefdReceipt) => row.invoiceId || '-' },
        { key: 'transactionId', label: 'Transaction ID', width: '13%', value: (row: VefdReceipt) => row.revenueTransactionId || '-' },
        { key: 'verificationCode', label: 'Verification Code', width: '13%', value: (row: VefdReceipt) => row.verificationCode || '-' },
        { key: 'receiptDate', label: 'Receipt Date', width: '11%', value: (row: VefdReceipt) => formatDate(row.receiptDate || row.invoiceDate || row.createdAt) },
        { key: 'status', label: 'Status', width: '10%', value: (row: VefdReceipt) => receiptStatusLabel(row.status) },
        { key: 'vat', label: 'VAT', align: 'right' as const, width: '10%', value: (row: VefdReceipt) => formatCurrency(toNumber(row.totalTax)) },
        { key: 'total', label: 'Total', align: 'right' as const, width: '12%', value: (row: VefdReceipt) => formatCurrency(toNumber(row.totalInclOfTax)) },
        { key: 'link', label: 'Receipt Link', width: '18%', value: (row: VefdReceipt) => row.link || '-' },
      ],
    }),
    [associationInfo?.name, filteredReceipts, searchTerm, sortValue, stats, statusFilter],
  );

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="VEFD receipts" description="This native fiscal receipt workspace is available for association admins only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading fiscal receipts" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Billing"
        title="VEFD receipts"
        subtitle="TRA fiscal receipts and VAT verification"
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh receipts" onPress={() => loadReceipts('refresh')} disabled={refreshing} />}
      />

      {error ? <MobileStatusBadge status="VEFD issue" label={error} tone="danger" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total receipts" value={formatNumber(stats.total)} description="Fiscal records" tone="blue" icon={ReceiptText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Verified" value={formatNumber(stats.verified)} description="TRA accepted" tone="green" icon={FileCheck2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending" value={formatNumber(stats.pending)} description="Awaiting verification" tone="orange" icon={Clock3} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Failed" value={formatNumber(stats.failed)} description="Needs attention" tone="red" icon={AlertTriangle} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total VAT" value={formatCurrency(stats.totalTax)} description={formatCurrency(stats.totalAmount)} tone="teal" icon={ShieldCheck} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Association" value={associationInfo?.name ? 'Current' : 'Unknown'} description={associationInfo?.name || 'Receipt metadata'} tone="slate" icon={ReceiptText} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search receipt, invoice, code..." onFilterPress={() => setSortOpen(true)} filterLabel="Sort" />
      <MobileStatusTabs value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} tabs={statusTabs.map((tab) => ({ ...tab, count: statusCounts[tab.value] || 0 }))} />

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitle}>
          <MobileText variant="section" weight="bold">
            Fiscal receipts
          </MobileText>
          <MobileText variant="small" tone="secondary">
            Showing {formatNumber(filteredReceipts.length)} of {formatNumber(receipts.length)} receipt(s)
          </MobileText>
        </View>
        <MobileReportExportButton options={receiptReportOptions} size="sm" onError={(exportError) => setError(getApiErrorMessage(exportError))} />
      </View>

      {listItems.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const receipt = filteredReceipts.find((row) => row.id === item.id);
            if (receipt) setSelectedReceipt(receipt);
          }}
        />
      ) : (
        <MobileEmptyState
          title={receipts.length > 0 ? 'No matching receipts' : 'No VEFD receipts yet'}
          description={receipts.length > 0 ? 'Clear search or status filters to see more fiscal receipts.' : 'Fiscal receipts will appear when paid invoices or revenue transactions are fiscalized.'}
        />
      )}

      <MobileSortSheet visible={sortOpen} value={sortValue} options={sortOptions} onChange={(value) => setSortValue(value as SortOption)} onClose={() => setSortOpen(false)} />
      <ReceiptDetailSheet receipt={selectedReceipt} associationInfo={associationInfo} onClose={() => setSelectedReceipt(null)} />
    </MobileScreen>
  );
}

function ReceiptDetailSheet({
  receipt,
  associationInfo,
  onClose,
}: {
  receipt: VefdReceipt | null;
  associationInfo: CurrentAssociationInfo | null;
  onClose: () => void;
}) {
  if (!receipt) return null;
  const link = receipt.link || null;
  return (
    <MobileSheet visible title="VEFD receipt" description={receipt.receiptNumber || 'Pending receipt'} onClose={onClose}>
      <MobileCard compact>
        <MobileInfoRow label="Association" value={associationInfo?.name || 'Association'} helper={associationInfo?.tin ? `TIN ${associationInfo.tin}` : associationInfo?.address || undefined} icon={ReceiptText} />
        <MobileInfoRow label="Status" value={receiptStatusLabel(receipt.status)} helper={receipt.verificationCode || 'Verification pending'} icon={ShieldCheck} status={receiptStatusLabel(receipt.status)} />
        <MobileInfoRow label="Invoice" value={receipt.invoiceId || '-'} helper={receipt.revenueTransactionId || 'No transaction ID'} icon={ReceiptText} />
        <MobileInfoRow label="Date" value={formatDate(receipt.receiptDate || receipt.invoiceDate || receipt.createdAt)} helper={receipt.receiptTime || undefined} icon={Clock3} />
        <MobileInfoRow label="Total" value={formatCurrency(toNumber(receipt.totalInclOfTax))} helper={`VAT ${formatCurrency(toNumber(receipt.totalTax))}`} icon={ReceiptText} />
        {receipt.znum || receipt.vrn ? <MobileInfoRow label="Fiscal IDs" value={receipt.znum || '-'} helper={receipt.vrn ? `VRN ${receipt.vrn}` : undefined} icon={FileCheck2} /> : null}
      </MobileCard>
      {link ? <MobileButton label="Verify on TRA" icon={ExternalLink} onPress={() => Linking.openURL(link)} fullWidth /> : null}
    </MobileSheet>
  );
}

function receiptStatusKind(status?: string | null): Exclude<StatusFilter, 'all'> {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('success') || normalized.includes('verified') || normalized.includes('complete')) return 'verified';
  if (normalized.includes('fail') || normalized.includes('error') || normalized.includes('reject')) return 'failed';
  return 'pending';
}

function receiptStatusTone(status?: string | null): StatusTone {
  const kind = receiptStatusKind(status);
  if (kind === 'verified') return 'success';
  if (kind === 'failed') return 'danger';
  return 'warning';
}

function receiptStatusLabel(status?: string | null) {
  const kind = receiptStatusKind(status);
  if (kind === 'verified') return 'Verified';
  if (kind === 'failed') return 'Failed';
  return status ? labelFromStatus(status) : 'Pending';
}

function sortReceipts(rows: VefdReceipt[], sortValue: SortOption) {
  return [...rows].sort((a, b) => {
    if (sortValue === 'receiptAsc') return String(a.receiptNumber || '').localeCompare(String(b.receiptNumber || ''));
    if (sortValue === 'amountDesc') return toNumber(b.totalInclOfTax) - toNumber(a.totalInclOfTax);
    if (sortValue === 'taxDesc') return toNumber(b.totalTax) - toNumber(a.totalTax);
    if (sortValue === 'statusAsc') return receiptStatusKind(a.status).localeCompare(receiptStatusKind(b.status));
    const modifier = sortValue === 'dateAsc' ? 1 : -1;
    return (dateValue(a.createdAt || a.receiptDate || a.invoiceDate) - dateValue(b.createdAt || b.receiptDate || b.invoiceDate)) * modifier;
  });
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value?: string | null) {
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

const styles = StyleSheet.create({
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
});
