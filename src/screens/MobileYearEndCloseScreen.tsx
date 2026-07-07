import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  WalletCards,
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
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAssociationGroupConfigs, type GroupConfig } from '@/services/member-service';
import {
  closeFinancialYear,
  downloadRevenueReport,
  getRevenueTransactionTotal,
  type FinancialYearCloseResult,
  type RevenueTransaction,
} from '@/services/revenue-transaction-service';
import { labelFromStatus, statusToneFor } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs, initialsFromName } from '@/utils/format';

type ReportFile = {
  id: string;
  title: string;
  type: 'excel' | 'pdf';
  path: string | null;
  icon: LucideIcon;
};

export default function MobileYearEndCloseScreen() {
  const { activeView, associationId, user } = useAuth();
  const [configs, setConfigs] = useState<GroupConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkDate, setCheckDate] = useState('');
  const [result, setResult] = useState<FinancialYearCloseResult | null>(null);
  const [lastDownload, setLastDownload] = useState<string | null>(null);

  const loadConfig = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before closing a financial year.');
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const rows = await getAssociationGroupConfigs(associationId);
        setConfigs(rows || []);
        setCheckDate((current) => current || todayIso());
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
    void Promise.resolve().then(() => loadConfig('initial'));
  }, [loadConfig]);

  const config = configs[0] || null;
  const financialYearStart = toIsoDate(config?.financialYearStartDate);
  const financialYearEnd = toIsoDate(config?.financialYearEndDate);
  const lastClosedEnd = toIsoDate(config?.additionalRules?.['lastClosedFinancialYearEndDate'] as string | undefined) || toIsoDate((config as { lastClosedFinancialYearEndDate?: string | null } | null)?.lastClosedFinancialYearEndDate);
  const closedHistory = Array.isArray(config?.additionalRules?.closedFinancialYears) ? config?.additionalRules?.closedFinancialYears.length : 0;
  const validDate = isIsoDate(checkDate);
  const futureCheckDate = Boolean(validDate && checkDate > todayIso());
  const beforeYearEnd = Boolean(validDate && financialYearEnd && checkDate < financialYearEnd);
  const validationMessage = useMemo(() => {
    if (!config) return 'Create a group configuration before closing the year.';
    if (!financialYearStart || !financialYearEnd) return 'Financial year start and end dates are required.';
    if (!checkDate.trim()) return 'Enter the check date.';
    if (!validDate) return 'Use YYYY-MM-DD.';
    if (futureCheckDate) return 'Check date cannot be in the future.';
    if (beforeYearEnd) return `Financial year close is blocked until ${formatDate(financialYearEnd)}.`;
    return null;
  }, [beforeYearEnd, checkDate, config, financialYearEnd, financialYearStart, futureCheckDate, validDate]);

  const overdueTransactions = result?.overdueResult?.overdueTransactions || [];
  const reportFiles = useMemo(() => buildReportFiles(result), [result]);
  const newFinancialYearEnd = extractNewFinancialYearEnd(result);
  const closedFinancialYear = extractClosedFinancialYear(result);
  const overdueTotal = toNumber(result?.overdueResult?.totalOverdueAmount);

  const handleCloseYear = async () => {
    if (!associationId || validationMessage) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    setLastDownload(null);

    try {
      const data = await closeFinancialYear(associationId, checkDate);
      setResult(data);
      setNotice('Financial year close completed.');
      await loadConfig('refresh');
    } catch (closeError) {
      setError(getApiErrorMessage(closeError));
    } finally {
      setWorking(false);
      setConfirmOpen(false);
    }
  };

  const handleDownload = async (file: ReportFile) => {
    if (!file.path) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const downloaded = await downloadRevenueReport(file.type, file.path);
      const outputUri = `${FileSystem.documentDirectory}${downloaded.filename}`;
      await FileSystem.writeAsStringAsync(outputUri, arrayBufferToBase64(downloaded.data), {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(outputUri, {
          mimeType: file.type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: `Share ${file.title}`,
        });
      }
      setLastDownload(downloaded.filename);
    } catch (downloadError) {
      setError(getApiErrorMessage(downloadError));
    } finally {
      setWorking(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Year-end close" description="Financial year close is available for association admin workspaces only." />;
  }

  if (loading && !configs.length) {
    return <MobilePageLoadingState kind="form" message="Loading year-end close" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Reports" title="Year-end close" subtitle="Association context unavailable" />
        <MobileErrorState title="Association not selected" description="Sign in through an association workspace before closing the year." />
      </MobileScreen>
    );
  }

  if (error && !configs.length) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Reports"
          title="Year-end close"
          subtitle="Financial close workspace"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" disabled={refreshing} onPress={() => void loadConfig('refresh')} />}
        />
        <MobileErrorState title="Year-end setup could not load" description={error} retryLabel="Retry" onRetry={() => void loadConfig('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Reports"
        title="Year-end close"
        subtitle={user?.associationName || 'Financial close workspace'}
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh setup" variant="secondary" disabled={refreshing} onPress={() => void loadConfig('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileStatusBadge status="Completed" label={notice} tone="success" /> : null}
      {lastDownload ? <MobileStatusBadge status="Sent" label={`Shared ${lastDownload}`} tone="info" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Current FY" value={financialYearEnd ? formatDate(financialYearEnd) : 'Missing'} description={financialYearStart ? `Started ${formatDate(financialYearStart)}` : 'Start date required'} icon={CalendarDays} tone={financialYearEnd ? 'blue' : 'red'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Check Date" value={checkDate || 'Not set'} description={beforeYearEnd ? 'Before year end' : validationMessage ? 'Needs attention' : 'Ready for backend close'} icon={ShieldAlert} tone={validationMessage ? 'orange' : 'green'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Previous Close" value={lastClosedEnd ? formatDate(lastClosedEnd) : 'None'} description={`${formatNumber(closedHistory)} close history item(s)`} icon={TrendingUp} tone={lastClosedEnd ? 'purple' : 'slate'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Reports" value={formatNumber(reportFiles.filter((file) => file.path).length)} description="Files returned after close" icon={FileSpreadsheet} tone={reportFiles.some((file) => file.path) ? 'green' : 'slate'} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard accent={validationMessage ? 'orange' : 'red'}>
        <View style={styles.cardHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Close financial year
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Runs the backend close workflow and rolls the configured financial year forward.
            </MobileText>
          </View>
          <MobileStatusBadge status={validationMessage ? 'Pending' : 'Processing'} label={validationMessage ? 'Blocked' : 'Ready'} tone={validationMessage ? 'warning' : 'danger'} />
        </View>

        <MobileTextInput
          label="Check date"
          value={checkDate}
          onChangeText={(value) => {
            setCheckDate(value.trim());
            setResult(null);
            setNotice(null);
          }}
          placeholder={financialYearEnd || 'YYYY-MM-DD'}
          helperText="Use the financial year end date or later."
          icon={CalendarDays}
          autoCapitalize="none"
          error={validationMessage || undefined}
          disabled={working}
        />

        <View style={styles.warningBox}>
          <AlertTriangle color="#B91C1C" size={19} strokeWidth={2.5} />
          <View style={styles.flex}>
            <MobileText variant="small" weight="bold">
              Destructive financial workflow
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Confirm only after statements, fines, shares, dividends, and report backups have been reviewed.
            </MobileText>
          </View>
        </View>

        <View style={styles.checklist}>
          <ChecklistRow title="Financial year configured" description={`${formatDate(financialYearStart)} - ${formatDate(financialYearEnd)}`} complete={Boolean(financialYearStart && financialYearEnd)} />
          <ChecklistRow title="Check date has reached FY end" description={financialYearEnd ? `Minimum date: ${formatDate(financialYearEnd)}` : 'Financial year end missing'} complete={!beforeYearEnd && validDate && Boolean(financialYearEnd)} />
          <ChecklistRow title="Backend confirmation required" description="The action remains behind this confirmation sheet." complete={!validationMessage} />
        </View>

        <MobileButton
          label="Close financial year"
          icon={ShieldAlert}
          variant="danger"
          fullWidth
          loading={working}
          disabled={Boolean(validationMessage) || working}
          onPress={() => setConfirmOpen(true)}
        />
      </MobileCard>

      {result ? (
        <MobileCard accent="green">
          <View style={styles.cardHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                Close result
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {closedFinancialYear ? `Closed ${closedFinancialYear}` : 'Backend close completed.'}
              </MobileText>
            </View>
            <MobileStatusBadge status="Completed" label="Closed" tone="success" />
          </View>
          <MobileInfoRow label="New financial year end" value={formatDate(newFinancialYearEnd)} helper="Rolled forward by backend configuration." icon={CalendarDays} status="Active" />
          <MobileInfoRow label="Overdue total" value={formatTzs(overdueTotal)} helper={`${formatNumber(overdueTransactions.length)} overdue transaction(s) returned`} icon={WalletCards} status="Completed" />
        </MobileCard>
      ) : null}

      {reportFiles.length ? (
        <MobileCard compact>
          <MobileText variant="section" weight="bold">
            Close reports
          </MobileText>
          <View style={styles.reportStack}>
            {reportFiles.map((file) => (
              <ReportRow key={file.id} file={file} disabled={working} onDownload={() => void handleDownload(file)} />
            ))}
          </View>
        </MobileCard>
      ) : null}

      {overdueTransactions.length ? (
        <MobileCard compact>
          <MobileText variant="section" weight="bold">
            Overdue transactions
          </MobileText>
          <MobileDataList items={overdueTransactions.slice(0, 8).map(transactionToListItem)} />
        </MobileCard>
      ) : result ? (
        <MobileEmptyState title="No overdue transactions returned" description="The close response did not include overdue fine or penalty transaction rows." />
      ) : null}

      <MobileConfirmSheet
        visible={confirmOpen}
        title="Close financial year?"
        description={`This will run year-end processing for ${checkDate}, close the year ending ${formatDate(financialYearEnd)}, and roll the configuration forward. This cannot be casually undone.`}
        confirmLabel="Close year"
        destructive
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleCloseYear()}
      />
    </MobileScreen>
  );
}

function ChecklistRow({ title, description, complete }: { title: string; description: string; complete: boolean }) {
  const Icon = complete ? CheckCircle2 : AlertTriangle;
  return (
    <View style={styles.checklistRow}>
      <View style={[styles.checkIcon, complete ? styles.checkIconDone : styles.checkIconPending]}>
        <Icon color={complete ? '#FFFFFF' : '#FFFFFF'} size={16} strokeWidth={2.6} />
      </View>
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

function ReportRow({ file, disabled, onDownload }: { file: ReportFile; disabled: boolean; onDownload: () => void }) {
  const Icon = file.icon;
  const available = Boolean(file.path);
  return (
    <View style={styles.reportRow}>
      <View style={styles.reportIcon}>
        <Icon color={available ? '#1D4ED8' : '#64748B'} size={18} strokeWidth={2.5} />
      </View>
      <View style={styles.flex}>
        <MobileText variant="small" weight="bold">
          {file.title}
        </MobileText>
        <MobileText variant="small" tone="secondary" numberOfLines={1}>
          {available ? file.path?.split('/').pop() : 'No file returned'}
        </MobileText>
      </View>
      {available ? (
        <MobileButton label="Share" icon={Download} size="sm" variant="secondary" disabled={disabled} onPress={onDownload} />
      ) : (
        <MobileStatusBadge status="Unknown" label="Missing" tone="neutral" />
      )}
    </View>
  );
}

function buildReportFiles(result: FinancialYearCloseResult | null): ReportFile[] {
  if (!result) return [];
  const reportPaths = result.reportPaths || {};
  const overdue = result.overdueResult || null;
  return [
    { id: 'overdue-excel', title: 'Overdue Excel report', type: 'excel', path: reportPaths.overdueExcelReportPath || overdue?.excelReportPath || null, icon: FileSpreadsheet },
    { id: 'overdue-pdf', title: 'Overdue PDF report', type: 'pdf', path: reportPaths.overduePdfReportPath || overdue?.pdfReportPath || null, icon: FileText },
    { id: 'dividend-excel', title: 'Dividend Excel report', type: 'excel', path: reportPaths.dividendExcelReportPath || result.dividendResult?.dividendExcelReportPath || null, icon: FileSpreadsheet },
    { id: 'dividend-pdf', title: 'Dividend PDF report', type: 'pdf', path: reportPaths.dividendPdfReportPath || result.dividendResult?.dividendPdfReportPath || null, icon: FileText },
  ];
}

function transactionToListItem(transaction: RevenueTransaction): MobileDataListItem {
  const title = transaction.memberFullName || transaction.memberName || transaction.membershipNumber || transaction.memberId || 'Unknown member';
  return {
    id: transaction.id,
    title,
    subtitle: transaction.description || Object.keys(transaction.paymentDetails || {}).join(' + ') || 'Year-end transaction',
    meta: `${formatDate(transaction.transactionDate || transaction.createdAt)} - Due ${formatDate(transaction.dueDate)}`,
    amount: formatTzs(getRevenueTransactionTotal(transaction)),
    status: labelFromStatus(transaction.paymentStatus),
    statusTone: statusToneFor(transaction.paymentStatus),
    accent: statusToneFor(transaction.paymentStatus),
    initials: initialsFromName(title),
  };
}

function extractNewFinancialYearEnd(result: FinancialYearCloseResult | null) {
  if (!result) return null;
  const rolled = result as FinancialYearCloseResult & { rolledFinancialYear?: { newEnd?: string | null } | null };
  return toIsoDate(result.newFinancialYearEndDate) || toIsoDate(rolled.rolledFinancialYear?.newEnd);
}

function extractClosedFinancialYear(result: FinancialYearCloseResult | null) {
  if (!result) return null;
  const shaped = result as FinancialYearCloseResult & { closedFinancialYear?: { start?: string | null; end?: string | null } | null };
  const start = toIsoDate(shaped.closedFinancialYear?.start);
  const end = toIsoDate(shaped.closedFinancialYear?.end) || toIsoDate(result.previousFinancialYearEndDate);
  if (!start && !end) return null;
  return `${formatDate(start)} - ${formatDate(end)}`;
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return globalThis.btoa(binary);
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    padding: 14,
  },
  checklist: {
    gap: 12,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconDone: {
    backgroundColor: '#15803D',
  },
  checkIconPending: {
    backgroundColor: '#D97706',
  },
  reportStack: {
    gap: 10,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  reportIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
