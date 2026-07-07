import { router } from 'expo-router';
import {
  ArrowUpCircle,
  Calendar,
  CheckCircle2,
  CreditCard,
  Package,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  WalletCards,
} from 'lucide-react-native';
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
import { type KpiTone, statusToneFor } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type SubscriptionTab = 'overview' | 'pending' | 'packages';
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

export default function MobileMemberSubscriptionScreen() {
  const { activeView, associationId, user } = useAuth();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [subscriptions, setSubscriptions] = useState<MemberSubscription[]>([]);
  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [activeTab, setActiveTab] = useState<SubscriptionTab>('overview');
  const [search, setSearch] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<MembershipPackage | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const userId = user?.userId;
  const associationType = String(user?.associationType || '').toUpperCase();
  const genericSupported = associationType === 'GENERIC';

  const loadSubscription = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId || !associationId) {
        setLoading(false);
        setError('Member and association context are required before loading subscriptions.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      setFeatureUnavailable(false);

      try {
        const currentMember = await getCurrentMemberByUserId(userId);
        setMember(currentMember);

        if (!genericSupported) {
          setSubscriptions([]);
          setPackages([]);
          setFeatureUnavailable(true);
          return;
        }

        const [subscriptionPage, packageRows] = await Promise.all([
          getCurrentMemberSubscriptions(associationId, { size: 100 }),
          getActiveAssociationPackages(associationId),
        ]);

        setSubscriptions((subscriptionPage.content || []).filter((subscription) => Boolean(subscription?.id)));
        setPackages(packageRows.filter((pkg) => Boolean(pkg?.id) && pkg.active !== false));
      } catch (loadError) {
        const message = getApiErrorMessage(loadError);
        setSubscriptions([]);
        setPackages([]);
        if (isFeatureUnavailable(message)) {
          setFeatureUnavailable(true);
          setError(null);
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, genericSupported, userId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadSubscription());
  }, [loadSubscription]);

  const activeSubscription = useMemo(
    () => sortSubscriptions(subscriptions).find((subscription) => statusOf(subscription) === 'ACTIVE') || null,
    [subscriptions],
  );
  const pendingSubscriptions = useMemo(
    () => sortSubscriptions(subscriptions).filter((subscription) => statusOf(subscription) === 'PENDING'),
    [subscriptions],
  );
  const subscriptionRevenue = useMemo(
    () => subscriptions.filter((subscription) => statusOf(subscription) === 'ACTIVE').reduce((sum, subscription) => sum + toNumber(subscription.amount), 0),
    [subscriptions],
  );
  const visiblePackages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return packages
      .filter((pkg) => {
        if (!query) return true;
        return [pkg.name, pkg.description, ...(pkg.benefits || []), lowestPackagePriceLabel(pkg)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
  }, [packages, search]);

  const tabs = useMemo(
    () => [
      { value: 'overview', label: 'Overview', count: subscriptions.length },
      { value: 'pending', label: 'Pending', count: pendingSubscriptions.length },
      { value: 'packages', label: 'Packages', count: packages.length },
    ],
    [packages.length, pendingSubscriptions.length, subscriptions.length],
  );

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Member workspace required"
        description="Subscription self-service is available from the member portal workspace."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="dashboard" message="Loading subscription workspace" />;
  }

  if (featureUnavailable) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Membership"
          title="My Subscriptions"
          subtitle={user?.associationName || 'Member portal'}
          rightAction={<MobileStatusBadge status="Unavailable" tone="warning" />}
        />
        <MobileEmptyState
          title="Subscriptions are not enabled here"
          description="Membership packages and subscriptions are available for Generic associations. This association uses a different member contribution model."
        />
        <MobileCard compact accent="blue">
          <MobileInfoRow label="Association type" value={associationType || 'Not provided'} helper="The API restricts this workflow to Generic associations." icon={ShieldAlert} />
          <MobileInfoRow label="Member" value={memberName(member, user?.fullName)} helper={member?.membershipNumber || user?.email || 'Current member'} icon={Package} />
        </MobileCard>
      </MobileScreen>
    );
  }

  if (error) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Membership" title="My Subscriptions" subtitle={user?.associationName || 'Member portal'} rightAction={<View />} />
        <MobileErrorState title="Could not load subscriptions" description={error} onRetry={() => loadSubscription()} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Membership"
        title="My Subscriptions"
        subtitle={member?.membershipNumber || user?.associationName || 'Member portal'}
        rightAction={<MobileStatusBadge status={activeSubscription ? 'Active' : pendingSubscriptions.length ? 'Pending' : 'Ready'} tone={activeSubscription ? 'success' : pendingSubscriptions.length ? 'warning' : 'primary'} />}
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone || 'success'} /> : null}

      <MobileSummaryPanel
        title={activeSubscription ? packageName(activeSubscription) : 'No active subscription'}
        value={activeSubscription ? amountWithCycle(activeSubscription) : 'Choose package'}
        description={activeSubscription ? subscriptionPeriod(activeSubscription) : 'Explore available membership packages below.'}
        icon={activeSubscription ? CheckCircle2 : Package}
        tone={activeSubscription ? 'green' : 'blue'}
      />

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active" value={activeSubscription ? '1' : '0'} description="Current approved plan" icon={CheckCircle2} tone={activeSubscription ? 'green' : 'slate'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pending" value={formatNumber(pendingSubscriptions.length)} description="Awaiting action" icon={Calendar} tone={pendingSubscriptions.length ? 'orange' : 'slate'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Packages" value={formatNumber(packages.length)} description="Available options" icon={Sparkles} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Active amount" value={formatCurrency(subscriptionRevenue, activeCurrency(activeSubscription, packages))} description="Current billing amount" icon={WalletCards} tone="blue" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as SubscriptionTab)} />

      {activeTab === 'overview' ? (
        <OverviewSection
          activeSubscription={activeSubscription}
          pendingSubscriptions={pendingSubscriptions}
          packages={packages}
          member={member}
          onOpenPackages={() => setActiveTab('packages')}
          onPayNow={handlePayNow}
          payingId={payingId}
        />
      ) : null}

      {activeTab === 'pending' ? (
        <PendingSection
          subscriptions={pendingSubscriptions}
          onPayNow={handlePayNow}
          payingId={payingId}
        />
      ) : null}

      {activeTab === 'packages' ? (
        <View style={styles.section}>
          <MobileSearchToolbar value={search} onChange={setSearch} placeholder="Search packages, benefits, or price..." filterLabel="Refresh" onFilterPress={() => loadSubscription('refresh')} />
          {refreshing ? <MobileToast title="Refreshing" description="Updating packages and subscription status." tone="info" /> : null}
          {visiblePackages.length ? (
            <View style={styles.packageList}>
              {visiblePackages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  activeSubscription={activeSubscription}
                  pendingSubscriptions={pendingSubscriptions}
                  onOpen={() => openPackage(pkg)}
                />
              ))}
            </View>
          ) : (
            <MobileEmptyState
              title="No packages found"
              description={search ? 'No available package matches your search.' : 'Your association has not published active packages yet.'}
              actionLabel={search ? 'Clear search' : undefined}
              onAction={search ? () => setSearch('') : undefined}
            />
          )}
        </View>
      ) : null}

      <View style={styles.footerActions}>
        <MobileButton label="Refresh" icon={RefreshCw} variant="secondary" loading={refreshing} onPress={() => loadSubscription('refresh')} />
        <MobileButton label="History" icon={ReceiptText} variant="secondary" onPress={() => router.push('/work/route-preview?routeId=member-member-subscription-history' as never)} />
      </View>

      <MobileSheet
        visible={Boolean(selectedPackage)}
        title={selectedPackage?.name || 'Package details'}
        description={selectedPackage?.description || 'Review package benefits and select a billing cycle.'}
        onClose={() => {
          if (!subscribing) setSelectedPackage(null);
        }}
      >
        {selectedPackage ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <MobileCard compact accent={packageTone(selectedPackage)}>
              <MobileInfoRow label="Starting price" value={lowestPackagePriceLabel(selectedPackage)} helper="Lowest available billing amount" icon={CreditCard} />
              <MobileInfoRow label="Subscribed members" value={formatNumber(toNumber(selectedPackage.memberCount))} helper="Current package membership" icon={Package} />
            </MobileCard>
            <MobileSelect
              label="Billing cycle"
              value={selectedBillingCycle}
              options={billingCycleOptions(selectedPackage)}
              onChange={(value) => setSelectedBillingCycle(value as BillingCycle)}
              helperText="Only billing cycles with an amount are shown. Free is used for free packages."
            />
            <BenefitsCard benefits={selectedPackage.benefits || []} />
            <View style={styles.sheetActions}>
              <MobileButton label="Close" variant="secondary" disabled={subscribing} onPress={() => setSelectedPackage(null)} />
              <MobileButton
                label={activeSubscription ? 'Request upgrade' : 'Subscribe'}
                icon={activeSubscription ? ArrowUpCircle : CheckCircle2}
                fullWidth
                loading={subscribing}
                disabled={hasExistingOpenSubscription(selectedPackage, subscriptions)}
                onPress={() => setConfirmOpen(true)}
                style={styles.sheetPrimaryAction}
              />
            </View>
            {hasExistingOpenSubscription(selectedPackage, subscriptions) ? (
              <MobileToast
                title="Already requested"
                description="You already have an active or pending subscription for this package."
                tone="warning"
              />
            ) : null}
          </ScrollView>
        ) : null}
      </MobileSheet>

      <MobileConfirmSheet
        visible={confirmOpen}
        title={activeSubscription ? 'Request package upgrade?' : 'Confirm subscription?'}
        description={selectedPackage ? `${selectedPackage.name} - ${billingLabel(selectedBillingCycle)} for ${formatCurrency(amountForCycle(selectedPackage, selectedBillingCycle), selectedPackage.currency || 'TZS')}.` : 'Confirm this subscription request.'}
        confirmLabel={activeSubscription ? 'Request upgrade' : 'Subscribe'}
        loading={subscribing}
        onCancel={() => {
          if (!subscribing) setConfirmOpen(false);
        }}
        onConfirm={handleSubscribe}
      />
    </MobileScreen>
  );

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
        title: 'Already requested',
        description: 'This package already has an active or pending subscription.',
        tone: 'warning',
      });
      return;
    }

    setSubscribing(true);
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
            description: 'Payment link was not returned. Use Pay Now from pending requests.',
            tone: 'warning',
          });
        }
      } else {
        setNotice({
          title: activeSubscription ? 'Upgrade requested' : 'Subscription requested',
          description: 'Your package request was submitted successfully.',
        });
      }

      setConfirmOpen(false);
      setSelectedPackage(null);
      await loadSubscription('refresh');
      setActiveTab('pending');
    } catch (subscribeError) {
      setNotice({
        title: 'Could not submit request',
        description: getApiErrorMessage(subscribeError),
        tone: 'danger',
      });
    } finally {
      setSubscribing(false);
    }
  }

  async function handlePayNow(subscription: MemberSubscription) {
    const pkg = subscriptionPackage(subscription);
    const memberId = subscription.memberId || member?.id;
    if (!pkg || !memberId || !associationId) {
      setNotice({
        title: 'Payment unavailable',
        description: 'The subscription is missing package or member details.',
        tone: 'warning',
      });
      return;
    }

    const amount = toNumber(subscription.amount) || amountForCycle(pkg, cycleOf(subscription));
    if (amount <= 0) {
      setNotice({
        title: 'No payment required',
        description: 'This subscription is marked as free.',
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
    } catch (payError) {
      setNotice({
        title: 'Could not open payment',
        description: getApiErrorMessage(payError),
        tone: 'danger',
      });
    } finally {
      setPayingId(null);
    }
  }
}

function OverviewSection({
  activeSubscription,
  pendingSubscriptions,
  packages,
  member,
  onOpenPackages,
  onPayNow,
  payingId,
}: {
  activeSubscription: MemberSubscription | null;
  pendingSubscriptions: MemberSubscription[];
  packages: MembershipPackage[];
  member: AssociationMember | null;
  onOpenPackages: () => void;
  onPayNow: (subscription: MemberSubscription) => void;
  payingId: string | null;
}) {
  return (
    <View style={styles.section}>
      <MobileCard compact accent={activeSubscription ? 'green' : 'blue'}>
        <View style={styles.sectionHeader}>
          <MobileText variant="section" weight="bold">
            Current plan
          </MobileText>
          <MobileStatusBadge status={activeSubscription ? statusOf(activeSubscription) : 'None'} tone={activeSubscription ? 'success' : 'neutral'} />
        </View>
        {activeSubscription ? (
          <>
            <MobileInfoRow label="Package" value={packageName(activeSubscription)} helper={subscriptionDescription(activeSubscription)} icon={Package} />
            <MobileInfoRow label="Billing" value={amountWithCycle(activeSubscription)} helper={subscriptionPeriod(activeSubscription)} icon={CreditCard} />
            <BenefitsCard benefits={subscriptionPackage(activeSubscription)?.benefits || []} compact />
          </>
        ) : (
          <>
            <MobileInfoRow label="Member" value={memberName(member)} helper={member?.membershipNumber || 'Current member'} icon={Package} />
            <MobileInfoRow label="Available packages" value={formatNumber(packages.length)} helper="Choose a package to request subscription." icon={Sparkles} />
            <MobileButton label="View packages" icon={Search} onPress={onOpenPackages} />
          </>
        )}
      </MobileCard>

      {pendingSubscriptions.length ? (
        <PendingSection subscriptions={pendingSubscriptions.slice(0, 3)} onPayNow={onPayNow} payingId={payingId} compact />
      ) : null}
    </View>
  );
}

function PendingSection({
  subscriptions,
  onPayNow,
  payingId,
  compact,
}: {
  subscriptions: MemberSubscription[];
  onPayNow: (subscription: MemberSubscription) => void;
  payingId: string | null;
  compact?: boolean;
}) {
  if (!subscriptions.length) {
    return (
      <MobileEmptyState
        title="No pending requests"
        description="Pending package requests and payment actions will appear here."
      />
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MobileText variant="section" weight="bold">
          Pending requests
        </MobileText>
        <MobileStatusBadge status="Pending" tone="warning" label={formatNumber(subscriptions.length)} />
      </View>
      {subscriptions.map((subscription) => {
        const amount = toNumber(subscription.amount);
        return (
          <MobileCard key={subscription.id} compact accent="orange">
            <View style={styles.pendingHeader}>
              <View style={styles.flex}>
                <MobileText variant="body" weight="bold" numberOfLines={1}>
                  {packageName(subscription)}
                </MobileText>
                <MobileText variant="small" tone="secondary" numberOfLines={compact ? 1 : 2}>
                  {subscriptionDescription(subscription)}
                </MobileText>
              </View>
              <MobileStatusBadge status={statusOf(subscription)} tone={statusToneFor(statusOf(subscription))} />
            </View>
            <MobileInfoRow label="Requested" value={formatDate(subscription.startDate || subscription.createdAt)} helper={billingLabel(cycleOf(subscription))} icon={Calendar} />
            <MobileInfoRow label="Amount" value={formatCurrency(amount, subscriptionCurrency(subscription))} helper={amount > 0 ? 'Payment can be opened securely.' : 'No payment required.'} icon={CreditCard} />
            {amount > 0 ? (
              <MobileButton
                label="Pay now"
                icon={CreditCard}
                loading={payingId === subscription.id}
                disabled={Boolean(payingId && payingId !== subscription.id)}
                onPress={() => onPayNow(subscription)}
              />
            ) : null}
          </MobileCard>
        );
      })}
    </View>
  );
}

function PackageCard({
  pkg,
  activeSubscription,
  pendingSubscriptions,
  onOpen,
}: {
  pkg: MembershipPackage;
  activeSubscription: MemberSubscription | null;
  pendingSubscriptions: MemberSubscription[];
  onOpen: () => void;
}) {
  const openRequest = [...(activeSubscription ? [activeSubscription] : []), ...pendingSubscriptions].some(
    (subscription) => subscriptionPackage(subscription)?.id === pkg.id,
  );

  return (
    <MobileCard compact accent={packageTone(pkg)}>
      <View style={styles.packageHeader}>
        <View style={styles.flex}>
          <MobileText variant="body" weight="bold" numberOfLines={1}>
            {pkg.name || 'Membership package'}
          </MobileText>
          <MobileText variant="small" tone="secondary" numberOfLines={2}>
            {pkg.description || 'No package description provided.'}
          </MobileText>
        </View>
        <MobileStatusBadge status={openRequest ? 'Active' : 'Available'} tone={openRequest ? 'success' : 'primary'} />
      </View>
      <View style={styles.priceRow}>
        <MobileText variant="value" weight="bold">
          {lowestPackagePriceLabel(pkg)}
        </MobileText>
        <MobileText variant="small" tone="secondary">
          {availableBillingCycles(pkg).map((cycle) => billingLabel(cycle)).join(', ') || 'Free'}
        </MobileText>
      </View>
      <BenefitsCard benefits={pkg.benefits || []} compact limit={3} />
      <MobileButton
        label={openRequest ? 'View details' : 'Choose package'}
        icon={openRequest ? Package : CheckCircle2}
        variant={openRequest ? 'secondary' : 'primary'}
        onPress={onOpen}
      />
    </MobileCard>
  );
}

function BenefitsCard({ benefits, compact, limit }: { benefits: string[]; compact?: boolean; limit?: number }) {
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
          <CheckCircle2 color="#15803D" size={15} strokeWidth={2.5} />
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

function billingSuffix(cycle?: string | null) {
  if (cycle === 'FREE') return '';
  return billingCycles.find((option) => option.value === cycle)?.suffix || '';
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

function subscriptionDescription(subscription: MemberSubscription) {
  return subscriptionPackage(subscription)?.description || 'Package subscription request.';
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

function subscriptionPeriod(subscription: MemberSubscription) {
  const start = formatDate(subscription.startDate || subscription.createdAt);
  const end = subscription.endDate ? ` to ${formatDate(subscription.endDate)}` : '';
  const suffix = billingSuffix(cycleOf(subscription));
  return `${start}${end}${suffix ? ` - ${suffix}` : ''}`;
}

function activeCurrency(subscription: MemberSubscription | null, packages: MembershipPackage[]) {
  return subscription ? subscriptionCurrency(subscription) : packages[0]?.currency || 'TZS';
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
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
  packageList: {
    gap: 12,
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
  footerActions: {
    flexDirection: 'row',
    gap: 10,
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
