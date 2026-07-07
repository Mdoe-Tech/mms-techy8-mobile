import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  Info,
  ListChecks,
  UploadCloud,
  WalletCards,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileFileUpload,
  MobileFormSection,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobileScreen,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import { importLoansFromFile, type LoanImportFile, type LoanImportResult } from '@/services/loan-service';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber } from '@/utils/format';

type ExpectedColumn = {
  id: string;
  position: number;
  name: string;
  requirement: 'Required' | 'Optional';
  detail: string;
};

const expectedColumns: ExpectedColumn[] = [
  { id: 'member-email', position: 1, name: 'Member Email', requirement: 'Required', detail: 'Matches the loan to an existing member.' },
  { id: 'requested-amount', position: 2, name: 'Requested Amount', requirement: 'Required', detail: 'Loan principal requested by the member.' },
  { id: 'repayment-period', position: 3, name: 'Repayment Period', requirement: 'Optional', detail: 'Months. Uses group defaults when blank.' },
  { id: 'purpose', position: 4, name: 'Purpose', requirement: 'Required', detail: 'Business reason or loan purpose.' },
  { id: 'collateral-type', position: 5, name: 'Collateral Type', requirement: 'Optional', detail: 'Asset category, or NONE.' },
  { id: 'collateral-value', position: 6, name: 'Collateral Value', requirement: 'Optional', detail: 'Estimated collateral value.' },
  { id: 'collateral-id', position: 7, name: 'Collateral Identification', requirement: 'Optional', detail: 'Serial number, registration, or description.' },
  { id: 'request-date', position: 8, name: 'Request Date', requirement: 'Optional', detail: 'ISO date or Excel date.' },
  { id: 'disbursement-date', position: 9, name: 'Disbursement Date', requirement: 'Optional', detail: 'Use for already-disbursed onboarding loans.' },
  { id: 'interest-rate', position: 10, name: 'Interest Rate %', requirement: 'Optional', detail: 'Overrides group default for that row.' },
  { id: 'guarantors', position: 11, name: 'Guarantors', requirement: 'Optional', detail: 'Comma-separated emails; amount format is email:50000.' },
  { id: 'past-principal', position: 12, name: 'Past Principal Paid', requirement: 'Optional', detail: 'For onboarding loans with existing repayments.' },
  { id: 'past-interest', position: 13, name: 'Past Interest Paid', requirement: 'Optional', detail: 'For onboarding loans with historical interest.' },
];

const importNotes = [
  'Interest Rate per row overrides the group default only for that loan.',
  'Disbursement date plus past principal and interest imports an already-disbursed onboarding loan.',
  'Guarantors must be comma-separated and can include a guaranteed amount after a colon.',
  'Loan terms and deduction rules follow the association Group Config.',
];

export default function MobileLoanBatchUploadScreen() {
  const { activeView, associationId } = useAuth();
  const [file, setFile] = useState<LoanImportFile | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LoanImportResult | null>(null);
  const loansRoute = getRouteByPath('/associations/loans');

  const requiredCount = expectedColumns.filter((column) => column.requirement === 'Required').length;
  const selectedFileSize = useMemo(() => formatFileSize(file?.size), [file?.size]);
  const columnItems = useMemo<MobileDataListItem[]>(
    () =>
      expectedColumns.map((column) => ({
        id: column.id,
        title: `${column.position}. ${column.name}`,
        subtitle: column.detail,
        meta: column.requirement,
        status: column.requirement,
        statusTone: column.requirement === 'Required' ? 'success' : 'info',
        initials: String(column.position),
        accent: column.requirement === 'Required' ? 'success' : 'info',
      })),
    [],
  );
  const successCount = Number(result?.successCount || 0);
  const failureCount = Number(result?.failureCount || 0);
  const resultErrors = result?.errors || [];

  const pickFile = async () => {
    setError(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.name || 'loan-import.xlsx',
      mimeType: asset.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: asset.size,
    });
    setResult(null);
  };

  const runImport = async () => {
    if (!associationId) {
      setError('Association context is required before importing loans.');
      return;
    }
    if (!file) {
      setError('Select an Excel workbook before importing loans.');
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const response = await importLoansFromFile(associationId, file);
      setResult(response);
      setFile(null);
    } catch (importError) {
      setError(getApiErrorMessage(importError));
    } finally {
      setImporting(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Batch loan import" description="This native page is available for association admin workspaces only." />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Loans"
        title="Batch loan import"
        subtitle="Upload loan workbooks and review row results"
        onBack={() => router.back()}
      />

      {error ? <MobileErrorState title="Import issue" description={error} /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Expected columns" value={formatNumber(expectedColumns.length)} description="Excel columns in order" tone="blue" icon={ListChecks} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Required columns" value={formatNumber(requiredCount)} description="Minimum fields needed" tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Selected file" value={file ? 'Ready' : 'None'} description={file ? selectedFileSize : 'Choose .xlsx or .xls'} tone={file ? 'green' : 'slate'} icon={FileSpreadsheet} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Last result" value={result ? formatNumber(successCount) : '-'} description={result ? `${formatNumber(failureCount)} skipped rows` : 'No import run yet'} tone={failureCount > 0 ? 'orange' : 'purple'} icon={FileCheck2} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFormSection title="Upload Excel file" description="Select an Excel workbook using the exact column order below. The backend validates each row before creating loans.">
        <MobileFileUpload
          title={file ? file.name : 'Choose Excel file'}
          description={file ? `${selectedFileSize} selected` : 'Accepted formats: .xlsx and .xls'}
          onPress={pickFile}
        />
        <View style={styles.actions}>
          <MobileButton label="Upload loans" icon={UploadCloud} loading={importing} disabled={!file || importing || !associationId} fullWidth onPress={runImport} />
          {file ? <MobileButton label="Choose different file" icon={FileSpreadsheet} variant="secondary" fullWidth onPress={pickFile} disabled={importing} /> : null}
        </View>
      </MobileFormSection>

      <MobileFormSection title="Import result" description="Review how many loans were imported and whether any rows need correction.">
        {result ? (
          <View style={styles.stack}>
            <MobileKpiGrid>
              <MobileKpiGridItem>
                <MobileKpiCard title="Imported" value={formatNumber(successCount)} description="Loans created" tone="green" icon={CheckCircle2} />
              </MobileKpiGridItem>
              <MobileKpiGridItem>
                <MobileKpiCard title="Skipped" value={formatNumber(failureCount)} description="Rows not imported" tone={failureCount > 0 ? 'orange' : 'slate'} icon={AlertTriangle} />
              </MobileKpiGridItem>
            </MobileKpiGrid>
            {resultErrors.length ? (
              <MobileCard compact accent="orange">
                <View style={styles.sectionHeader}>
                  <MobileText variant="section" weight="bold">
                    Rows needing attention
                  </MobileText>
                  <MobileStatusBadge status="Warning" label={`${resultErrors.length} issue(s)`} tone="warning" />
                </View>
                <View style={styles.stack}>
                  {resultErrors.slice(0, 8).map((issue, index) => (
                    <MobileInfoRow key={`${index}-${issue}`} label={`Issue ${index + 1}`} value={issue} icon={AlertTriangle} />
                  ))}
                </View>
              </MobileCard>
            ) : (
              <MobileSummaryPanel title="Import accepted" value="Clean" description="The backend reported no row-level errors." tone="green" icon={CheckCircle2} />
            )}
          </View>
        ) : (
          <MobileEmptyState title="No import result yet" description="Upload an Excel file to see imported and skipped row counts here." />
        )}
      </MobileFormSection>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Expected Excel structure
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Keep this order so the import parser maps each row correctly.
            </MobileText>
          </View>
          <MobileStatusBadge status="Published" label={`${expectedColumns.length} columns`} tone="info" />
        </View>
        <MobileDataList items={columnItems} showChevron={false} />
      </MobileCard>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Import notes
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Rules enforced by group configuration and backend parsing.
            </MobileText>
          </View>
          <Info size={19} color="#2563EB" strokeWidth={2.5} />
        </View>
        <View style={styles.stack}>
          {importNotes.map((note) => (
            <MobileInfoRow key={note} label="Note" value={note} icon={Info} />
          ))}
          <MobileInfoRow label="Association context" value={associationId ? 'Available' : 'Missing'} helper={associationId || 'Association ID is required'} icon={WalletCards} status={associationId ? 'Active' : 'Failed'} />
        </View>
      </MobileCard>

      <View style={styles.actions}>
        <MobileButton
          label="Back to loans"
          icon={ArrowLeft}
          variant="secondary"
          fullWidth
          onPress={() => (loansRoute ? router.push({ pathname: '/work/route-preview', params: { routeId: loansRoute.id } } as never) : router.back())}
        />
      </View>
    </MobileScreen>
  );
}

function formatFileSize(size?: number | null) {
  if (!size) return 'Excel workbook';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  stack: {
    gap: 10,
  },
  actions: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
