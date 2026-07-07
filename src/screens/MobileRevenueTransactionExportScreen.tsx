import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { CalendarDays, FileSpreadsheet, Filter, RotateCcw, Share2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileFormSection,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobileScreen,
  MobileSelect,
  MobileStatusBadge,
  MobileTextInput,
} from '@/components/mobile';
import { exportRevenueTransactions } from '@/services/revenue-transaction-service';
import { getApiErrorMessage } from '@/types/api';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type ExportFilters = {
  paymentType: string;
  paymentStatus: string;
  startDate: string;
  endDate: string;
};

const paymentTypes = [
  { label: 'All types', value: 'ALL' },
  { label: 'Share purchase', value: 'SHARE_PURCHASE' },
  { label: 'Fine', value: 'FINE' },
  { label: 'Social contribution', value: 'SOCIAL_CONTRIBUTION' },
  { label: 'Penalty', value: 'PENALTY' },
  { label: 'Membership fee', value: 'MEMBERSHIP_FEE' },
  { label: 'Loan repayment', value: 'LOAN_REPAYMENT' },
  { label: 'Other', value: 'OTHER' },
];

const paymentStatuses = [
  { label: 'All statuses', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Refunded', value: 'REFUNDED' },
];

export default function MobileRevenueTransactionExportScreen() {
  const { activeView, associationId } = useAuth();
  const [filters, setFilters] = useState<ExportFilters>({
    paymentType: 'ALL',
    paymentStatus: 'ALL',
    startDate: '',
    endDate: '',
  });
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<{ fileName: string; size: number; uri: string } | null>(null);

  const activeFilterCount = useMemo(
    () =>
      [
        filters.paymentType !== 'ALL',
        filters.paymentStatus !== 'ALL',
        Boolean(filters.startDate),
        Boolean(filters.endDate),
      ].filter(Boolean).length,
    [filters],
  );
  const selectedType = paymentTypes.find((type) => type.value === filters.paymentType)?.label || 'All types';
  const selectedStatus = paymentStatuses.find((status) => status.value === filters.paymentStatus)?.label || 'All statuses';
  const dateRange = dateRangeLabel(filters.startDate, filters.endDate);

  const updateFilter = (field: keyof ExportFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const resetFilters = () => {
    setFilters({
      paymentType: 'ALL',
      paymentStatus: 'ALL',
      startDate: '',
      endDate: '',
    });
    setError(null);
  };

  const handleExport = async () => {
    if (!associationId) {
      setError('Association context is required before exporting transactions.');
      return;
    }
    if (filters.startDate && !isIsoDate(filters.startDate)) {
      setError('Enter a valid start date using YYYY-MM-DD.');
      return;
    }
    if (filters.endDate && !isIsoDate(filters.endDate)) {
      setError('Enter a valid end date using YYYY-MM-DD.');
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const response = await exportRevenueTransactions({
        associationId,
        paymentType: filters.paymentType === 'ALL' ? undefined : filters.paymentType,
        paymentStatus: filters.paymentStatus === 'ALL' ? undefined : filters.paymentStatus,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      const fileName = `revenue_transactions_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      const bytes = new Uint8Array(response.data);
      await FileSystem.writeAsStringAsync(fileUri, arrayBufferToBase64(response.data), {
        encoding: FileSystem.EncodingType.Base64,
      });
      setLastExport({ fileName, size: bytes.byteLength, uri: fileUri });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Share revenue transactions export',
          UTI: 'org.openxmlformats.spreadsheetml.sheet',
        });
      }
    } catch (exportError) {
      setError(getApiErrorMessage(exportError));
    } finally {
      setExporting(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Export transactions"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader showLogo eyebrow="Finance" title="Export transactions" subtitle="Download filtered Excel workbook" onBack={() => router.back()} />

      {error ? <MobileStatusBadge status="Export issue" label={error} tone="danger" /> : null}
      {lastExport ? <MobileStatusBadge status="Completed" label={`Saved ${lastExport.fileName}`} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active filters" value={String(activeFilterCount)} description={`${selectedType} · ${selectedStatus}`} tone={activeFilterCount ? 'blue' : 'slate'} icon={Filter} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Export format" value="Excel" description={dateRange} tone={lastExport ? 'green' : 'teal'} icon={FileSpreadsheet} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFormSection title="Export filters" description="Leave filters as All to export every available revenue transaction for this association.">
        <MobileSelect label="Payment type" value={filters.paymentType} options={paymentTypes} onChange={(value) => updateFilter('paymentType', value)} />
        <MobileSelect label="Payment status" value={filters.paymentStatus} options={paymentStatuses} onChange={(value) => updateFilter('paymentStatus', value)} />
        <MobileTextInput label="Start date" value={filters.startDate} onChangeText={(value) => updateFilter('startDate', value)} placeholder="Optional YYYY-MM-DD" icon={CalendarDays} disabled={exporting} />
        <MobileTextInput label="End date" value={filters.endDate} onChangeText={(value) => updateFilter('endDate', value)} placeholder="Optional YYYY-MM-DD" icon={CalendarDays} disabled={exporting} />
        <View style={styles.actions}>
          <MobileButton label="Reset" icon={RotateCcw} variant="secondary" onPress={resetFilters} disabled={exporting || activeFilterCount === 0} style={styles.flexButton} />
          <MobileButton label="Export Excel" icon={Share2} onPress={handleExport} loading={exporting} style={styles.flexButton} />
        </View>
      </MobileFormSection>

      {lastExport ? (
        <MobileCard compact>
          <MobileInfoRow label="File" value={lastExport.fileName} helper={formatBytes(lastExport.size)} icon={FileSpreadsheet} status="Completed" />
          <MobileInfoRow label="Filters" value={`${selectedType} · ${selectedStatus}`} helper={dateRange} icon={Filter} />
        </MobileCard>
      ) : (
        <MobileEmptyState title="Ready to export" description="Choose filters if needed, then export revenue transactions to Excel." />
      )}
    </MobileScreen>
  );
}

function dateRangeLabel(startDate: string, endDate: string) {
  if (startDate && endDate) return `${startDate} - ${endDate}`;
  if (startDate) return `From ${startDate}`;
  if (endDate) return `Until ${endDate}`;
  return 'All dates';
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KB`;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
});
