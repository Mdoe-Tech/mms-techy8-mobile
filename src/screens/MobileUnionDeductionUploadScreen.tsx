import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  History,
  RefreshCw,
  UploadCloud,
  WalletCards,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileCheckboxRow,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileFileUpload,
  MobileFormSection,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSelect,
  MobileSheet,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  downloadUnionDeductionUploadRecords,
  getUnionDeductionUploadHistory,
  uploadUnionDeductionFile,
  type UnionDeductionUploadFile,
  type UnionDeductionUploadHistory,
} from '@/services/union-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type DownloadKind = 'failed' | 'successful';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 7 }, (_, index) => {
  const year = currentYear - 3 + index;
  return { label: String(year), value: String(year) };
});

const monthOptions = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((label, index) => ({ label, value: String(index + 1) }));

const expectedColumns = [
  { id: 'member', name: 'Membership Number or Employee ID', detail: 'Used to match an existing UNION member.' },
  { id: 'amount', name: 'Deduction Amount', detail: 'Payroll deduction amount for the selected period.' },
  { id: 'name', name: 'Full Name', detail: 'Helpful for manual review and row errors.' },
  { id: 'email', name: 'Email', detail: 'Optional matching/review context.' },
  { id: 'phone', name: 'Phone Number', detail: 'Optional review context.' },
];

export default function MobileUnionDeductionUploadScreen() {
  const { activeView, associationId, user } = useAuth();
  const [history, setHistory] = useState<UnionDeductionUploadHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<UnionDeductionUploadFile | null>(null);
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [override, setOverride] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState<UnionDeductionUploadHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; description?: string; tone?: 'success' | 'danger' | 'warning' | 'info' } | null>(null);
  const [downloading, setDownloading] = useState<DownloadKind | null>(null);

  const loadHistory = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setError('Association context is required before loading union deduction uploads.');
        setLoading(false);
        return;
      }
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const rows = await getUnionDeductionUploadHistory(associationId);
        setHistory(rows);
        if (mode === 'refresh') setNotice({ title: 'Upload history refreshed', tone: 'success' });
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
    if (activeView !== 'ADMIN') return;
    void Promise.resolve().then(() => loadHistory());
  }, [activeView, loadHistory]);

  const stats = useMemo(() => buildStats(history), [history]);
  const historyItems = useMemo<MobileDataListItem[]>(
    () =>
      history.slice(0, 8).map((upload) => ({
        id: upload.id,
        title: upload.originalFilename || `Upload ${upload.id.slice(0, 8)}`,
        subtitle: periodLabel(upload.periodYear, upload.periodMonth),
        meta: upload.startTime ? formatDate(upload.startTime) : 'No start time',
        amount: `${formatNumber(upload.successfulRecords)}/${formatNumber(upload.totalRecords)}`,
        status: upload.status,
        statusLabel: statusLabel(upload.status),
        statusTone: uploadStatusTone(upload.status),
        initials: uploadInitials(upload.status),
        accent: uploadStatusTone(upload.status),
      })),
    [history],
  );
  const selectedFileSize = formatFileSize(file?.size);
  const canUpload = Boolean(associationId && file && !uploading);
  const isUnion = String(user?.associationType || '').toUpperCase() === 'UNION';

  const pickFile = async () => {
    setError(null);
    setNotice(null);
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
    if (!asset?.uri) return;
    setFile({
      uri: asset.uri,
      name: asset.name || 'union-deductions.xlsx',
      mimeType: asset.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: asset.size,
    });
  };

  const requestUpload = () => {
    if (!associationId) {
      setError('Association context is required before uploading deductions.');
      return;
    }
    if (!file) {
      setError('Choose an Excel workbook before uploading deductions.');
      return;
    }
    setConfirmVisible(true);
  };

  const runUpload = async () => {
    if (!associationId || !file) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const message = await uploadUnionDeductionFile(associationId, {
        file,
        year: Number(year),
        month: Number(month),
        override,
      });
      setNotice({ title: 'Upload accepted', description: message || 'Processing will continue in the background.', tone: 'success' });
      setFile(null);
      setConfirmVisible(false);
      await loadHistory('refresh');
    } catch (uploadError) {
      setConfirmVisible(false);
      const message = getApiErrorMessage(uploadError);
      setError(message);
      setNotice({ title: 'Upload failed', description: message, tone: 'danger' });
    } finally {
      setUploading(false);
    }
  };

  const shareRecords = async (upload: UnionDeductionUploadHistory, kind: DownloadKind) => {
    if (!associationId) return;
    setDownloading(kind);
    setNotice(null);
    try {
      const response = await downloadUnionDeductionUploadRecords(associationId, upload.id, kind, 'excel');
      const fileUri = `${FileSystem.Paths.cache.uri}union-${kind}-records-${upload.id.slice(0, 8)}.xlsx`;
      await FileSystem.writeAsStringAsync(fileUri, arrayBufferToBase64(response.data), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: `Share ${kind} deduction records`,
        });
      }
      setNotice({ title: 'Download ready', description: `${kind === 'failed' ? 'Failed' : 'Successful'} records prepared for sharing.`, tone: 'success' });
    } catch (downloadError) {
      setNotice({ title: 'Download failed', description: getApiErrorMessage(downloadError), tone: 'danger' });
    } finally {
      setDownloading(null);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Union deduction upload" description="Deduction upload is available for association admin workspaces only." />;
  }

  if (loading && !history.length) {
    return <MobilePageLoadingState kind="form" message="Loading deduction upload history" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Union members"
        title="Deduction upload"
        subtitle={user?.associationName || 'Upload payroll deduction workbooks'}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh history" variant="secondary" disabled={refreshing} onPress={() => void loadHistory('refresh')} />}
      />

      {!isUnion ? <MobileStatusBadge status="Warning" label="This route is intended for UNION associations." tone="warning" /> : null}
      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone} /> : null}
      {error ? <MobileErrorState title="Deduction upload issue" description={error} retryLabel="Retry history" onRetry={() => void loadHistory('refresh')} /> : null}

      <MobileSummaryPanel
        title="Current upload package"
        value={file ? 'Ready' : 'No file'}
        description={file ? `${file.name} · ${selectedFileSize}` : 'Choose an Excel workbook, period, and override option.'}
        tone={file ? 'green' : 'blue'}
        icon={file ? FileCheck2 : UploadCloud}
      />

      <MobileFormSection title="Upload deductions" description="Upload .xlsx or .xls files. CSV must be converted to Excel before upload because the backend validator accepts Excel workbooks.">
        <View style={styles.periodGrid}>
          <View style={styles.flex}>
            <MobileSelect label="Year" value={year} options={yearOptions} onChange={setYear} />
          </View>
          <View style={styles.flex}>
            <MobileSelect label="Month" value={month} options={monthOptions} onChange={setMonth} />
          </View>
        </View>
        <MobileCheckboxRow
          label="Allow override"
          description="Replace an existing upload for the same month and year."
          checked={override}
          onChange={setOverride}
          disabled={uploading}
        />
        <MobileFileUpload
          title={file ? file.name : 'Choose deduction workbook'}
          description={file ? `${selectedFileSize} selected` : 'Accepted formats: .xlsx and .xls'}
          onPress={pickFile}
        />
        <View style={styles.actions}>
          <MobileButton label="Upload file" icon={UploadCloud} loading={uploading} disabled={!canUpload} fullWidth onPress={requestUpload} />
          {file ? <MobileButton label="Choose different file" icon={FileSpreadsheet} variant="secondary" fullWidth onPress={pickFile} disabled={uploading} /> : null}
        </View>
      </MobileFormSection>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Uploads" value={formatNumber(history.length)} description="Loaded history records" tone="blue" icon={History} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Processing" value={formatNumber(stats.processing)} description="Active upload jobs" tone={stats.processing ? 'orange' : 'slate'} icon={CalendarClock} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Successful rows" value={formatNumber(stats.successful)} description={`${formatNumber(stats.total)} total rows`} tone="green" icon={CheckCircle2} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Failed rows" value={formatNumber(stats.failed)} description="Need correction" tone={stats.failed ? 'red' : 'slate'} icon={XCircle} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Expected workbook columns
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Keep these headers so payroll deductions map cleanly.
            </MobileText>
          </View>
          <MobileStatusBadge status="Published" label={`${expectedColumns.length} columns`} tone="info" />
        </View>
        {expectedColumns.map((column, index) => (
          <MobileInfoRow key={column.id} label={`${index + 1}. ${column.name}`} value="Required" helper={column.detail} icon={FileSpreadsheet} status="Required" />
        ))}
      </MobileCard>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Upload history
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Recent deduction file processing results.
            </MobileText>
          </View>
          <MobileStatusBadge status="Records" label={formatNumber(history.length)} tone="neutral" />
        </View>
        {historyItems.length ? (
          <MobileDataList items={historyItems} onPressItem={(item) => setSelectedUpload(history.find((upload) => upload.id === item.id) || null)} />
        ) : (
          <MobileEmptyState title="No upload history" description="Uploaded deduction workbooks will appear here once processing begins." />
        )}
      </MobileCard>

      <MobileConfirmSheet
        visible={confirmVisible}
        title="Upload deduction workbook?"
        description={`${file?.name || 'Selected workbook'} will be processed for ${periodLabel(Number(year), Number(month))}${override ? ' and will override any existing upload for that period.' : '.'}`}
        confirmLabel="Upload"
        loading={uploading}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={runUpload}
      />

      <UploadDetailSheet
        upload={selectedUpload}
        downloading={downloading}
        onClose={() => setSelectedUpload(null)}
        onDownload={shareRecords}
      />
    </MobileScreen>
  );
}

function UploadDetailSheet({
  upload,
  downloading,
  onClose,
  onDownload,
}: {
  upload: UnionDeductionUploadHistory | null;
  downloading: DownloadKind | null;
  onClose: () => void;
  onDownload: (upload: UnionDeductionUploadHistory, kind: DownloadKind) => void;
}) {
  return (
    <MobileSheet
      visible={Boolean(upload)}
      title="Deduction upload"
      description={upload?.originalFilename || 'Upload processing details'}
      onClose={onClose}
    >
      {upload ? (
        <>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                Selected upload
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {upload.originalFilename || upload.id}
              </MobileText>
            </View>
            <MobileStatusBadge status={upload.status} label={statusLabel(upload.status)} tone={uploadStatusTone(upload.status)} />
          </View>
          <MobileInfoRow label="Period" value={periodLabel(upload.periodYear, upload.periodMonth)} icon={CalendarClock} />
          <MobileInfoRow label="Rows" value={`${formatNumber(upload.successfulRecords)} successful / ${formatNumber(upload.failedRecords)} failed`} helper={`${formatNumber(upload.totalRecords)} total rows`} icon={WalletCards} />
          <MobileInfoRow label="Started" value={upload.startTime ? formatDate(upload.startTime) : 'Not available'} helper={upload.completionTime ? `Completed ${formatDate(upload.completionTime)}` : 'Completion pending'} icon={History} />
          {upload.errorDetails ? <MobileInfoRow label="Error details" value={upload.errorDetails} icon={AlertTriangle} /> : null}
          <View style={styles.actions}>
            <MobileButton label="Close" variant="secondary" onPress={onClose} />
            <MobileButton label="Failed rows" icon={Download} variant="secondary" loading={downloading === 'failed'} disabled={!upload.failedRecords} onPress={() => onDownload(upload, 'failed')} style={styles.flex} />
            <MobileButton label="Successful" icon={Download} loading={downloading === 'successful'} disabled={!upload.successfulRecords} onPress={() => onDownload(upload, 'successful')} style={styles.flex} />
          </View>
        </>
      ) : null}
    </MobileSheet>
  );
}

function buildStats(history: UnionDeductionUploadHistory[]) {
  return history.reduce(
    (stats, upload) => ({
      total: stats.total + upload.totalRecords,
      successful: stats.successful + upload.successfulRecords,
      failed: stats.failed + upload.failedRecords,
      processing: stats.processing + (String(upload.status).toUpperCase() === 'PROCESSING' ? 1 : 0),
    }),
    { total: 0, successful: 0, failed: 0, processing: 0 },
  );
}

function uploadStatusTone(status?: string | null): StatusTone {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED') return 'success';
  if (normalized === 'COMPLETED_WITH_ERRORS') return 'warning';
  if (normalized === 'FAILED') return 'danger';
  if (normalized === 'PROCESSING') return 'primary';
  return 'neutral';
}

function statusLabel(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED_WITH_ERRORS') return 'With errors';
  if (normalized === 'PROCESSING') return 'Processing';
  if (normalized === 'COMPLETED') return 'Completed';
  if (normalized === 'FAILED') return 'Failed';
  return 'Unknown';
}

function uploadInitials(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED') return 'OK';
  if (normalized === 'FAILED') return 'FX';
  if (normalized === 'PROCESSING') return 'PR';
  return 'UD';
}

function periodLabel(year?: number | null, month?: number | null) {
  if (!year || !month) return 'No period';
  const monthName = monthOptions.find((option) => option.value === String(month))?.label || `Month ${month}`;
  return `${monthName} ${year}`;
}

function formatFileSize(size?: number | null) {
  if (!size) return 'Excel workbook';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('This device cannot encode the downloaded workbook.');
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return globalThis.btoa(binary);
}

const styles = StyleSheet.create({
  periodGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  stack: {
    gap: 12,
  },
});
