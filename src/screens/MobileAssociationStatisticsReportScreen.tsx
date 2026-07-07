import { router } from 'expo-router';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileText,
  Package,
  RefreshCw,
  Target,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
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
  MobileProgressBar,
  MobileScreen,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
} from '@/components/mobile';
import {
  getAssociationStatisticsReport,
  type AssociationStatisticsReport,
} from '@/services/report-service';
import { type KpiTone, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatPercent, formatTzs } from '@/utils/format';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';

type StatisticsTab = 'members' | 'finance' | 'compliance' | 'packages';

export default function MobileAssociationStatisticsReportScreen() {
  const { activeView, associationId, user } = useAuth();
  const theme = useNaneTheme();
  const [report, setReport] = useState<AssociationStatisticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StatisticsTab>('members');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const loadReport = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading statistics.');
        return;
      }

      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const nextReport = await getAssociationStatisticsReport(associationId);
        setReport(nextReport);
        setGeneratedAt(new Date().toISOString());
      } catch (loadError) {
        if (!report) setReport(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, report],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadReport('initial'));
  }, [loadReport]);

  const activeRate = useMemo(() => ratio(report?.activeMembers, report?.totalMembers), [report]);
  const pendingRate = useMemo(() => ratio(report?.pendingMembers, report?.totalMembers), [report]);
  const complianceRate = useMemo(() => ratio(report?.compliantMembers, report?.totalMembers), [report]);
  const documentsRate = useMemo(() => ratio(report?.membersWithDocuments, report?.totalMembers), [report]);
  const registrationProgress = Math.round(clamp(report?.averageRegistrationProgress || 0, 0, 100));

  const packageEntries = useMemo(
    () =>
      Object.entries(report?.membershipDistribution || {})
        .map(([name, count]) => ({
          name,
          count,
          percent: ratio(count, report?.totalMembers),
        }))
        .sort((left, right) => right.count - left.count),
    [report],
  );
  const memberSummary = report
    ? `${formatNumber(report.totalMembers)} ${report.totalMembers === 1 ? 'member' : 'members'} in report`
    : 'Association overview';

  const tabs = useMemo(
    () => [
      { value: 'members', label: 'Members', count: report?.totalMembers || 0 },
      { value: 'finance', label: 'Finance', count: report?.totalPackages || 0 },
      { value: 'compliance', label: 'Health', count: report?.compliantMembers || 0 },
      { value: 'packages', label: 'Packages', count: packageEntries.length },
    ],
    [packageEntries.length, report],
  );

  if (activeView !== 'ADMIN') {
    return (
      <AccessDeniedScreen
        title="Association statistics"
        description="This native page is available for association admin workspaces only."
      />
    );
  }

  if (loading && !report) {
    return <MobilePageLoadingState kind="dashboard" message="Loading association statistics" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Reports" title="Association statistics" subtitle="Association context unavailable" />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before opening reports." />
      </MobileScreen>
    );
  }

  if (error && !report) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Reports"
          title="Association statistics"
          subtitle={user?.associationName || 'Association overview'}
          onBack={() => router.back()}
          rightAction={
            <MobileIconButton
              icon={RefreshCw}
              label="Retry"
              variant="secondary"
              disabled={refreshing}
              onPress={() => void loadReport('refresh')}
            />
          }
        />
        <MobileErrorState title="Statistics could not load" description={error} retryLabel="Retry" onRetry={() => void loadReport('refresh')} />
      </MobileScreen>
    );
  }

  if (!report) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Reports"
          title="Association statistics"
          subtitle={user?.associationName || 'Association overview'}
          onBack={() => router.back()}
          rightAction={
            <MobileIconButton
              icon={RefreshCw}
              label="Refresh"
              variant="secondary"
              disabled={refreshing}
              onPress={() => void loadReport('refresh')}
            />
          }
        />
        <MobileEmptyState
          title="No statistics available"
          description="The report endpoint returned no association statistics yet."
          actionLabel="Refresh"
          onAction={() => void loadReport('refresh')}
        />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Reports"
        title="Association statistics"
        subtitle={`${user?.associationName || 'Association'}${generatedAt ? ` - refreshed ${formatDate(generatedAt)}` : ''}`}
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh"
            variant="secondary"
            disabled={refreshing}
            onPress={() => void loadReport('refresh')}
          />
        }
      />

      <MobileCard accent={healthTone(activeRate, complianceRate, registrationProgress)}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryTitle}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.colors.primary }]}>
              <BarChart3 color={theme.colors.onPrimary} size={19} strokeWidth={2.5} />
            </View>
            <View style={styles.flex}>
              <MobileText variant="small" tone="secondary" weight="bold" style={styles.uppercase}>
                Operational report
              </MobileText>
              <MobileText variant="section" weight="bold" numberOfLines={2}>
                {memberSummary}
              </MobileText>
            </View>
          </View>
          <MobileStatusBadge status={healthLabel(activeRate, complianceRate, registrationProgress)} />
        </View>
        <View style={styles.progressStack}>
          <MobileProgressBar value={activeRate} label="Active member rate" tone="green" />
          <MobileProgressBar value={registrationProgress} label="Average registration progress" tone="blue" />
          <MobileProgressBar value={complianceRate} label="Compliance coverage" tone="teal" />
        </View>
      </MobileCard>

      {error ? (
        <MobileErrorState
          title="Showing last loaded statistics"
          description={error}
          retryLabel="Refresh"
          onRetry={() => void loadReport('refresh')}
        />
      ) : null}

      <MobileStatusTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as StatisticsTab)} />

      {activeTab === 'members' ? (
        <MembersSection report={report} activeRate={activeRate} pendingRate={pendingRate} />
      ) : null}

      {activeTab === 'finance' ? <FinanceSection report={report} /> : null}

      {activeTab === 'compliance' ? (
        <ComplianceSection
          report={report}
          complianceRate={complianceRate}
          documentsRate={documentsRate}
          registrationProgress={registrationProgress}
        />
      ) : null}

      {activeTab === 'packages' ? (
        <PackageDistributionSection entries={packageEntries} totalMembers={report.totalMembers} />
      ) : null}
    </MobileScreen>
  );
}

function MembersSection({
  report,
  activeRate,
  pendingRate,
}: {
  report: AssociationStatisticsReport;
  activeRate: number;
  pendingRate: number;
}) {
  return (
    <View style={styles.section}>
      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total Members" value={formatNumber(report.totalMembers)} description="All registered records" icon={Users} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Active Members"
            value={formatNumber(report.activeMembers)}
            description={`${formatPercent(activeRate)} active rate`}
            icon={UserCheck}
            tone="green"
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Pending Members"
            value={formatNumber(report.pendingMembers)}
            description={`${formatPercent(pendingRate)} awaiting activation`}
            icon={Clock3}
            tone="orange"
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Inactive Members" value={formatNumber(report.inactiveMembers)} description="Inactive records" icon={UserX} tone="red" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <MobileText variant="body" weight="bold">
          Recent member activity
        </MobileText>
        <MobileInfoRow label="New members" value={formatNumber(report.newMembersLast30Days)} helper="Created in the last 30 days" icon={UserPlus} />
        <MobileInfoRow label="Updated members" value={formatNumber(report.updatedMembersLast30Days)} helper="Profiles changed in the last 30 days" icon={Activity} />
        <MobileInfoRow label="Completed registrations" value={formatNumber(report.completedRegistrations)} helper="Members that finished registration" icon={CheckCircle2} />
      </MobileCard>
    </View>
  );
}

function FinanceSection({ report }: { report: AssociationStatisticsReport }) {
  return (
    <View style={styles.section}>
      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Monthly Potential"
            value={formatTzs(report.potentialMonthlyRevenue)}
            description="Based on active subscriptions"
            icon={DollarSign}
            tone="green"
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Annual Potential"
            value={formatTzs(report.potentialAnnualRevenue)}
            description="Projected full year"
            icon={TrendingUp}
            tone="teal"
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active Packages" value={formatNumber(report.totalPackages)} description="Membership package catalog" icon={Package} tone="purple" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <MobileText variant="body" weight="bold">
          Projection basis
        </MobileText>
        <MobileInfoRow label="Monthly revenue" value={formatTzs(report.potentialMonthlyRevenue)} helper="Potential recurring monthly amount" icon={DollarSign} />
        <MobileInfoRow label="Annual revenue" value={formatTzs(report.potentialAnnualRevenue)} helper="Potential annualized amount" icon={TrendingUp} />
        <MobileInfoRow label="Package coverage" value={formatNumber(report.totalPackages)} helper="Active packages used in the report" icon={Package} />
      </MobileCard>
    </View>
  );
}

function ComplianceSection({
  report,
  complianceRate,
  documentsRate,
  registrationProgress,
}: {
  report: AssociationStatisticsReport;
  complianceRate: number;
  documentsRate: number;
  registrationProgress: number;
}) {
  return (
    <View style={styles.section}>
      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Compliant Members"
            value={formatNumber(report.compliantMembers)}
            description={`${formatPercent(complianceRate)} of total members`}
            icon={Target}
            tone="teal"
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="With Documents"
            value={formatNumber(report.membersWithDocuments)}
            description={`${formatPercent(documentsRate)} of total members`}
            icon={FileText}
            tone="purple"
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Registration Progress"
            value={formatPercent(registrationProgress)}
            description="Average active-member completion"
            icon={Activity}
            tone="blue"
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <MobileText variant="body" weight="bold">
          Registration health
        </MobileText>
        <View style={styles.progressStack}>
          <MobileProgressBar value={registrationProgress} label="Average registration progress" tone="blue" />
          <MobileProgressBar value={complianceRate} label="Fully compliant members" tone="teal" />
          <MobileProgressBar value={documentsRate} label="Members with documents" tone="purple" />
        </View>
      </MobileCard>
    </View>
  );
}

function PackageDistributionSection({
  entries,
  totalMembers,
}: {
  entries: { name: string; count: number; percent: number }[];
  totalMembers: number;
}) {
  if (!entries.length) {
    return (
      <MobileCard compact>
        <MobileEmptyState
          title="No package distribution yet"
          description="No active package/member distribution was returned for this association."
        />
      </MobileCard>
    );
  }

  return (
    <MobileCard compact>
      <View style={styles.sectionHeader}>
        <View>
          <MobileText variant="body" weight="bold">
            Members by package
          </MobileText>
          <MobileText variant="small" tone="secondary">
            Distribution across {formatNumber(totalMembers)} members
          </MobileText>
        </View>
        <MobileStatusBadge status="Published" />
      </View>

      <View style={styles.distributionList}>
        {entries.map((entry, index) => (
          <View key={`${entry.name}-${index}`} style={styles.distributionRow}>
            <View style={styles.distributionTop}>
              <MobileText variant="small" weight="bold" numberOfLines={2} style={styles.flex}>
                {entry.name}
              </MobileText>
              <MobileText variant="small" weight="bold">
                {formatNumber(entry.count)} ({formatPercent(entry.percent)})
              </MobileText>
            </View>
            <MobileProgressBar value={entry.percent} tone={packageTone(index)} />
          </View>
        ))}
      </View>
    </MobileCard>
  );
}

function ratio(value = 0, total = 0) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function healthLabel(activeRate: number, complianceRate: number, registrationProgress: number) {
  if (activeRate >= 70 && complianceRate >= 70 && registrationProgress >= 70) return 'Active';
  if (activeRate >= 50 || registrationProgress >= 50) return 'Under Review';
  return 'Pending';
}

function healthTone(activeRate: number, complianceRate: number, registrationProgress: number): KpiTone {
  if (activeRate >= 70 && complianceRate >= 70 && registrationProgress >= 70) return 'green';
  if (activeRate >= 50 || registrationProgress >= 50) return 'orange';
  return 'slate';
}

function packageTone(index: number): KpiTone {
  const tones: KpiTone[] = ['blue', 'green', 'purple', 'teal', 'orange', 'slate'];
  return tones[index % tones.length];
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryTitle: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uppercase: {
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  progressStack: {
    marginTop: 16,
    gap: 12,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  distributionList: {
    marginTop: 14,
    gap: 14,
  },
  distributionRow: {
    gap: 8,
  },
  distributionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
