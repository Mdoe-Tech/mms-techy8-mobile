import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, Building2, CheckCircle2, Package, Plus, RefreshCw, Send, ShieldCheck, Users, WalletCards } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileStatusBadge,
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

  if (loading && !dashboard) {
    return <MobilePageLoadingState kind="dashboard" message="Loading association dashboard" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
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
      <MobileScreen>
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
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Association workspace"
        title={associationName}
        subtitle={`Updated ${formatDate(dashboard?.timestamp)}`}
        rightAction={
          <MobileButton
            label="Refresh"
            icon={RefreshCw}
            size="sm"
            variant="secondary"
            loading={loading}
            disabled={loading || !associationId}
            onPress={loadDashboard}
          />
        }
      />

      {error && dashboard ? (
        <MobileStatusBadge status="Refresh failed" label={error} tone="warning" />
      ) : null}

      <MobileKpiCard
        featured
        title="Year-to-date collections"
        value={formatTzs(totalCollected)}
        description={`${formatTzs(totalExpenses)} expenses · ${formatTzs(netPosition)} net`}
        icon={WalletCards}
        trend={{ value: formatNumber(dashboard?.newMembersLast30Days ?? 0), label: 'new members', direction: 'up' }}
      />

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Needs attention
        </MobileText>
        <MobileStatusBadge status="Review" label={`${formatNumber(openItems)} open`} tone="review" />
      </View>

      <MobileCard>
        <View style={styles.attentionGrid}>
          <View style={styles.attentionItem}>
            <MobileText variant="section" weight="bold">
              {formatNumber(dashboard?.inactiveMembers ?? 0)}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Inactive members
            </MobileText>
          </View>
          <View style={styles.attentionItem}>
            <MobileText variant="section" weight="bold">
              {formatNumber(dashboard?.partiallyCompletedRegistrations ?? 0)}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Partial registrations
            </MobileText>
          </View>
          <View style={styles.attentionItem}>
            <MobileText variant="section" weight="bold">
              {formatNumber(dashboard?.fullyCompliantMembers ?? 0)}
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Fully compliant
            </MobileText>
          </View>
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
            onPress={() =>
              addMemberRoute
                ? router.push({ pathname: '/route-preview', params: { routeId: addMemberRoute.id } } as never)
                : undefined
            }
          />
          <MobileButton label="Record pay" icon={Banknote} variant="secondary" style={styles.actionButton} />
          <MobileButton label="Approve" icon={CheckCircle2} variant="secondary" style={styles.actionButton} />
          <MobileButton label="Send SMS" icon={Send} variant="secondary" style={styles.actionButton} />
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
          onPress={() =>
            membersRoute
              ? router.push({ pathname: '/route-preview', params: { routeId: membersRoute.id } } as never)
              : undefined
          }
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

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  attentionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attentionItem: {
    flexGrow: 1,
    flexBasis: '30%',
    gap: 2,
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
});
