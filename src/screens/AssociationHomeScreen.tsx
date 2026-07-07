import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Package,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileHomeHeader,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileProgressBar,
  MobileScreen,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
} from '@/components/mobile';
import { getApiErrorMessage } from '@/types/api';
import { getAssociationDashboard, type AssociationDashboardData } from '@/services/dashboard-service';
import { getRouteByPath } from '@/navigation/route-registry';
import { useNaneTheme } from '@/theme/tokens';
import { formatDate, formatNumber, formatPercent, formatTzs } from '@/utils/format';

export default function AssociationHomeScreen() {
  const theme = useNaneTheme();
  const { associationId, user } = useAuth();
  const [dashboard, setDashboard] = useState<AssociationDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!associationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setDashboard(await getAssociationDashboard(associationId));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [associationId]);

  useEffect(() => {
    void Promise.resolve().then(loadDashboard);
  }, [loadDashboard]);

  const associationName = dashboard?.associationName || user?.associationName || 'Association dashboard';
  const totalCollected = dashboard?.totalCollectedAmountCurrentYear ?? dashboard?.totalCollectedAmount ?? dashboard?.totalRevenue ?? 0;
  const totalExpenses = dashboard?.totalExpensesCurrentYear ?? dashboard?.totalExpenses ?? 0;
  const netPosition = dashboard?.profitLossCurrentYear ?? totalCollected - totalExpenses;
  const openItems =
    (dashboard?.inactiveMembers ?? 0) + (dashboard?.partiallyCompletedRegistrations ?? 0) + (dashboard?.packageSubscriptions?.filter((item) => item.pendingSubscriptions).length ?? 0);
  const expenseCoverage = percentOf(totalExpenses, Math.max(totalCollected, totalExpenses));
  const netCoverage = percentOf(Math.max(netPosition, 0), Math.max(totalCollected, totalExpenses));

  const recentMembers = useMemo<MobileDataListItem[]>(
    () =>
      (dashboard?.recentMembers || []).slice(0, 5).map((member, index) => {
        const title = member.fullLegalName || member.businessName || member.email || `Member ${index + 1}`;
        return {
          id: `${member.email || title}-${index}`,
          title,
          subtitle: member.packageName || member.email || 'Member record',
          meta: formatDate(member.createdAt),
          status: member.status || 'Unknown',
          amount: member.registrationProgress !== undefined ? formatPercent(member.registrationProgress) : undefined,
          accent: 'primary',
        };
      }),
    [dashboard?.recentMembers],
  );

  const packageItems = useMemo<MobileDataListItem[]>(
    () =>
      (dashboard?.packageSubscriptions || []).slice(0, 4).map((item, index) => ({
        id: `${item.packageName || 'package'}-${index}`,
        title: item.packageName || `Package ${index + 1}`,
        subtitle: `${formatNumber(item.activeSubscriptions ?? 0)} active of ${formatNumber(item.totalSubscriptions ?? 0)} subscriptions`,
        meta: item.pendingSubscriptions ? `${formatNumber(item.pendingSubscriptions)} pending` : item.active === false ? 'Inactive package' : 'No pending subscriptions',
        amount: formatTzs(item.revenue ?? 0),
        status: item.active === false ? 'Inactive' : 'Active',
        accent: item.active === false ? 'neutral' : 'success',
      })),
    [dashboard?.packageSubscriptions],
  );
  const membersRoute = getRouteByPath('/associations/members');
  const addMemberRoute = getRouteByPath('/associations/members/new');
  const recordPaymentRoute = getRouteByPath('/associations/revenue-transactions/create');
  const approvalsRoute = getRouteByPath('/associations/wallet/approve-withdrawals');
  const smsConfigRoute = getRouteByPath('/associations/settings/sms-sender-config');
  const openRoute = (route: ReturnType<typeof getRouteByPath>) => {
    if (route) {
      router.push({ pathname: '/work/route-preview', params: { routeId: route.id } } as never);
    }
  };

  if (loading && !dashboard) {
    return <MobilePageLoadingState kind="dashboard" message="Loading association dashboard" />;
  }

  if (!associationId) {
    return (
      <MobileScreen refreshing={loading} onRefresh={() => void loadDashboard()}>
        <MobilePageHeader showLogo eyebrow="Association workspace" title="Association dashboard" subtitle="Association context unavailable" />
        <MobileErrorState
          title="Association not selected"
          description="Sign in through an association account before opening the association dashboard."
        />
      </MobileScreen>
    );
  }

  if (error && !dashboard) {
    return (
      <MobileScreen refreshing={loading} onRefresh={() => void loadDashboard()}>
        <MobilePageHeader
          showLogo
          eyebrow="Association workspace"
          title={associationName}
          subtitle="Dashboard data could not be loaded"
          rightAction={
            <MobileButton label="Refresh" icon={RefreshCw} size="sm" variant="secondary" loading={loading} disabled={loading} onPress={loadDashboard} />
          }
        />
        <MobileErrorState title="Dashboard could not load" description={error} retryLabel="Retry" onRetry={loadDashboard} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen refreshing={loading} onRefresh={() => void loadDashboard()}>
      <MobileHomeHeader
        displayName={user?.fullName}
        workspaceLabel="Association"
        workspaceName={associationName}
        subtitle={user?.email}
        updatedText={formatDate(dashboard?.timestamp)}
        refreshing={loading}
        onRefresh={() => void loadDashboard()}
      />

      {error && dashboard ? (
        <MobileStatusBadge status="Refresh failed" label={error} tone="warning" />
      ) : null}

      <MobileSummaryPanel
        title="Year-to-date collections"
        value={formatTzs(totalCollected)}
        description={`${formatTzs(totalExpenses)} expenses · ${formatTzs(netPosition)} net`}
        tone={netPosition >= 0 ? 'blue' : 'orange'}
        icon={WalletCards}
        footer={
          <View style={styles.progressStack}>
            <MobileProgressBar value={expenseCoverage} label="Expense coverage" tone={expenseCoverage > 75 ? 'orange' : 'green'} />
            <MobileProgressBar value={netCoverage} label="Net collection position" tone={netPosition >= 0 ? 'green' : 'red'} />
          </View>
        }
      />

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Needs attention
        </MobileText>
        <MobileStatusBadge status="Review" label={`${formatNumber(openItems)} open`} tone="review" />
      </View>

      <MobileCard compact>
        <View style={styles.attentionPanelHeader}>
          <View style={[styles.attentionPanelIcon, { backgroundColor: theme.colors.status.review }]}>
            <AlertTriangle color={theme.colors.onPrimary} size={18} strokeWidth={2.4} />
          </View>
          <View style={styles.attentionPanelCopy}>
            <MobileText variant="small" weight="bold">
              Review snapshot
            </MobileText>
            <MobileText variant="tiny" tone="secondary">
              Quick signals that need action or confirmation.
            </MobileText>
          </View>
        </View>
        <View style={styles.attentionList}>
          <AttentionMetric
            icon={UserX}
            indicatorIcon={AlertTriangle}
            value={dashboard?.inactiveMembers ?? 0}
            title="Inactive"
            description="Members to follow up"
            color={theme.colors.status.danger}
          />
          <AttentionMetric
            icon={ClipboardCheck}
            indicatorIcon={AlertTriangle}
            value={dashboard?.partiallyCompletedRegistrations ?? 0}
            title="Incomplete"
            description="Registrations to finish"
            color={theme.colors.status.warning}
          />
          <AttentionMetric
            icon={UserCheck}
            indicatorIcon={CheckCircle2}
            value={dashboard?.fullyCompliantMembers ?? 0}
            title="Compliant"
            description="Members in good standing"
            color={theme.colors.status.success}
          />
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Total members"
            value={formatNumber(dashboard?.totalMembers ?? 0)}
            description={`${formatNumber(dashboard?.activeMembers ?? 0)} currently active`}
            tone="blue"
            icon={Users}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Monthly revenue"
            value={formatTzs(dashboard?.monthlyRevenue ?? 0)}
            description="Current month"
            tone="green"
            icon={Banknote}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Registration progress"
            value={formatPercent(dashboard?.averageRegistrationProgress ?? 0)}
            description={`${formatNumber(dashboard?.membersWithRequiredDocuments ?? 0)} with required documents`}
            tone="purple"
            icon={ShieldCheck}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Packages"
            value={formatNumber(dashboard?.totalPackages ?? dashboard?.packageSubscriptions?.length ?? 0)}
            description="Active member packages"
            tone="teal"
            icon={Package}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard>
        <View style={styles.sectionHeader}>
          <View>
            <MobileText variant="section" weight="bold">
              Fast work
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Common actions for an association officer.
            </MobileText>
          </View>
        </View>
        <View style={styles.actionGrid}>
          <MobileButton
            label="Add member"
            icon={Plus}
            style={styles.actionButton}
            onPress={() => openRoute(addMemberRoute)}
          />
          <MobileButton label="Record pay" icon={Banknote} variant="secondary" style={styles.actionButton} onPress={() => openRoute(recordPaymentRoute)} />
          <MobileButton label="Approve" icon={CheckCircle2} variant="secondary" style={styles.actionButton} onPress={() => openRoute(approvalsRoute)} />
          <MobileButton label="SMS setup" icon={Send} variant="secondary" style={styles.actionButton} onPress={() => openRoute(smsConfigRoute)} />
        </View>
      </MobileCard>

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Recent members
        </MobileText>
        <MobileButton
          label="View all"
          variant="ghost"
          size="sm"
          onPress={() => openRoute(membersRoute)}
        />
      </View>
      {recentMembers.length ? (
        <MobileDataList items={recentMembers} />
      ) : (
        <MobileEmptyState title="No recent members" description="New member activity will appear here when available." />
      )}

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Packages
        </MobileText>
        <Building2 color={theme.colors.primary} size={19} />
      </View>
      {packageItems.length ? (
        <MobileDataList items={packageItems} />
      ) : (
        <MobileEmptyState title="No package activity" description="Package subscription activity will appear here when available." />
      )}
    </MobileScreen>
  );
}

type AttentionMetricProps = {
  icon: LucideIcon;
  indicatorIcon: LucideIcon;
  value: number;
  title: string;
  description: string;
  color: string;
};

function AttentionMetric({ icon: Icon, indicatorIcon: IndicatorIcon, value, title, description, color }: AttentionMetricProps) {
  const theme = useNaneTheme();

  return (
    <View style={[styles.attentionItem, { borderColor: theme.colors.border }]}>
      <View style={[styles.attentionIcon, { backgroundColor: color }]}>
        <Icon color={theme.colors.onPrimary} size={16} strokeWidth={2.4} />
      </View>
      <View style={styles.attentionItemCopy}>
        <MobileText variant="small" weight="bold">
          {title}
        </MobileText>
        <MobileText variant="tiny" tone="secondary">
          {description}
        </MobileText>
      </View>
      <View style={[styles.attentionValuePill, { backgroundColor: value > 0 ? color : theme.colors.textMuted }]}>
        <IndicatorIcon color={theme.colors.onPrimary} size={13} strokeWidth={2.4} />
        <MobileText variant="tiny" weight="bold" style={{ color: theme.colors.onPrimary }}>
          {formatNumber(value)}
        </MobileText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  attentionPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  attentionPanelIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionPanelCopy: {
    flex: 1,
    gap: 1,
  },
  attentionList: {
    gap: 8,
  },
  attentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  attentionIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionItemCopy: {
    flex: 1,
    gap: 1,
  },
  attentionValuePill: {
    minWidth: 48,
    height: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: '47%',
  },
  progressStack: {
    gap: 10,
  },
});

function percentOf(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round(Math.max(0, Math.min(100, (value / total) * 100)));
}
