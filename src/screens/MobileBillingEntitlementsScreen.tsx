import { router, useLocalSearchParams } from 'expo-router';
import {
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Info,
  ListChecks,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getCurrentBillingEntitlements,
  type BillingEntitlements,
  type BillingFeatureEntitlement,
} from '@/services/billing-entitlement-service';
import { labelFromStatus } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type FeatureFilter = 'all' | 'available' | 'blocked';

export default function MobileBillingEntitlementsScreen() {
  const params = useLocalSearchParams();
  const { activeView, user } = useAuth();
  const [entitlements, setEntitlements] = useState<BillingEntitlements | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<BillingFeatureEntitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FeatureFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [handledPreviewFeatureKey, setHandledPreviewFeatureKey] = useState<string | null>(null);

  const previewFeatureKey = Array.isArray(params.featureKey) ? params.featureKey[0] : params.featureKey;
  const canViewBilling = useMemo(() => hasBillingEntitlementPermission(user), [user]);

  const loadEntitlements = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    setNotice(null);

    try {
      const response = await getCurrentBillingEntitlements();
      setEntitlements({
        ...response,
        features: Array.isArray(response.features) ? response.features : [],
      });
      if (mode === 'refresh') setNotice('Billing access refreshed.');
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      if (mode === 'initial') setEntitlements(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadEntitlements();
    });
    return () => {
      active = false;
    };
  }, [loadEntitlements]);

  const features = useMemo(() => entitlements?.features || [], [entitlements?.features]);

  useEffect(() => {
    if (!previewFeatureKey || handledPreviewFeatureKey === previewFeatureKey || features.length === 0) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const feature = features.find((item) => item.featureKey === previewFeatureKey || item.featureId === previewFeatureKey);
      if (!feature) return;
      setSelectedFeature(feature);
      setHandledPreviewFeatureKey(previewFeatureKey);
    });
    return () => {
      active = false;
    };
  }, [features, handledPreviewFeatureKey, previewFeatureKey]);

  const metrics = useMemo(() => {
    const available = features.filter((feature) => feature.available).length;
    const blocked = features.length - available;
    const overrides = features.filter((feature) => feature.overrideEnabled !== null && typeof feature.overrideEnabled !== 'undefined').length;
    return {
      available,
      blocked,
      total: features.length,
      overrides,
      accessActive: Boolean(entitlements?.subscriptionAllowsAccess),
    };
  }, [entitlements?.subscriptionAllowsAccess, features]);

  const filteredFeatures = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return features.filter((feature) => {
      if (filter === 'available' && !feature.available) return false;
      if (filter === 'blocked' && feature.available) return false;
      if (!query) return true;
      return [
        feature.featureName,
        feature.featureKey,
        feature.groupKey,
        feature.denialReason,
        feature.limitUnit,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [features, filter, searchTerm]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: metrics.total },
      { value: 'available', label: 'Allowed', count: metrics.available },
      { value: 'blocked', label: 'Blocked', count: metrics.blocked },
    ],
    [metrics.available, metrics.blocked, metrics.total],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredFeatures.map((feature) => ({
        id: feature.featureId || `${feature.featureKey}-${feature.groupKey || 'feature'}`,
        title: feature.featureName || displayText(feature.featureKey, 'Feature'),
        subtitle: feature.featureKey,
        meta: `${displayText(feature.groupKey, 'General')} · ${formatLimit(feature)}`,
        status: feature.available ? 'Allowed' : 'Blocked',
        statusTone: feature.available ? 'success' : 'danger',
        accent: feature.available ? 'success' : 'danger',
      })),
    [filteredFeatures],
  );

  const openSupport = async () => {
    const subject = encodeURIComponent('Nane billing access support');
    const body = encodeURIComponent(
      `Association: ${entitlements?.associationName || 'Not loaded'}\nPlan: ${entitlements?.planName || 'No plan assigned'}\nStatus: ${entitlements?.subscriptionStatus || 'No subscription'}\n`,
    );
    await Linking.openURL(`mailto:support@nane.co.tz?subject=${subject}&body=${body}`);
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Billing entitlements" description="Billing access is available from association admin workspaces only." />;
  }

  if (!canViewBilling) {
    return <AccessDeniedScreen title="Billing entitlements" description="Your role cannot view billing entitlements for this association." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading billing access" />;
  }

  if (error && !entitlements) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Settings"
          title="Nane billing"
          subtitle="Plan and feature access"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" onPress={() => void loadEntitlements('refresh')} />}
        />
        <MobileErrorState title="Billing access unavailable" description={error} retryLabel="Retry" onRetry={() => void loadEntitlements('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Nane billing"
        subtitle="Current plan, access status, and feature availability."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh" variant="secondary" disabled={refreshing} onPress={() => void loadEntitlements('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Billing access" description={notice} tone="success" /> : null}

      <MobileCard compact accent={metrics.accessActive ? 'green' : 'orange'}>
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: metrics.accessActive ? '#15803D' : '#C2410C' }]}>
            {metrics.accessActive ? <CheckCircle2 color="#FFFFFF" size={22} strokeWidth={2.5} /> : <XCircle color="#FFFFFF" size={22} strokeWidth={2.5} />}
          </View>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {entitlements?.planName || 'No plan assigned'}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {entitlements?.planCode || 'Managed by Nane Admin'} · {displayText(entitlements?.subscriptionStatus, 'No subscription')}
            </MobileText>
          </View>
          <MobileStatusBadge status={metrics.accessActive ? 'Active' : 'Restricted'} tone={metrics.accessActive ? 'success' : 'warning'} />
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Plan" value={entitlements?.planName ? shortText(entitlements.planName) : 'No plan'} description={entitlements?.planCode || 'Managed by admin'} icon={CircleDollarSign} tone={entitlements?.planName ? 'blue' : 'orange'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Access" value={metrics.accessActive ? 'Active' : 'Restricted'} description={displayText(entitlements?.subscriptionStatus, 'No subscription')} icon={ShieldCheck} tone={metrics.accessActive ? 'green' : 'orange'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Features" value={`${formatNumber(metrics.available)} / ${formatNumber(metrics.total)}`} description={metrics.blocked > 0 ? `${formatNumber(metrics.blocked)} blocked` : 'All available'} icon={ListChecks} tone={metrics.blocked > 0 ? 'orange' : 'green'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Association" value={displayText(entitlements?.associationType, 'Unknown')} description={entitlements?.associationName || 'Current workspace'} icon={Building2} tone="slate" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.sectionHeader}>
          <View style={styles.flex}>
            <MobileText variant="body" weight="bold">
              Feature access
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              Evaluated {formatDate(entitlements?.evaluatedAt)}. Access until {formatDate(entitlements?.accessUntil)}.
            </MobileText>
          </View>
          <MobileStatusBadge status={`${metrics.overrides} overrides`} tone={metrics.overrides > 0 ? 'info' : 'neutral'} />
        </View>
      </MobileCard>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search features, groups, reasons..." />
      <MobileStatusTabs tabs={tabs} value={filter} onChange={(value) => setFilter(value as FeatureFilter)} />

      {listItems.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const feature = filteredFeatures.find((candidate) => (candidate.featureId || `${candidate.featureKey}-${candidate.groupKey || 'feature'}`) === item.id);
            if (feature) setSelectedFeature(feature);
          }}
        />
      ) : (
        <MobileEmptyState
          title={features.length ? 'No features match this view' : 'No billing features configured'}
          description={features.length ? 'Change the search or status filter to see more feature access rules.' : 'When Nane Admin assigns billing features, they will appear here.'}
        />
      )}

      <MobileCard compact accent="slate">
        <View style={styles.infoRow}>
          <Info color="#475569" size={18} strokeWidth={2.4} />
          <View style={styles.flex}>
            <MobileText variant="small" tone="secondary">
              Plan assignment, overrides, invoices, and upgrades are managed from Admin Billing. Association admins can view the effective access here.
            </MobileText>
          </View>
        </View>
        <MobileButton label="Contact support" icon={Mail} variant="secondary" size="sm" onPress={() => void openSupport()} />
      </MobileCard>

      <FeatureDetailSheet feature={selectedFeature} onClose={() => setSelectedFeature(null)} />
    </MobileScreen>
  );
}

type FeatureDetailSheetProps = {
  feature: BillingFeatureEntitlement | null;
  onClose: () => void;
};

function FeatureDetailSheet({ feature, onClose }: FeatureDetailSheetProps) {
  const configKeys = feature?.config && typeof feature.config === 'object' ? Object.keys(feature.config) : [];
  return (
    <MobileSheet visible={Boolean(feature)} title={feature?.featureName || 'Feature access'} description={feature?.featureKey || 'Billing entitlement'} onClose={onClose}>
      {feature ? (
        <View style={styles.sheetContent}>
          <MobileCard compact accent={feature.available ? 'green' : 'red'}>
            <View style={styles.detailHeader}>
              <View style={styles.flex}>
                <MobileText variant="section" weight="bold" numberOfLines={2}>
                  {feature.featureName || displayText(feature.featureKey, 'Feature')}
                </MobileText>
                <MobileText variant="small" tone="secondary" numberOfLines={2}>
                  {displayText(feature.groupKey, 'General')} group
                </MobileText>
              </View>
              <MobileStatusBadge status={feature.available ? 'Allowed' : 'Blocked'} tone={feature.available ? 'success' : 'danger'} />
            </View>
          </MobileCard>

          <MobileInfoRow label="Feature key" value={feature.featureKey || 'Not set'} icon={Search} />
          <MobileInfoRow label="Plan inclusion" value={feature.planIncluded ? 'Included in plan' : 'Not included'} icon={ListChecks} status={feature.planIncluded ? 'Included' : 'Excluded'} />
          <MobileInfoRow label="Override" value={overrideLabel(feature.overrideEnabled)} icon={ShieldCheck} status={overrideLabel(feature.overrideEnabled)} />
          <MobileInfoRow label="Limit" value={formatLimit(feature)} icon={CircleDollarSign} />
          <MobileInfoRow label="Reason" value={feature.denialReason || (feature.available ? 'Available in current subscription' : 'No reason provided')} icon={Info} />
          {configKeys.length > 0 ? <MobileInfoRow label="Config keys" value={configKeys.join(', ')} icon={Info} /> : null}
        </View>
      ) : null}
    </MobileSheet>
  );
}

function hasBillingEntitlementPermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string; systemRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || '', user?.systemRole || ''].map((value) => value.toLowerCase());
  return values.some((value) =>
    [
      'billing.entitlements.view',
      'billing_entitlements_view',
      'platform_admin',
      'association_admin',
      'admin',
    ].includes(value),
  );
}

function formatLimit(feature: BillingFeatureEntitlement) {
  if (feature.limitValue === null || typeof feature.limitValue === 'undefined' || feature.limitValue === '') return 'No limit';
  const numericValue = Number(feature.limitValue);
  const value = Number.isFinite(numericValue) ? formatNumber(numericValue) : String(feature.limitValue);
  return `${value}${feature.limitUnit ? ` ${feature.limitUnit}` : ''}`;
}

function displayText(value: string | null | undefined, fallback = '-') {
  const normalized = String(value || '').replace(/[._-]+/g, ' ').trim();
  if (!normalized) return fallback;
  return labelFromStatus(normalized);
}

function shortText(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return 'None';
  if (text.length <= 14) return text;
  return `${text.slice(0, 13)}...`;
}

function overrideLabel(value?: boolean | null) {
  if (value === true) return 'Enabled';
  if (value === false) return 'Disabled';
  return 'None';
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  sheetContent: {
    gap: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
});
