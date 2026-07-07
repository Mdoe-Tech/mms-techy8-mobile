import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  CalendarDays,
  Coins,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
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
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import { getAssociationGroupConfigs, type GroupConfig } from '@/services/member-service';
import {
  distributeDividends,
  downloadRevenueReport,
  getRevenueTransactionTotal,
  labelFromPaymentType,
  type DividendDistributionResult,
} from '@/services/revenue-transaction-service';
import { labelFromStatus, statusToneFor } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type ReportFile = {
  id: string;
  title: string;
  description: string;
  type: 'excel' | 'pdf';
  path: string | null;
  icon: LucideIcon;
};

export default function MobileDividendDistributionScreen() {
  const { activeView, associationId } = useAuth();
  const [configs, setConfigs] = useState<GroupConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkDate, setCheckDate] = useState('');
  const [result, setResult] = useState<DividendDistributionResult | null>(null);
  const [lastDownload, setLastDownload] = useState<string | null>(null);

  const loadConfig = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading dividend rules.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const loadedConfigs = await getAssociationGroupConfigs(associationId);
        setConfigs(loadedConfigs || []);
      } catch (loadError) {
        setConfigs([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadConfig();
    });
    return () => {
      active = false;
    };
  }, [loadConfig]);

  const config = configs[0] || null;
  const rules = config?.additionalRules || {};
  const weighting = String(rules['dividends.weighting'] || 'SHARE_COUNT');
  const minMonths = Number(rules['dividends.minMonthsSinceJoin'] ?? 0);
  const financialYearStart = toIsoDate(config?.financialYearStartDate);
  const financialYearEnd = toIsoDate(config?.financialYearEndDate);
  const selectedDate = checkDate || todayIso();
  const totalDistributed = toNumber(result?.totalDistributed);
  const dividendTransactions = useMemo(() => result?.dividendTransactions || [], [result?.dividendTransactions]);
  const reportFiles = useMemo<ReportFile[]>(
    () => [
      {
        id: 'dividend-excel',
        title: 'Dividend allocation Excel',
        description: 'Spreadsheet for member dividend allocations.',
        type: 'excel',
        path: result?.dividendExcelReportPath || null,
        icon: FileSpreadsheet,
      },
      {
        id: 'dividend-pdf',
        title: 'Dividend allocation PDF',
        description: 'Printable dividend allocation report.',
        type: 'pdf',
        path: result?.dividendPdfReportPath || null,
        icon: FileText,
      },
      {
        id: 'overdue-excel',
        title: 'Overdue deductions Excel',
        description: 'Spreadsheet for overdue fines deducted first.',
        type: 'excel',
        path: result?.overdueExcelReportPath || null,
        icon: FileSpreadsheet,
      },
      {
        id: 'overdue-pdf',
        title: 'Overdue deductions PDF',
        description: 'Printable overdue fines and deduction report.',
        type: 'pdf',
        path: result?.overduePdfReportPath || null,
        icon: FileText,
      },
    ],
    [result],
  );
  const reportCount = reportFiles.filter((file) => file.path).length;

  const dateError = useMemo(() => {
    if (checkDate && !isIsoDate(checkDate)) return 'Use YYYY-MM-DD format, for example 2026-07-04.';
    if (financialYearEnd && selectedDate < financialYearEnd) {
      return `Dividend distribution can run after the financial year ends on ${formatDate(financialYearEnd)}.`;
    }
    return null;
  }, [checkDate, financialYearEnd, selectedDate]);

  const transactionsList = useMemo<MobileDataListItem[]>(
    () =>
      dividendTransactions.slice(0, 10).map((transaction, index) => {
        const title = transaction.memberFullName || transaction.memberName || transaction.membershipNumber || `Dividend ${index + 1}`;
        return {
          id: transaction.id || `${title}-${index}`,
          title,
          subtitle: transaction.membershipNumber || labelFromPaymentType(Object.keys(transaction.paymentDetails || {})[0]),
          meta: `${formatDate(transaction.transactionDate || transaction.createdAt)} · ${transaction.description || 'Dividend distribution'}`,
          amount: formatTzs(getRevenueTransactionTotal(transaction)),
          status: labelFromStatus(transaction.paymentStatus || 'PAID'),
          statusTone: statusToneFor(transaction.paymentStatus || 'PAID'),
          initials: initialsFromName(title),
          accent: 'success',
        };
      }),
    [dividendTransactions],
  );

  const runDistribution = async () => {
    if (!associationId || dateError) return;
    setConfirmOpen(false);
    setWorking(true);
    setError(null);
    setLastDownload(null);
    try {
      const data = await distributeDividends(associationId, checkDate || undefined);
      setResult(data || {});
    } catch (distributionError) {
      setError(getApiErrorMessage(distributionError));
    } finally {
      setWorking(false);
    }
  };

  const downloadReportFile = async (file: ReportFile) => {
    if (!file.path) return;
    setError(null);
    setLastDownload(null);
    try {
      const { filename, data } = await downloadRevenueReport(file.type, file.path);
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, arrayBufferToBase64(data), {
        encoding: FileSystem.EncodingType.Base64,
      });
      setLastDownload(filename);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: file.type === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
          dialogTitle: file.title,
        });
      }
    } catch (downloadError) {
      setError(getApiErrorMessage(downloadError));
    }
  };

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Dividend distribution"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message="Loading dividend rules" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Dividend distribution"
        subtitle="Run year-end dividends and reports"
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Reload rules"
            variant="secondary"
            disabled={working}
            onPress={() => void loadConfig('refresh')}
          />
        }
      />

      {error ? <MobileErrorState title="Dividend workflow issue" description={error} retryLabel="Reload rules" onRetry={() => void loadConfig('refresh')} /> : null}
      {lastDownload ? <MobileStatusBadge status="Completed" label={`Downloaded ${lastDownload}`} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Workflow status"
            value={working ? 'Processing' : result ? 'Completed' : 'Ready'}
            description={associationId ? 'Association context active' : 'Missing association context'}
            tone={working ? 'blue' : result ? 'green' : 'slate'}
            icon={ShieldCheck}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Total distributed"
            value={formatTzs(totalDistributed)}
            description={result ? 'Dividend amount generated' : 'Waiting for distribution'}
            tone={totalDistributed ? 'green' : 'teal'}
            icon={Coins}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Members paid"
            value={formatNumber(dividendTransactions.length)}
            description="Dividend transactions returned"
            tone={dividendTransactions.length ? 'purple' : 'blue'}
            icon={Users}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Reports"
            value={formatNumber(reportCount)}
            description="Excel and PDF files available"
            tone={reportCount ? 'orange' : 'slate'}
            icon={FileText}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Distribution setup
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Confirm the check date before creating dividend transactions.
            </MobileText>
          </View>
          <MobileStatusBadge status={dateError ? 'Rejected' : 'Active'} label={dateError ? 'Blocked' : 'Ready'} tone={dateError ? 'danger' : 'success'} />
        </View>

        <View style={styles.formStack}>
          <MobileTextInput
            label="Check date"
            value={checkDate}
            onChangeText={setCheckDate}
            placeholder={todayIso()}
            helperText={checkDate ? 'Financial year-end validation uses this date.' : 'Leave empty to let the server use today.'}
            error={dateError || undefined}
            icon={CalendarDays}
            autoCapitalize="none"
            disabled={working}
          />
          <View style={styles.actions}>
            <MobileButton label="Use today" variant="secondary" size="sm" onPress={() => setCheckDate(todayIso())} disabled={working} style={styles.actionButton} />
            {checkDate ? <MobileButton label="Clear" variant="ghost" size="sm" onPress={() => setCheckDate('')} disabled={working} style={styles.actionButton} /> : null}
          </View>
        </View>

        <View style={styles.ruleGrid}>
          <MobileInfoRow
            label="Financial year"
            value={`${formatDate(financialYearStart)} - ${formatDate(financialYearEnd)}`}
            helper="Distribution is allowed after the configured year end."
            icon={CalendarDays}
          />
          <MobileInfoRow
            label="Dividend rule"
            value={formatWeighting(weighting)}
            helper={`${formatNumber(minMonths)} minimum month(s) since joining.`}
            icon={TrendingUp}
          />
        </View>

        <View style={styles.notice}>
          <Info color="#1D4ED8" size={18} strokeWidth={2.4} />
          <View style={styles.flex}>
            <MobileText variant="small" weight="bold">
              This is a posting workflow
            </MobileText>
            <MobileText variant="small" tone="secondary">
              It calculates eligible member dividends, deducts overdue fines when configured, creates dividend transactions, and returns report files.
            </MobileText>
          </View>
        </View>

        <MobileButton
          label={working ? 'Running distribution' : 'Run dividend distribution'}
          icon={Coins}
          loading={working}
          fullWidth
          disabled={!associationId || Boolean(dateError) || refreshing}
          onPress={() => setConfirmOpen(true)}
        />
      </MobileCard>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Safety checklist
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Review before running the distribution.
            </MobileText>
          </View>
          <MobileStatusBadge status="Review" label="Confirm first" tone="review" />
        </View>
        <SafetyRow icon={ShieldAlert} title="No preview endpoint exists" description="The server performs the distribution when this action is confirmed." />
        <SafetyRow icon={CalendarDays} title="Year-end protected" description="The backend rejects distribution before the configured financial year end." />
        <SafetyRow icon={FileSpreadsheet} title="Reports are generated" description="Dividend and overdue reports are returned after a successful run." />
      </MobileCard>

      {result ? (
        <MobileCard compact>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                Generated reports
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {formatNumber(reportCount)} of 4 files returned
              </MobileText>
            </View>
            <MobileStatusBadge status={reportCount ? 'Completed' : 'Unknown'} label={reportCount ? 'Available' : 'No files'} tone={reportCount ? 'success' : 'neutral'} />
          </View>

          <View style={styles.reportList}>
            {reportFiles.map((file) => (
              <ReportRow key={file.id} file={file} onDownload={() => void downloadReportFile(file)} />
            ))}
          </View>
        </MobileCard>
      ) : null}

      {result ? (
        <MobileCard compact>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                Dividend transactions
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {formatNumber(dividendTransactions.length)} returned by the server
              </MobileText>
            </View>
            <MobileStatusBadge status="Completed" label={formatTzs(totalDistributed)} tone="success" />
          </View>

          {transactionsList.length ? (
            <>
              <MobileDataList items={transactionsList} showChevron={false} />
              {dividendTransactions.length > transactionsList.length ? (
                <MobileText variant="small" tone="secondary" style={styles.footerNote}>
                  Showing first {formatNumber(transactionsList.length)} transactions. Download the report for the full allocation.
                </MobileText>
              ) : null}
            </>
          ) : (
            <MobileEmptyState
              title="No dividend transactions returned"
              description="The action completed, but the response did not include member transaction rows."
            />
          )}
        </MobileCard>
      ) : (
        <MobileEmptyState
          title="No dividend run yet"
          description="Run distribution after financial year end to create member allocations and downloadable reports."
        />
      )}

      <MobileConfirmSheet
        visible={confirmOpen}
        title="Run dividend distribution?"
        description={`This will create dividend transactions using ${checkDate ? selectedDate : 'today'} as the check date and may deduct overdue fines first. Continue only after confirming the dividend rules.`}
        confirmLabel="Run distribution"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void runDistribution()}
      />
    </MobileScreen>
  );
}

function ReportRow({ file, onDownload }: { file: ReportFile; onDownload: () => void }) {
  const Icon = file.icon;
  const available = Boolean(file.path);
  return (
    <View style={styles.reportRow}>
      <View style={styles.reportIcon}>
        <Icon color={available ? '#1D4ED8' : '#64748B'} size={18} strokeWidth={2.4} />
      </View>
      <View style={styles.flex}>
        <MobileText variant="small" weight="bold">
          {file.title}
        </MobileText>
        <MobileText variant="small" tone="secondary">
          {available ? file.description : 'Not returned in the latest response.'}
        </MobileText>
      </View>
      {available ? (
        <MobileButton label="Download" icon={Download} size="sm" variant="secondary" onPress={onDownload} />
      ) : (
        <MobileStatusBadge status="Unknown" label="Missing" tone="neutral" />
      )}
    </View>
  );
}

function SafetyRow({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <View style={styles.safetyRow}>
      <Icon color="#1D4ED8" size={18} strokeWidth={2.4} />
      <View style={styles.flex}>
        <MobileText variant="small" weight="bold">
          {title}
        </MobileText>
        <MobileText variant="small" tone="secondary">
          {description}
        </MobileText>
      </View>
    </View>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function toIsoDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatWeighting(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('This device cannot encode the downloaded report file.');
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return globalThis.btoa(binary);
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  formStack: {
    gap: 10,
    marginBottom: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  ruleGrid: {
    gap: 10,
    marginBottom: 12,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    padding: 12,
    marginBottom: 14,
  },
  safetyRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reportList: {
    gap: 10,
  },
  reportRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reportIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  footerNote: {
    marginTop: 10,
  },
});
