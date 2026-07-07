import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  AlertTriangle,
  CalendarDays,
  Coins,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
  Users,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAmountInput,
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
  MobileSearchToolbar,
  MobileSelect,
  MobileStatusBadge,
  MobileStatusTabs,
  type MobileStatusTab,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import {
  getAllAssociationMembers,
  getAssociationGroupConfigs,
  getAssociationMemberRevenueSummary,
  type AssociationMember,
  type GroupConfig,
} from '@/services/member-service';
import {
  closeFinancialYear,
  deductMemberFinesFromDividend,
  distributeDividends,
  downloadRevenueReport,
  generateManualShareFines,
  getMemberTransactionHistory,
  getRevenueTransactionTotal,
  markFinesDueAtFinancialYearEnd,
  type DividendDistributionResult,
  type FinancialYearCloseResult,
  type MarkFinesDueResult,
  type RevenueTransaction,
} from '@/services/revenue-transaction-service';
import { labelFromStatus, statusToneFor, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatTzs, initialsFromName } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type FineWorkflowAction = 'mark-due' | 'deduct-fines' | 'generate-fines' | 'distribute-dividends' | 'close-year';
type CheckMode = 'period' | 'exact' | 'range';

type ReportFile = {
  id: string;
  title: string;
  type: 'excel' | 'pdf';
  path: string | null;
  icon: LucideIcon;
};

type WorkflowResult = {
  action: FineWorkflowAction;
  title: string;
  description: string;
  amount?: number;
  transactions?: RevenueTransaction[];
  reports?: ReportFile[];
};

const workflowTabs: MobileStatusTab[] = [
  { value: 'mark-due', label: 'Mark due' },
  { value: 'deduct-fines', label: 'Deduct' },
  { value: 'generate-fines', label: 'Generate' },
  { value: 'distribute-dividends', label: 'Dividends' },
  { value: 'close-year', label: 'Close year' },
];

const checkModeOptions = [
  { label: 'Period-based', value: 'period' },
  { label: 'Exact date', value: 'exact' },
  { label: 'Date range', value: 'range' },
];

const MEMBER_LOAD_COUNT = 8;

export default function MobileFineManagementScreen() {
  const { activeView, associationId } = useAuth();
  const theme = useNaneTheme();
  const [configs, setConfigs] = useState<GroupConfig[]>([]);
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FineWorkflowAction>('mark-due');
  const [checkDate, setCheckDate] = useState('');
  const [checkMode, setCheckMode] = useState<CheckMode>('period');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberVisibleCount, setMemberVisibleCount] = useState(MEMBER_LOAD_COUNT);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberDetailsLoading, setMemberDetailsLoading] = useState(false);
  const [memberOverdueTotal, setMemberOverdueTotal] = useState<number | null>(null);
  const [memberLastDividend, setMemberLastDividend] = useState<number | null>(null);
  const [lastDividendDate, setLastDividendDate] = useState<string | null>(null);
  const [deductAmount, setDeductAmount] = useState('');
  const [confirmAction, setConfirmAction] = useState<FineWorkflowAction | null>(null);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [lastDownload, setLastDownload] = useState<string | null>(null);

  const loadSetup = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading fine workflows.');
        return;
      }
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const [loadedConfigs, loadedMembers] = await Promise.all([
          getAssociationGroupConfigs(associationId),
          getAllAssociationMembers(associationId, { size: 250, sort: 'membershipNumber,asc' }),
        ]);
        setConfigs(loadedConfigs || []);
        setMembers(loadedMembers.content || []);
        const configuredYearEnd = toIsoDate((loadedConfigs || [])[0]?.financialYearEndDate);
        if (configuredYearEnd) {
          setCheckDate((current) => current || configuredYearEnd);
        }
      } catch (loadError) {
        setConfigs([]);
        setMembers([]);
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
      if (active) void loadSetup();
    });
    return () => {
      active = false;
    };
  }, [loadSetup]);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) || null,
    [members, selectedMemberId],
  );
  const config = configs[0] || null;
  const financialYearEnd = toIsoDate(config?.financialYearEndDate);
  const financialYearStart = toIsoDate(config?.financialYearStartDate);
  const currentWorkflow = workflowTabs.find((tab) => tab.value === activeTab)?.label || 'Workflow';
  const beforeYearEnd = Boolean(checkDate && financialYearEnd && checkDate < financialYearEnd);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    const activeMembers = members.filter((member) => String(member.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
    if (!query) return activeMembers;
    return activeMembers.filter((member) =>
      [member.fullLegalName, member.membershipNumber, member.contactInfo?.email, member.contactInfo?.phoneNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [memberSearch, members]);

  const validationMessage = useMemo(() => {
    if (activeTab === 'deduct-fines') {
      if (!selectedMemberId) return 'Select a member first.';
      if (toNumber(deductAmount) <= 0) return 'Enter an amount greater than zero.';
      return null;
    }
    if (activeTab === 'generate-fines') {
      if (checkMode === 'range') {
        if (!isIsoDate(startDate) || !isIsoDate(endDate)) return 'Enter valid start and end dates.';
        if (startDate > endDate) return 'Start date must be before end date.';
        return null;
      }
      if (!isIsoDate(checkDate)) return 'Enter a valid check date.';
      return null;
    }
    if (!isIsoDate(checkDate)) return 'Enter a valid check date.';
    if ((activeTab === 'distribute-dividends' || activeTab === 'close-year') && beforeYearEnd) {
      return `This workflow can run after FY end ${formatDate(financialYearEnd)}.`;
    }
    return null;
  }, [activeTab, beforeYearEnd, checkDate, checkMode, deductAmount, endDate, financialYearEnd, selectedMemberId, startDate]);

  useEffect(() => {
    if (!selectedMemberId || !associationId) {
      return;
    }

    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setMemberDetailsLoading(true);
      setMemberOverdueTotal(null);
      setMemberLastDividend(null);
      setLastDividendDate(null);
      void Promise.allSettled([
        getAssociationMemberRevenueSummary(selectedMemberId),
        getMemberTransactionHistory(selectedMemberId, { paymentStatus: 'PAID' }),
      ])
        .then(([summaryResult, historyResult]) => {
          if (!active) return;
          if (summaryResult.status === 'fulfilled') {
            const summary = summaryResult.value;
            setMemberOverdueTotal(toNumber(summary.overdueFinesTotal) + toNumber(summary.overduePenaltiesTotal));
          } else {
            setMemberOverdueTotal(0);
          }

          if (historyResult.status === 'fulfilled') {
            const latestDividend = [...(historyResult.value || [])]
              .filter((transaction) => toNumber(transaction.paymentDetails?.DIVIDEND) > 0 && String(transaction.paymentStatus || '').toUpperCase() === 'PAID')
              .sort((a, b) => new Date(b.transactionDate || b.createdAt || 0).getTime() - new Date(a.transactionDate || a.createdAt || 0).getTime())[0];
            const amount = toNumber(latestDividend?.paymentDetails?.DIVIDEND);
            setMemberLastDividend(amount);
            setLastDividendDate(latestDividend?.transactionDate || latestDividend?.createdAt || null);
            setDeductAmount(amount > 0 ? String(amount) : '');
          } else {
            setMemberLastDividend(0);
            setDeductAmount('');
          }
        })
        .finally(() => {
          if (active) setMemberDetailsLoading(false);
        });
    });

    return () => {
      active = false;
    };
  }, [associationId, selectedMemberId]);

  const openConfirm = () => {
    if (validationMessage) return;
    setConfirmAction(activeTab);
  };

  const runConfirmedAction = async () => {
    if (!associationId || !confirmAction) return;
    setWorking(true);
    setError(null);
    setLastDownload(null);
    setConfirmAction(null);
    try {
      if (confirmAction === 'mark-due') {
        const data = await markFinesDueAtFinancialYearEnd(associationId, checkDate);
        setResult(buildMarkDueResult(data));
      } else if (confirmAction === 'deduct-fines' && selectedMemberId) {
        const remaining = await deductMemberFinesFromDividend(associationId, selectedMemberId, toNumber(deductAmount));
        setResult({
          action: 'deduct-fines',
          title: 'Fines deducted',
          description: `${selectedMember?.fullLegalName || 'Selected member'} remaining amount: ${formatTzs(toNumber(remaining))}`,
          amount: toNumber(remaining),
        });
        setDeductAmount('');
        void loadMemberDetailsAgain(selectedMemberId);
      } else if (confirmAction === 'generate-fines') {
        const scope =
          checkMode === 'range'
            ? { checkMode, startDate: `${startDate}T00:00:00`, endDate: `${endDate}T23:59:59` }
            : { checkMode, checkDate: `${checkDate}T00:00:00` };
        const data = await generateManualShareFines(associationId, scope);
        setResult({
          action: 'generate-fines',
          title: data.length ? 'Share fines generated' : 'No fines generated',
          description: `${formatNumber(data.length)} fine${data.length === 1 ? '' : 's'} returned by the backend.`,
          transactions: data,
        });
      } else if (confirmAction === 'distribute-dividends') {
        const data = await distributeDividends(associationId, checkDate);
        setResult(buildDividendResult(data));
      } else if (confirmAction === 'close-year') {
        const data = await closeFinancialYear(associationId, checkDate);
        setResult(buildCloseYearResult(data));
        void loadSetup('refresh');
      }
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setWorking(false);
    }
  };

  const loadMemberDetailsAgain = async (memberId: string) => {
    try {
      const summary = await getAssociationMemberRevenueSummary(memberId);
      setMemberOverdueTotal(toNumber(summary.overdueFinesTotal) + toNumber(summary.overduePenaltiesTotal));
    } catch {
      // The action result remains visible even if the background refresh fails.
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
        title="Fine management"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message="Loading fine workflows" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Finance"
        title="Fine management"
        subtitle="Fines, dividends, and year close"
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Reload fine workflows"
            variant="secondary"
            disabled={refreshing || working}
            onPress={() => void loadSetup('refresh')}
          />
        }
      />

      {error ? <MobileErrorState title="Fine workflow issue" description={error} retryLabel="Reload" onRetry={() => void loadSetup('refresh')} /> : null}
      {lastDownload ? <MobileStatusBadge status="Completed" label={`Downloaded ${lastDownload}`} tone="success" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Financial year end" value={formatDate(financialYearEnd)} description="Configured close date" tone={financialYearEnd ? 'green' : 'orange'} icon={CalendarDays} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active members" value={formatNumber(members.length)} description="Available for selection" tone="blue" icon={Users} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Workflow" value={currentWorkflow} description="Selected processing tab" tone={activeTab === 'close-year' ? 'red' : 'purple'} icon={FileText} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Action state" value={working ? 'Processing' : 'Ready'} description="Confirmation required first" tone={working ? 'orange' : 'slate'} icon={ShieldCheck} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Fine workflows
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Choose one workflow and confirm before records are changed.
            </MobileText>
          </View>
          <MobileStatusBadge status="Processing" label={currentWorkflow} tone={activeTab === 'close-year' ? 'danger' : 'info'} />
        </View>
        <MobileStatusTabs tabs={workflowTabs} value={activeTab} onChange={(value) => setActiveTab(value as FineWorkflowAction)} />
      </MobileCard>

      <MobileCard compact accent={activeTab === 'close-year' ? 'red' : activeTab === 'generate-fines' ? 'orange' : 'blue'}>
        <WorkflowContent
          activeTab={activeTab}
          checkDate={checkDate}
          setCheckDate={setCheckDate}
          checkMode={checkMode}
          setCheckMode={setCheckMode}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          memberSearch={memberSearch}
          setMemberSearch={(value) => {
            setMemberSearch(value);
            setMemberVisibleCount(MEMBER_LOAD_COUNT);
          }}
          filteredMembers={filteredMembers}
          memberVisibleCount={memberVisibleCount}
          setMemberVisibleCount={setMemberVisibleCount}
          selectedMemberId={selectedMemberId}
          setSelectedMemberId={setSelectedMemberId}
          selectedMember={selectedMember}
          memberDetailsLoading={memberDetailsLoading}
          memberOverdueTotal={memberOverdueTotal}
          memberLastDividend={memberLastDividend}
          lastDividendDate={lastDividendDate}
          deductAmount={deductAmount}
          setDeductAmount={setDeductAmount}
          validationMessage={validationMessage}
          financialYearStart={financialYearStart}
          financialYearEnd={financialYearEnd}
          working={working}
          themeColors={{ primary: theme.colors.primary, border: theme.colors.border, surface: theme.colors.surface }}
        />
        <MobileButton
          label={actionLabel(activeTab, working)}
          icon={actionIcon(activeTab)}
          loading={working}
          fullWidth
          variant={activeTab === 'close-year' ? 'danger' : 'primary'}
          disabled={Boolean(validationMessage) || refreshing}
          onPress={openConfirm}
        />
      </MobileCard>

      {result ? (
        <MobileCard compact>
          <View style={styles.sectionHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                {result.title}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {result.description}
              </MobileText>
            </View>
            <MobileStatusBadge status="Completed" label="Done" tone="success" />
          </View>

          {typeof result.amount === 'number' ? (
            <MobileInfoRow label="Amount" value={formatTzs(result.amount)} helper="Returned by the backend." icon={Coins} status="Completed" />
          ) : null}

          {result.reports?.length ? (
            <View style={styles.reportList}>
              {result.reports.map((file) => (
                <ReportRow key={file.id} file={file} onDownload={() => void downloadReportFile(file)} />
              ))}
            </View>
          ) : null}

          {result.transactions?.length ? (
            <MobileDataList items={result.transactions.slice(0, 8).map(transactionToListItem)} showChevron={false} />
          ) : result.action === 'generate-fines' || result.action === 'mark-due' || result.action === 'distribute-dividends' ? (
            <MobileEmptyState title="No transaction rows returned" description="The action completed without returning member transaction rows." />
          ) : null}
        </MobileCard>
      ) : (
        <MobileEmptyState
          title="No workflow has run yet"
          description="Select a workflow, complete the required fields, and confirm the action to see results here."
        />
      )}

      <MobileConfirmSheet
        visible={Boolean(confirmAction)}
        title={confirmTitle(confirmAction)}
        description={confirmDescription(confirmAction, {
          checkDate,
          financialYearEnd,
          selectedMemberName: selectedMember?.fullLegalName || selectedMember?.membershipNumber || 'selected member',
          deductAmount: toNumber(deductAmount),
          checkMode,
          startDate,
          endDate,
        })}
        confirmLabel={confirmAction === 'close-year' ? 'Close year' : 'Confirm'}
        destructive={confirmAction === 'close-year'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runConfirmedAction()}
      />
    </MobileScreen>
  );
}

function WorkflowContent(props: {
  activeTab: FineWorkflowAction;
  checkDate: string;
  setCheckDate: (value: string) => void;
  checkMode: CheckMode;
  setCheckMode: (value: CheckMode) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  memberSearch: string;
  setMemberSearch: (value: string) => void;
  filteredMembers: AssociationMember[];
  memberVisibleCount: number;
  setMemberVisibleCount: (value: number | ((current: number) => number)) => void;
  selectedMemberId: string | null;
  setSelectedMemberId: (value: string) => void;
  selectedMember: AssociationMember | null;
  memberDetailsLoading: boolean;
  memberOverdueTotal: number | null;
  memberLastDividend: number | null;
  lastDividendDate: string | null;
  deductAmount: string;
  setDeductAmount: (value: string) => void;
  validationMessage: string | null;
  financialYearStart: string | null;
  financialYearEnd: string | null;
  working: boolean;
  themeColors: { primary: string; border: string; surface: string };
}) {
  if (props.activeTab === 'deduct-fines') {
    return (
      <View style={styles.workflowStack}>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Deduct member fines
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Apply an available dividend amount against overdue fines and penalties.
            </MobileText>
          </View>
          <MobileStatusBadge status={props.selectedMember ? 'Active' : 'Pending'} label={props.selectedMember ? 'Selected' : 'Choose member'} tone={props.selectedMember ? 'success' : 'warning'} />
        </View>
        <MobileSearchToolbar value={props.memberSearch} onChange={props.setMemberSearch} placeholder="Search members..." />
        <View style={styles.memberList}>
          {props.filteredMembers.slice(0, props.memberVisibleCount).map((member) => {
            const selected = member.id === props.selectedMemberId;
            return (
              <Pressable
                key={member.id}
                onPress={() => props.setSelectedMemberId(member.id)}
                style={({ pressed }) => [
                  styles.memberRow,
                  {
                    backgroundColor: props.themeColors.surface,
                    borderColor: selected ? props.themeColors.primary : props.themeColors.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <View style={styles.flex}>
                  <MobileText variant="small" weight="bold" numberOfLines={1}>
                    {member.fullLegalName || member.membershipNumber || 'Unknown member'}
                  </MobileText>
                  <MobileText variant="small" tone="secondary" numberOfLines={1}>
                    {member.contactInfo?.email || member.membershipNumber || 'No email'}
                  </MobileText>
                </View>
                <MobileStatusBadge status={selected ? 'Selected' : member.status || 'Active'} label={selected ? 'Selected' : member.status || 'Active'} tone={selected ? 'primary' : undefined} />
              </Pressable>
            );
          })}
        </View>
        {props.memberVisibleCount < props.filteredMembers.length ? (
          <MobileButton label="Load more members" variant="secondary" fullWidth onPress={() => props.setMemberVisibleCount((current) => current + MEMBER_LOAD_COUNT)} />
        ) : null}
        <MobileAmountInput
          label="Amount to deduct from"
          value={props.deductAmount}
          onChangeText={props.setDeductAmount}
          helperText={props.memberLastDividend ? `Last dividend: ${formatTzs(props.memberLastDividend)}${props.lastDividendDate ? ` on ${formatDate(props.lastDividendDate)}` : ''}` : 'Enter the dividend or available amount.'}
          error={props.validationMessage || undefined}
          disabled={props.working || props.memberDetailsLoading || !props.selectedMemberId}
        />
        <View style={styles.detailGrid}>
          <MobileInfoRow label="Overdue fines" value={props.memberDetailsLoading ? 'Loading...' : formatTzs(props.memberOverdueTotal || 0)} helper="Fines and penalties currently overdue." icon={TriangleAlert} status={(props.memberOverdueTotal || 0) > 0 ? 'Overdue' : 'Paid'} />
          <MobileInfoRow label="Last dividend" value={props.memberDetailsLoading ? 'Loading...' : formatTzs(props.memberLastDividend || 0)} helper={props.lastDividendDate ? `Paid ${formatDate(props.lastDividendDate)}` : 'No paid dividend found.'} icon={Coins} status={props.memberLastDividend ? 'Paid' : 'Unknown'} />
        </View>
      </View>
    );
  }

  if (props.activeTab === 'generate-fines') {
    return (
      <View style={styles.workflowStack}>
        <WorkflowHeader title="Generate share fines" description="Generate missed share-purchase fines for active members." tone="warning" />
        <MobileSelect label="Check mode" value={props.checkMode} options={checkModeOptions} onChange={(value) => props.setCheckMode(value as CheckMode)} />
        {props.checkMode === 'range' ? (
          <View style={styles.twoColumn}>
            <MobileTextInput label="Start date" value={props.startDate} onChangeText={props.setStartDate} placeholder="YYYY-MM-DD" icon={CalendarDays} autoCapitalize="none" disabled={props.working} />
            <MobileTextInput label="End date" value={props.endDate} onChangeText={props.setEndDate} placeholder="YYYY-MM-DD" icon={CalendarDays} autoCapitalize="none" disabled={props.working} />
          </View>
        ) : (
          <MobileTextInput
            label="Check date"
            value={props.checkDate}
            onChangeText={props.setCheckDate}
            placeholder="YYYY-MM-DD"
            helperText={props.checkMode === 'period' ? 'Uses the configured share purchase period ending on this date.' : 'Checks the selected exact date.'}
            icon={CalendarDays}
            autoCapitalize="none"
            disabled={props.working}
          />
        )}
        {props.validationMessage ? <MobileStatusBadge status="Rejected" label={props.validationMessage} tone="danger" /> : null}
      </View>
    );
  }

  if (props.activeTab === 'close-year') {
    return (
      <View style={styles.workflowStack}>
        <WorkflowHeader title="Close financial year" description="Marks dues, distributes dividends, and rolls the group config forward." tone="danger" />
        <MobileTextInput label="Check date" value={props.checkDate} onChangeText={props.setCheckDate} placeholder={props.financialYearEnd || 'YYYY-MM-DD'} icon={CalendarDays} autoCapitalize="none" error={props.validationMessage || undefined} disabled={props.working} />
        <View style={styles.warningBox}>
          <ShieldAlert color="#B91C1C" size={18} strokeWidth={2.4} />
          <View style={styles.flex}>
            <MobileText variant="small" weight="bold">
              Irreversible year-end workflow
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Confirm only after statements, fines, and dividend calculations are reviewed.
            </MobileText>
          </View>
        </View>
        <MobileInfoRow label="Current financial year" value={`${formatDate(props.financialYearStart)} - ${formatDate(props.financialYearEnd)}`} helper="Loaded from group configuration." icon={CalendarDays} status="Active" />
      </View>
    );
  }

  const isDividend = props.activeTab === 'distribute-dividends';
  return (
    <View style={styles.workflowStack}>
      <WorkflowHeader
        title={isDividend ? 'Distribute dividends' : 'Mark fines due'}
        description={isDividend ? 'Distribute year-end dividends and deduct overdue fines first.' : 'Mark pending fines and penalties overdue when the financial year has ended.'}
        tone={isDividend ? 'info' : 'primary'}
      />
      <MobileTextInput label="Check date" value={props.checkDate} onChangeText={props.setCheckDate} placeholder={props.financialYearEnd || 'YYYY-MM-DD'} icon={CalendarDays} autoCapitalize="none" error={props.validationMessage || undefined} disabled={props.working} />
      <MobileInfoRow label="Financial year" value={`${formatDate(props.financialYearStart)} - ${formatDate(props.financialYearEnd)}`} helper={isDividend ? 'Dividend distribution is blocked before FY end.' : 'Before FY end, marking due returns no overdue changes.'} icon={CalendarDays} status={props.financialYearEnd ? 'Active' : 'Pending'} />
    </View>
  );
}

function WorkflowHeader({ title, description, tone }: { title: string; description: string; tone: 'primary' | 'info' | 'warning' | 'danger' }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.flex}>
        <MobileText variant="section" weight="bold">
          {title}
        </MobileText>
        <MobileText variant="small" tone="secondary">
          {description}
        </MobileText>
      </View>
      <MobileStatusBadge status={title} label="Ready" tone={tone} />
    </View>
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
        <MobileText variant="small" tone="secondary" numberOfLines={1}>
          {available ? file.path?.split('/').pop() : 'No file returned'}
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

function buildMarkDueResult(data: MarkFinesDueResult): WorkflowResult {
  const rows = data.overdueTransactions || [];
  return {
    action: 'mark-due',
    title: rows.length ? 'Fines marked overdue' : 'No fines marked overdue',
    description: `${formatNumber(rows.length)} transaction${rows.length === 1 ? '' : 's'} returned.`,
    amount: toNumber(data.totalOverdueAmount),
    transactions: rows,
    reports: [
      { id: 'mark-excel', title: 'Overdue Excel report', type: 'excel', path: data.excelReportPath || null, icon: FileSpreadsheet },
      { id: 'mark-pdf', title: 'Overdue PDF report', type: 'pdf', path: data.pdfReportPath || null, icon: FileText },
    ],
  };
}

function buildDividendResult(data: DividendDistributionResult): WorkflowResult {
  return {
    action: 'distribute-dividends',
    title: 'Dividends distributed',
    description: `${formatNumber(data.dividendTransactions?.length || 0)} dividend transaction${data.dividendTransactions?.length === 1 ? '' : 's'} returned.`,
    amount: toNumber(data.totalDistributed),
    transactions: data.dividendTransactions || [],
    reports: [
      { id: 'div-excel', title: 'Dividend Excel report', type: 'excel', path: data.dividendExcelReportPath || null, icon: FileSpreadsheet },
      { id: 'div-pdf', title: 'Dividend PDF report', type: 'pdf', path: data.dividendPdfReportPath || null, icon: FileText },
      { id: 'overdue-excel', title: 'Overdue Excel report', type: 'excel', path: data.overdueExcelReportPath || null, icon: FileSpreadsheet },
      { id: 'overdue-pdf', title: 'Overdue PDF report', type: 'pdf', path: data.overduePdfReportPath || null, icon: FileText },
    ],
  };
}

function buildCloseYearResult(data: FinancialYearCloseResult): WorkflowResult {
  const reportPaths = data.reportPaths || {};
  const dividend = data.dividendResult || null;
  const overdue = data.overdueResult || null;
  return {
    action: 'close-year',
    title: 'Financial year closed',
    description: `New FY end: ${formatDate(data.newFinancialYearEndDate)}`,
    amount: toNumber(dividend?.totalDistributed || overdue?.totalOverdueAmount),
    transactions: [...(dividend?.dividendTransactions || []), ...(overdue?.overdueTransactions || [])],
    reports: [
      { id: 'close-div-excel', title: 'Dividend Excel report', type: 'excel', path: reportPaths.dividendExcelReportPath || dividend?.dividendExcelReportPath || null, icon: FileSpreadsheet },
      { id: 'close-div-pdf', title: 'Dividend PDF report', type: 'pdf', path: reportPaths.dividendPdfReportPath || dividend?.dividendPdfReportPath || null, icon: FileText },
      { id: 'close-overdue-excel', title: 'Overdue Excel report', type: 'excel', path: reportPaths.overdueExcelReportPath || overdue?.excelReportPath || null, icon: FileSpreadsheet },
      { id: 'close-overdue-pdf', title: 'Overdue PDF report', type: 'pdf', path: reportPaths.overduePdfReportPath || overdue?.pdfReportPath || null, icon: FileText },
    ],
  };
}

function transactionToListItem(transaction: RevenueTransaction): MobileDataListItem {
  const name = transaction.memberFullName || transaction.memberName || transaction.membershipNumber || transaction.memberId || 'Unknown member';
  return {
    id: transaction.id,
    title: name,
    subtitle: transaction.description || Object.keys(transaction.paymentDetails || {}).join(' + ') || 'Fine workflow transaction',
    meta: `${formatDate(transaction.transactionDate || transaction.createdAt)} · Due ${formatDate(transaction.dueDate)}`,
    amount: formatTzs(getRevenueTransactionTotal(transaction)),
    status: labelFromStatus(transaction.paymentStatus),
    statusTone: statusToneFor(transaction.paymentStatus),
    initials: initialsFromName(name),
    accent: statusToneFor(transaction.paymentStatus),
  };
}

function actionLabel(action: FineWorkflowAction, working: boolean) {
  if (working) return 'Processing';
  if (action === 'mark-due') return 'Mark fines as due';
  if (action === 'deduct-fines') return 'Deduct fines';
  if (action === 'generate-fines') return 'Generate fines';
  if (action === 'distribute-dividends') return 'Distribute dividends';
  return 'Close financial year';
}

function actionIcon(action: FineWorkflowAction) {
  if (action === 'mark-due') return FileText;
  if (action === 'deduct-fines') return WalletCards;
  if (action === 'generate-fines') return AlertTriangle;
  if (action === 'distribute-dividends') return Coins;
  return TrendingUp;
}

function confirmTitle(action: FineWorkflowAction | null) {
  if (action === 'close-year') return 'Close financial year?';
  if (action === 'deduct-fines') return 'Deduct fines?';
  if (action === 'generate-fines') return 'Generate share fines?';
  if (action === 'distribute-dividends') return 'Distribute dividends?';
  return 'Confirm action?';
}

function confirmDescription(
  action: FineWorkflowAction | null,
  context: {
    checkDate: string;
    financialYearEnd: string | null;
    selectedMemberName: string;
    deductAmount: number;
    checkMode: CheckMode;
    startDate: string;
    endDate: string;
  },
) {
  if (action === 'deduct-fines') {
    return `Deduct overdue fines for ${context.selectedMemberName} from ${formatTzs(context.deductAmount)}.`;
  }
  if (action === 'generate-fines') {
    const scope = context.checkMode === 'range' ? `${context.startDate} to ${context.endDate}` : context.checkDate;
    return `Generate missed share-purchase fines using ${context.checkMode} mode for ${scope}.`;
  }
  if (action === 'distribute-dividends') {
    return `Run dividend distribution for check date ${context.checkDate}. Overdue fines may be deducted first.`;
  }
  if (action === 'close-year') {
    return `This will run year-end processing for ${context.checkDate}, close the year ending ${formatDate(context.financialYearEnd)}, and roll the configuration forward. This cannot be casually undone.`;
  }
  return `Mark pending fines and penalties due using check date ${context.checkDate}.`;
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
  workflowStack: {
    gap: 12,
    marginBottom: 14,
  },
  twoColumn: {
    gap: 12,
  },
  memberList: {
    gap: 8,
  },
  memberRow: {
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailGrid: {
    gap: 10,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    padding: 12,
  },
  reportList: {
    gap: 10,
    marginBottom: 12,
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
});
