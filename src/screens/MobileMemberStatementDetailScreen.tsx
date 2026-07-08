import { router } from 'expo-router';
import {
  Banknote,
  CalendarRange,
  Download,
  FileSpreadsheet,
  Hash,
  ListChecks,
  RefreshCw,
  Share2,
  TrendingUp,
  UserRound,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  type MobileDataListItem,
  MobileDetailHeader,
  MobileEmptyState,
  MobileErrorState,
  MobileFormSection,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileSearchToolbar,
  MobileScreen,
  MobileSelect,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
  useMobileFeedback,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getAssociationGroupConfigs,
  getAssociationMember,
  getAssociationMembersStatement,
  getAssociationSharesStatement,
  type AssociationMember,
  type ContributionStatementTransaction,
  type GroupConfig,
  type MembersStatement,
  type ShareStatementTransaction,
  type SharesStatement,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';
import { labelFromStatus, statusToneFor } from '@/theme/tokens';
import {
  exportIndividualStatementReport,
  type StatementFileFormat,
  type StatementKind,
} from '@/utils/mobile-statement-export';

type MobileMemberStatementDetailScreenProps = {
  memberId?: string;
};

type PeriodOption = {
  label: string;
  value: string;
  startDate: string;
  endDate: string;
};

type ActiveTab = 'summary' | 'shares' | 'contributions';
type PeriodFilterType = 'financialYear' | 'customRange' | 'allTime';

const ALL_TIME_VALUE = 'all-time';
const VERY_EARLY_DATE_TIME = '1900-01-01T00:00:00';

export default function MobileMemberStatementDetailScreen({ memberId }: MobileMemberStatementDetailScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const { toast } = useMobileFeedback();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [groupConfig, setGroupConfig] = useState<GroupConfig | null>(null);
  const [periodOptions, setPeriodOptions] = useState<PeriodOption[]>([]);
  const [filterType, setFilterType] = useState<PeriodFilterType>('financialYear');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sharesStatement, setSharesStatement] = useState<SharesStatement | null>(null);
  const [membersStatement, setMembersStatement] = useState<MembersStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStatements, setLoadingStatements] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('summary');
  const [shareSearch, setShareSearch] = useState('');
  const [shareStatus, setShareStatus] = useState('ALL');
  const [contributionSearch, setContributionSearch] = useState('');
  const [contributionStatus, setContributionStatus] = useState('ALL');

  const statementSource = membersStatement || sharesStatement;
  const memberName = statementSource?.memberName || member?.fullLegalName || 'Member';
  const membershipNumber = statementSource?.membershipNumber || member?.membershipNumber || 'No membership number';
  const financialYearPeriodOptions = useMemo(() => periodOptions.filter((option) => option.value !== ALL_TIME_VALUE), [periodOptions]);
  const selectedFinancialYearRange = financialYearPeriodOptions.find((option) => option.value === selectedPeriod) || financialYearPeriodOptions[0] || null;
  const selectedRange = useMemo(
    () => resolveStatementPeriod(filterType, selectedFinancialYearRange, customStartDate, customEndDate),
    [customEndDate, customStartDate, filterType, selectedFinancialYearRange],
  );

  const loadStatements = useCallback(
    async (period: PeriodOption, mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId || !memberId) return;
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoadingStatements(true);
      }
      setError(null);
      setNotice(null);

      try {
        const [sharesResponse, membersResponse] = await Promise.all([
          getAssociationSharesStatement(associationId, period.startDate, period.endDate),
          getAssociationMembersStatement(associationId, period.startDate, period.endDate),
        ]);

        const matchingShares = sharesResponse.find((item) => item.memberId === memberId) || null;
        const matchingMembers = membersResponse.find((item) => item.memberId === memberId) || null;
        setSharesStatement(matchingShares);
        setMembersStatement(matchingMembers);
        if (!matchingShares && !matchingMembers) {
          setNotice('No statement records were returned for this member in the selected period.');
        }
      } catch (statementError) {
        setError(getApiErrorMessage(statementError));
      } finally {
        setLoadingStatements(false);
        setRefreshing(false);
      }
    },
    [associationId, memberId],
  );

  const loadInitial = useCallback(async () => {
    if (!associationId || !memberId) {
      setLoading(false);
      setError('Association or member context is missing.');
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const [memberResponse, configs] = await Promise.all([
        getAssociationMember(memberId),
        getAssociationGroupConfigs(associationId),
      ]);
      const config = configs[0] || null;
      if (!config?.financialYearStartDate) {
        setMember(memberResponse);
        setGroupConfig(config);
        setPeriodOptions([]);
        setSelectedPeriod('');
        setNotice('Financial year configuration is required before statements can be generated.');
        return;
      }

      const options = buildFinancialYearOptions(config);
      setMember(memberResponse);
      setGroupConfig(config);
      setPeriodOptions(options);
      setSelectedPeriod(options[0]?.value || '');

      if (options[0]) {
        await loadStatements(options[0]);
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [associationId, loadStatements, memberId]);

  useEffect(() => {
    void Promise.resolve().then(loadInitial);
  }, [loadInitial]);

  const shareTransactions = useMemo(
    () => [...(sharesStatement?.transactions || [])].sort(compareStatementTransactions),
    [sharesStatement],
  );
  const contributionTransactions = useMemo(
    () => [...(membersStatement?.transactions || [])]
      .filter((transaction) => transaction.contributionType !== 'LOAN_REPAYMENT')
      .sort(compareStatementTransactions),
    [membersStatement],
  );

  const shareStatusTabs = useMemo(
    () => buildStatusTabs(shareTransactions),
    [shareTransactions],
  );
  const contributionStatusTabs = useMemo(
    () => buildStatusTabs(contributionTransactions),
    [contributionTransactions],
  );

  const filteredShareItems = useMemo(
    () => shareTransactions
      .filter((transaction) => matchesStatus(transaction.status, shareStatus))
      .filter((transaction) => matchesSearch([
        transaction.description,
        transaction.status,
        transaction.periodDate,
        transaction.transactionDate,
      ], shareSearch))
      .map(mapShareTransactionToItem),
    [shareSearch, shareStatus, shareTransactions],
  );

  const filteredContributionItems = useMemo(
    () => contributionTransactions
      .filter((transaction) => matchesStatus(transaction.status, contributionStatus))
      .filter((transaction) => matchesSearch([
        transaction.description,
        transaction.status,
        transaction.contributionType,
        transaction.periodDate,
        transaction.transactionDate,
      ], contributionSearch))
      .map(mapContributionTransactionToItem),
    [contributionSearch, contributionStatus, contributionTransactions],
  );

  const contributionRows = useMemo(
    () => Object.entries(membersStatement?.contributions || {})
      .filter(([, value]) => toNumber(value) !== 0)
      .sort(([left], [right]) => left.localeCompare(right)),
    [membersStatement],
  );

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Member statement"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading && !member) {
    return <MobilePageLoadingState kind="detail" message="Loading member statement" />;
  }

  if (error && !member) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Statements"
          title="Member statement"
          subtitle="Statement could not be loaded"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadInitial()} />}
        />
        <MobileErrorState title="Statement could not load" description={error} retryLabel="Retry" onRetry={() => void loadInitial()} />
      </MobileScreen>
    );
  }

  const applyPeriod = () => {
    if (!selectedRange) {
      setNotice('Choose a valid reporting period before loading statements.');
      return;
    }
    void loadStatements(selectedRange, 'refresh');
  };

  const runIndividualExport = async (kind: StatementKind, format: StatementFileFormat) => {
    const statement = kind === 'shares' ? sharesStatement : membersStatement;
    if (!statement || !selectedRange) {
      toast.error({
        title: 'Statement not ready',
        description: 'Load the statement for a valid period before exporting.',
      });
      return;
    }

    const key = `${kind}-${format}`;
    setExporting(key);
    try {
      await exportIndividualStatementReport({
        kind,
        statement,
        memberId,
        format,
        associationName: user?.associationName,
        groupConfig,
        periodLabel: selectedRange.label,
        startDate: selectedRange.startDate,
        endDate: selectedRange.endDate,
        destination: 'save',
      });
      toast.success({
        title: 'Statement exported',
        description: `${kind === 'shares' ? 'Share' : 'Member'} statement ${format.toUpperCase()} saved to your device.`,
      });
    } catch (exportError) {
      const message = getApiErrorMessage(exportError);
      setError(message);
      toast.error({
        title: 'Export failed',
        description: message,
      });
    } finally {
      setExporting(null);
    }
  };

  const shareSummary = async () => {
    await Share.share({
      title: 'Nane member statement summary',
      message: [
        `${memberName} - ${membershipNumber}`,
        `Period: ${selectedRange?.label || 'Not selected'}`,
        `Period shares: ${formatNumber(toNumber(statementSource?.totalShares))}`,
        `Period share value: ${formatCurrency(toNumber(statementSource?.totalShareValue))}`,
        `Net shares: ${formatNumber(toNumber(statementSource?.currentNetTotalShares))}`,
        `Net share value: ${formatCurrency(toNumber(statementSource?.currentNetTotalShareValue))}`,
        `Outstanding loan: ${formatCurrency(toNumber(membersStatement?.totalOutstandingLoanBalance))}`,
      ].join('\n'),
    });
  };

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Statements"
        title="Member statement"
        subtitle={groupConfig?.name || user?.associationName || 'Financial statement'}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh statements"
            variant="secondary"
            disabled={refreshing || loadingStatements}
            onPress={applyPeriod}
          />
        }
      />

      {notice ? <MobileToast title="Statement" description={notice} tone="info" /> : null}
      {error && member ? <MobileToast title="Statement issue" description={error} tone="danger" /> : null}

      <MobileDetailHeader
        title={memberName}
        subtitle={membershipNumber}
        eyebrow="Financial statement"
        status={statementSource ? 'Loaded' : 'No data'}
        avatarName={memberName}
        avatarTone={statementSource ? 'success' : 'neutral'}
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Period shares"
            value={formatNumber(toNumber(statementSource?.totalShares))}
            description={formatCurrency(toNumber(statementSource?.totalShareValue))}
            tone="purple"
            icon={Hash}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Net share value"
            value={formatCurrency(toNumber(statementSource?.currentNetTotalShareValue))}
            description={`${formatNumber(toNumber(statementSource?.currentNetTotalShares))} net shares`}
            tone="green"
            icon={TrendingUp}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Outstanding loan"
            value={formatCurrency(toNumber(membersStatement?.totalOutstandingLoanBalance))}
            description="Loan balance"
            tone={toNumber(membersStatement?.totalOutstandingLoanBalance) > 0 ? 'orange' : 'slate'}
            icon={Banknote}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Activity rows"
            value={formatNumber(shareTransactions.length + contributionTransactions.length)}
            description={`${formatNumber(shareTransactions.length)} shares · ${formatNumber(contributionTransactions.length)} other`}
            tone="blue"
            icon={ListChecks}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFormSection
        title="Statement period"
        description="Choose the reporting period, then reload the member statement."
      >
        {periodOptions.length ? (
          <>
            <MobileSelect
              label="Period type"
              value={filterType}
              options={[
                { label: 'Financial year', value: 'financialYear' },
                { label: 'Custom dates', value: 'customRange' },
                { label: 'All time', value: 'allTime' },
              ]}
              onChange={(value) => setFilterType(value as PeriodFilterType)}
            />
            {filterType === 'financialYear' ? (
              <MobileSelect
                label="Financial year"
                value={selectedFinancialYearRange?.value || ''}
                options={financialYearPeriodOptions.map((option) => ({ label: option.label, value: option.value }))}
                onChange={setSelectedPeriod}
              />
            ) : null}
            {filterType === 'customRange' ? (
              <View style={styles.customDateFields}>
                <MobileTextInput label="Start date" value={customStartDate} onChangeText={setCustomStartDate} placeholder="YYYY-MM-DD" />
                <MobileTextInput label="End date" value={customEndDate} onChangeText={setCustomEndDate} placeholder="YYYY-MM-DD" />
              </View>
            ) : null}
            <MobileInfoRow
              label="Date range"
              value={selectedRange ? `${formatDate(selectedRange.startDate)} - ${formatDate(selectedRange.endDate)}` : 'Not selected'}
              helper={selectedRange?.value === ALL_TIME_VALUE ? 'All available transactions up to today.' : filterType === 'customRange' ? 'Generated from the custom date range.' : 'Generated from the association financial year configuration.'}
              icon={CalendarRange}
              status={selectedRange?.value === ALL_TIME_VALUE ? 'All time' : filterType === 'customRange' ? 'Custom' : 'Financial year'}
            />
            <View style={styles.actions}>
              <View style={styles.primaryAction}>
                <MobileButton
                  label={loadingStatements || refreshing ? 'Loading...' : 'Load statements'}
                  icon={RefreshCw}
                  loading={loadingStatements || refreshing}
                  onPress={applyPeriod}
                  fullWidth
                />
              </View>
              <View style={styles.secondaryAction}>
                <MobileButton
                  label="Share"
                  icon={Share2}
                  variant="secondary"
                  disabled={!statementSource}
                  onPress={() => void shareSummary()}
                  fullWidth
                />
              </View>
            </View>
          </>
        ) : (
          <MobileEmptyState
            title="Configuration required"
            description="Set up the association financial year configuration before statements can be generated."
          />
        )}
      </MobileFormSection>

      {loadingStatements && !statementSource ? <MobilePageLoadingState kind="list" message="Fetching statements" /> : null}

      {!loadingStatements && !statementSource ? (
        <MobileEmptyState
          title="No statement data"
          description="No shares or member statement records were returned for this member in the selected period."
          actionLabel="Reload statements"
          onAction={applyPeriod}
        />
      ) : null}

      {statementSource ? (
        <>
          <MobileFormSection
            title="Download statements"
            description="Save the full statements with summaries, transaction rows, and periodic summaries."
          >
            {sharesStatement ? (
              <StatementDownloadCard
                title="Share Statement"
                description="Share activity, share value, net shares, transactions, and periodic share summaries."
                loadingKey={exporting}
                keyPrefix="shares"
                onPdf={() => void runIndividualExport('shares', 'pdf')}
                onExcel={() => void runIndividualExport('shares', 'excel')}
              />
            ) : null}
            {membersStatement ? (
              <StatementDownloadCard
                title="Member Statement"
                description="Comprehensive statement with shares, social contributions, fines, penalties, and loan balance."
                loadingKey={exporting}
                keyPrefix="members"
                onPdf={() => void runIndividualExport('members', 'pdf')}
                onExcel={() => void runIndividualExport('members', 'excel')}
              />
            ) : null}
          </MobileFormSection>

          <MobileStatusTabs
            value={activeTab}
            onChange={(value) => setActiveTab(value as ActiveTab)}
            tabs={[
              { value: 'summary', label: 'Summary' },
              { value: 'shares', label: 'Shares', count: shareTransactions.length },
              { value: 'contributions', label: 'Contributions', count: contributionTransactions.length },
            ]}
          />

          {activeTab === 'summary' ? (
            <MobileFormSection
              title="Statement summary"
              description="Main totals used to understand this member's financial position."
            >
              <MobileInfoRow label="Member" value={memberName} helper={membershipNumber} icon={UserRound} status={member?.status || 'Member'} />
              <MobileInfoRow
                label="Share purchases"
                value={formatCurrency(toNumber(statementSource.totalShareValue))}
                helper={`${formatNumber(toNumber(statementSource.totalShares))} shares in period`}
                icon={WalletCards}
                status="Shares"
              />
              <MobileInfoRow
                label="Current net shares"
                value={formatCurrency(toNumber(statementSource.currentNetTotalShareValue))}
                helper={`${formatNumber(toNumber(statementSource.currentNetTotalShares))} shares after deductions`}
                icon={TrendingUp}
                status="Net"
              />
              <MobileInfoRow
                label="Outstanding loan"
                value={formatCurrency(toNumber(membersStatement?.totalOutstandingLoanBalance))}
                helper="Loan balance from member statement"
                icon={Banknote}
                status={toNumber(membersStatement?.totalOutstandingLoanBalance) > 0 ? 'Outstanding' : 'Clear'}
              />

              {contributionRows.length ? (
                <MobileCard compact>
                  <View style={styles.sectionHeader}>
                    <MobileText variant="body" weight="bold">
                      Contributions
                    </MobileText>
                    <MobileStatusBadge status="Totals" label={formatNumber(contributionRows.length)} tone="primary" />
                  </View>
                  {contributionRows.map(([key, value]) => (
                    <MobileInfoRow
                      key={key}
                      label={formatContributionType(key)}
                      value={formatCurrency(toNumber(value))}
                      icon={FileSpreadsheet}
                      status={labelFromStatus(key)}
                    />
                  ))}
                </MobileCard>
              ) : null}
            </MobileFormSection>
          ) : null}

          {activeTab === 'shares' ? (
            <MobileFormSection
              title="Share transactions"
              description="Share purchase activity in the selected period."
            >
              <MobileSearchToolbar value={shareSearch} onChange={setShareSearch} placeholder="Search shares" />
              <MobileStatusTabs tabs={shareStatusTabs} value={shareStatus} onChange={setShareStatus} />
              {filteredShareItems.length ? (
                <MobileDataList items={filteredShareItems} showChevron={false} />
              ) : (
                <MobileEmptyState title="No share transactions" description="Adjust the search or status filter to see more records." />
              )}
            </MobileFormSection>
          ) : null}

          {activeTab === 'contributions' ? (
            <MobileFormSection
              title="Contribution transactions"
              description="Social contributions, fines, penalties, and other member activity."
            >
              <MobileSearchToolbar value={contributionSearch} onChange={setContributionSearch} placeholder="Search contributions" />
              <MobileStatusTabs tabs={contributionStatusTabs} value={contributionStatus} onChange={setContributionStatus} />
              {filteredContributionItems.length ? (
                <MobileDataList items={filteredContributionItems} showChevron={false} />
              ) : (
                <MobileEmptyState title="No contribution transactions" description="Adjust the search or status filter to see more records." />
              )}
            </MobileFormSection>
          ) : null}
        </>
      ) : null}
    </MobileScreen>
  );
}

function buildFinancialYearOptions(config: GroupConfig): PeriodOption[] {
  const start = parseDate(config.financialYearStartDate);
  if (!start) return [];

  const today = new Date();
  const currentYear = today.getFullYear();
  const thisYearStart = new Date(currentYear, start.getMonth(), start.getDate());
  const baseStart = today < thisYearStart
    ? new Date(currentYear - 1, start.getMonth(), start.getDate())
    : thisYearStart;

  const years = [0, -1, -2, 1].map((offset) => {
    const fyStart = new Date(baseStart);
    fyStart.setFullYear(baseStart.getFullYear() + offset);
    const fyEnd = new Date(fyStart);
    fyEnd.setFullYear(fyStart.getFullYear() + 1);
    fyEnd.setDate(fyEnd.getDate() - 1);

    return {
      label: `${fyStart.getFullYear()}-${fyEnd.getFullYear()}`,
      value: `${fyStart.getFullYear()}-${fyEnd.getFullYear()}`,
      startDate: toApiDateTime(fyStart, 'start'),
      endDate: toApiDateTime(fyEnd, 'end'),
    };
  });

  return [
    ...years,
    {
      label: 'All time',
      value: ALL_TIME_VALUE,
      startDate: VERY_EARLY_DATE_TIME,
      endDate: toApiDateTime(today, 'end'),
    },
  ];
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toApiDateTime(date: Date, mode: 'start' | 'end') {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T${mode === 'start' ? '00:00:00' : '23:59:59'}`;
}

function resolveStatementPeriod(
  filterType: PeriodFilterType,
  selectedFinancialYearRange: PeriodOption | null,
  customStartDate: string,
  customEndDate: string,
): PeriodOption | null {
  if (filterType === 'allTime') {
    const today = new Date();
    return {
      label: 'All time',
      value: ALL_TIME_VALUE,
      startDate: VERY_EARLY_DATE_TIME,
      endDate: toApiDateTime(today, 'end'),
    };
  }

  if (filterType === 'financialYear') return selectedFinancialYearRange;

  const start = parseDate(customStartDate);
  const end = parseDate(customEndDate);
  if (!start || !end || start > end) return null;

  return {
    label: `${formatDate(customStartDate)} to ${formatDate(customEndDate)}`,
    value: 'custom',
    startDate: toApiDateTime(start, 'start'),
    endDate: toApiDateTime(end, 'end'),
  };
}

function toNumber(value?: number | string | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareStatementTransactions(
  left: ShareStatementTransaction | ContributionStatementTransaction,
  right: ShareStatementTransaction | ContributionStatementTransaction,
) {
  return String(right.transactionDate || '').localeCompare(String(left.transactionDate || ''));
}

function buildStatusTabs(transactions: (ShareStatementTransaction | ContributionStatementTransaction)[]) {
  const counts = new Map<string, number>();
  transactions.forEach((transaction) => {
    const label = labelFromStatus(transaction.status);
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [
    { value: 'ALL', label: 'All', count: transactions.length },
    ...Array.from(counts.entries()).map(([label, count]) => ({ value: label, label, count })),
  ];
}

function matchesStatus(status: string | null | undefined, selected: string) {
  return selected === 'ALL' || labelFromStatus(status) === selected;
}

function matchesSearch(values: unknown[], search: string) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => String(value || '').toLowerCase().includes(normalized));
}

function mapShareTransactionToItem(transaction: ShareStatementTransaction): MobileDataListItem {
  const status = labelFromStatus(transaction.status);
  return {
    id: transaction.transactionId || `${transaction.transactionDate}-${transaction.description}`,
    title: transaction.description || 'Share purchase',
    subtitle: formatDate(transaction.transactionDate),
    meta: `${formatNumber(toNumber(transaction.shareCount))} shares · Week ${transaction.weekNumber || '-'}`,
    amount: formatCurrency(toNumber(transaction.amount)),
    status,
    statusTone: statusToneFor(status),
    accent: statusToneFor(status),
  };
}

function mapContributionTransactionToItem(transaction: ContributionStatementTransaction): MobileDataListItem {
  const status = labelFromStatus(transaction.status);
  return {
    id: transaction.transactionId || `${transaction.transactionDate}-${transaction.description}`,
    title: formatContributionType(transaction.contributionType),
    subtitle: transaction.description || formatDate(transaction.transactionDate),
    meta: `${formatDate(transaction.transactionDate)} · Week ${transaction.weekNumber || '-'}`,
    amount: formatCurrency(toNumber(transaction.amount)),
    status,
    statusTone: statusToneFor(status),
    accent: statusToneFor(status),
  };
}

function formatContributionType(type?: string | null) {
  return String(type || 'Unknown')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryAction: {
    flex: 1,
    minWidth: 176,
  },
  secondaryAction: {
    minWidth: 104,
    flexShrink: 1,
  },
  customDateFields: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  downloadCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  downloadIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  downloadText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  downloadActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
});

function StatementDownloadCard({
  title,
  description,
  loadingKey,
  keyPrefix,
  onPdf,
  onExcel,
}: {
  title: string;
  description: string;
  loadingKey: string | null;
  keyPrefix: StatementKind;
  onPdf: () => void;
  onExcel: () => void;
}) {
  return (
    <MobileCard compact>
      <View style={styles.downloadCardHeader}>
        <View style={styles.downloadIcon}>
          <FileSpreadsheet color="#ffffff" size={18} strokeWidth={2.5} />
        </View>
        <View style={styles.downloadText}>
          <MobileText variant="body" weight="bold">{title}</MobileText>
          <MobileText variant="small" tone="secondary">{description}</MobileText>
        </View>
      </View>
      <View style={styles.downloadActions}>
        <MobileButton
          label="PDF"
          icon={Download}
          size="sm"
          loading={loadingKey === `${keyPrefix}-pdf`}
          disabled={Boolean(loadingKey)}
          onPress={onPdf}
        />
        <MobileButton
          label="Excel"
          icon={Download}
          variant="secondary"
          size="sm"
          loading={loadingKey === `${keyPrefix}-excel`}
          disabled={Boolean(loadingKey)}
          onPress={onExcel}
        />
      </View>
    </MobileCard>
  );
}
