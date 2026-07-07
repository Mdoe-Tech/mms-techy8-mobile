import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import {
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  KeyRound,
  ListChecks,
  RefreshCw,
  Share2,
  TriangleAlert,
  UploadCloud,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
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
  MobileProgressBar,
  MobileScreen,
  MobileStatusBadge,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getAssociationConfig,
  getBatchMemberCredentials,
  getBatchMemberJobStatus,
  importAssociationMembersFromFile,
  type AssociationConfig,
  type AssociationConfigField,
  type BatchCredential,
  type BatchJobStatus,
  type MemberImportFile,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber } from '@/utils/format';
import { labelFromStatus, statusToneFor, useNaneTheme } from '@/theme/tokens';

type ImportState = 'ready' | 'uploading' | 'processing' | 'completed' | 'failed';

type TemplateColumn = {
  key: string;
  label: string;
  required?: boolean;
  helper?: string;
};

const BASE_COLUMNS: TemplateColumn[] = [
  { key: 'fullLegalName', label: 'fullLegalName', required: true, helper: 'Member or company name' },
  { key: 'memberType', label: 'memberType', required: true, helper: 'INDIVIDUAL, COMPANY, or FOUNDING_MEMBER' },
  { key: 'physicalAddress', label: 'physicalAddress', helper: 'Optional physical address' },
  { key: 'postalAddress', label: 'postalAddress', helper: 'Optional postal address' },
  { key: 'phoneNumber', label: 'phoneNumber', required: true, helper: 'Primary phone number' },
  { key: 'email', label: 'email', required: true, helper: 'Unique member email' },
  { key: 'termsAccepted', label: 'termsAccepted', required: true, helper: 'True or False' },
  { key: 'firstRegistrationDate', label: 'firstRegistrationDate', helper: 'YYYY-MM-DD' },
];

const VIKOBA_COLUMNS: TemplateColumn[] = [
  { key: 'shareCount', label: 'shareCount', helper: 'Initial share count' },
  { key: 'transactionDate', label: 'transactionDate', helper: 'YYYY-MM-DD for initial shares' },
];

const COMPLETED_STATUSES = new Set(['COMPLETED', 'PARTIALLY_COMPLETED', 'COMPLETED_WITH_ERRORS']);

export default function MobileMemberImportScreen() {
  const { activeView, associationId, user } = useAuth();
  const theme = useNaneTheme();
  const [config, setConfig] = useState<AssociationConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<MemberImportFile | null>(null);
  const [importState, setImportState] = useState<ImportState>('ready');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<BatchJobStatus | null>(null);
  const [credentials, setCredentials] = useState<BatchCredential[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const loadConfig = useCallback(async () => {
    if (!associationId) {
      setConfigLoading(false);
      return;
    }

    setConfigLoading(true);
    setConfigError(null);

    try {
      const response = await getAssociationConfig(associationId);
      setConfig(response);
    } catch (loadError) {
      setConfigError(getApiErrorMessage(loadError));
    } finally {
      setConfigLoading(false);
    }
  }, [associationId]);

  useEffect(() => {
    void Promise.resolve().then(loadConfig);
    return stopPolling;
  }, [loadConfig, stopPolling]);

  const associationType = String(
    user?.associationType || nestedSettings(config)?.associationType || '',
  ).toUpperCase();
  const templateColumns = useMemo(
    () => buildTemplateColumns(associationType, config),
    [associationType, config],
  );
  const dynamicFieldCount = Math.max(0, templateColumns.length - BASE_COLUMNS.length - (associationType === 'VIKOBA' ? VIKOBA_COLUMNS.length : 0));
  const requiredCount = templateColumns.filter((column) => column.required).length;
  const progress = Math.max(0, Math.min(100, Math.round(Number(jobStatus?.progressPercentage || 0))));
  const statusLabel = labelFromStatus(jobStatus?.status || importState);
  const issueCount = Number(jobStatus?.failedRecords || 0) + Number(jobStatus?.skippedRecords || 0);

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Import members"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Members"
          title="Import members"
          subtitle="Association context is missing"
          onBack={() => router.back()}
        />
        <MobileErrorState
          title="Association missing"
          description="Sign in to an association workspace before importing members."
        />
      </MobileScreen>
    );
  }

  if (configLoading && !config) {
    return <MobilePageLoadingState kind="form" message="Preparing member import" />;
  }

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setSelectedFile({
      uri: asset.uri,
      name: asset.name || 'members-import.xlsx',
      mimeType: asset.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    setError(null);
    setNotice(null);
  };

  const pollJob = async (nextJobId: string) => {
    try {
      const status = await getBatchMemberJobStatus(nextJobId);
      setJobStatus(status);
      if (status.credentials?.length) {
        setCredentials(status.credentials);
      }

      const normalized = String(status.status || '').toUpperCase();
      if (COMPLETED_STATUSES.has(normalized) || normalized === 'FAILED') {
        stopPolling();
        setImportState(normalized === 'FAILED' ? 'failed' : 'completed');
        if (!status.credentials?.length && normalized !== 'FAILED') {
          void getBatchMemberCredentials(nextJobId)
            .then(setCredentials)
            .catch(() => undefined);
        }
      }
    } catch (pollError) {
      setError(getApiErrorMessage(pollError));
    }
  };

  const startPolling = (nextJobId: string) => {
    stopPolling();
    void pollJob(nextJobId);
    pollingRef.current = setInterval(() => {
      void pollJob(nextJobId);
    }, 2500);
  };

  const uploadFile = async () => {
    if (!selectedFile) {
      setNotice('Choose an Excel file before uploading.');
      return;
    }

    setImportState('uploading');
    setError(null);
    setNotice(null);
    setJobStatus(null);
    setCredentials([]);

    try {
      const response = await importAssociationMembersFromFile(associationId, selectedFile);
      const nextJobId = response.batchJobId;
      if (!nextJobId) {
        throw new Error('The server accepted the upload but did not return a batch job ID.');
      }

      setJobId(nextJobId);
      setImportState('processing');
      setJobStatus({
        jobId: nextJobId,
        status: response.status || 'PROCESSING',
        totalRecords: response.totalRecords || 0,
        processedRecords: 0,
        successfulRecords: response.successfulRecords || 0,
        failedRecords: response.failedRecords || 0,
        progressPercentage: 0,
        errors: response.errors || [],
      });
      startPolling(nextJobId);
    } catch (uploadError) {
      setImportState('failed');
      setError(getApiErrorMessage(uploadError));
    }
  };

  const resetImport = () => {
    stopPolling();
    setSelectedFile(null);
    setImportState('ready');
    setJobId(null);
    setJobStatus(null);
    setCredentials([]);
    setError(null);
    setNotice(null);
  };

  const shareTemplateColumns = async () => {
    const required = templateColumns
      .map((column) => `${column.required ? '*' : ''}${column.label}`)
      .join(', ');
    const sample = templateColumns
      .map((column) => sampleValueFor(column.key))
      .join(', ');

    await Share.share({
      title: 'Nane member import columns',
      message: [
        'Nane member import columns',
        'Required columns are prefixed with *.',
        '',
        required,
        '',
        'Sample row:',
        sample,
      ].join('\n'),
    });
  };

  const shareCredentials = async () => {
    if (!credentials.length) {
      setNotice('No generated credentials are available for this batch yet.');
      return;
    }

    const lines = [
      'Member ID,Email,Temporary Password',
      ...credentials.map((credential) => [
        credential.memberId || '',
        credential.email || '',
        credential.password || '',
      ].join(',')),
    ];

    await Share.share({
      title: 'Nane batch member credentials',
      message: lines.join('\n'),
    });
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Members"
        title="Import members"
        subtitle={user?.associationName || 'Batch member registration'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Reload import configuration"
            variant="secondary"
            disabled={configLoading}
            onPress={() => void loadConfig()}
          />
        }
      />

      {notice ? <MobileToast title="Member import" description={notice} tone="info" /> : null}
      {configError ? (
        <MobileToast
          title="Template configuration warning"
          description="Core columns are shown. Custom registration fields could not be loaded."
          tone="warning"
        />
      ) : null}
      {error ? <MobileToast title="Import issue" description={error} tone="danger" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Import status"
            value={statusLabel}
            description={selectedFile?.name || 'No file selected'}
            tone={importState === 'failed' ? 'red' : importState === 'completed' ? 'green' : 'blue'}
            icon={UploadCloud}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Template columns"
            value={formatNumber(templateColumns.length)}
            description={`${formatNumber(requiredCount)} required`}
            tone="purple"
            icon={FileSpreadsheet}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Successful"
            value={formatNumber(Number(jobStatus?.successfulRecords || 0))}
            description={`${formatNumber(Number(jobStatus?.processedRecords || 0))} processed`}
            tone="green"
            icon={CheckCircle2}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Issues"
            value={formatNumber(issueCount)}
            description={`${formatNumber(Number(jobStatus?.failedRecords || 0))} failed`}
            tone={issueCount > 0 ? 'red' : 'slate'}
            icon={TriangleAlert}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFormSection
        title="Upload members"
        description="Choose the completed Excel workbook and start the batch registration job."
      >
        <MobileFileUpload
          title={selectedFile ? selectedFile.name : 'Choose Excel file'}
          description={selectedFile ? 'Ready to upload. You can replace it before starting.' : 'XLSX and XLS files are supported.'}
          onPress={pickFile}
        />

        {importState === 'uploading' || importState === 'processing' || jobStatus ? (
          <MobileCard compact accent={importState === 'failed' ? 'red' : importState === 'completed' ? 'green' : 'blue'}>
            <View style={styles.resultHeader}>
              <View style={styles.resultTitle}>
                <MobileText variant="body" weight="bold">
                  Batch job
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {jobId || 'Waiting for server job ID'}
                </MobileText>
              </View>
              <MobileStatusBadge status={jobStatus?.status || importState} tone={statusToneFor(jobStatus?.status || importState)} />
            </View>
            <MobileProgressBar
              value={importState === 'uploading' && !jobStatus ? 8 : progress}
              label={importState === 'uploading' && !jobStatus ? 'Uploading file' : 'Backend processing'}
              tone={importState === 'failed' ? 'red' : importState === 'completed' ? 'green' : 'blue'}
            />
            <View style={styles.metricsRow}>
              <ResultMetric label="Total" value={jobStatus?.totalRecords} />
              <ResultMetric label="Processed" value={jobStatus?.processedRecords} />
              <ResultMetric label="Success" value={jobStatus?.successfulRecords} />
              <ResultMetric label="Failed" value={jobStatus?.failedRecords} />
            </View>
          </MobileCard>
        ) : null}

        <View style={styles.actions}>
          <MobileButton
            label={importState === 'uploading' ? 'Uploading...' : importState === 'processing' ? 'Processing...' : 'Upload members'}
            icon={UploadCloud}
            loading={importState === 'uploading' || importState === 'processing'}
            disabled={!selectedFile || importState === 'uploading' || importState === 'processing'}
            onPress={() => void uploadFile()}
            fullWidth
          />
          <MobileButton
            label="Reset"
            icon={X}
            variant="secondary"
            disabled={importState === 'uploading' || importState === 'processing'}
            onPress={resetImport}
          />
        </View>
      </MobileFormSection>

      <MobileFormSection
        title="Prepare Excel file"
        description="Use these columns in the first row. Required columns are marked with an asterisk."
      >
        <View style={styles.templateHeader}>
          <View style={styles.templateCopy}>
            <MobileText variant="body" weight="bold">
              {associationType || 'Association'} member template
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {dynamicFieldCount > 0
                ? `${formatNumber(dynamicFieldCount)} configured custom field${dynamicFieldCount === 1 ? '' : 's'} included.`
                : 'Core member columns are ready for upload.'}
            </MobileText>
          </View>
          <MobileButton label="Share" icon={Share2} size="sm" variant="secondary" onPress={() => void shareTemplateColumns()} />
        </View>

        <View style={styles.columnWrap}>
          {templateColumns.slice(0, 16).map((column) => (
            <View
              key={column.key}
              style={[
                styles.columnChip,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <MobileText variant="tiny" weight="bold">
                {column.required ? '*' : ''}{column.label}
              </MobileText>
            </View>
          ))}
        </View>
        {templateColumns.length > 16 ? (
          <MobileText variant="small" tone="secondary">
            Plus {formatNumber(templateColumns.length - 16)} more configured column{templateColumns.length - 16 === 1 ? '' : 's'}. Use Share to see the full list.
          </MobileText>
        ) : null}

        <MobileInfoRow
          label="File type"
          value="Excel workbook"
          helper=".xlsx and .xls files are accepted by the backend import parser."
          icon={FileSpreadsheet}
          status="Ready"
        />
        <MobileInfoRow
          label="Document files"
          value="Upload later"
          helper="Member verification files still need to be uploaded on each member record after import."
          icon={FileText}
          status="Manual"
        />
      </MobileFormSection>

      {jobStatus ? (
        <MobileFormSection
          title="Import result"
          description="Review the outcome before leaving this page."
        >
          <MobileInfoRow
            label="Status"
            value={labelFromStatus(jobStatus.status)}
            helper={`${formatNumber(Number(jobStatus.processedRecords || 0))} of ${formatNumber(Number(jobStatus.totalRecords || 0))} rows processed.`}
            icon={ListChecks}
            status={jobStatus.status || 'Unknown'}
          />
          <MobileInfoRow
            label="Generated credentials"
            value={formatNumber(credentials.length)}
            helper="Temporary passwords are returned after successful member creation."
            icon={KeyRound}
            status={credentials.length ? 'Available' : 'None'}
          />
          {Number(jobStatus.skippedRecords || 0) > 0 ? (
            <MobileInfoRow
              label="Skipped"
              value={formatNumber(Number(jobStatus.skippedRecords || 0))}
              helper="Usually duplicate or already-existing member rows."
              icon={ClipboardList}
              status="Review"
            />
          ) : null}

          {credentials.length ? (
            <>
              <MobileDataList
                showChevron={false}
                items={credentials.slice(0, 3).map((credential, index) => ({
                  id: credential.memberId || credential.email || `credential-${index}`,
                  title: credential.email || 'Member credential',
                  subtitle: credential.memberId || 'New member',
                  meta: 'Temporary password generated',
                  status: 'Ready',
                  statusTone: 'success',
                  accent: 'success',
                  initials: 'PW',
                }))}
              />
              <MobileButton
                label="Share credentials"
                icon={Share2}
                variant="secondary"
                onPress={() => void shareCredentials()}
                fullWidth
              />
            </>
          ) : null}

          {jobStatus.errors?.length ? (
            <MobileCard compact accent="red">
              <MobileText variant="body" weight="bold">
                Import errors
              </MobileText>
              {jobStatus.errors.slice(0, 5).map((item) => (
                <MobileText key={item} variant="small" tone="secondary">
                  {item}
                </MobileText>
              ))}
              {jobStatus.errors.length > 5 ? (
                <MobileText variant="small" tone="secondary">
                  Plus {formatNumber(jobStatus.errors.length - 5)} more issue{jobStatus.errors.length - 5 === 1 ? '' : 's'}.
                </MobileText>
              ) : null}
            </MobileCard>
          ) : null}
        </MobileFormSection>
      ) : (
        <MobileEmptyState
          title="No import job yet"
          description="Choose a completed Excel workbook and upload it to start batch member registration."
        />
      )}
    </MobileScreen>
  );
}

function ResultMetric({ label, value }: { label: string; value?: number | null }) {
  return (
    <View style={styles.metric}>
      <MobileText variant="tiny" tone="secondary" weight="bold">
        {label}
      </MobileText>
      <MobileText variant="body" weight="bold">
        {formatNumber(Number(value || 0))}
      </MobileText>
    </View>
  );
}

function nestedSettings(config?: AssociationConfig | null) {
  return config?.settings?.settings || config?.settings || {};
}

function buildTemplateColumns(associationType: string, config?: AssociationConfig | null) {
  const columns = [...BASE_COLUMNS];
  if (associationType === 'VIKOBA') {
    columns.splice(2, 0, VIKOBA_COLUMNS[0]);
    columns.push(VIKOBA_COLUMNS[1]);
  }

  const pages = nestedSettings(config).pages;
  const dynamicFields = Array.isArray(pages)
    ? pages.flatMap((page) => page.fields || [])
    : [];

  dynamicFields
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .forEach((field) => appendConfigField(columns, field));

  return dedupeColumns(columns);
}

function appendConfigField(columns: TemplateColumn[], field: AssociationConfigField) {
  const label = field.label || field.name;
  if (label) {
    columns.push({
      key: `custom-${field.name || label}`,
      label,
      required: Boolean(field.required),
      helper: field.type || 'Custom field',
    });
  }

  field.details?.forEach((detail) => appendConfigField(columns, detail));
}

function dedupeColumns(columns: TemplateColumn[]) {
  const seen = new Set<string>();
  return columns.filter((column) => {
    const key = column.label.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sampleValueFor(key: string) {
  const normalized = key.toLowerCase();
  if (normalized.includes('email')) return 'member@example.com';
  if (normalized.includes('phone')) return '0712345678';
  if (normalized.includes('type')) return 'INDIVIDUAL';
  if (normalized.includes('terms')) return 'True';
  if (normalized.includes('date')) return '2026-07-04';
  if (normalized.includes('share')) return '10';
  if (normalized.includes('name')) return 'Sample Member';
  if (normalized.includes('address')) return 'Dar es Salaam';
  return 'Sample';
}

const styles = StyleSheet.create({
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  templateCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  columnWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  columnChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  resultTitle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  metric: {
    minWidth: '46%',
    flexGrow: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
