import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { CalendarDays, Download, FileJson, FileSpreadsheet, Filter, RotateCcw, Share2 } from 'lucide-react-native';
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
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAssociationLoansPage, type AssociationLoanSummary } from '@/services/loan-service';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type ExportFormat = 'csv' | 'json';

type ExportFilters = {
  format: ExportFormat;
  status: string;
  startDate: string;
  endDate: string;
  fileName: string;
};

type LastExport = {
  fileName: string;
  uri: string;
  count: number;
  size: number;
  format: ExportFormat;
};

const exportLimit = 1000;

const formatOptions = [
  { label: 'CSV spreadsheet', value: 'csv' },
  { label: 'JSON data file', value: 'json' },
];

const statusOptions = [
  { label: 'All statuses', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Disbursed', value: 'DISBURSED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Defaulted', value: 'DEFAULTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export default function MobileLoanExportScreen() {
  const { activeView, associationId } = useAuth();
  const [filters, setFilters] = useState<ExportFilters>({
    format: 'csv',
    status: 'ALL',
    startDate: '',
    endDate: '',
    fileName: '',
  });
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<LastExport | null>(null);

  const activeFilterCount = useMemo(
    () => [filters.status !== 'ALL', Boolean(filters.startDate), Boolean(filters.endDate)].filter(Boolean).length,
    [filters.endDate, filters.startDate, filters.status],
  );
  const dateScope = dateRangeLabel(filters.startDate, filters.endDate);
  const selectedFormat = formatOptions.find((option) => option.value === filters.format)?.label || 'CSV spreadsheet';
  const plannedFileName = buildFileName(filters.fileName, filters.format);

  const updateFilter = (field: keyof ExportFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value as ExportFilters[keyof ExportFilters] }));
    setError(null);
  };

  const resetFilters = () => {
    setFilters({
      format: 'csv',
      status: 'ALL',
      startDate: '',
      endDate: '',
      fileName: '',
    });
    setError(null);
  };

  const handleExport = async () => {
    if (!associationId) {
      setError('Association context is required before exporting loans.');
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
    if (filters.startDate && filters.endDate && new Date(filters.startDate).getTime() > new Date(filters.endDate).getTime()) {
      setError('Start date must be before end date.');
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const response = await getAssociationLoansPage({
        associationId,
        status: filters.status === 'ALL' ? undefined : filters.status,
        startDate: filters.startDate ? `${filters.startDate}T00:00:00` : undefined,
        endDate: filters.endDate ? `${filters.endDate}T23:59:59` : undefined,
        page: 0,
        size: exportLimit,
        sort: 'requestDate,desc',
      });
      const loans = response.content || [];
      const content = filters.format === 'json' ? buildJson(loans) : buildCsv(loans);
      const fileName = plannedFileName;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, content);
      const info = await FileSystem.getInfoAsync(fileUri);
      setLastExport({
        fileName,
        uri: fileUri,
        count: loans.length,
        size: info.exists && 'size' in info ? Number(info.size || 0) : content.length,
        format: filters.format,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: filters.format === 'json' ? 'application/json' : 'text/csv',
          dialogTitle: 'Share loan export',
        });
      }
    } catch (exportError) {
      setError(getApiErrorMessage(exportError));
    } finally {
      setExporting(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Export loans" description="This native page is available for association admin workspaces only." />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader showLogo eyebrow="Loans" title="Export loans" subtitle="Download loan records for reporting" onBack={() => router.back()} />

      {error ? <MobileStatusBadge status="Export issue" label={error} tone="danger" /> : null}
      {lastExport ? <MobileStatusBadge status="Completed" label={`Saved ${lastExport.fileName}`} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Export format" value={selectedFormat} description={filters.format === 'csv' ? 'Excel-compatible' : 'Structured data'} tone="blue" icon={filters.format === 'json' ? FileJson : FileSpreadsheet} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Date scope" value={dateScope} description="Request-date filters" tone="teal" icon={CalendarDays} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Export limit" value={formatNumber(exportLimit)} description="Maximum rows requested" tone="green" icon={Filter} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Last export" value={lastExport ? formatNumber(lastExport.count) : '-'} description={lastExport ? lastExport.fileName : 'No export run yet'} tone={lastExport ? 'green' : 'slate'} icon={Download} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFormSection title="Export configuration" description="Choose output format and optional filters before sharing the generated file.">
        <MobileSelect label="Export format" value={filters.format} options={formatOptions} onChange={(value) => updateFilter('format', value)} />
        <MobileSelect label="Loan status" value={filters.status} options={statusOptions} onChange={(value) => updateFilter('status', value)} />
        <MobileTextInput label="Start date" value={filters.startDate} onChangeText={(value) => updateFilter('startDate', value)} placeholder="Optional YYYY-MM-DD" icon={CalendarDays} disabled={exporting} />
        <MobileTextInput label="End date" value={filters.endDate} onChangeText={(value) => updateFilter('endDate', value)} placeholder="Optional YYYY-MM-DD" icon={CalendarDays} disabled={exporting} />
        <MobileTextInput label="Filename" value={filters.fileName} onChangeText={(value) => updateFilter('fileName', value)} placeholder="loans-export" helperText={`Download name: ${plannedFileName}`} icon={FileSpreadsheet} disabled={exporting} />
        <View style={styles.actions}>
          <MobileButton label="Reset" icon={RotateCcw} variant="secondary" onPress={resetFilters} disabled={exporting || activeFilterCount === 0} style={styles.flexButton} />
          <MobileButton label="Export" icon={Share2} onPress={handleExport} loading={exporting} style={styles.flexButton} />
        </View>
      </MobileFormSection>

      {lastExport ? (
        <MobileCard compact>
          <MobileInfoRow label="File" value={lastExport.fileName} helper={formatBytes(lastExport.size)} icon={lastExport.format === 'json' ? FileJson : FileSpreadsheet} status="Completed" />
          <MobileInfoRow label="Rows" value={formatNumber(lastExport.count)} helper={`${selectedFormat} - ${dateScope}`} icon={Filter} />
          <MobileInfoRow label="Saved location" value="Device document cache" helper={lastExport.uri} icon={Download} />
        </MobileCard>
      ) : (
        <MobileEmptyState title="Ready to export" description="Choose filters if needed, then export loan records to a shareable file." />
      )}
    </MobileScreen>
  );
}

function buildCsv(loans: AssociationLoanSummary[]) {
  const rows = loans.map(mapLoanForExport);
  const headers = Object.keys(mapLoanForExport({ id: '' }));
  return [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header as keyof typeof row])).join(',')),
  ].join('\n');
}

function buildJson(loans: AssociationLoanSummary[]) {
  return JSON.stringify(
    {
      exportDate: new Date().toISOString(),
      totalLoans: loans.length,
      loans: loans.map((loan) => ({
        id: loan.id,
        memberName: loan.memberFullName,
        membershipNumber: memberNumberFor(loan),
        requestedAmount: loan.requestedAmount,
        repaymentAmount: loan.repaymentAmount,
        remainingBalance: loan.remainingBalance,
        status: loan.status,
        requestDate: loan.requestDate,
        nextPaymentDueDate: loan.nextPaymentDueDate,
        isOverdue: loan.isOverdue,
        interestMethod: loan.interestCalculationMethod,
      })),
    },
    null,
    2,
  );
}

function mapLoanForExport(loan: Partial<AssociationLoanSummary>) {
  return {
    'Loan ID': loan.id || '',
    'Member Name': loan.memberFullName || '',
    'Membership Number': memberNumberFor(loan),
    'Requested Amount': loan.requestedAmount || 0,
    'Repayment Amount': loan.repaymentAmount || 0,
    'Remaining Balance': loan.remainingBalance || 0,
    Status: loan.status || '',
    'Request Date': formatDate(loan.requestDate),
    'Next Payment Due': formatDate(loan.nextPaymentDueDate),
    Overdue: loan.isOverdue ? 'Yes' : 'No',
    'Interest Method': loan.interestCalculationMethod || '',
    'Requested Amount Label': formatCurrency(Number(loan.requestedAmount || 0)),
    'Remaining Balance Label': formatCurrency(Number(loan.remainingBalance || 0)),
  };
}

function escapeCsv(value: unknown) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function memberNumberFor(loan: Partial<AssociationLoanSummary>) {
  return loan.memberMembershipNumber || '';
}

function buildFileName(customFileName: string, format: ExportFormat) {
  const cleaned = customFileName
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
  const base = cleaned || `loans-export-${new Date().toISOString().slice(0, 10)}`;
  return `${base}.${format}`;
}

function dateRangeLabel(startDate: string, endDate: string) {
  if (startDate && endDate) return `${startDate} - ${endDate}`;
  if (startDate) return `From ${startDate}`;
  if (endDate) return `Until ${endDate}`;
  return 'All time';
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
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
