import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  ReceiptText,
  UploadCloud,
  WalletCards,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileFileUpload,
  MobileFormSection,
  MobileInfoRow,
  MobilePageHeader,
  MobileScreen,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import {
  importRevenueTransactionsFromFile,
  type RevenueImportFile,
  type RevenueTransaction,
} from '@/services/revenue-transaction-service';
import { useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

const templateColumns = [
  'memberEmail',
  'transactionDate',
  'paymentType',
  'paymentValue',
  'loanId',
  'paymentStatus',
  'description',
  'dueDate',
  'referenceId',
  'fineCategory',
];

const acceptedPaymentTypes = [
  'SHARE_PURCHASE',
  'FINE',
  'SOCIAL_CONTRIBUTION',
  'PENALTY',
  'LOAN_REPAYMENT',
  'LOAN_APPLICATION_FEE',
];

export default function MobileRevenueTransactionImportScreen() {
  const { activeView, associationId } = useAuth();
  const theme = useNaneTheme();
  const [file, setFile] = useState<RevenueImportFile | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RevenueTransaction[] | null>(null);
  const ledgerRoute = getRouteByPath('/associations/revenue-transactions');

  const selectedFileSize = useMemo(() => {
    if (!file || !('size' in file)) return 'Excel workbook';
    return `${(Number((file as RevenueImportFile & { size?: number }).size || 0) / 1024).toFixed(1)} KB`;
  }, [file]);

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

    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset?.uri) return;
    setFile({
      uri: asset.uri,
      name: asset.name || 'revenue-transactions.xlsx',
      mimeType: asset.mimeType,
      ...(asset.size ? { size: asset.size } : {}),
    } as RevenueImportFile);
    setResult(null);
  };

  const handleImport = async () => {
    if (!associationId) {
      setError('Association context is required before importing transactions.');
      return;
    }
    if (!file) {
      setError('Select an Excel workbook before importing.');
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const response = await importRevenueTransactionsFromFile(associationId, file);
      setResult(response || []);
    } catch (importError) {
      setError(getApiErrorMessage(importError));
    } finally {
      setImporting(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Import transactions"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (result) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Finance" title="Import complete" subtitle={`${result.length} transaction(s) imported`} onBack={() => router.back()} />
        <MobileSummaryPanel
          title="Imported transactions"
          value={String(result.length)}
          description="Rows accepted by the revenue import endpoint"
          tone="green"
          icon={CheckCircle2}
        />
        <MobileCard compact>
          <MobileInfoRow label="File" value={file?.name || 'Imported workbook'} helper={selectedFileSize} icon={FileSpreadsheet} />
          <MobileInfoRow label="Association context" value={associationId ? 'Available' : 'Missing'} icon={WalletCards} status={associationId ? 'Active' : 'Failed'} />
        </MobileCard>
        <View style={styles.actions}>
          <MobileButton
            label="Back to ledger"
            icon={ReceiptText}
            fullWidth
            onPress={() => (ledgerRoute ? router.push({ pathname: '/work/route-preview', params: { routeId: ledgerRoute.id } } as never) : router.back())}
          />
          <MobileButton
            label="Import another file"
            icon={UploadCloud}
            variant="secondary"
            fullWidth
            onPress={() => {
              setResult(null);
              setFile(null);
            }}
          />
        </View>
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Import transactions"
        subtitle="Upload completed Excel workbook"
        onBack={() => router.back()}
      />

      {error ? <MobileStatusBadge status="Import failed" label={error} tone="danger" /> : null}

      <MobileSummaryPanel
        title="Import format"
        value=".xlsx"
        description={file ? file.name : 'Choose an Excel workbook'}
        tone={file ? 'green' : 'blue'}
        icon={FileSpreadsheet}
      />

      <MobileFormSection title="Workbook" description="Use one transaction per row with paymentType and paymentValue columns. Add loanId only for loan repayments.">
        <MobileFileUpload
          title={file ? file.name : 'Choose Excel file'}
          description={file ? selectedFileSize : 'Tap to select an .xlsx workbook from this device.'}
          onPress={pickFile}
        />
        <View style={styles.actions}>
          <MobileButton
            label="Import transactions"
            icon={UploadCloud}
            loading={importing}
            disabled={!file || importing || !associationId}
            fullWidth
            onPress={handleImport}
          />
          {file ? (
            <MobileButton label="Choose different file" icon={FileSpreadsheet} variant="secondary" fullWidth onPress={pickFile} disabled={importing} />
          ) : null}
        </View>
      </MobileFormSection>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Template columns
          </MobileText>
          <MobileStatusBadge status="Published" label={`${templateColumns.length} columns`} tone="info" />
        </View>
        <View style={styles.columnGrid}>
          {templateColumns.map((column) => (
            <View key={column} style={[styles.columnPill, { borderColor: theme.colors.border }]}>
              <MobileText variant="tiny" weight="bold">
                {column}
              </MobileText>
            </View>
          ))}
        </View>
      </MobileCard>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Accepted payment types
          </MobileText>
          <MobileStatusBadge status="Active" label={`${acceptedPaymentTypes.length} types`} tone="success" />
        </View>
        <View style={styles.columnGrid}>
          {acceptedPaymentTypes.map((paymentType) => (
            <View key={paymentType} style={[styles.columnPill, { borderColor: theme.colors.border }]}>
              <MobileText variant="tiny" weight="bold">
                {paymentType}
              </MobileText>
            </View>
          ))}
        </View>
      </MobileCard>

      <MobileCard compact>
        <MobileInfoRow label="Sample workbook" value="Use web download" helper="The web admin sample uses the same paymentType and paymentValue format." icon={Download} />
        <MobileInfoRow label="Association context" value={associationId ? 'Available' : 'Missing'} helper={associationId || 'Association ID is required'} icon={WalletCards} status={associationId ? 'Active' : 'Failed'} />
      </MobileCard>
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  columnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  columnPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actions: {
    gap: 10,
  },
});
