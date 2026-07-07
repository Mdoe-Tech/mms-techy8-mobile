import { router } from 'expo-router';
import {
  ArrowUpCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Package,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDetailHeader,
  MobileEmptyState,
  MobileErrorState,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSelect,
  MobileStatusBadge,
  MobileSummaryPanel,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getCurrentMemberByUserId, type AssociationMember } from '@/services/member-service';
import { getMembershipPackageById, type MembershipPackage } from '@/services/package-service';
import {
  createSubscriptionPaymentLink,
  getCurrentMemberSubscriptions,
  subscribeCurrentMember,
  type BillingCycle,
  type MemberSubscription,
} from '@/services/subscription-service';
import { type KpiTone, type StatusTone, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

type PackageState = 'CURRENT' | 'PENDING' | 'INACTIVE' | 'AVAILABLE';
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

type MobileMemberPackageSubscribeScreenProps = {
  packageId?: string;
};

export default function MobileMemberPackageSubscribeScreen({ packageId }: MobileMemberPackageSubscribeScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const theme = useNaneTheme();
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [packageData, setPackageData] = useState<MembershipPackage | null>(null);
  const [subscriptions, setSubscriptions] = useState<MemberSubscription[]>([]);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const packagesRoute = getRouteByPath('/member/packages');
  const subscriptionRoute = getRouteByPath('/member/subscription');
  const userId = user?.userId;
  const associationType = String(user?.associationType || '').toUpperCase();
  const genericSupported = associationType === 'GENERIC';

  const loadPackage = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId || !associationId) {
        setLoading(false);
        setLoadError('Member and association context are required before opening package details.');
        return;
      }

      if (!packageId) {
        setLoading(false);
        setLoadError('A package ID is required to open this detail page.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      setFeatureUnavailable(false);
      setNotice(null);

      try {
        const currentMember = await getCurrentMemberByUserId(userId);
        setMember(currentMember);

        if (!genericSupported) {
          setPackageData(null);
          setSubscriptions([]);
          setFeatureUnavailable(true);
          return;
        }

        const [pkg, subscriptionPage] = await Promise.all([
          getMembershipPackageById(packageId),
          getCurrentMemberSubscriptions(associationId, { size: 100 }),
        ]);

        if (pkg.associationId && pkg.associationId !== associationId) {
          throw new Error('This package belongs to a different association.');
        }

        setPackageData(pkg);
        setSelectedBillingCycle(defaultBillingCycle(pkg));
        setSubscriptions((subscriptionPage.content || []).filter((subscription) => Boolean(subscription?.id)));
      } catch (error) {
        const message = getApiErrorMessage(error);
        setPackageData(null);
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
    [associationId, genericSupported, packageId, userId],
  );

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(() => loadPackage());
    }
  }, [activeView, loadPackage]);

  const activeSubscription = useMemo(
    () => sortSubscriptions(subscriptions).find((subscription) => statusOf(subscription) === 'ACTIVE') || null,
    [subscriptions],
  );
  const packageSubscription = useMemo(
    () =>
      sortSubscriptions(subscriptions).find((subscription) => {
        const status = statusOf(subscription);
        return subscriptionPackage(subscription)?.id === packageData?.id && (status === 'ACTIVE' || status === 'PENDING');
      }) || null,
    [packageData?.id, subscriptions],
  );
  const state = packageState(packageData, packageSubscription);
  const selectedAmount = amountForCycle(packageData, selectedBillingCycle);
  const cycles = packageData ? availableBillingCycles(packageData) : [];
  const priceRows = packageData ? pricingRows(packageData) : [];
  const canSubmit = packageData && state === 'AVAILABLE' && !submitting;
  const submitLabel = activeSubscription ? 'Request change' : 'Subscribe';

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Member workspace required"
        description="Package subscription details are available from the member portal workspace."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="detail" message="Loading package details" />;
  }

  if (featureUnavailable) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Membership"
          title="Subscribe Package"
          subtitle={user?.associationName || 'Member portal'}
          onBack={goBackToPackages}
          rightAction={<MobileStatusBadge status="Unavailable" tone="warning" />}
        />
        <MobileEmptyState
          title="Package subscriptions are not enabled here"
          description="Membership package subscriptions are available for Generic associations. This association uses a different contribution model."
          actionLabel="Back to packages"
          onAction={goBackToPackages}
        />
        <MobileCard compact accent="blue">
          <MobileInfoRow label="Association type" value={associationType || 'Not provided'} helper="The backend restricts package subscription workflows to Generic associations." icon={ShieldAlert} />
          <MobileInfoRow label="Member" value={memberName(member, user?.fullName)} helper={member?.membershipNumber || user?.email || 'Current member'} icon={UserRound} />
        </MobileCard>
      </MobileScreen>
    );
  }

  if (loadError || !packageData) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Membership"
          title="Subscribe Package"
          subtitle={user?.associationName || 'Member portal'}
          onBack={goBackToPackages}
          rightAction={<MobileButton label="Retry" icon={RefreshCw} size="sm" variant="secondary" onPress={() => void loadPackage('refresh')} />}
        />
        <MobileErrorState
          title="Package details could not load"
          description={loadError || 'The selected package was not found.'}
          retryLabel="Retry"
          onRetry={() => void loadPackage('refresh')}
        />
        <MobileButton label="Back to packages" icon={Package} variant="secondary" fullWidth onPress={goBackToPackages} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Membership"
        title="Subscribe Package"
        subtitle={member?.membershipNumber || user?.associationName || 'Member portal'}
        onBack={goBackToPackages}
        rightAction={<MobileStatusBadge status={stateLabel(state)} tone={stateStatusTone(state)} />}
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone || 'success'} /> : null}

      <MobileDetailHeader
        eyebrow="Package detail"
        title={packageData.name || 'Membership package'}
        subtitle={packageData.description || 'No package description provided.'}
        status={stateLabel(state)}
        statusTone={stateStatusTone(state)}
        avatarName={packageData.name || 'Package'}
        avatarTone={state === 'CURRENT' ? 'success' : state === 'PENDING' ? 'warning' : 'primary'}
      />

      <MobileSummaryPanel
        title={selectedBillingCycle === 'FREE' ? 'Free package' : `${billingLabel(selectedBillingCycle)} billing`}
        value={formatCurrency(selectedAmount, packageData.currency || 'TZS')}
        description={selectedBillingCycle === 'FREE' ? 'No payment is required for this package.' : billingSuffix(selectedBillingCycle)}
        icon={CreditCard}
        tone={stateKpiTone(state)}
        footer={
          <View style={styles.summaryActions}>
            <MobileButton label="Packages" icon={Package} variant="secondary" size="sm" onPress={goBackToPackages} style={styles.summaryButton} />
            <MobileButton label="Subscription" icon={WalletCards} variant="ghost" size="sm" onPress={goToSubscription} style={styles.summaryButton} />
            <MobileButton
              label="Refresh"
              icon={RefreshCw}
              variant="ghost"
              size="sm"
              loading={refreshing}
              disabled={refreshing || submitting || paying}
              onPress={() => void loadPackage('refresh')}
              style={styles.summaryButton}
            />
          </View>
        }
      />

      <MobileCard compact accent={stateKpiTone(state)} style={styles.actionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="small" tone="secondary" weight="bold">
              Subscription action
            </MobileText>
            <MobileText variant="body" weight="bold">
              {actionTitle(state, activeSubscription)}
            </MobileText>
          </View>
          <MobileStatusBadge status={stateLabel(state)} tone={stateStatusTone(state)} />
        </View>

        <MobileSelect
          label="Billing cycle"
          value={selectedBillingCycle}
          options={billingCycleOptions(packageData)}
          onChange={(value) => setSelectedBillingCycle(value as BillingCycle)}
          disabled={state !== 'AVAILABLE'}
          helperText={state === 'AVAILABLE' ? 'Choose the billing cycle before confirming.' : disabledHelper(state, packageSubscription)}
        />

        {state === 'PENDING' && packageSubscription ? (
          <MobileButton
            label="Pay now"
            icon={CreditCard}
            loading={paying}
            fullWidth
            onPress={() => void handlePayNow(packageSubscription)}
          />
        ) : (
          <MobileButton
            label={state === 'AVAILABLE' ? submitLabel : stateLabel(state)}
            icon={state === 'AVAILABLE' ? ArrowUpCircle : CheckCircle2}
            loading={submitting}
            disabled={!canSubmit}
            fullWidth
            onPress={() => setConfirmOpen(true)}
          />
        )}
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Starting at" value={lowestPackagePriceLabel(packageData)} description="Lowest option" icon={CreditCard} tone={packageTone(packageData)} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Cycles" value={formatNumber(cycles.length)} description="Billing options" icon={Clock3} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members" value={formatNumber(toNumber(packageData.memberCount))} description="Current package" icon={UsersRound} tone={toNumber(packageData.memberCount) > 0 ? 'purple' : 'slate'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Updated" value={shortDate(packageData.updatedAt || packageData.createdAt)} description="Package changes" icon={CalendarDays} tone="teal" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <BenefitsCard benefits={packageData.benefits || []} iconColor={theme.colors.status.success} />

      <MobileCard compact accent="blue">
        <View style={styles.sectionHeader}>
          <View>
            <MobileText variant="section" weight="bold">
              Pricing Options
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Selectable billing cycles configured for this package.
            </MobileText>
          </View>
        </View>
        <View style={styles.priceList}>
          {priceRows.map((row) => (
            <View key={row.value} style={[styles.priceRow, { borderColor: theme.colors.border }]}>
              <View style={styles.flex}>
                <MobileText variant="body" weight="bold">
                  {row.label}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {row.suffix || 'No recurring interval'}
                </MobileText>
              </View>
              <MobileText variant="body" weight="bold" style={{ color: theme.colors.kpi[row.tone] }}>
                {row.amountLabel}
              </MobileText>
            </View>
          ))}
        </View>
      </MobileCard>

      <MobileCard compact accent="slate">
        <MobileInfoRow label="Association" value={packageData.associationName || user?.associationName || 'Current association'} helper={packageData.associationId || associationId || 'Association context'} icon={Package} />
        <MobileInfoRow label="Member" value={memberName(member, user?.fullName)} helper={member?.membershipNumber || user?.email || 'Current member'} icon={UserRound} />
        <MobileInfoRow label="Created" value={formatDate(packageData.createdAt)} helper={`Updated ${formatDate(packageData.updatedAt)}`} icon={CalendarDays} />
      </MobileCard>

      <MobileConfirmSheet
        visible={confirmOpen}
        title={activeSubscription ? 'Request package change?' : 'Confirm subscription?'}
        description={`${packageData.name || 'Package'} - ${billingLabel(selectedBillingCycle)} for ${formatCurrency(selectedAmount, packageData.currency || 'TZS')}.`}
        confirmLabel={submitLabel}
        loading={submitting}
        onCancel={() => {
          if (!submitting) setConfirmOpen(false);
        }}
        onConfirm={handleSubscribe}
      />
    </MobileScreen>
  );

  function goBackToPackages() {
    if (packagesRoute) {
      router.push({ pathname: '/work/route-preview', params: { routeId: packagesRoute.id } } as never);
      return;
    }
    router.back();
  }

  function goToSubscription() {
    if (subscriptionRoute) {
      router.push({ pathname: '/work/route-preview', params: { routeId: subscriptionRoute.id } } as never);
      return;
    }
    router.back();
  }

  async function handleSubscribe() {
    if (!packageData || !associationId) return;
    if (state !== 'AVAILABLE') {
      setConfirmOpen(false);
      setNotice({
        title: 'Package cannot be selected',
        description: disabledHelper(state, packageSubscription),
        tone: 'warning',
      });
      return;
    }

    setSubmitting(true);
    try {
      const subscribedMember = await subscribeCurrentMember(packageData.id, selectedBillingCycle);
      if (selectedAmount > 0 && subscribedMember.id) {
        const paymentLink = await createSubscriptionPaymentLink({
          memberId: subscribedMember.id,
          associationId,
          amount: selectedAmount,
          currency: packageData.currency || 'TZS',
          purpose: 'SUBSCRIPTION',
          description: `Subscription - ${packageData.name || 'Package'} (${selectedBillingCycle})`,
        });

        if (paymentLink.url) {
          await Linking.openURL(paymentLink.url);
          setNotice({ title: 'Subscription created', description: 'Opening the secure payment page.' });
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
      await loadPackage('refresh');
    } catch (error) {
      setNotice({
        title: 'Could not submit request',
        description: getApiErrorMessage(error),
        tone: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePayNow(subscription: MemberSubscription) {
    const pkg = subscriptionPackage(subscription) || packageData;
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
        description: 'This subscription is marked as free.',
        tone: 'info',
      });
      return;
    }

    setPaying(true);
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
      setPaying(false);
    }
  }
}

function BenefitsCard({ benefits, iconColor }: { benefits: string[]; iconColor: string }) {
  if (!benefits.length) {
    return (
      <MobileCard compact accent="slate">
        <MobileInfoRow label="Benefits" value="Not specified" helper="Package benefits have not been listed." icon={Sparkles} />
      </MobileCard>
    );
  }

  return (
    <MobileCard compact accent="green">
      <MobileText variant="section" weight="bold">
        Package Benefits
      </MobileText>
      <View style={styles.benefits}>
        {benefits.map((benefit, index) => (
          <View key={`${benefit}-${index}`} style={styles.benefitRow}>
            <CheckCircle2 color={iconColor} size={16} strokeWidth={2.5} />
            <MobileText variant="small" tone="secondary" style={styles.flex}>
              {benefit}
            </MobileText>
          </View>
        ))}
      </View>
    </MobileCard>
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

function pricingRows(pkg: MembershipPackage) {
  const cycles = availableBillingCycles(pkg);
  return cycles.map((cycle) => {
    const amount = amountForCycle(pkg, cycle);
    return {
      value: cycle,
      label: billingLabel(cycle),
      suffix: billingSuffix(cycle),
      amount,
      amountLabel: formatCurrency(amount, pkg.currency || 'TZS'),
      tone: amount <= 0 ? 'green' : 'blue',
    } satisfies { value: BillingCycle; label: string; suffix: string; amount: number; amountLabel: string; tone: KpiTone };
  });
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

function statusOf(subscription: MemberSubscription) {
  return String(subscription.status || 'UNKNOWN').toUpperCase();
}

function cycleOf(subscription: MemberSubscription): BillingCycle {
  const cycle = String(subscription.billingCycle || 'MONTHLY').toUpperCase();
  return (cycle === 'FREE' || billingCycles.some((option) => option.value === cycle) ? cycle : 'MONTHLY') as BillingCycle;
}

function packageState(pkg: MembershipPackage | null, subscription: MemberSubscription | null): PackageState {
  if (subscription && statusOf(subscription) === 'ACTIVE') return 'CURRENT';
  if (subscription && statusOf(subscription) === 'PENDING') return 'PENDING';
  if (pkg?.active === false) return 'INACTIVE';
  return 'AVAILABLE';
}

function stateLabel(state: PackageState) {
  if (state === 'CURRENT') return 'Current';
  if (state === 'PENDING') return 'Pending';
  if (state === 'INACTIVE') return 'Inactive';
  return 'Available';
}

function stateStatusTone(state: PackageState): StatusTone {
  if (state === 'CURRENT') return 'success';
  if (state === 'PENDING') return 'warning';
  if (state === 'INACTIVE') return 'neutral';
  return 'primary';
}

function stateKpiTone(state: PackageState): KpiTone {
  if (state === 'CURRENT') return 'green';
  if (state === 'PENDING') return 'orange';
  if (state === 'INACTIVE') return 'slate';
  return 'blue';
}

function packageTone(pkg: MembershipPackage): KpiTone {
  const price = lowestPackagePrice(pkg);
  if (price <= 0) return 'green';
  if (toNumber(pkg.memberCount) > 0) return 'purple';
  return 'blue';
}

function actionTitle(state: PackageState, activeSubscription: MemberSubscription | null) {
  if (state === 'CURRENT') return 'You are subscribed to this package';
  if (state === 'PENDING') return 'This package request is pending';
  if (state === 'INACTIVE') return 'This package is not available';
  return activeSubscription ? 'Request a package change' : 'Subscribe to this package';
}

function disabledHelper(state: PackageState, subscription: MemberSubscription | null) {
  if (state === 'CURRENT') return 'This is already your active package.';
  if (state === 'PENDING') return subscription?.amount ? 'Finish payment or wait for approval from My subscription.' : 'Wait for approval from My subscription.';
  if (state === 'INACTIVE') return 'Inactive packages cannot receive new subscriptions.';
  return 'Choose the billing cycle before confirming.';
}

function memberName(member: AssociationMember | null, fallback = 'Current member') {
  return member?.fullLegalName || fallback;
}

function sortSubscriptions(subscriptions: MemberSubscription[]) {
  return [...subscriptions].sort((left, right) => dateValue(right.createdAt || right.startDate) - dateValue(left.createdAt || left.startDate));
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function shortDate(value?: string | null) {
  const formatted = formatDate(value);
  return formatted === 'Not available' ? 'N/A' : formatted.replace(/\\s\\d{4}$/, '');
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
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryButton: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 126,
  },
  actionCard: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefits: {
    gap: 9,
    marginTop: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  priceList: {
    gap: 0,
  },
  priceRow: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
