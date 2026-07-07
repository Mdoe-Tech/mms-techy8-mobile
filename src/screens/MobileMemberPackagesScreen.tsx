import { router } from 'expo-router';
import { ArrowUpCircle, CheckCircle2, CreditCard, History, Package, RefreshCw, Search, ShieldAlert, Sparkles, UserRound, WalletCards } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileEmptyState,
  MobileErrorState,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import { getActiveAssociationPackages, type MembershipPackage } from '@/services/package-service';
import {
  createSubscriptionPaymentLink,
  getCurrentMemberSubscriptions,
  subscribeCurrentMember,
  type BillingCycle,
  type MemberSubscription,
} from '@/services/subscription-service';
import { type KpiTone, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatNumber } from '@/utils/format';

type PackageTab = 'ALL' | 'AVAILABLE' | 'CURRENT' | 'PENDING';
type Notice = { title: string; description?: string; tone?: 'success' | 'warning' | 'danger' | 'info' } | null;

const billingCycles: {
  value: BillingCycle;
  label: string;
  suffix: string;
  amountKey: keyof Pick<
    MembershipPackage,
    'weeklyAmount' | 'biWeeklyAmount' | 'monthlyAmount' | 'quarterlyAmount' | 'semiAnnualAmount' | 'annualAmount'
  >;
}[] = [
  { value: 'WEEKLY', label: 'Weekly', suffix: 'per week', amountKey: 'weeklyAmount' },
  { value: 'BI_WEEKLY', label: 'Bi-weekly', suffix: 'every two weeks', amountKey: 'biWeeklyAmount' },
  { value: 'MONTHLY', label: 'Monthly', suffix: 'per month', amountKey: 'monthlyAmount' },
  { value: 'QUARTERLY', label: 'Quarterly', suffix: 'per quarter', amountKey: 'quarterlyAmount' },
  { value: 'SEMI_ANNUAL', label: 'Semi-annual', suffix: 'twice per year', amountKey: 'semiAnnualAmount' },
  { value: 'ANNUAL', label: 'Annual', suffix: 'per year', amountKey: 'annualAmount' },
];

export default function MobileMemberPackagesScreen() {
  const { activeView, associationId, user } = useAuth();
  const theme = useNaneTheme();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [subscriptions, setSubscriptions] = useState<MemberSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [activeTab, setActiveTab] = useState<PackageTab>('ALL');
  const [search, setSearch] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<MembershipPackage | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const userId = user?.userId;
  const associationType = String(user?.associationType || '').toUpperCase();
  const genericSupported = associationType === 'GENERIC';
  const subscriptionRoute = getRouteByPath('/member/subscription');
  const historyRoute = getRouteByPath('/member/subscription-history');

  const loadPackages = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId || !associationId) {
        setLoading(false);
        setLoadError('Member and association context are required before loading packages.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      setNotice(null);
      setFeatureUnavailable(false);

      try {
        const currentMember = await getCurrentMemberByUserId(userId);
        setMember(currentMember);

        if (!genericSupported) {
          setPackages([]);
          setSubscriptions([]);
          setFeatureUnavailable(true);
          return;
        }

        const [packageRows, subscriptionPage] = await Promise.all([
          getActiveAssociationPackages(associationId),
          getCurrentMemberSubscriptions(associationId, { size: 100 }),
        ]);

        setPackages(packageRows.filter((pkg) => Boolean(pkg?.id) && pkg.active !== false));
        setSubscriptions((subscriptionPage.content || []).filter((subscription) => Boolean(subscription?.id)));
      } catch (error) {
        const message = getApiErrorMessage(error);
        setPackages([]);
        setSubscriptions([]);
        if (isFeatureUnavailable(message)) {
          setFeatureUnavailable(true);
          setLoadError(null);
        } else {
          setLoadError(message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, genericSupported, userId],
  );

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(() => loadPackages());
    }
  }, [activeView, loadPackages]);

  const activeSubscription = useMemo(
    () => sortSubscriptions(subscriptions).find((subscription) => statusOf(subscription) === 'ACTIVE') || null,
    [subscriptions],
  );
  const pendingSubscriptions = useMemo(
    () => sortSubscriptions(subscriptions).filter((subscription) => statusOf(subscription) === 'PENDING'),
    [subscriptions],
  );
  const startingPrice = useMemo(
    () => packages.map((pkg) => lowestPackagePrice(pkg)).filter((amount) => amount >= 0).sort((left, right) => left - right)[0] ?? 0,
    [packages],
  );
  const currency = activeSubscription ? subscriptionCurrency(activeSubscription) : packages[0]?.currency || 'TZS';

  const packageRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return packages
      .filter((pkg) => {
        const state = packageState(pkg, activeSubscription, pendingSubscriptions);
        if (activeTab === 'AVAILABLE' && state !== 'AVAILABLE') return false;
        if (activeTab === 'CURRENT' && state !== 'CURRENT') return false;
        if (activeTab === 'PENDING' && state !== 'PENDING') return false;
        if (!query) return true;
        return [pkg.name, pkg.description, lowestPackagePriceLabel(pkg), availableBillingCycles(pkg).map((cycle) => billingLabel(cycle)).join(' '), ...(pkg.benefits || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) => {
        const leftState = packageState(left, activeSubscription, pendingSubscriptions);
        const rightState = packageState(right, activeSubscription, pendingSubscriptions);
        return packageStateOrder(leftState) - packageStateOrder(rightState) || lowestPackagePrice(left) - lowestPackagePrice(right) || String(left.name || '').localeCompare(String(right.name || ''));
      });
  }, [activeSubscription, activeTab, packages, pendingSubscriptions, search]);

  const tabs = useMemo(
    () => [
      { value: 'ALL', label: 'All', count: packages.length },
      { value: 'AVAILABLE', label: 'Available', count: packages.filter((pkg) => packageState(pkg, activeSubscription, pendingSubscriptions) === 'AVAILABLE').length },
      { value: 'CURRENT', label: 'Current', count: packages.filter((pkg) => packageState(pkg, activeSubscription, pendingSubscriptions) === 'CURRENT').length },
      { value: 'PENDING', label: 'Pending', count: packages.filter((pkg) => packageState(pkg, activeSubscription, pendingSubscriptions) === 'PENDING').length },
    ],
    [activeSubscription, packages, pendingSubscriptions],
  );

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Member workspace required"
        description="Package browsing is available from the member portal workspace."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading membership packages" />;
  }

  if (featureUnavailable) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Membership"
          title="Packages"
          subtitle={user?.associationName || 'Member portal'}
          rightAction={<MobileStatusBadge status="Unavailable" tone="warning" />}
        />
        <MobileEmptyState
          title="Packages are not enabled here"
          description="Membership package browsing is available for Generic associations. This association uses a different contribution model."
        />
        <MobileCard compact accent="blue">
          <MobileInfoRow label="Association type" value={associationType || 'Not provided'} helper="The backend restricts package subscription workflows to Generic associations." icon={ShieldAlert} />
          <MobileInfoRow label="Member" value={memberName(member, user?.fullName)} helper={member?.membershipNumber || user?.email || 'Current member'} icon={UserRound} />
        </MobileCard>
      </MobileScreen>
    );
  }

  if (loadError) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Membership"
          title="Packages"
          subtitle={user?.associationName || 'Member portal'}
          rightAction={<MobileButton label="Retry" icon={RefreshCw} size="sm" variant="secondary" onPress={() => void loadPackages('refresh')} />}
        />
        <MobileErrorState title="Could not load packages" description={loadError} retryLabel="Retry" onRetry={() => void loadPackages('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Membership"
        title="Packages"
        subtitle={member?.membershipNumber || user?.associationName || 'Member portal'}
        rightAction={<MobileStatusBadge status={activeSubscription ? 'Active' : pendingSubscriptions.length ? 'Pending' : 'Available'} tone={activeSubscription ? 'success' : pendingSubscriptions.length ? 'warning' : 'primary'} />}
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone || 'success'} /> : null}

      <MobileSummaryPanel
        title={activeSubscription ? 'Current package' : 'Package catalog'}
        value={activeSubscription ? packageName(activeSubscription) : `${formatNumber(packages.length)} available`}
        description={activeSubscription ? amountWithCycle(activeSubscription) : 'Compare plans and choose the billing cycle that fits your membership.'}
        icon={activeSubscription ? CheckCircle2 : Package}
        tone={activeSubscription ? 'green' : 'blue'}
        footer={
          <View style={styles.summaryActions}>
            <MobileButton
              label="My subscription"
              icon={WalletCards}
              variant="secondary"
              size="sm"
              onPress={() => (subscriptionRoute ? router.push({ pathname: '/work/route-preview', params: { routeId: subscriptionRoute.id } } as never) : router.back())}
              style={styles.summaryButton}
            />
            <MobileButton
              label="History"
              icon={History}
              variant="ghost"
              size="sm"
              onPress={() => (historyRoute ? router.push({ pathname: '/work/route-preview', params: { routeId: historyRoute.id } } as never) : router.back())}
              style={styles.summaryButton}
            />
          </View>
        }
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Available" value={formatNumber(packages.length)} description="Published plans" icon={Sparkles} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Starting at" value={startingPrice <= 0 ? 'Free' : formatCurrency(startingPrice, currency)} description="Lowest billing option" icon={CreditCard} tone={startingPrice <= 0 ? 'green' : 'blue'} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileSearchToolbar value={search} onChange={setSearch} placeholder="Search package, benefit, or price..." filterLabel="Refresh" onFilterPress={() => void loadPackages('refresh')} />
      {refreshing ? <MobileToast title="Refreshing packages" description="Checking current plan, pending requests, and active packages." tone="info" /> : null}
      <MobileStatusTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as PackageTab)} />

      {packageRows.length ? (
        <View style={styles.packageList}>
          {packageRows.map((pkg) => {
            const state = packageState(pkg, activeSubscription, pendingSubscriptions);
            const pending = pendingSubscriptionForPackage(pkg, pendingSubscriptions);
            return (
              <PackageCatalogCard
                key={pkg.id}
                pkg={pkg}
                state={state}
                pendingSubscription={pending}
                paying={payingId === pending?.id}
                payDisabled={Boolean(payingId && payingId !== pending?.id)}
                onPayNow={pending ? () => void handlePayNow(pending) : undefined}
                onOpen={() => openPackage(pkg)}
              />
            );
          })}
        </View>
      ) : (
        <MobileEmptyState
          title="No packages found"
          description={search ? 'No package matches your current search or status filter.' : 'Your association has not published active packages yet.'}
          actionLabel={search || activeTab !== 'ALL' ? 'Reset view' : undefined}
          onAction={search || activeTab !== 'ALL' ? resetFilters : undefined}
        />
      )}

      <MobileSheet
        visible={Boolean(selectedPackage)}
        title={selectedPackage?.name || 'Package details'}
        description={selectedPackage?.description || 'Review benefits, billing cycles, and subscription status.'}
        onClose={() => {
          if (!submitting) setSelectedPackage(null);
        }}
      >
        {selectedPackage ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <MobileCard compact accent={packageTone(selectedPackage)}>
              <MobileInfoRow label="Status" value={packageStateLabel(packageState(selectedPackage, activeSubscription, pendingSubscriptions))} helper="Status for your member account" icon={Package} />
              <MobileInfoRow label="Starting price" value={lowestPackagePriceLabel(selectedPackage)} helper="Lowest available billing amount" icon={CreditCard} />
              <MobileInfoRow label="Subscribed members" value={formatNumber(toNumber(selectedPackage.memberCount))} helper="Current package membership" icon={UserRound} />
            </MobileCard>
            <MobileSelect
              label="Billing cycle"
              value={selectedBillingCycle}
              options={billingCycleOptions(selectedPackage)}
              onChange={(value) => setSelectedBillingCycle(value as BillingCycle)}
              helperText="Only billing cycles with configured prices are shown."
            />
            <BenefitsCard benefits={selectedPackage.benefits || []} iconColor={theme.colors.status.success} />
            <View style={styles.sheetActions}>
              <MobileButton label="Close" variant="secondary" disabled={submitting} onPress={() => setSelectedPackage(null)} />
              <MobileButton
                label={activeSubscription ? 'Request change' : 'Subscribe'}
                icon={activeSubscription ? ArrowUpCircle : CheckCircle2}
                fullWidth
                loading={submitting}
                disabled={hasExistingOpenSubscription(selectedPackage, subscriptions)}
                onPress={() => setConfirmOpen(true)}
                style={styles.sheetPrimaryAction}
              />
            </View>
            {hasExistingOpenSubscription(selectedPackage, subscriptions) ? (
              <MobileToast
                title="Already selected"
                description="This package already has an active or pending subscription for your account."
                tone="warning"
              />
            ) : null}
          </ScrollView>
        ) : null}
      </MobileSheet>

      <MobileConfirmSheet
        visible={confirmOpen}
        title={activeSubscription ? 'Request package change?' : 'Confirm subscription?'}
        description={selectedPackage ? `${selectedPackage.name || 'Package'} - ${billingLabel(selectedBillingCycle)} for ${formatCurrency(amountForCycle(selectedPackage, selectedBillingCycle), selectedPackage.currency || 'TZS')}.` : 'Confirm this package request.'}
        confirmLabel={activeSubscription ? 'Request change' : 'Subscribe'}
        loading={submitting}
        onCancel={() => {
          if (!submitting) setConfirmOpen(false);
        }}
        onConfirm={handleSubscribe}
      />
    </MobileScreen>
  );

  function resetFilters() {
    setSearch('');
    setActiveTab('ALL');
  }

  function openPackage(pkg: MembershipPackage) {
    setSelectedPackage(pkg);
    setSelectedBillingCycle(defaultBillingCycle(pkg));
  }

  async function handleSubscribe() {
    if (!selectedPackage || !associationId) return;
    if (hasExistingOpenSubscription(selectedPackage, subscriptions)) {
      setConfirmOpen(false);
      setSelectedPackage(null);
      setNotice({
        title: 'Already selected',
        description: 'This package already has an active or pending subscription.',
        tone: 'warning',
      });
      return;
    }

    setSubmitting(true);
    try {
      const subscribedMember = await subscribeCurrentMember(selectedPackage.id, selectedBillingCycle);
      const amount = amountForCycle(selectedPackage, selectedBillingCycle);

      if (amount > 0 && subscribedMember.id) {
        const paymentLink = await createSubscriptionPaymentLink({
          memberId: subscribedMember.id,
          associationId,
          amount,
          currency: selectedPackage.currency || 'TZS',
          purpose: 'SUBSCRIPTION',
          description: `Subscription - ${selectedPackage.name || 'Package'} (${selectedBillingCycle})`,
        });

        if (paymentLink.url) {
          await Linking.openURL(paymentLink.url);
          setNotice({
            title: 'Subscription created',
            description: 'Opening the secure payment page.',
          });
        } else {
          setNotice({
            title: 'Subscription created',
            description: 'Payment link was not returned. Use My subscription to continue payment.',
            tone: 'warning',
          });
        }
      } else {
        setNotice({
          title: activeSubscription ? 'Package change requested' : 'Subscription requested',
          description: 'Your package request was submitted successfully.',
        });
      }

      setConfirmOpen(false);
      setSelectedPackage(null);
      await loadPackages('refresh');
      setActiveTab('PENDING');
    } catch (error) {
      setNotice({
        title: 'Could not submit package request',
        description: getApiErrorMessage(error),
        tone: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePayNow(subscription: MemberSubscription) {
    const pkg = subscriptionPackage(subscription);
    const memberId = subscription.memberId || member?.id;
    if (!pkg || !memberId || !associationId) {
      setNotice({
        title: 'Payment unavailable',
        description: 'This subscription is missing package or member details.',
        tone: 'warning',
      });
      return;
    }

    const amount = toNumber(subscription.amount) || amountForCycle(pkg, cycleOf(subscription));
    if (amount <= 0) {
      setNotice({
        title: 'No payment required',
        description: 'This package subscription is marked as free.',
        tone: 'info',
      });
      return;
    }

    setPayingId(subscription.id);
    try {
      const paymentLink = await createSubscriptionPaymentLink({
        memberId,
        associationId,
        amount,
        currency: pkg.currency || 'TZS',
        purpose: 'SUBSCRIPTION',
        description: `Subscription - ${pkg.name || 'Package'} (${cycleOf(subscription)})`,
      });

      if (!paymentLink.url) throw new Error('Payment link was not returned.');
      await Linking.openURL(paymentLink.url);
    } catch (error) {
      setNotice({
        title: 'Could not open payment',
        description: getApiErrorMessage(error),
        tone: 'danger',
      });
    } finally {
      setPayingId(null);
    }
  }
}

function PackageCatalogCard({
  pkg,
  state,
  pendingSubscription,
  paying,
  payDisabled,
  onPayNow,
  onOpen,
}: {
  pkg: MembershipPackage;
  state: 'CURRENT' | 'PENDING' | 'AVAILABLE';
  pendingSubscription?: MemberSubscription | null;
  paying?: boolean;
  payDisabled?: boolean;
  onPayNow?: () => void;
  onOpen: () => void;
}) {
  const status = packageStateLabel(state);
  const tone = state === 'CURRENT' ? 'success' : state === 'PENDING' ? 'warning' : 'primary';
  const pendingAmount = pendingSubscription ? toNumber(pendingSubscription.amount) : 0;

  return (
    <MobileCard compact accent={state === 'CURRENT' ? 'green' : state === 'PENDING' ? 'orange' : packageTone(pkg)}>
      <View style={styles.packageHeader}>
        <View style={styles.flex}>
          <MobileText variant="body" weight="bold" numberOfLines={1}>
            {pkg.name || 'Membership package'}
          </MobileText>
          <MobileText variant="small" tone="secondary" numberOfLines={2}>
            {pkg.description || 'No package description provided.'}
          </MobileText>
        </View>
        <MobileStatusBadge status={status} tone={tone} />
      </View>

      <View style={styles.priceRow}>
        <MobileText variant="section" weight="bold">
          {lowestPackagePriceLabel(pkg)}
        </MobileText>
        <MobileText variant="small" tone="secondary" numberOfLines={1}>
          {availableBillingCycles(pkg).map((cycle) => billingLabel(cycle)).join(', ') || 'Free'}
        </MobileText>
      </View>

      <BenefitsCard benefits={pkg.benefits || []} compact limit={3} />

      {state === 'PENDING' ? (
        <MobileCard compact accent="orange" style={styles.inlineNotice}>
          <MobileText variant="small" weight="bold">
            Pending request
          </MobileText>
          <MobileText variant="small" tone="secondary">
            {pendingAmount > 0 ? `${formatCurrency(pendingAmount, pkg.currency || 'TZS')} awaiting payment or approval.` : 'Awaiting approval.'}
          </MobileText>
        </MobileCard>
      ) : null}

      <View style={styles.cardActions}>
        <MobileButton
          label="Details"
          icon={Search}
          variant={state === 'AVAILABLE' ? 'secondary' : 'ghost'}
          onPress={onOpen}
          style={styles.actionButton}
        />
        {state === 'PENDING' && pendingAmount > 0 && onPayNow ? (
          <MobileButton
            label="Pay now"
            icon={CreditCard}
            loading={paying}
            disabled={payDisabled}
            onPress={onPayNow}
            style={styles.actionButton}
          />
        ) : (
          <MobileButton
            label={state === 'CURRENT' ? 'Current' : 'Choose'}
            icon={state === 'CURRENT' ? CheckCircle2 : ArrowUpCircle}
            disabled={state === 'CURRENT'}
            onPress={onOpen}
            style={styles.actionButton}
          />
        )}
      </View>
    </MobileCard>
  );
}

function BenefitsCard({ benefits, compact, limit, iconColor }: { benefits: string[]; compact?: boolean; limit?: number; iconColor?: string }) {
  const visible = limit ? benefits.slice(0, limit) : benefits;
  if (!visible.length) {
    return (
      <MobileInfoRow
        label="Benefits"
        value="Not specified"
        helper="Package benefits have not been listed."
        icon={Sparkles}
      />
    );
  }

  return (
    <View style={[styles.benefits, compact ? styles.compactBenefits : null]}>
      <MobileText variant="small" weight="bold">
        Benefits
      </MobileText>
      {visible.map((benefit, index) => (
        <View key={`${benefit}-${index}`} style={styles.benefitRow}>
          <CheckCircle2 color={iconColor || '#15803D'} size={15} strokeWidth={2.5} />
          <MobileText variant="small" tone="secondary" style={styles.flex}>
            {benefit}
          </MobileText>
        </View>
      ))}
      {limit && benefits.length > limit ? (
        <MobileText variant="tiny" tone="secondary">
          +{benefits.length - limit} more benefits
        </MobileText>
      ) : null}
    </View>
  );
}

function billingCycleOptions(pkg: MembershipPackage) {
  return availableBillingCycles(pkg).map((cycle) => ({
    value: cycle,
    label: `${billingLabel(cycle)} - ${formatCurrency(amountForCycle(pkg, cycle), pkg.currency || 'TZS')}`,
  }));
}

function availableBillingCycles(pkg: MembershipPackage): BillingCycle[] {
  const cycles = billingCycles
    .filter((cycle) => toNumber(pkg[cycle.amountKey]) > 0)
    .map((cycle) => cycle.value);
  return cycles.length ? cycles : ['FREE'];
}

function defaultBillingCycle(pkg: MembershipPackage): BillingCycle {
  return availableBillingCycles(pkg)[0] || 'FREE';
}

function billingLabel(cycle?: string | null) {
  if (cycle === 'FREE') return 'Free';
  return billingCycles.find((option) => option.value === cycle)?.label || String(cycle || 'Billing');
}

function amountForCycle(pkg: MembershipPackage | null | undefined, cycle: BillingCycle) {
  if (!pkg || cycle === 'FREE') return 0;
  const option = billingCycles.find((item) => item.value === cycle);
  return option ? toNumber(pkg[option.amountKey]) : 0;
}

function lowestPackagePrice(pkg: MembershipPackage) {
  return availableBillingCycles(pkg)
    .map((cycle) => amountForCycle(pkg, cycle))
    .sort((left, right) => left - right)[0] || 0;
}

function lowestPackagePriceLabel(pkg: MembershipPackage) {
  const price = lowestPackagePrice(pkg);
  if (price <= 0) return 'Free';
  return formatCurrency(price, pkg.currency || 'TZS');
}

function subscriptionPackage(subscription: MemberSubscription | null | undefined) {
  return (subscription?.packageResponse || subscription?.membershipPackage || null) as MembershipPackage | null;
}

function packageName(subscription: MemberSubscription) {
  return subscriptionPackage(subscription)?.name || 'Membership package';
}

function statusOf(subscription: MemberSubscription) {
  return String(subscription.status || 'UNKNOWN').toUpperCase();
}

function cycleOf(subscription: MemberSubscription): BillingCycle {
  const cycle = String(subscription.billingCycle || 'MONTHLY').toUpperCase();
  return (cycle === 'FREE' || billingCycles.some((option) => option.value === cycle) ? cycle : 'MONTHLY') as BillingCycle;
}

function subscriptionCurrency(subscription: MemberSubscription) {
  return subscriptionPackage(subscription)?.currency || 'TZS';
}

function amountWithCycle(subscription: MemberSubscription) {
  const amount = toNumber(subscription.amount);
  const cycle = cycleOf(subscription);
  return `${formatCurrency(amount, subscriptionCurrency(subscription))}${cycle === 'FREE' ? '' : ` / ${billingLabel(cycle).toLowerCase()}`}`;
}

function pendingSubscriptionForPackage(pkg: MembershipPackage, pendingSubscriptions: MemberSubscription[]) {
  return pendingSubscriptions.find((subscription) => subscriptionPackage(subscription)?.id === pkg.id) || null;
}

function packageState(pkg: MembershipPackage, activeSubscription: MemberSubscription | null, pendingSubscriptions: MemberSubscription[]) {
  if (subscriptionPackage(activeSubscription)?.id === pkg.id) return 'CURRENT';
  if (pendingSubscriptionForPackage(pkg, pendingSubscriptions)) return 'PENDING';
  return 'AVAILABLE';
}

function packageStateLabel(state: 'CURRENT' | 'PENDING' | 'AVAILABLE') {
  if (state === 'CURRENT') return 'Current';
  if (state === 'PENDING') return 'Pending';
  return 'Available';
}

function packageStateOrder(state: 'CURRENT' | 'PENDING' | 'AVAILABLE') {
  if (state === 'CURRENT') return 0;
  if (state === 'PENDING') return 1;
  return 2;
}

function hasExistingOpenSubscription(pkg: MembershipPackage, subscriptions: MemberSubscription[]) {
  return subscriptions.some((subscription) => {
    const status = statusOf(subscription);
    return subscriptionPackage(subscription)?.id === pkg.id && (status === 'PENDING' || status === 'ACTIVE');
  });
}

function memberName(member: AssociationMember | null, fallback = 'Current member') {
  return member?.fullLegalName || fallback;
}

function packageTone(pkg: MembershipPackage): KpiTone {
  const price = lowestPackagePrice(pkg);
  if (price <= 0) return 'green';
  if (toNumber(pkg.memberCount) > 0) return 'purple';
  return 'blue';
}

function sortSubscriptions(subscriptions: MemberSubscription[]) {
  return [...subscriptions].sort((left, right) => dateValue(right.createdAt || right.startDate) - dateValue(left.createdAt || left.startDate));
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function isFeatureUnavailable(message: string) {
  const lower = message.toLowerCase();
  return lower.includes('generic') || lower.includes('not available for this association type') || lower.includes('restricted');
}

const styles = StyleSheet.create({
  summaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryButton: {
    flex: 1,
  },
  packageList: {
    gap: 12,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  priceRow: {
    gap: 2,
  },
  benefits: {
    gap: 8,
  },
  compactBenefits: {
    gap: 6,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  inlineNotice: {
    gap: 3,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 12,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetPrimaryAction: {
    flex: 1,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
