import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { CalendarDays, CreditCard, FileText, Landmark, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

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
  MobileText,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import { getApiErrorMessage, MobileApiError } from '@/types/api';
import { getMemberDashboard, type MemberDashboardData } from '@/services/dashboard-service';
import { useNaneTheme } from '@/theme/tokens';
import { formatDate, formatNumber, formatPercent, formatTzs } from '@/utils/format';

export default function MemberHomeScreen() {
  const theme = useNaneTheme();
  const [dashboard, setDashboard] = useState<MemberDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paymentRoute = getRouteByPath('/member/pay/generic');
  const deductionsRoute = getRouteByPath('/member/deductions');
  const loanRequestRoute = getRouteByPath('/member/loans/request');
  const invoicesRoute = getRouteByPath('/member/invoices');
  const eventsRoute = getRouteByPath('/member/events');
  const registrationRoute = getRouteByPath('/member/registration/complete');
  const openRoute = (route: ReturnType<typeof getRouteByPath>) => {
    if (route) router.push({ pathname: '/work/route-preview', params: { routeId: route.id } } as never);
  };
  const openRouteReplacement = useCallback((route: ReturnType<typeof getRouteByPath>) => {
    if (route) router.replace({ pathname: '/work/route-preview', params: { routeId: route.id } } as never);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setDashboard(await getMemberDashboard());
    } catch (loadError) {
      if (loadError instanceof MobileApiError && loadError.status === 404 && registrationRoute) {
        openRouteReplacement(registrationRoute);
        return;
      }
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [openRouteReplacement, registrationRoute]);

  useEffect(() => {
    void Promise.resolve().then(loadDashboard);
  }, [loadDashboard]);

  const recentTransactions = useMemo<MobileDataListItem[]>(
    () =>
      Object.entries(dashboard?.recentTransactions || {})
        .slice(0, 5)
        .map(([label, amount], index) => ({
          id: `${label}-${index}`,
          title: label,
          subtitle: 'Recent contribution activity',
          meta: 'Dashboard summary',
          amount: formatTzs(Number(amount) || 0),
          status: 'Paid',
          accent: 'paid',
        })),
    [dashboard?.recentTransactions],
  );

  const packageItems = useMemo<MobileDataListItem[]>(
    () =>
      (dashboard?.subscribedPackages || []).slice(0, 4).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: item.description || 'Subscribed package',
        meta: item.subscribedAt ? `Subscribed ${formatDate(item.subscribedAt)}` : 'Subscription date unavailable',
        amount: item.price !== undefined ? formatTzs(item.price) : undefined,
        status: item.status,
        accent: item.status?.toLowerCase() === 'active' ? 'success' : 'neutral',
      })),
    [dashboard?.subscribedPackages],
  );

  const isUnionMember = dashboard?.associationType?.toUpperCase() === 'UNION';
  const isSaccosMember = ['SACCOS', 'SACCO'].includes(dashboard?.associationType?.toUpperCase() || '');
  const primaryActionRoute = isUnionMember ? deductionsRoute : paymentRoute;
  const primaryActionLabel = isUnionMember ? 'Deductions' : isSaccosMember ? 'Pay savings' : 'Pay shares';
  const primaryActionIcon = isUnionMember ? WalletCards : CreditCard;
  const contributionValue = isUnionMember ? dashboard?.unionContributions?.totalAmount : isSaccosMember ? dashboard?.totalSavings : dashboard?.totalContributions;
  const contributionDescription = isUnionMember
    ? `${formatNumber(dashboard?.unionContributions?.contributionCount ?? 0)} deduction records`
    : isSaccosMember ? 'Paid savings used for loan eligibility' : 'Total recorded';

  if (loading && !dashboard) {
    return <MobilePageLoadingState kind="dashboard" message="Loading member dashboard" />;
  }

  if (error && !dashboard) {
    return (
      <MobileScreen refreshing={loading} onRefresh={() => void loadDashboard()}>
        <MobilePageHeader
          showLogo
          eyebrow="Member portal"
          title="Member dashboard"
          subtitle="Member context unavailable"
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
        displayName={dashboard?.memberName || 'Member'}
        workspaceLabel="Member"
        workspaceName={dashboard?.associationName || 'Nane association'}
        subtitle={dashboard?.membershipNumber || 'Membership number pending'}
        refreshing={loading}
        onRefresh={() => void loadDashboard()}
      />

      {error && dashboard ? <MobileStatusBadge status="Refresh failed" label={error} tone="warning" /> : null}

      <MobileKpiCard
        featured
        title="My financial position"
        value={formatTzs(dashboard?.totalPaid ?? dashboard?.totalContributions ?? 0)}
        description="Total paid and contribution position"
        icon={WalletCards}
        trend={{ value: formatTzs(dashboard?.monthlyContribution ?? 0), label: 'this month', direction: 'up' }}
      />

      <MobileCard>
        <View style={styles.membershipHeader}>
          <View style={styles.membershipCopy}>
            <MobileText variant="section" weight="bold">
              Membership status
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {dashboard?.membershipNumber || 'Membership number pending'} · Joined {formatDate(dashboard?.memberSince)}
            </MobileText>
          </View>
          <MobileStatusBadge status={dashboard?.status || 'Unknown'} />
        </View>
        <MobileProgressBar value={dashboard?.registrationProgress ?? 0} tone="green" style={styles.membershipProgress} />
        <MobileText variant="small" tone="secondary">
          {formatPercent(dashboard?.registrationProgress ?? 0)} of the member profile and requirements are complete.
        </MobileText>
      </MobileCard>

      <MobileCard>
        <MobileText variant="section" weight="bold">
          Quick actions
        </MobileText>
        <View style={styles.actionGrid}>
          <MobileButton label={primaryActionLabel} icon={primaryActionIcon} style={styles.actionButton} onPress={() => openRoute(primaryActionRoute)} />
          <MobileButton label="Request loan" icon={Landmark} variant="secondary" style={styles.actionButton} onPress={() => openRoute(loanRequestRoute)} />
          <MobileButton label="Invoice" icon={FileText} variant="secondary" style={styles.actionButton} onPress={() => openRoute(invoicesRoute)} />
          <MobileButton label="Events" icon={CalendarDays} variant="secondary" style={styles.actionButton} onPress={() => openRoute(eventsRoute)} />
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard
            title={isUnionMember ? 'Deductions' : isSaccosMember ? 'Savings' : 'Contributions'}
            value={formatTzs(contributionValue ?? dashboard?.totalSocialContributions ?? 0)}
            description={contributionDescription}
            tone="teal"
            icon={WalletCards}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Loan balance"
            value={formatTzs(dashboard?.activeLoanBalance ?? 0)}
            description={`${formatNumber(dashboard?.activeLoansCount ?? 0)} active loans`}
            tone="orange"
            icon={Landmark}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title={isSaccosMember ? 'Equity shares' : 'Shares'}
            value={formatTzs(dashboard?.totalShareValue ?? dashboard?.totalSharesBought ?? 0)}
            description={isSaccosMember ? `${formatNumber(dashboard?.totalSharesBought ?? 0)} shares for dividends` : `${formatNumber(dashboard?.totalSharePurchases ?? 0)} share purchases`}
            tone="green"
            icon={CreditCard}
          />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard
            title="Transactions"
            value={formatNumber(dashboard?.totalTransactions ?? 0)}
            description={`${formatNumber(dashboard?.activeSubscriptions ?? 0)} active subscriptions`}
            tone="purple"
            icon={FileText}
          />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Recent transactions
        </MobileText>
        <ShieldCheck color={theme.colors.status.success} size={19} />
      </View>
      {recentTransactions.length ? (
        <MobileDataList items={recentTransactions} />
      ) : (
        <MobileEmptyState title="No recent transactions" description="Recent contribution activity will appear here when available." />
      )}

      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Subscriptions
        </MobileText>
        <MobileStatusBadge status="Active" label={`${formatNumber(dashboard?.activeSubscriptions ?? 0)} active`} tone="success" />
      </View>
      {packageItems.length ? (
        <MobileDataList items={packageItems} />
      ) : (
        <MobileEmptyState title="No subscriptions" description="Subscribed packages will appear here when available." />
      )}
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  membershipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  membershipCopy: {
    flex: 1,
    minWidth: 0,
  },
  membershipProgress: {
    marginTop: 16,
    marginBottom: 8,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
