import { router, useLocalSearchParams } from 'expo-router';
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileErrorState,
  MobileFormSection,
  MobileIconButton,
  MobileInfoRow,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAllAssociationMembers, type AssociationMember } from '@/services/member-service';
import { getActiveAssociationPackages, type MembershipPackage } from '@/services/package-service';
import {
  subscribeAllMembers,
  subscribeMemberAdminEnhanced,
  subscribeMultipleMembers,
  type BillingCycle,
  type BulkSubscriptionResponse,
} from '@/services/subscription-service';
import { type StatusTone, useNaneTheme } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatCurrency, formatNumber, initialsFromName } from '@/utils/format';

type MemberFilter = 'ALL' | 'SELECTED' | 'NO_PACKAGE' | 'WITH_PACKAGE';
type SubscribeMode = 'selected' | 'all' | null;

const billingCycleOptions = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BI_WEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUAL', label: 'Semi-annual' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'FREE', label: 'Free' },
];

export default function MobileSubscribeMemberScreen() {
  const params = useLocalSearchParams();
  const { activeView, associationId, user } = useAuth();
  const theme = useNaneTheme();
  const paramMemberId = firstParam(params.memberId);
  const paramPackageId = firstParam(params.packageId);
  const [members, setMembers] = useState<AssociationMember[]>([]);
  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(() => (paramMemberId ? new Set([paramMemberId]) : new Set()));
  const [selectedPackageId, setSelectedPackageId] = useState<string>(paramPackageId || '');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MemberFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const [confirmMode, setConfirmMode] = useState<SubscribeMode>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [startDate, setStartDate] = useState(todayIso());
  const [isFree, setIsFree] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canManageSubscriptions = useMemo(() => hasSubscriptionManagePermission(user), [user]);
  const selectedPackage = useMemo(() => packages.find((pkg) => pkg.id === selectedPackageId) || null, [packages, selectedPackageId]);
  const selectedMembers = useMemo(() => members.filter((member) => selectedMemberIds.has(member.id)), [members, selectedMemberIds]);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);

      setError(null);
      setFeatureUnavailable(false);
      try {
        const [packageRows, memberPage] = await Promise.all([
          getActiveAssociationPackages(associationId),
          getAllAssociationMembers(associationId, { size: 250, sort: 'fullLegalName,asc' }),
        ]);
        const activePackages = packageRows.filter((pkg) => pkg?.id && pkg.active !== false);
        setPackages(activePackages);
        setMembers(memberPage.content.filter((member) => Boolean(member?.id)));
        if (!selectedPackageId && activePackages[0]?.id) {
          setSelectedPackageId(activePackages[0].id);
          const firstCycle = availableBillingCycles(activePackages[0])[0]?.value;
          if (firstCycle) setBillingCycle(firstCycle);
        }
      } catch (loadError) {
        const message = getApiErrorMessage(loadError);
        setPackages([]);
        setMembers([]);
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
    [associationId, selectedPackageId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadData());
  }, [loadData]);

  const metrics = useMemo(() => {
    const withPackage = members.filter((member) => Boolean(member.packageId || member.packageName)).length;
    return {
      totalMembers: members.length,
      selected: selectedMemberIds.size,
      packages: packages.length,
      unassigned: Math.max(0, members.length - withPackage),
    };
  }, [members, packages.length, selectedMemberIds.size]);

  const tabs = useMemo(() => [
    { value: 'ALL', label: 'All', count: members.length },
    { value: 'SELECTED', label: 'Selected', count: selectedMemberIds.size },
    { value: 'NO_PACKAGE', label: 'No package', count: members.filter((member) => !member.packageId && !member.packageName).length },
    { value: 'WITH_PACKAGE', label: 'With package', count: members.filter((member) => Boolean(member.packageId || member.packageName)).length },
  ].filter((tab) => tab.value === 'ALL' || tab.count > 0), [members, selectedMemberIds.size]);

  const visibleMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members
      .filter((member) => {
        if (filter === 'SELECTED' && !selectedMemberIds.has(member.id)) return false;
        if (filter === 'NO_PACKAGE' && (member.packageId || member.packageName)) return false;
        if (filter === 'WITH_PACKAGE' && !member.packageId && !member.packageName) return false;
        if (!term) return true;
        return [
          member.fullLegalName,
          member.membershipNumber,
          member.contactInfo?.email,
          member.contactInfo?.phoneNumber,
          member.packageName,
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => String(a.fullLegalName || '').localeCompare(String(b.fullLegalName || '')));
  }, [filter, members, search, selectedMemberIds]);

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association workspace required" description="Member subscriptions are assigned from the association admin workspace." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message="Loading members and packages" />;
  }

  async function refresh() {
    await loadData('refresh');
  }

  function toggleMember(memberId: string) {
    setSelectedMemberIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  function selectPackage(pkg: MembershipPackage) {
    setSelectedPackageId(pkg.id);
    const valid: BillingCycle[] = availableBillingCycles(pkg).map((cycle) => cycle.value);
    if (valid.length > 0 && !valid.includes(billingCycle)) {
      setBillingCycle(valid[0]);
    }
  }

  function toggleAllVisible() {
    setSelectedMemberIds((current) => {
      const next = new Set(current);
      const allVisibleSelected = visibleMembers.length > 0 && visibleMembers.every((member) => next.has(member.id));
      visibleMembers.forEach((member) => {
        if (allVisibleSelected) next.delete(member.id);
        else next.add(member.id);
      });
      return next;
    });
  }

  function openConfirm(mode: SubscribeMode) {
    setFormError(null);
    if (!selectedPackage) {
      setFormError('Select an active package before subscribing members.');
      return;
    }
    if (mode === 'selected' && selectedMemberIds.size === 0) {
      setFormError('Select at least one member before continuing.');
      return;
    }
    if (mode === 'all' && members.length === 0) {
      setFormError('There are no members to subscribe.');
      return;
    }
    setConfirmMode(mode);
  }

  async function executeSubscription() {
    if (!associationId || !selectedPackage || !confirmMode) return;
    const validation = validateSubscriptionForm(startDate, selectedPackage, billingCycle, isFree);
    setFormError(validation);
    if (validation) return;

    setWorking(true);
    setError(null);
    try {
      const effectiveCycle = isFree ? 'FREE' : billingCycle;
      if (confirmMode === 'all') {
        const result = await subscribeAllMembers(associationId, selectedPackage.id, effectiveCycle, startDate, isFree);
        setNotice(formatBulkSubscriptionResult(result, members.length));
      } else {
        const ids = Array.from(selectedMemberIds);
        const useSingleEnhancedCalls = ids.length === 1 || isFree || startDate !== todayIso();
        if (useSingleEnhancedCalls) {
          let success = 0;
          const errors: string[] = [];
          for (const memberId of ids) {
            try {
              await subscribeMemberAdminEnhanced(memberId, selectedPackage.id, effectiveCycle, startDate, isFree);
              success += 1;
            } catch (singleError) {
              errors.push(getApiErrorMessage(singleError));
            }
          }
          if (success === 0 && errors.length > 0) throw new Error(errors[0]);
          setNotice(`Subscribed ${formatNumber(success)} selected member${success === 1 ? '' : 's'} to ${selectedPackage.name || 'package'}.${errors.length > 0 ? ` Failed: ${formatNumber(errors.length)}.` : ''}`);
        } else {
          await subscribeMultipleMembers(ids, selectedPackage.id, effectiveCycle);
          setNotice(`Subscribed ${formatNumber(ids.length)} selected member${ids.length === 1 ? '' : 's'} to ${selectedPackage.name || 'package'}.`);
        }
      }
      setConfirmMode(null);
      setSelectedMemberIds(new Set());
      await loadData('refresh');
    } catch (subscribeError) {
      setError(getApiErrorMessage(subscribeError));
    } finally {
      setWorking(false);
    }
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        title="Subscribe Members"
        eyebrow="Membership billing"
        subtitle="Assign active packages to selected members or the full association."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh data" onPress={refresh} disabled={refreshing} />}
      />

      {notice ? <MobileToast title={notice} tone="success" /> : null}
      {error ? <MobileErrorState title="Subscription failed" description={error} onRetry={refresh} /> : null}
      {formError ? <MobileToast title={formError} tone="warning" /> : null}

      {featureUnavailable ? (
        <FeatureUnavailableState onRefresh={refresh} />
      ) : (
        <>
          <MobileCard compact accent="blue">
            <View style={styles.compactStats}>
              <CompactStat icon={Users} value={formatNumber(metrics.totalMembers)} label="Members" tone="primary" />
              <CompactStat icon={UserCheck} value={formatNumber(metrics.selected)} label="Selected" tone="success" />
              <CompactStat icon={Package} value={formatNumber(metrics.packages)} label="Packages" tone="review" />
              <CompactStat icon={Clock3} value={formatNumber(metrics.unassigned)} label="Unassigned" tone="warning" />
            </View>
          </MobileCard>

          {!canManageSubscriptions ? (
            <MobileCard compact accent="orange" style={styles.noticeCard}>
              <ShieldAlert color={theme.colors.status.warning} size={20} />
              <View style={styles.noticeCopy}>
                <MobileText variant="small" weight="bold">
                  Read-only access
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Subscription assignment requires subscription management permission.
                </MobileText>
              </View>
            </MobileCard>
          ) : null}

          <MobileFormSection title="Package" description="Choose the active package members should receive.">
            {packages.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packageScroller}>
                {packages.map((pkg) => (
                  <PackageChoice
                    key={pkg.id}
                    pkg={pkg}
                    selected={pkg.id === selectedPackageId}
                    onPress={() => selectPackage(pkg)}
                  />
                ))}
              </ScrollView>
            ) : (
              <MobileEmptyState title="No active packages" description="Create and activate a package before assigning subscriptions." />
            )}
          </MobileFormSection>

          {selectedPackage ? (
            <MobileCard compact accent="blue">
              <View style={styles.selectedPackageHeader}>
                <View style={styles.noticeCopy}>
                  <MobileText variant="small" weight="bold">
                    {selectedPackage.name || 'Selected package'}
                  </MobileText>
                  <MobileText variant="small" tone="secondary">
                    {availableBillingCycles(selectedPackage).map((cycle) => `${cycle.label}: ${formatCurrency(cycle.amount, selectedPackage.currency || 'TZS')}`).join(' • ') || 'Free subscription only'}
                  </MobileText>
                </View>
                <MobileStatusBadge status="Active" tone="success" />
              </View>
            </MobileCard>
          ) : null}

          <MobileSearchToolbar value={search} onChange={setSearch} placeholder="Search members" />
          <MobileStatusTabs tabs={tabs} value={filter} onChange={(value) => setFilter(value as MemberFilter)} />

          <View style={styles.actionsRow}>
            <MobileButton
              label={visibleMembers.length > 0 && visibleMembers.every((member) => selectedMemberIds.has(member.id)) ? 'Unselect visible' : 'Select visible'}
              icon={Search}
              variant="secondary"
              onPress={toggleAllVisible}
              disabled={visibleMembers.length === 0}
            />
            <MobileButton label="Clear selected" variant="ghost" onPress={() => setSelectedMemberIds(new Set())} disabled={selectedMemberIds.size === 0} />
          </View>

          {visibleMembers.length > 0 ? (
            <View style={styles.list}>
              {visibleMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  selected={selectedMemberIds.has(member.id)}
                  onToggle={() => toggleMember(member.id)}
                />
              ))}
            </View>
          ) : (
            <MobileEmptyState title="No members found" description="Try another search term or member filter." />
          )}

          <MobileCard compact accent="blue">
            <View style={styles.subscribeFooter}>
              <View style={styles.noticeCopy}>
                <MobileText variant="small" weight="bold">
                  Subscription action
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Selected: {formatNumber(selectedMemberIds.size)} • Members available: {formatNumber(members.length)}
                </MobileText>
              </View>
              <View style={styles.footerActions}>
                <MobileButton
                  label="Selected"
                  icon={UserCheck}
                  onPress={() => openConfirm('selected')}
                  disabled={!canManageSubscriptions || !selectedPackage || selectedMemberIds.size === 0}
                />
                <MobileButton
                  label="All"
                  icon={Users}
                  variant="secondary"
                  onPress={() => openConfirm('all')}
                  disabled={!canManageSubscriptions || !selectedPackage || members.length === 0}
                />
              </View>
            </View>
          </MobileCard>
        </>
      )}

      <SubscribeConfirmSheet
        mode={confirmMode}
        pkg={selectedPackage}
        selectedCount={selectedMemberIds.size}
        totalMembers={members.length}
        selectedMembers={selectedMembers}
        billingCycle={billingCycle}
        startDate={startDate}
        isFree={isFree}
        working={working}
        onBillingCycleChange={setBillingCycle}
        onStartDateChange={(value) => {
          setStartDate(value);
          setFormError(null);
        }}
        onFreeChange={setIsFree}
        onClose={() => setConfirmMode(null)}
        onSubmit={executeSubscription}
      />
    </MobileScreen>
  );
}

function PackageChoice({ pkg, selected, onPress }: { pkg: MembershipPackage; selected: boolean; onPress: () => void }) {
  const theme = useNaneTheme();
  const cycles = availableBillingCycles(pkg);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.packageChoice,
        {
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={styles.packageChoiceHeader}>
        <View style={[styles.packageIcon, { backgroundColor: selected ? theme.colors.primary : theme.colors.status.review }]}>
          <Package color={theme.colors.onPrimary} size={18} strokeWidth={2.4} />
        </View>
        {selected ? <MobileStatusBadge status="Selected" tone="primary" /> : null}
      </View>
      <MobileText variant="body" weight="bold" numberOfLines={1}>
        {pkg.name || 'Package'}
      </MobileText>
      <MobileText variant="small" tone="secondary" numberOfLines={2}>
        {cycles.length > 0 ? `${cycles.length} paid cycle${cycles.length === 1 ? '' : 's'}` : 'Free package'}
      </MobileText>
      <MobileText variant="small" weight="bold">
        {startingPriceLabel(pkg)}
      </MobileText>
    </Pressable>
  );
}

function CompactStat({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tone: StatusTone;
}) {
  const theme = useNaneTheme();
  return (
    <View style={styles.compactStat}>
      <View style={[styles.compactStatIcon, { backgroundColor: theme.colors.status[tone] }]}>
        <Icon color={theme.colors.onPrimary} size={15} strokeWidth={2.5} />
      </View>
      <MobileText variant="body" weight="bold">
        {value}
      </MobileText>
      <MobileText variant="tiny" tone="secondary" numberOfLines={1}>
        {label}
      </MobileText>
    </View>
  );
}

function MemberRow({ member, selected, onToggle }: { member: AssociationMember; selected: boolean; onToggle: () => void }) {
  const theme = useNaneTheme();
  const hasPackage = Boolean(member.packageId || member.packageName);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.memberRow,
        {
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadow,
          opacity: pressed ? 0.84 : 1,
        },
      ]}
    >
      <View style={[styles.checkBox, { backgroundColor: selected ? theme.colors.primary : theme.colors.surface, borderColor: selected ? theme.colors.primary : theme.colors.borderStrong }]}>
        {selected ? <CheckCircle2 color={theme.colors.onPrimary} size={18} strokeWidth={2.8} /> : null}
      </View>
      <View style={[styles.avatar, { backgroundColor: hasPackage ? theme.colors.status.paid : theme.colors.status.neutral }]}>
        <MobileText variant="small" weight="bold" tone="inverse">
          {initialsFromName(member.fullLegalName || 'M')}
        </MobileText>
      </View>
      <View style={styles.rowMain}>
        <View style={styles.rowTitle}>
          <MobileText variant="body" weight="bold" numberOfLines={1} style={styles.rowTitleText}>
            {member.fullLegalName || 'Unnamed member'}
          </MobileText>
          <MobileStatusBadge status={hasPackage ? 'Has Package' : 'No Package'} tone={hasPackage ? 'paid' : 'neutral'} />
        </View>
        <MobileText variant="small" tone="secondary" numberOfLines={1}>
          {member.membershipNumber || 'No membership no.'} • {member.contactInfo?.email || member.contactInfo?.phoneNumber || 'No contact'}
        </MobileText>
        {member.packageName ? (
          <MobileText variant="small" weight="bold" numberOfLines={1}>
            Current: {member.packageName}
          </MobileText>
        ) : null}
      </View>
    </Pressable>
  );
}

function SubscribeConfirmSheet({
  mode,
  pkg,
  selectedCount,
  totalMembers,
  selectedMembers,
  billingCycle,
  startDate,
  isFree,
  working,
  onBillingCycleChange,
  onStartDateChange,
  onFreeChange,
  onClose,
  onSubmit,
}: {
  mode: SubscribeMode;
  pkg: MembershipPackage | null;
  selectedCount: number;
  totalMembers: number;
  selectedMembers: AssociationMember[];
  billingCycle: BillingCycle;
  startDate: string;
  isFree: boolean;
  working: boolean;
  onBillingCycleChange: (value: BillingCycle) => void;
  onStartDateChange: (value: string) => void;
  onFreeChange: (value: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!mode || !pkg) return null;
  const cycles = availableBillingCycles(pkg);
  const cycleOptions = cycles.length > 0 ? cycles.map((cycle) => ({ value: cycle.value, label: `${cycle.label} • ${formatCurrency(cycle.amount, pkg.currency || 'TZS')}` })) : billingCycleOptions;
  const effectiveCount = mode === 'all' ? totalMembers : selectedCount;
  const amount = isFree ? 0 : amountForCycle(pkg, billingCycle);
  const total = amount * effectiveCount;

  return (
    <MobileSheet
      visible={Boolean(mode)}
      title={mode === 'all' ? 'Subscribe all members?' : 'Subscribe selected members?'}
      description={`${pkg.name || 'Package'} • ${formatNumber(effectiveCount)} member${effectiveCount === 1 ? '' : 's'}`}
      onClose={onClose}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
        {mode === 'all' ? (
          <MobileCard compact accent="orange">
            <MobileText variant="small" weight="bold">
              This action applies to the full association
            </MobileText>
            <MobileText variant="small" tone="secondary">
              The backend skips members who already have an active or pending subscription and returns success, skipped, and failed counts.
            </MobileText>
          </MobileCard>
        ) : selectedMembers.length > 0 && selectedMembers.length <= 6 ? (
          <MobileFormSection title="Selected preview" description="A short preview of members that will be subscribed.">
            {selectedMembers.slice(0, 6).map((member) => (
              <MobileInfoRow key={member.id} label={member.fullLegalName || 'Unnamed member'} value={member.membershipNumber || member.contactInfo?.email || 'Selected'} icon={UserCheck} />
            ))}
          </MobileFormSection>
        ) : null}

        <MobileFormSection title="Billing setup" description="Choose how this subscription should start and be charged.">
          <MobileTextInput
            label="Start date"
            value={startDate}
            onChangeText={onStartDateChange}
            placeholder="YYYY-MM-DD"
            helperText="Use the backend date format, for example 2026-07-05."
            icon={CalendarClock}
            autoCapitalize="none"
          />
          <MobileSelect
            label="Billing cycle"
            value={billingCycle}
            options={cycleOptions}
            onChange={(value) => onBillingCycleChange(value as BillingCycle)}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isFree }}
            onPress={() => onFreeChange(!isFree)}
            style={styles.freeRow}
          >
            <MobileStatusBadge status={isFree ? 'Free' : 'Paid'} tone={isFree ? 'success' : 'neutral'} />
            <View style={styles.noticeCopy}>
              <MobileText variant="small" weight="bold">
                Make this subscription free
              </MobileText>
              <MobileText variant="small" tone="secondary">
                Free subscriptions are activated without creating an amount to collect.
              </MobileText>
            </View>
          </Pressable>
        </MobileFormSection>

        <MobileCard compact accent={isFree ? 'green' : 'blue'}>
          <MobileInfoRow label="Package" value={pkg.name || 'Selected package'} icon={Package} />
          <MobileInfoRow label="Members" value={formatNumber(effectiveCount)} icon={Users} />
          <MobileInfoRow label="Cycle" value={isFree ? 'Free' : cycleLabel(billingCycle)} icon={CalendarClock} />
          <MobileInfoRow label="Amount per member" value={formatCurrency(amount, pkg.currency || 'TZS')} icon={Banknote} />
          <MobileInfoRow label="Cycle total" value={formatCurrency(total, pkg.currency || 'TZS')} icon={Banknote} />
        </MobileCard>
      </ScrollView>

      <View style={styles.sheetActions}>
        <MobileButton label="Cancel" variant="secondary" onPress={onClose} />
        <MobileButton label="Confirm subscription" loading={working} onPress={onSubmit} fullWidth style={styles.flexButton} />
      </View>
    </MobileSheet>
  );
}

function FeatureUnavailableState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <MobileCard compact accent="orange">
      <View style={styles.featureState}>
        <ShieldAlert size={26} />
        <View style={styles.featureCopy}>
          <MobileText variant="section" weight="bold">
            Package subscriptions are not enabled here
          </MobileText>
          <MobileText variant="body" tone="secondary">
            The backend currently enables package subscription assignment for eligible generic associations. Continue using the other association workflows in this workspace.
          </MobileText>
        </View>
        <MobileButton label="Refresh" icon={RefreshCw} variant="secondary" onPress={onRefresh} />
      </View>
    </MobileCard>
  );
}

function availableBillingCycles(pkg: MembershipPackage) {
  return [
    { value: 'WEEKLY' as const, label: 'Weekly', amount: amountNumber(pkg.weeklyAmount) },
    { value: 'BI_WEEKLY' as const, label: 'Bi-weekly', amount: amountNumber(pkg.biWeeklyAmount) },
    { value: 'MONTHLY' as const, label: 'Monthly', amount: amountNumber(pkg.monthlyAmount) },
    { value: 'QUARTERLY' as const, label: 'Quarterly', amount: amountNumber(pkg.quarterlyAmount) },
    { value: 'SEMI_ANNUAL' as const, label: 'Semi-annual', amount: amountNumber(pkg.semiAnnualAmount) },
    { value: 'ANNUAL' as const, label: 'Annual', amount: amountNumber(pkg.annualAmount) },
  ].filter((cycle) => cycle.amount > 0);
}

function amountForCycle(pkg: MembershipPackage, cycle: BillingCycle) {
  if (cycle === 'WEEKLY') return amountNumber(pkg.weeklyAmount);
  if (cycle === 'BI_WEEKLY') return amountNumber(pkg.biWeeklyAmount);
  if (cycle === 'QUARTERLY') return amountNumber(pkg.quarterlyAmount);
  if (cycle === 'SEMI_ANNUAL') return amountNumber(pkg.semiAnnualAmount);
  if (cycle === 'ANNUAL') return amountNumber(pkg.annualAmount);
  if (cycle === 'FREE') return 0;
  return amountNumber(pkg.monthlyAmount);
}

function startingPriceLabel(pkg: MembershipPackage) {
  const first = availableBillingCycles(pkg).sort((a, b) => a.amount - b.amount)[0];
  return first ? `${formatCurrency(first.amount, pkg.currency || 'TZS')} ${first.label}` : 'Free';
}

function validateSubscriptionForm(startDate: string, pkg: MembershipPackage, billingCycle: BillingCycle, isFree: boolean) {
  const parsed = new Date(`${startDate}T00:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(parsed.getTime())) {
    return 'Enter a valid start date in YYYY-MM-DD format.';
  }
  if (!isFree && billingCycle !== 'FREE' && amountForCycle(pkg, billingCycle) <= 0) {
    return 'The selected package does not have an amount for that billing cycle.';
  }
  return null;
}

function formatBulkSubscriptionResult(result: BulkSubscriptionResponse, fallbackTotal: number) {
  const considered = amountNumber(result.totalMembersConsidered) || fallbackTotal;
  const success = amountNumber(result.successfullySubscribed);
  const skipped = amountNumber(result.skippedAlreadySubscribed);
  const failed = amountNumber(result.failedSubscriptions);
  return `Processed ${formatNumber(considered)} members. Subscribed: ${formatNumber(success)}, skipped: ${formatNumber(skipped)}, failed: ${formatNumber(failed)}.`;
}

function hasSubscriptionManagePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || ''].map((value) => value.toLowerCase());
  return values.some((value) => [
    'subscriptions.manage',
    'subscriptions_manage',
    'members.manage',
    'members_manage',
    'association_admin',
    'admin',
  ].includes(value));
}

function isFeatureUnavailable(message: string) {
  return /ASSOCIATION_TYPE_FORBIDDEN|not available for this association type|forbidden/i.test(message);
}

function amountNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function cycleLabel(cycle: BillingCycle) {
  if (cycle === 'BI_WEEKLY') return 'Bi-weekly';
  if (cycle === 'SEMI_ANNUAL') return 'Semi-annual';
  return cycle.charAt(0) + cycle.slice(1).toLowerCase();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noticeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  compactStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  compactStat: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 92,
    gap: 3,
  },
  compactStatIcon: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  packageScroller: {
    gap: 10,
    paddingRight: 18,
  },
  packageChoice: {
    width: 224,
    minHeight: 152,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  packageChoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  packageIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPackageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  list: {
    gap: 10,
  },
  memberRow: {
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOpacity: 0.015,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0,
  },
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitleText: {
    flex: 1,
  },
  subscribeFooter: {
    gap: 12,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetContent: {
    gap: 14,
    paddingBottom: 6,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  freeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureState: {
    alignItems: 'flex-start',
    gap: 14,
  },
  featureCopy: {
    gap: 6,
  },
});
