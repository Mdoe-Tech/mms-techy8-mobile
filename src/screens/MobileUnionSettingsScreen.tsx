import { router } from 'expo-router';
import {
  AlertTriangle,
  CalendarClock,
  Percent,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileConfirmSheet,
  MobileDataList,
  type MobileDataListItem,
  MobileEmptyState,
  MobileErrorState,
  MobileFormSection,
  MobileIconButton,
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSelect,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAssociationProfile, type AssociationProfile } from '@/services/association-service';
import {
  getUnionDeductions,
  getUnionSettings,
  updateUnionSettings,
  type UnionDeduction,
  type UnionSettings,
} from '@/services/union-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber, formatPercent, formatTzs, initialsFromName } from '@/utils/format';

type UnionSettingsTab = 'settings' | 'impact';
type UnionSettingsMode = 'confirm';

type UnionSettingsForm = {
  enabled: string;
  rate: string;
};

type MobileUnionSettingsScreenProps = {
  initialTab?: UnionSettingsTab;
  initialMode?: UnionSettingsMode;
};

export default function MobileUnionSettingsScreen({
  initialTab,
  initialMode,
}: MobileUnionSettingsScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const [tab, setTab] = useState<UnionSettingsTab>(initialTab || 'settings');
  const [profile, setProfile] = useState<AssociationProfile | null>(null);
  const [settings, setSettings] = useState<UnionSettings | null>(null);
  const [deductions, setDeductions] = useState<UnionDeduction[]>([]);
  const [form, setForm] = useState<UnionSettingsForm>({ enabled: 'false', rate: '0' });
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const handledInitialModeRef = useRef(false);

  const canManageSettings = useMemo(() => hasUnionSettingsPermission(user), [user]);
  const isUnionAssociation = String(profile?.type || user?.associationType || '').toUpperCase() === 'UNION';

  const loadSettings = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading union settings.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      if (mode === 'refresh') setNotice(null);

      try {
        const loadedProfile = await getAssociationProfile(associationId);
        setProfile(loadedProfile);

        if (String(loadedProfile.type || '').toUpperCase() !== 'UNION') {
          setSettings(null);
          setDeductions([]);
          setForm({ enabled: 'false', rate: '0' });
          return;
        }

        const [loadedSettings, loadedDeductions] = await Promise.all([
          getUnionSettings(associationId),
          getUnionDeductions(associationId).catch(() => []),
        ]);
        setSettings(loadedSettings);
        setDeductions(loadedDeductions);
        setForm({
          enabled: String(loadedSettings.enabled),
          rate: String(loadedSettings.rate),
        });
        setFormError(null);
        if (mode === 'refresh') setNotice('Union settings refreshed.');
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadSettings('initial'));
  }, [loadSettings]);

  useEffect(() => {
    if (loading || handledInitialModeRef.current || initialMode !== 'confirm' || !canManageSettings || !isUnionAssociation) return;
    handledInitialModeRef.current = true;
    void Promise.resolve().then(() => setConfirmSave(true));
  }, [canManageSettings, initialMode, isUnionAssociation, loading]);

  const metrics = useMemo(() => {
    const enabled = form.enabled === 'true';
    const rate = parseRate(form.rate);
    const activeMembers = new Set(deductions.map((deduction) => deduction.member?.id).filter(Boolean)).size;
    const totalDeductions = deductions.reduce((sum, deduction) => sum + deduction.amount, 0);
    return {
      enabled,
      rate,
      activeMembers,
      deductionRows: deductions.length,
      totalDeductions,
      keys: Object.keys(settings?.rawSettings || {}).filter((key) => key.startsWith('union.')).length,
    };
  }, [deductions, form.enabled, form.rate, settings?.rawSettings]);

  const tabs = useMemo(
    () => [
      { value: 'settings', label: 'Settings', count: metrics.enabled ? 1 : 0 },
      { value: 'impact', label: 'Impact', count: metrics.deductionRows },
    ],
    [metrics.deductionRows, metrics.enabled],
  );

  const recentDeductions = useMemo<MobileDataListItem[]>(
    () =>
      deductions.slice(0, 5).map((deduction) => ({
        id: deduction.id,
        title: deduction.member?.fullLegalName || 'Union member',
        subtitle: deduction.member?.membershipNumber || 'No membership number',
        meta: formatDate(deduction.deductionPeriod || deduction.createdAt),
        amount: formatTzs(deduction.amount),
        status: 'Published',
        statusLabel: 'Deduction',
        statusTone: 'info',
        initials: initialsFromName(deduction.member?.fullLegalName || 'Union Member'),
        accent: 'info',
      })),
    [deductions],
  );

  const updateForm = (patch: Partial<UnionSettingsForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setFormError(null);
    setNotice(null);
  };

  const requestSave = () => {
    if (!canManageSettings) {
      setError('Your role cannot update union settings.');
      return;
    }
    const errorMessage = validateForm(form);
    setFormError(errorMessage);
    if (errorMessage) return;
    setConfirmSave(true);
  };

  const saveSettings = async () => {
    if (!associationId || !settings) return;
    const errorMessage = validateForm(form);
    setFormError(errorMessage);
    if (errorMessage) {
      setConfirmSave(false);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateUnionSettings(associationId, settings.rawSettings, {
        enabled: form.enabled === 'true',
        rate: parseRate(form.rate),
      });
      setSettings((current) => ({
        ...(current || updated),
        ...updated,
      }));
      setConfirmSave(false);
      setNotice('Union salary deduction settings saved.');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Union settings" description="Union settings are available for association admin workspaces only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message="Loading union settings" />;
  }

  if (!isUnionAssociation) {
    return (
      <AccessDeniedScreen
        title="Union settings"
        description={`${profile?.name || 'This association'} is not configured as a UNION association, so salary percentage deduction settings do not apply.`}
      />
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Union settings"
        subtitle="Configure salary-based monthly deductions"
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh union settings"
            variant="secondary"
            disabled={refreshing || saving}
            onPress={() => void loadSettings('refresh')}
          />
        }
      />

      {error ? <MobileErrorState title="Union settings issue" description={error} retryLabel="Reload" onRetry={() => void loadSettings('refresh')} /> : null}
      {notice ? <MobileToast title={notice} /> : null}
      {!canManageSettings ? (
        <MobileToast title="Read-only access" description="This account needs settings update permission to change salary deductions." tone="warning" />
      ) : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Salary deduction" value={metrics.enabled ? 'Enabled' : 'Off'} description={metrics.enabled ? 'Monthly percentage active' : 'No salary percentage deduction'} icon={ShieldCheck} tone={metrics.enabled ? 'green' : 'slate'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Deduction rate" value={formatPercent(metrics.rate)} description="Applied to salary-like member attributes" icon={Percent} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Deduction rows" value={formatNumber(metrics.deductionRows)} description={`${formatTzs(metrics.totalDeductions)} recorded`} icon={CalendarClock} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Members touched" value={formatNumber(metrics.activeMembers)} description={`${formatNumber(metrics.keys)} union config keys`} icon={Users} tone="orange" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs tabs={tabs} value={tab} onChange={(value) => setTab(value === 'impact' ? 'impact' : 'settings')} />

      {tab === 'settings' ? (
        <View style={styles.stack}>
          <MobileCard compact accent="orange" style={styles.sectionCard}>
            <View style={styles.warningRow}>
              <AlertTriangle color="#C2410C" size={19} />
              <View style={styles.flex}>
                <MobileText variant="body" weight="bold">
                  Scheduled deduction setting
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  These values are consumed by the monthly reminder job when it creates salary percentage deductions for UNION members.
                </MobileText>
              </View>
            </View>
          </MobileCard>

          <MobileFormSection title="Salary deduction" description="Deduct a percentage of salary monthly for union members.">
            <MobileSelect
              label="Enable salary percentage deductions"
              value={form.enabled}
              options={[
                { label: 'Yes, deduct by salary percentage', value: 'true' },
                { label: 'No, keep disabled', value: 'false' },
              ]}
              onChange={(enabled) => updateForm({ enabled })}
              disabled={!canManageSettings || saving}
            />
            <MobileTextInput
              label="Deduction rate (%)"
              value={form.rate}
              onChangeText={(rate) => updateForm({ rate })}
              placeholder="0"
              helperText="Use numbers only. Example: 5 means 5% of salary."
              error={formError || undefined}
              keyboardType="decimal-pad"
              icon={Percent}
              disabled={!canManageSettings || saving}
            />
          </MobileFormSection>

          <MobileButton
            label="Save settings"
            icon={Save}
            loading={saving}
            disabled={!canManageSettings || saving}
            fullWidth
            onPress={requestSave}
          />
        </View>
      ) : null}

      {tab === 'impact' ? (
        <View style={styles.stack}>
          <MobileCard compact style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.flex}>
                <MobileText variant="section" weight="bold">
                  Current impact
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {profile?.name || 'Union association'}
                </MobileText>
              </View>
              <MobileStatusBadge status={metrics.enabled ? 'Active' : 'Inactive'} label={metrics.enabled ? 'Enabled' : 'Off'} tone={metrics.enabled ? 'success' : 'neutral'} />
            </View>
            <MobileInfoRow label="Config key" value="union.deduction.percent.enabled" helper={String(metrics.enabled)} icon={SlidersHorizontal} />
            <MobileInfoRow label="Config key" value="union.deduction.percent.rate" helper={formatPercent(metrics.rate)} icon={Percent} />
            <MobileInfoRow label="Recorded deductions" value={formatNumber(metrics.deductionRows)} helper={`${formatTzs(metrics.totalDeductions)} total in loaded records.`} icon={CalendarClock} />
          </MobileCard>

          <MobileCard compact style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.flex}>
                <MobileText variant="section" weight="bold">
                  Recent deductions
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Latest loaded union deduction records.
                </MobileText>
              </View>
            </View>
            {recentDeductions.length ? (
              <MobileDataList items={recentDeductions} showChevron={false} />
            ) : (
              <MobileEmptyState title="No deductions loaded" description="Salary percentage deductions will appear after monthly deduction processing creates records." />
            )}
          </MobileCard>
        </View>
      ) : null}

      <MobileConfirmSheet
        visible={confirmSave}
        title="Save union settings"
        description={`Set salary percentage deductions to ${form.enabled === 'true' ? 'enabled' : 'off'} at ${formatPercent(parseRate(form.rate))}. This affects future scheduled deduction generation.`}
        confirmLabel="Save settings"
        loading={saving}
        onCancel={() => setConfirmSave(false)}
        onConfirm={() => void saveSettings()}
      />
    </MobileScreen>
  );
}

function validateForm(form: UnionSettingsForm) {
  const rate = Number(form.rate);
  if (!Number.isFinite(rate) || rate < 0) return 'Deduction rate must be zero or higher.';
  if (rate > 100) return 'Deduction rate cannot be above 100%.';
  return null;
}

function parseRate(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function hasUnionSettingsPermission(user: ReturnType<typeof useAuth>['user']) {
  if (!user) return false;
  if (user.isTechy8Admin) return true;
  const values = [...(user.permissions || []), ...(user.roles || []), user.associationRole || '', user.systemRole || '']
    .filter(Boolean)
    .map((value) => value.toLowerCase().replace(/[\s-]+/g, '_'));
  return values.some((value) =>
    [
      'settings.update',
      'settings_update',
      'config.write',
      'config_write',
      'union.settings',
      'union_settings',
      'platform_admin',
      'association_admin',
      'admin',
      'system_admin',
    ].includes(value),
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  sectionCard: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
