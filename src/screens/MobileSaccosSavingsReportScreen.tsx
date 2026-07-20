import { router } from 'expo-router';
import { CalendarDays, Coins, PiggyBank, RefreshCw, Users, WalletCards } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { isSaccosAssociation } from '@/auth/association-type';
import {
  MobileCard,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileReportExportButton,
  MobileScreen,
  MobileSearchToolbar,
  MobileStatusBadge,
  MobileText,
  MobileTextInput,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAssociationGroupConfigs } from '@/services/member-service';
import { getSaccosSavingsReport, type SaccosSavingsMemberRow, type SaccosSavingsReport } from '@/services/saccos-service';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber, formatTzs } from '@/utils/format';

export default function MobileSaccosSavingsReportScreen() {
  const { activeView, associationId, user } = useAuth();
  const defaults = defaultRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [report, setReport] = useState<SaccosSavingsReport | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (mode: 'initial' | 'refresh' = 'initial', range?: { startDate: string; endDate: string }) => {
    if (!associationId) {
      setLoading(false);
      return;
    }
    const requested = range || { startDate, endDate };
    if (!isIsoDate(requested.startDate) || !isIsoDate(requested.endDate) || requested.startDate > requested.endDate) {
      setError('Choose a valid date range using YYYY-MM-DD. The start must not be after the end.');
      setLoading(false);
      return;
    }
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setReport(await getSaccosSavingsReport(associationId, requested.startDate, requested.endDate));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [associationId, endDate, startDate]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!associationId || !active) return;
      let range = defaultRange();
      try {
        const configs = await getAssociationGroupConfigs(associationId);
        const config = configs[0];
        if (config?.financialYearStartDate && config?.financialYearEndDate) {
          range = { startDate: config.financialYearStartDate, endDate: config.financialYearEndDate };
          if (active) {
            setStartDate(range.startDate);
            setEndDate(range.endDate);
          }
        }
      } catch {
        // The report remains usable with the calendar-year fallback.
      }
      if (active) await loadReport('initial', range);
    });
    return () => { active = false; };
    // The initial load intentionally resolves the association financial year once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [associationId]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (report?.members || []).filter((row) => !query || [row.memberName, row.membershipNumber]
      .filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [report?.members, search]);

  const exportOptions = useMemo(() => ({
    title: 'SACCOS Savings & Shares Report',
    associationName: report?.associationName || user?.associationName,
    subtitle: `${report?.startDate || startDate} to ${report?.endDate || endDate}`,
    purpose: 'Separate member savings from equity shares used for dividends.',
    fileName: `saccos-savings-shares-${report?.startDate || startDate}-to-${report?.endDate || endDate}`,
    rows: visibleRows,
    columns: [
      { key: 'membershipNumber', label: 'Membership Number', value: (row: SaccosSavingsMemberRow) => row.membershipNumber || '' },
      { key: 'memberName', label: 'Member Name', value: (row: SaccosSavingsMemberRow) => row.memberName || '' },
      { key: 'shareCount', label: 'Equity Shares', align: 'right' as const, value: (row: SaccosSavingsMemberRow) => Number(row.shareCount || 0) },
      { key: 'shareValue', label: 'Equity Share Value', align: 'right' as const, value: (row: SaccosSavingsMemberRow) => Number(row.shareValue || 0) },
      { key: 'savingsInPeriod', label: 'Savings in Period', align: 'right' as const, value: (row: SaccosSavingsMemberRow) => Number(row.savingsInPeriod || 0) },
      { key: 'totalSavingsAsOfEndDate', label: 'Total Savings', align: 'right' as const, value: (row: SaccosSavingsMemberRow) => Number(row.totalSavingsAsOfEndDate || 0) },
    ],
    metrics: [
      { label: 'Savings in period', value: formatTzs(Number(report?.totalSavingsInPeriod || 0)) },
      { label: 'Total savings', value: formatTzs(Number(report?.totalSavingsAsOfEndDate || 0)) },
      { label: 'Equity shares', value: formatNumber(Number(report?.totalShareCount || 0)) },
      { label: 'Equity share value', value: formatTzs(Number(report?.totalShareValue || 0)) },
    ],
    filters: [{ label: 'Period', value: `${report?.startDate || startDate} to ${report?.endDate || endDate}` }],
  }), [endDate, report, startDate, user?.associationName, visibleRows]);

  if (activeView !== 'ADMIN') return <AccessDeniedScreen title="Savings & Shares Report" description="This report is available in association admin workspaces only." />;
  if (!isSaccosAssociation(user?.associationType)) return <AccessDeniedScreen title="Savings & Shares Report" description="This report is only available for SACCOS associations." />;
  if (loading && !report) return <MobilePageLoadingState kind="dashboard" message="Loading SACCOS savings report" />;
  if (!associationId) return <AccessDeniedScreen title="Savings & Shares Report" description="Select an association before opening the report." />;

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo eyebrow="SACCOS reports" title="Savings & Shares Report"
        subtitle="Savings for loan eligibility; equity shares for ownership and dividends."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh report" variant="secondary" disabled={refreshing} onPress={() => void loadReport('refresh')} />}
      />
      {error ? <MobileErrorState title="Report issue" description={error} retryLabel="Reload" onRetry={() => void loadReport('refresh')} /> : null}

      <MobileCard compact>
        <View style={styles.dateGrid}>
          <MobileTextInput label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" icon={CalendarDays} error={!isIsoDate(startDate) ? 'Use YYYY-MM-DD' : undefined} />
          <MobileTextInput label="End date" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" icon={CalendarDays} error={!isIsoDate(endDate) ? 'Use YYYY-MM-DD' : undefined} />
          <MobileIconButton icon={RefreshCw} label="Apply date range" variant="primary" disabled={refreshing || !isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate} onPress={() => void loadReport('refresh')} />
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem><MobileKpiCard title="Savings in period" value={formatTzs(Number(report?.totalSavingsInPeriod || 0))} description={`${report?.startDate || startDate} to ${report?.endDate || endDate}`} icon={PiggyBank} tone="green" /></MobileKpiGridItem>
        <MobileKpiGridItem><MobileKpiCard title="Total savings" value={formatTzs(Number(report?.totalSavingsAsOfEndDate || 0))} description={`As at ${report?.endDate || endDate}`} icon={WalletCards} tone="blue" /></MobileKpiGridItem>
        <MobileKpiGridItem><MobileKpiCard title="Equity shares" value={formatNumber(Number(report?.totalShareCount || 0))} description="Used for dividends" icon={Coins} tone="purple" /></MobileKpiGridItem>
        <MobileKpiGridItem><MobileKpiCard title="Members" value={formatNumber((report?.members || []).length)} description="Rows in report" icon={Users} tone="teal" /></MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileReportExportButton options={exportOptions} label="Export PDF / Excel" fullWidth disabled={!visibleRows.length} onError={(exportError) => setError(getApiErrorMessage(exportError))} />
      <MobileSearchToolbar value={search} onChange={setSearch} placeholder="Search member or membership number..." />
      <MobileStatusBadge status="Report rows" label={`${visibleRows.length} shown`} tone="info" />

      {visibleRows.length ? (
        <View style={styles.memberList}>
          {visibleRows.map((row) => (
            <MobileCard key={row.memberId} compact>
              <MobileText variant="body" weight="bold">{row.memberName || 'Unnamed member'}</MobileText>
              <MobileText variant="small" tone="secondary">{row.membershipNumber || 'No membership number'}</MobileText>
              <MobileInfoRow label="Savings in period" value={formatTzs(Number(row.savingsInPeriod || 0))} icon={PiggyBank} />
              <MobileInfoRow label="Total savings" value={formatTzs(Number(row.totalSavingsAsOfEndDate || 0))} icon={WalletCards} />
              <MobileInfoRow label="Equity shares" value={formatNumber(Number(row.shareCount || 0))} helper={formatTzs(Number(row.shareValue || 0))} icon={Coins} />
            </MobileCard>
          ))}
        </View>
      ) : <MobileEmptyState title="No report rows" description="No members matched the filters or no SACCOS records exist for this period." />}
    </MobileScreen>
  );
}

function defaultRange() {
  const year = new Date().getFullYear();
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

const styles = StyleSheet.create({
  dateGrid: { gap: 12 },
  memberList: { gap: 10 },
});
