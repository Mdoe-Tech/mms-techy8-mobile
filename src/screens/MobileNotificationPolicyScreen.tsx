import {
  BellRing,
  MessageSquare,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileCheckboxRow,
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
  MobileSearchToolbar,
  MobileSheet,
  MobileStatusTabs,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getCurrentNotificationPolicy,
  updateCurrentNotificationPolicy,
  type NotificationCategoryPolicy,
  type NotificationPolicy,
} from '@/services/notification-policy-service';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber } from '@/utils/format';

type CategoryDraft = Record<string, { smsEnabled: boolean; emailEnabled: boolean; pushEnabled: boolean }>;

type MobileNotificationPolicyScreenProps = {
  initialGroup?: string;
  initialMode?: 'detail' | 'confirm';
};

const groupOrder = ['Membership', 'Community', 'Engagement', 'Governance', 'Finance', 'Loans', 'Approvals', 'CRM', 'Platform'];

export default function MobileNotificationPolicyScreen({ initialGroup, initialMode }: MobileNotificationPolicyScreenProps) {
  const { activeView, user } = useAuth();
  const [policy, setPolicy] = useState<NotificationPolicy | null>(null);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>({});
  const [activeGroup, setActiveGroup] = useState(initialGroup || 'all');
  const [query, setQuery] = useState('');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const handledInitialModeRef = useRef(false);

  const canUpdate = useMemo(() => hasPolicyPermission(user, 'write'), [user]);

  const applyPolicy = useCallback((nextPolicy: NotificationPolicy) => {
    setPolicy(nextPolicy);
    setSmsEnabled(Boolean(nextPolicy.sms.enabled));
    setEmailEnabled(Boolean(nextPolicy.email.enabled));
    setPushEnabled(Boolean(nextPolicy.push.enabled));
    setCategoryDraft(
      Object.fromEntries(
        nextPolicy.categories.map((category) => [
          category.key,
          {
            smsEnabled: Boolean(category.sms.enabled),
            emailEnabled: Boolean(category.email.enabled),
            pushEnabled: Boolean(category.push.enabled),
          },
        ]),
      ),
    );
  }, []);

  const loadPolicy = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      if (mode === 'refresh') setNotice(null);

      try {
        const nextPolicy = await getCurrentNotificationPolicy();
        applyPolicy(nextPolicy);
        if (mode === 'refresh') setNotice('Notification policy refreshed.');
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyPolicy],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadPolicy('initial'));
  }, [loadPolicy]);

  const categories = useMemo(() => policy?.categories || [], [policy?.categories]);
  const groups = useMemo(() => orderedGroups(categories), [categories]);
  const visibleCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return categories.filter((category) => {
      const groupMatch = activeGroup === 'all' || category.group === activeGroup;
      if (!groupMatch) return false;
      if (!normalizedQuery) return true;
      return [category.label, category.description, category.group, category.key].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [activeGroup, categories, query]);

  useEffect(() => {
    if (loading || handledInitialModeRef.current || !policy) return;
    if (initialMode === 'detail') {
      const first = visibleCategories[0] || categories[0];
      if (first) {
        handledInitialModeRef.current = true;
        void Promise.resolve().then(() => setSelectedCategoryKey(first.key));
      }
    } else if (initialMode === 'confirm') {
      handledInitialModeRef.current = true;
      void Promise.resolve().then(() => setConfirmSave(true));
    }
  }, [categories, initialMode, loading, policy, visibleCategories]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.key === selectedCategoryKey) || null,
    [categories, selectedCategoryKey],
  );

  const metrics = useMemo(() => {
    const managed = categories.filter((category) => category.associationManaged);
    const platform = categories.length - managed.length;
    const disabledCategoryChannels = categories.reduce((sum, category) => {
      const draft = categoryDraft[category.key] || { smsEnabled: category.sms.enabled, emailEnabled: category.email.enabled, pushEnabled: category.push.enabled };
      return sum + (draft.smsEnabled ? 0 : 1) + (draft.emailEnabled ? 0 : 1) + (draft.pushEnabled ? 0 : 1);
    }, 0);
    return {
      masterChannels: Number(smsEnabled) + Number(emailEnabled) + Number(pushEnabled),
      managed: managed.length,
      platform,
      disabledCategoryChannels,
    };
  }, [categories, categoryDraft, emailEnabled, pushEnabled, smsEnabled]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: categories.length },
      ...groups.map((group) => ({
        value: group,
        label: group,
        count: categories.filter((category) => category.group === group).length,
      })),
    ],
    [categories, groups],
  );

  const items = useMemo<MobileDataListItem[]>(
    () =>
      visibleCategories.map((category) => {
        const draft = categoryDraft[category.key] || { smsEnabled: category.sms.enabled, emailEnabled: category.email.enabled, pushEnabled: category.push.enabled };
        const state = channelState(draft.smsEnabled, draft.emailEnabled, draft.pushEnabled, category.associationManaged);
        return {
          id: category.key,
          title: category.label,
          subtitle: category.description,
          meta: `${category.group} - ${category.associationManaged ? 'Association managed' : 'Platform managed'}`,
          status: state.status,
          statusLabel: state.label,
          statusTone: state.tone,
          initials: channelInitials(draft.smsEnabled, draft.emailEnabled, draft.pushEnabled),
          accent: state.accent,
        };
      }),
    [categoryDraft, visibleCategories],
  );

  const updateCategory = (categoryKey: string, patch: Partial<{ smsEnabled: boolean; emailEnabled: boolean; pushEnabled: boolean }>) => {
    setCategoryDraft((current) => ({
      ...current,
      [categoryKey]: {
        smsEnabled: current[categoryKey]?.smsEnabled ?? true,
        emailEnabled: current[categoryKey]?.emailEnabled ?? true,
        pushEnabled: current[categoryKey]?.pushEnabled ?? true,
        ...patch,
      },
    }));
    setNotice(null);
  };

  const savePolicy = async () => {
    if (!policy || !canUpdate) return;
    setSaving(true);
    setError(null);
    try {
      const nextPolicy = await updateCurrentNotificationPolicy({
        smsEnabled,
        emailEnabled,
        pushEnabled,
        categories: Object.fromEntries(
          policy.categories
            .filter((category) => category.associationManaged)
            .map((category) => [
              category.key,
              {
                smsEnabled: categoryDraft[category.key]?.smsEnabled ?? category.sms.enabled,
                emailEnabled: categoryDraft[category.key]?.emailEnabled ?? category.email.enabled,
                pushEnabled: categoryDraft[category.key]?.pushEnabled ?? category.push.enabled,
              },
            ]),
        ),
      });
      applyPolicy(nextPolicy);
      setConfirmSave(false);
      setNotice('Notification policy saved.');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Notification policy" description="Notification delivery policy is available from association admin workspaces only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading notification policy" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Configuration"
        title="Notification policy"
        subtitle="Manage SMS, email, and push delivery by module"
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Reload policy"
            variant="secondary"
            disabled={refreshing || saving}
            onPress={() => void loadPolicy('refresh')}
          />
        }
      />

      {error ? <MobileErrorState title="Notification policy issue" description={error} retryLabel="Reload policy" onRetry={() => void loadPolicy('refresh')} /> : null}
      {notice ? <MobileToast title={notice} /> : null}
      {!canUpdate ? <MobileToast title="Read-only access" description="This account can view policy but cannot update notification settings." tone="warning" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Master channels" value={`${metrics.masterChannels}/3`} description="SMS, email, and push enabled" icon={BellRing} tone={metrics.masterChannels === 3 ? 'green' : 'orange'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Association rules" value={formatNumber(metrics.managed)} description="Editable module policies" icon={SlidersHorizontal} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Platform rules" value={formatNumber(metrics.platform)} description="System-managed policies" icon={ShieldCheck} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Disabled paths" value={formatNumber(metrics.disabledCategoryChannels)} description="Category channel switches off" icon={MessageSquare} tone={metrics.disabledCategoryChannels ? 'orange' : 'green'} />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileFormSection title="Master delivery" description="These switches control association-wide delivery before category rules are checked.">
        <MobileCheckboxRow
          label="Enable SMS delivery"
          description={policy?.sms.settingKey || 'notifications.sms.enabled'}
          checked={smsEnabled}
          onChange={setSmsEnabled}
          disabled={!canUpdate || saving || !policy?.sms.editable}
        />
        <MobileCheckboxRow
          label="Enable email delivery"
          description={policy?.email.settingKey || 'notifications.email.enabled'}
          checked={emailEnabled}
          onChange={setEmailEnabled}
          disabled={!canUpdate || saving || !policy?.email.editable}
        />
        <MobileCheckboxRow
          label="Enable push alerts"
          description={policy?.push.settingKey || 'notifications.push.enabled'}
          checked={pushEnabled}
          onChange={setPushEnabled}
          disabled={!canUpdate || saving || !policy?.push.editable}
        />
      </MobileFormSection>

      <MobileCard compact style={styles.toolbarCard}>
        <MobileSearchToolbar value={query} onChange={setQuery} placeholder="Search category, group, or setting..." />
        <MobileStatusTabs tabs={tabs} value={activeGroup} onChange={setActiveGroup} />
      </MobileCard>

      {items.length ? (
        <MobileDataList items={items} onPressItem={(item) => setSelectedCategoryKey(item.id)} />
      ) : (
        <MobileEmptyState title="No policy categories" description="No notification categories match the current search and group filters." />
      )}

      <View style={styles.actions}>
        <MobileButton label="Save notification policy" icon={Save} loading={saving} disabled={!canUpdate || saving || !policy} fullWidth onPress={() => setConfirmSave(true)} />
      </View>

      <CategoryPolicySheet
        category={selectedCategory}
        draft={selectedCategory ? categoryDraft[selectedCategory.key] : undefined}
        canUpdate={canUpdate}
        saving={saving}
        onClose={() => setSelectedCategoryKey(null)}
        onChange={updateCategory}
      />

      <MobileConfirmSheet
        visible={confirmSave}
        title="Save notification policy"
        description="Apply the current SMS, email, push, and category delivery settings for this association."
        confirmLabel="Save policy"
        loading={saving}
        onCancel={() => setConfirmSave(false)}
        onConfirm={() => void savePolicy()}
      />
    </MobileScreen>
  );
}

function CategoryPolicySheet({
  category,
  draft,
  canUpdate,
  saving,
  onClose,
  onChange,
}: {
  category: NotificationCategoryPolicy | null;
  draft?: { smsEnabled: boolean; emailEnabled: boolean; pushEnabled: boolean };
  canUpdate: boolean;
  saving: boolean;
  onClose: () => void;
  onChange: (categoryKey: string, patch: Partial<{ smsEnabled: boolean; emailEnabled: boolean; pushEnabled: boolean }>) => void;
}) {
  if (!category) return null;
  const smsEnabled = draft?.smsEnabled ?? category.sms.enabled;
  const emailEnabled = draft?.emailEnabled ?? category.email.enabled;
  const pushEnabled = draft?.pushEnabled ?? category.push.enabled;
  const categoryEditable = category.associationManaged && canUpdate;

  return (
    <MobileSheet visible={Boolean(category)} title={category.label} description={category.description} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
        <MobileInfoRow label="Group" value={category.group} icon={BellRing} />
        <MobileInfoRow label="Owner" value={category.associationManaged ? 'Association' : 'Platform'} helper={category.associationManaged ? 'Editable by association admins with configuration access.' : 'Protected by Nane platform policy.'} icon={ShieldCheck} />
        <MobileInfoRow label="Setting key" value={category.key} icon={SlidersHorizontal} />

        <MobileFormSection title="Category delivery" description="These settings apply after the master SMS, email, and push switches.">
          <MobileCheckboxRow
            label="SMS for this category"
            description={category.sms.settingKey}
            checked={smsEnabled}
            onChange={(checked) => onChange(category.key, { smsEnabled: checked })}
            disabled={saving || !categoryEditable || !category.sms.editable}
          />
          <MobileCheckboxRow
            label="Email for this category"
            description={category.email.settingKey}
            checked={emailEnabled}
            onChange={(checked) => onChange(category.key, { emailEnabled: checked })}
            disabled={saving || !categoryEditable || !category.email.editable}
          />
          <MobileCheckboxRow
            label="Push alerts for this category"
            description={category.push.settingKey}
            checked={pushEnabled}
            onChange={(checked) => onChange(category.key, { pushEnabled: checked })}
            disabled={saving || !categoryEditable || !category.push.editable}
          />
        </MobileFormSection>

        {!categoryEditable ? (
          <MobileText variant="small" tone="secondary">
            This policy is read-only for the current session.
          </MobileText>
        ) : null}
      </ScrollView>
    </MobileSheet>
  );
}

function orderedGroups(categories: NotificationCategoryPolicy[]) {
  const groups = Array.from(new Set(categories.map((category) => category.group)));
  return groups.sort((a, b) => {
    const aIndex = groupOrder.indexOf(a);
    const bIndex = groupOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

function channelState(smsEnabled: boolean, emailEnabled: boolean, pushEnabled: boolean, associationManaged: boolean) {
  if (!associationManaged) {
    return { label: 'Platform', status: 'platform', tone: 'review' as const, accent: 'review' as const };
  }
  if (smsEnabled && emailEnabled && pushEnabled) {
    return { label: 'All on', status: 'active', tone: 'success' as const, accent: 'primary' as const };
  }
  if (smsEnabled || emailEnabled || pushEnabled) {
    return { label: 'Partial', status: 'partial', tone: 'warning' as const, accent: 'warning' as const };
  }
  return { label: 'Off', status: 'inactive', tone: 'danger' as const, accent: 'danger' as const };
}

function channelInitials(smsEnabled: boolean, emailEnabled: boolean, pushEnabled: boolean) {
  if (smsEnabled && emailEnabled && pushEnabled) return 'SEP';
  if (smsEnabled && emailEnabled) return 'SE';
  if (smsEnabled && pushEnabled) return 'SP';
  if (emailEnabled && pushEnabled) return 'EP';
  if (smsEnabled) return 'S';
  if (emailEnabled) return 'E';
  if (pushEnabled) return 'P';
  return 'Off';
}

function hasPolicyPermission(user: ReturnType<typeof useAuth>['user'], scope: 'read' | 'write') {
  if (!user) return false;
  if (user.isTechy8Admin) return true;
  const values = [...(user.permissions || []), ...(user.roles || []), user.associationRole || '', user.systemRole || '']
    .filter(Boolean)
    .map((value) => value.toLowerCase().replace(/[\s-]+/g, '_'));
  const adminValues = ['admin', 'association_admin', 'system_admin'];
  if (values.some((value) => adminValues.includes(value))) return true;
  if (scope === 'read') return values.some((value) => ['config_read', 'settings.view', 'settings_view'].includes(value));
  return values.some((value) => ['config_write', 'settings.update', 'settings_update'].includes(value));
}

const styles = StyleSheet.create({
  toolbarCard: {
    gap: 12,
  },
  actions: {
    gap: 10,
  },
  sheetContent: {
    gap: 14,
    paddingBottom: 8,
  },
});
