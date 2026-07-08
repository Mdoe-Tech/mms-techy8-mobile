import { router } from 'expo-router';
import { CalendarRange, Download, Eye, FileSpreadsheet, FileText, RefreshCw, Search, UsersRound, WalletCards } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  type MobileDataListItem,
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
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileSortSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  useMobileFeedback,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getAllAssociationMembers,
  getAssociationCumulatedSharesReport,
  getAssociationGroupConfigs,
  getAssociationMembersStatement,
  getAssociationSharesStatement,
  type AssociationMember,
  type CumulatedSharesReportRow,
  type GroupConfig,
} from '@/services/member-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatPercent, initialsFromName } from '@/utils/format';
import { labelFromStatus, statusToneFor } from '@/theme/tokens';
import {
  exportConsolidatedStatementReport,
  exportCumulatedSharesReport,
  type StatementFileFormat,
  type StatementKind,
} from '@/utils/mobile-statement-export';

const INITIAL_VISIBLE_COUNT = 25;
const LOAD_MORE_COUNT = 25;
const VERY_EARLY_DATE_TIME = '1900-01-01T00:00:00';

type PeriodFilterType = 'financialYear' | 'customRange' | 'allTime';
type StatementPeriodRange = {
  label: string;
  value: string;
  startDate: string;
  endDate: string;
};

const sortOptions = [
  { value: 'membershipNumber', label: 'Membership number', description: 'Smallest membership number first.' },
  { value: 'fullLegalName', label: 'Member name', description: 'Alphabetical by member name.' },
  { value: 'status', label: 'Status', description: 'Group members by current status.' },
  { value: 'createdAt', label: 'Newest members', description: 'Recently created members first.' },
];

export default function MobileMemberStatementsScreen() {
  const { activeView, associationId, user } = useAuth();
  const { toast } = useMobileFeedback();
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [groupConfig, setGroupConfig] = useState<GroupConfig | null>(null);
  const [cumulatedSharesReport, setCumulatedSharesReport] = useState<CumulatedSharesReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [loadingCumulatedShares, setLoadingCumulatedShares] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('membershipNumber');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterType, setFilterType] = useState<PeriodFilterType>('financialYear');
  const [selectedFinancialYear, setSelectedFinancialYear] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  const loadDirectory = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        return;
      }

      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [memberResponse, configs] = await Promise.all([
          getAllAssociationMembers(associationId),
          getAssociationGroupConfigs(associationId).catch(() => []),
        ]);
        setMembers(memberResponse.content.filter((member) => Boolean(member.id)));
        setGroupConfig(configs[0] || null);
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
    void Promise.resolve().then(() => loadDirectory());
  }, [loadDirectory]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach((member) => {
      const key = labelFromStatus(member.status);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [members]);

  const statusTabs = useMemo(
    () => [
      { value: 'ALL', label: 'All', count: members.length },
      ...Array.from(statusCounts.entries()).map(([label, count]) => ({ value: label, label, count })),
    ],
    [members.length, statusCounts],
  );

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members
      .filter((member) => status === 'ALL' || labelFromStatus(member.status) === status)
      .filter((member) => {
        if (!query) return true;
        return [
          member.fullLegalName,
          member.membershipNumber,
          member.employeeId,
          member.memberType,
          member.packageName,
          member.contactInfo?.email,
          member.contactInfo?.phoneNumber,
          member.status,
        ].some((value) => String(value || '').toLowerCase().includes(query));
      })
      .sort((left, right) => compareMembers(left, right, sortBy));
  }, [members, search, sortBy, status]);

  const visibleMembers = filteredMembers.slice(0, visibleCount);
  const activeMembers = members.filter((member) => labelFromStatus(member.status) === 'Active').length;
  const configured = Boolean(groupConfig?.financialYearStartDate);
  const currentPeriod = configured ? buildCurrentPeriodLabel(groupConfig) : 'Not configured';
  const detailRoute = getRouteByPath('/associations/statements/:memberId');
  const associationName = user?.associationName;
  const financialYearOptions = useMemo(() => (groupConfig ? buildFinancialYearOptions(groupConfig) : []), [groupConfig]);
  const effectiveSelectedFinancialYear = selectedFinancialYear || financialYearOptions[0]?.value || '';
  const selectedRange = useMemo(
    () => resolveStatementPeriod(filterType, financialYearOptions, effectiveSelectedFinancialYear, customStartDate, customEndDate),
    [customEndDate, customStartDate, effectiveSelectedFinancialYear, filterType, financialYearOptions],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleMembers.map((member) => ({
        id: member.id,
        title: member.fullLegalName || 'Unnamed member',
        subtitle: member.membershipNumber || member.employeeId || 'No membership number',
        meta: `${member.packageName || 'No package'} · Joined ${formatDate(member.firstRegistrationDate || member.createdAt)}`,
        amount: formatPercent(Number(member.registrationProgress || 0)),
        status: member.status || 'Unknown',
        statusTone: statusToneFor(member.status),
        accent: statusToneFor(member.status),
        initials: initialsFromName(member.fullLegalName || 'Member'),
      })),
    [visibleMembers],
  );

  const runStatementExport = useCallback(
    async (kind: StatementKind, format: StatementFileFormat) => {
      if (!associationId || !selectedRange) {
        toast.error({
          title: 'Date range required',
          description: 'Choose a valid statement period before exporting.',
        });
        return;
      }

      const key = `${kind}-${format}`;
      setExporting(key);
      setError(null);
      try {
        const statements =
          kind === 'shares'
            ? await getAssociationSharesStatement(associationId, selectedRange.startDate, selectedRange.endDate)
            : await getAssociationMembersStatement(associationId, selectedRange.startDate, selectedRange.endDate);

        await exportConsolidatedStatementReport({
          kind,
          format,
          statements,
          associationName,
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
    },
    [associationId, associationName, groupConfig, selectedRange, toast],
  );

  const fetchCumulatedShares = useCallback(async () => {
    if (!associationId || !selectedRange) {
      toast.error({
        title: 'Date range required',
        description: 'Choose a valid statement period before loading the cumulated shares report.',
      });
      return [];
    }

    setLoadingCumulatedShares(true);
    setError(null);
    try {
      const rows = await getAssociationCumulatedSharesReport(associationId, selectedRange.startDate, selectedRange.endDate);
      const sortedRows = [...rows].sort((left, right) => String(left.membershipNumber || '').localeCompare(String(right.membershipNumber || ''), undefined, { numeric: true, sensitivity: 'base' }));
      setCumulatedSharesReport(sortedRows);
      if (!sortedRows.length) {
        toast.info({
          title: 'No data',
          description: 'No cumulated share data was found for the selected period.',
        });
      }
      return sortedRows;
    } catch (loadError) {
      const message = getApiErrorMessage(loadError);
      setError(message);
      toast.error({
        title: 'Report could not load',
        description: message,
      });
      return [];
    } finally {
      setLoadingCumulatedShares(false);
    }
  }, [associationId, selectedRange, toast]);

  const runCumulatedSharesExport = useCallback(async () => {
    if (!selectedRange) {
      toast.error({
        title: 'Date range required',
        description: 'Choose a valid statement period before exporting.',
      });
      return;
    }

    setExporting('cumulated-excel');
    try {
      const rows = cumulatedSharesReport.length ? cumulatedSharesReport : await fetchCumulatedShares();
      await exportCumulatedSharesReport({
        rows,
        associationName,
        groupConfig,
        periodLabel: selectedRange.label,
        startDate: selectedRange.startDate,
        endDate: selectedRange.endDate,
        destination: 'save',
      });
      toast.success({
        title: 'Report exported',
        description: 'Cumulated Shares Report Excel saved to your device.',
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
  }, [associationName, cumulatedSharesReport, fetchCumulatedShares, groupConfig, selectedRange, toast]);

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Member statements"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading && members.length === 0) {
    return <MobilePageLoadingState kind="list" message="Loading member statements" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Statements" title="Member statements" subtitle="Association context unavailable" />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before opening statements." />
      </MobileScreen>
    );
  }

  if (error && members.length === 0) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Statements"
          title="Member statements"
          subtitle={user?.associationName || 'Statement directory'}
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadDirectory('refresh')} />}
        />
        <MobileErrorState title="Statements could not load" description={error} retryLabel="Retry" onRetry={() => void loadDirectory('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Statements"
        title="Member statements"
        subtitle={`${user?.associationName || 'Statement directory'} · ${formatNumber(members.length)} members`}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh statements"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadDirectory('refresh')}
          />
        }
      />

      {error ? <MobileStatusBadge status="Refresh failed" label={error} tone="warning" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members" value={formatNumber(members.length)} description="Available for statements" tone="blue" icon={UsersRound} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active" value={formatNumber(activeMembers)} description="Currently active" tone="green" icon={UsersRound} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Period" value={currentPeriod} description={configured ? 'Current financial year' : 'Configure first'} tone={configured ? 'purple' : 'red'} icon={CalendarRange} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Filtered" value={formatNumber(filteredMembers.length)} description="Matching current filters" tone="teal" icon={Search} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle}>
            <MobileText variant="body" weight="bold">
              Statement readiness
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Member detail screens use the association financial year configuration.
            </MobileText>
          </View>
          <MobileStatusBadge status={configured ? 'Ready' : 'Setup required'} tone={configured ? 'success' : 'danger'} />
        </View>
        <MobileInfoRow
          label="Group config"
          value={groupConfig?.name || 'Not configured'}
          helper={configured ? `${formatDate(groupConfig?.financialYearStartDate)} - ${formatDate(groupConfig?.financialYearEndDate)}` : 'Financial year dates are required for statements.'}
          icon={WalletCards}
          status={configured ? 'Ready' : 'Missing'}
        />
      </MobileCard>

      <MobileFormSection
        title="Export statements"
        description="Choose a period, then download the same statement reports available on the web dashboard."
      >
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
            value={effectiveSelectedFinancialYear}
            options={financialYearOptions.map((option) => ({ label: option.label, value: option.value }))}
            onChange={setSelectedFinancialYear}
            placeholder={configured ? 'Select financial year' : 'Financial year not configured'}
          />
        ) : null}
        {filterType === 'customRange' ? (
          <View style={styles.dateGrid}>
            <MobileTextInput label="Start date" value={customStartDate} onChangeText={setCustomStartDate} placeholder="YYYY-MM-DD" />
            <MobileTextInput label="End date" value={customEndDate} onChangeText={setCustomEndDate} placeholder="YYYY-MM-DD" />
          </View>
        ) : null}
        <MobileInfoRow
          label="Selected period"
          value={selectedRange ? selectedRange.label : 'Invalid date range'}
          helper={selectedRange ? `${formatDate(selectedRange.startDate)} - ${formatDate(selectedRange.endDate)}` : 'Enter valid dates before exporting.'}
          icon={CalendarRange}
          status={selectedRange ? 'Ready' : 'Required'}
        />

        <View style={styles.exportCards}>
          <StatementExportCard
            title="Share Statements"
            description="Consolidated share purchases, period totals, and current net share values."
            icon={FileText}
            loadingKey={exporting}
            disabled={!selectedRange}
            onPdf={() => void runStatementExport('shares', 'pdf')}
            onExcel={() => void runStatementExport('shares', 'excel')}
          />
          <StatementExportCard
            title="Member Statements"
            description="Comprehensive member activity including shares, social contributions, fines, penalties, and loans."
            icon={FileSpreadsheet}
            loadingKey={exporting}
            disabled={!selectedRange}
            onPdf={() => void runStatementExport('members', 'pdf')}
            onExcel={() => void runStatementExport('members', 'excel')}
          />
          <MobileCard compact>
            <View style={styles.reportCardHeader}>
              <View style={styles.reportIcon}>
                <WalletCards color="#ffffff" size={18} strokeWidth={2.5} />
              </View>
              <View style={styles.reportText}>
                <MobileText variant="body" weight="bold">Cumulated Shares Report</MobileText>
                <MobileText variant="small" tone="secondary">Shares brought forward, current-year purchases, loan deductions, and net shares.</MobileText>
              </View>
            </View>
            <View style={styles.reportActions}>
              <MobileButton
                label="View"
                icon={Eye}
                variant="secondary"
                size="sm"
                loading={loadingCumulatedShares}
                disabled={!selectedRange || loadingCumulatedShares}
                onPress={() => void fetchCumulatedShares()}
              />
              <MobileButton
                label="Excel"
                icon={Download}
                size="sm"
                loading={exporting === 'cumulated-excel'}
                disabled={!selectedRange || Boolean(exporting)}
                onPress={() => void runCumulatedSharesExport()}
              />
            </View>
          </MobileCard>
        </View>
      </MobileFormSection>

      {cumulatedSharesReport.length ? (
        <MobileCard compact>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitle}>
              <MobileText variant="body" weight="bold">Cumulated Shares Report</MobileText>
              <MobileText variant="small" tone="secondary">Shares Net = brought forward + current FY bought - shares used to pay loans.</MobileText>
            </View>
            <MobileStatusBadge status="Rows" label={formatNumber(cumulatedSharesReport.length)} tone="primary" />
          </View>
          <MobileDataList
            showChevron={false}
            items={cumulatedSharesReport.slice(0, 30).map((row, index) => ({
              id: row.memberId || `${row.membershipNumber}-${index}`,
              title: row.memberName || 'Unnamed member',
              subtitle: row.membershipNumber || 'No membership number',
              meta: `B/F ${formatNumber(Number(row.totalSharesBroughtForward || 0))} · Bought ${formatNumber(Number(row.totalSharesBoughtCurrentFinancialYear || 0))} · Loan use ${formatNumber(Number(row.totalSharesUsedToPayLoans || 0))}`,
              amount: formatNumber(Number(row.sharesNet || 0)),
              status: 'Net shares',
              statusTone: 'primary',
              accent: 'primary',
              initials: initialsFromName(row.memberName || 'Member'),
            }))}
          />
          {cumulatedSharesReport.length > 30 ? (
            <MobileText variant="tiny" tone="muted">
              Showing first 30 rows. Export Excel for the full report.
            </MobileText>
          ) : null}
        </MobileCard>
      ) : null}

      <MobileSearchToolbar
        value={search}
        onChange={setSearch}
        placeholder="Search name, membership, phone..."
        onFilterPress={() => setSortOpen(true)}
        filterLabel="Sort"
      />
      <MobileStatusTabs tabs={statusTabs} value={status} onChange={setStatus} />

      {listItems.length ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            if (detailRoute) {
              router.push({ pathname: '/work/route-preview', params: { routeId: detailRoute.id, memberId: item.id } } as never);
            }
          }}
        />
      ) : (
        <MobileEmptyState
          title="No members found"
          description="Adjust the search text or status filter to find statement records."
        />
      )}

      {visibleCount < filteredMembers.length ? (
        <MobileButton
          label={`Load ${Math.min(LOAD_MORE_COUNT, filteredMembers.length - visibleCount)} more`}
          variant="secondary"
          fullWidth
          onPress={() => setVisibleCount((current) => current + LOAD_MORE_COUNT)}
        />
      ) : null}

      <MobileSortSheet
        visible={sortOpen}
        options={sortOptions}
        value={sortBy}
        onChange={setSortBy}
        onClose={() => setSortOpen(false)}
      />
    </MobileScreen>
  );
}

function compareMembers(left: AssociationMember, right: AssociationMember, sortBy: string) {
  if (sortBy === 'fullLegalName') {
    return String(left.fullLegalName || '').localeCompare(String(right.fullLegalName || ''));
  }
  if (sortBy === 'status') {
    return String(left.status || '').localeCompare(String(right.status || ''));
  }
  if (sortBy === 'createdAt') {
    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
  }
  return String(left.membershipNumber || '').localeCompare(String(right.membershipNumber || ''));
}

function buildCurrentPeriodLabel(config: GroupConfig | null) {
  const start = config?.financialYearStartDate ? new Date(config.financialYearStartDate) : null;
  if (!start || Number.isNaN(start.getTime())) return 'Not configured';
  const today = new Date();
  const thisYearStart = new Date(today.getFullYear(), start.getMonth(), start.getDate());
  const fyStart = today < thisYearStart
    ? new Date(today.getFullYear() - 1, start.getMonth(), start.getDate())
    : thisYearStart;
  const fyEnd = new Date(fyStart);
  fyEnd.setFullYear(fyStart.getFullYear() + 1);
  fyEnd.setDate(fyEnd.getDate() - 1);
  return `${fyStart.getFullYear()}-${fyEnd.getFullYear()}`;
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  exportRow: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  dateGrid: {
    gap: 10,
  },
  exportCards: {
    gap: 10,
  },
  reportCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reportIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  reportText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  reportActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 10,
  },
});

function StatementExportCard({
  title,
  description,
  icon: Icon,
  loadingKey,
  disabled,
  onPdf,
  onExcel,
}: {
  title: string;
  description: string;
  icon: typeof FileText;
  loadingKey: string | null;
  disabled?: boolean;
  onPdf: () => void;
  onExcel: () => void;
}) {
  const keyPrefix = title.startsWith('Share') ? 'shares' : 'members';
  return (
    <MobileCard compact>
      <View style={styles.reportCardHeader}>
        <View style={styles.reportIcon}>
          <Icon color="#ffffff" size={18} strokeWidth={2.5} />
        </View>
        <View style={styles.reportText}>
          <MobileText variant="body" weight="bold">{title}</MobileText>
          <MobileText variant="small" tone="secondary">{description}</MobileText>
        </View>
      </View>
      <View style={styles.reportActions}>
        <MobileButton
          label="PDF"
          icon={Download}
          size="sm"
          loading={loadingKey === `${keyPrefix}-pdf`}
          disabled={disabled || Boolean(loadingKey)}
          onPress={onPdf}
        />
        <MobileButton
          label="Excel"
          icon={Download}
          variant="secondary"
          size="sm"
          loading={loadingKey === `${keyPrefix}-excel`}
          disabled={disabled || Boolean(loadingKey)}
          onPress={onExcel}
        />
      </View>
    </MobileCard>
  );
}

function buildFinancialYearOptions(config: GroupConfig): StatementPeriodRange[] {
  const start = parseDate(config.financialYearStartDate);
  if (!start) return [];

  const today = new Date();
  const currentYear = today.getFullYear();
  const thisYearStart = new Date(currentYear, start.getMonth(), start.getDate());
  const baseStart = today < thisYearStart ? new Date(currentYear - 1, start.getMonth(), start.getDate()) : thisYearStart;

  return [0, -1, -2, 1].map((offset) => {
    const fyStart = new Date(baseStart);
    fyStart.setFullYear(baseStart.getFullYear() + offset);
    const fyEnd = new Date(fyStart);
    fyEnd.setFullYear(fyStart.getFullYear() + 1);
    fyEnd.setDate(fyEnd.getDate() - 1);
    const label = `${fyStart.getFullYear()}-${fyEnd.getFullYear()}`;
    return {
      label,
      value: label,
      startDate: toApiDateTime(fyStart, 'start'),
      endDate: toApiDateTime(fyEnd, 'end'),
    };
  });
}

function resolveStatementPeriod(
  filterType: PeriodFilterType,
  financialYearOptions: StatementPeriodRange[],
  selectedFinancialYear: string,
  customStartDate: string,
  customEndDate: string,
): StatementPeriodRange | null {
  if (filterType === 'allTime') {
    const today = new Date();
    return {
      label: 'All Time',
      value: 'all-time',
      startDate: VERY_EARLY_DATE_TIME,
      endDate: toApiDateTime(today, 'end'),
    };
  }

  if (filterType === 'financialYear') {
    return financialYearOptions.find((option) => option.value === selectedFinancialYear) || financialYearOptions[0] || null;
  }

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
