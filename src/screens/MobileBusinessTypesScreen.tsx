import { router, useLocalSearchParams } from 'expo-router';
import { BriefcaseBusiness, Edit3, EyeOff, Plus, RefreshCw, Save, Search, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  MobileSearchToolbar,
  MobileSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  createBusinessType,
  deleteBusinessType,
  getBusinessTypes,
  updateBusinessType,
  type BusinessType,
} from '@/services/business-type-service';
import { getApiErrorMessage } from '@/types/api';
import { formatNumber } from '@/utils/format';

type BusinessTypeFilter = 'all' | 'enabled' | 'disabled';
type FormSheet = { mode: 'create' } | { mode: 'edit'; item: BusinessType } | null;
type ConfirmAction = { type: 'delete'; item: BusinessType } | { type: 'toggle'; item: BusinessType } | null;

export default function MobileBusinessTypesScreen() {
  const params = useLocalSearchParams();
  const { activeView, user } = useAuth();
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([]);
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<BusinessTypeFilter>('all');
  const [formSheet, setFormSheet] = useState<FormSheet>(null);
  const [displayName, setDisplayName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [handledPreviewId, setHandledPreviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const previewMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const previewId = Array.isArray(params.businessTypeId) ? params.businessTypeId[0] : params.businessTypeId;
  const canManage = useMemo(() => hasSettingsUpdatePermission(user), [user]);

  const loadBusinessTypes = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const rows = await getBusinessTypes();
      setBusinessTypes([...rows].sort(sortBusinessTypes));
    } catch (loadError) {
      setBusinessTypes([]);
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const openCreateForm = useCallback(() => {
    setNotice(null);
    setError(null);
    setSelectedType(null);
    setDisplayName('');
    setFormError(null);
    setFormSheet({ mode: 'create' });
  }, []);

  const openEditForm = useCallback((item: BusinessType) => {
    setNotice(null);
    setError(null);
    setSelectedType(null);
    setDisplayName(item.displayName || '');
    setFormError(null);
    setFormSheet({ mode: 'edit', item });
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadBusinessTypes();
    });
    return () => {
      active = false;
    };
  }, [loadBusinessTypes]);

  useEffect(() => {
    if (loading) return;
    const previewKey = `${previewMode || 'detail'}:${previewId || 'none'}`;
    if (handledPreviewId === previewKey) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (previewMode === 'create') {
        openCreateForm();
        setHandledPreviewId(previewKey);
        return;
      }
      if (!previewId) return;
      const item = businessTypes.find((candidate) => candidate.id === previewId || candidate.value === previewId);
      if (!item) return;
      if (previewMode === 'edit') openEditForm(item);
      else setSelectedType(item);
      setHandledPreviewId(previewKey);
    });
    return () => {
      active = false;
    };
  }, [businessTypes, handledPreviewId, loading, openCreateForm, openEditForm, previewId, previewMode]);

  const metrics = useMemo(() => {
    const enabled = businessTypes.filter((item) => item.enabled).length;
    const disabled = businessTypes.length - enabled;
    return {
      total: businessTypes.length,
      enabled,
      disabled,
      generatedValues: new Set(businessTypes.map((item) => item.value).filter(Boolean)).size,
    };
  }, [businessTypes]);

  const filteredTypes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return businessTypes.filter((item) => {
      if (filter === 'enabled' && !item.enabled) return false;
      if (filter === 'disabled' && item.enabled) return false;
      if (!query) return true;
      return [item.displayName, item.value].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [businessTypes, filter, searchTerm]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: metrics.total },
      { value: 'enabled', label: 'Enabled', count: metrics.enabled },
      { value: 'disabled', label: 'Disabled', count: metrics.disabled },
    ],
    [metrics.disabled, metrics.enabled, metrics.total],
  );

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredTypes.map((item) => ({
        id: item.id,
        title: item.displayName || displayNameFromValue(item.value),
        subtitle: item.value || 'No value generated',
        meta: item.enabled ? 'Visible in member business profiles' : 'Hidden from new selections',
        status: item.enabled ? 'Enabled' : 'Disabled',
        statusTone: item.enabled ? 'success' : 'neutral',
        accent: item.enabled ? 'success' : 'neutral',
      })),
    [filteredTypes],
  );

  const closeForm = () => {
    setFormSheet(null);
    setDisplayName('');
    setFormError(null);
  };

  const saveBusinessType = async () => {
    if (!canManage) {
      setError('Your role cannot update business types.');
      return;
    }
    const cleaned = displayName.trim();
    if (!cleaned) {
      setFormError('Display name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        displayName: cleaned,
        value: formatBusinessTypeValue(cleaned),
        enabled: formSheet?.mode === 'edit' ? Boolean(formSheet.item.enabled) : true,
      };
      if (formSheet?.mode === 'edit') {
        await updateBusinessType(formSheet.item.id, payload);
        setNotice('Business type updated.');
      } else {
        await createBusinessType(payload);
        setNotice('Business type added.');
      }
      closeForm();
      await loadBusinessTypes('refresh');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    if (!canManage) {
      setError('Your role cannot update business types.');
      setConfirmAction(null);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (confirmAction.type === 'delete') {
        await deleteBusinessType(confirmAction.item.id);
        setNotice('Business type deleted.');
      } else {
        const nextEnabled = !confirmAction.item.enabled;
        await updateBusinessType(confirmAction.item.id, {
          value: confirmAction.item.value,
          displayName: confirmAction.item.displayName,
          enabled: nextEnabled,
        });
        setNotice(`Business type ${nextEnabled ? 'enabled' : 'disabled'}.`);
      }
      setSelectedType(null);
      await loadBusinessTypes('refresh');
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setConfirmAction(null);
      setSaving(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Business types" description="Business type settings are available from association admin workspaces only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading business types" />;
  }

  if (error && businessTypes.length === 0 && !notice) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Settings"
          title="Business types"
          subtitle="Member profile categories"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" disabled={refreshing} onPress={() => void loadBusinessTypes('refresh')} />}
        />
        <MobileErrorState title="Business types could not load" description={error} retryLabel="Retry" onRetry={() => void loadBusinessTypes('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Business types"
        subtitle="Manage categories members use for business profiles."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={Plus} label="Add business type" variant="primary" disabled={!canManage} onPress={openCreateForm} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Business types" description={notice} tone="success" /> : null}
      {!canManage ? <MobileStatusBadge status="Read only" label="Your role can review business types but cannot change them." tone="info" /> : null}

      <MobileCard compact accent={metrics.disabled > 0 ? 'orange' : 'green'}>
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: metrics.disabled > 0 ? '#C2410C' : '#15803D' }]}>
            <BriefcaseBusiness color="#FFFFFF" size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              {formatNumber(metrics.enabled)} enabled categories
            </MobileText>
            <MobileText variant="small" tone="secondary">
              {metrics.disabled > 0 ? `${formatNumber(metrics.disabled)} disabled categories are hidden from new selections.` : 'All business types are available for member profiles.'}
            </MobileText>
          </View>
          <MobileStatusBadge status={metrics.disabled > 0 ? 'Review' : 'Active'} tone={metrics.disabled > 0 ? 'warning' : 'success'} />
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Total" value={formatNumber(metrics.total)} description="Business types" icon={BriefcaseBusiness} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Enabled" value={formatNumber(metrics.enabled)} description="Visible options" icon={ToggleRight} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Disabled" value={formatNumber(metrics.disabled)} description="Hidden options" icon={EyeOff} tone={metrics.disabled > 0 ? 'orange' : 'slate'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Values" value={formatNumber(metrics.generatedValues)} description="Generated keys" icon={Search} tone="purple" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search display name or generated value..." />
      <MobileStatusTabs tabs={tabs} value={filter} onChange={(value) => setFilter(value as BusinessTypeFilter)} />

      {listItems.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const businessType = filteredTypes.find((candidate) => candidate.id === item.id);
            if (businessType) setSelectedType(businessType);
          }}
        />
      ) : (
        <MobileEmptyState
          title={businessTypes.length ? 'No business types match this view' : 'No business types configured'}
          description={businessTypes.length ? 'Clear search or status filters to see more business types.' : 'Add categories such as Equipment Supply or Food Vendor for member profiles.'}
          actionLabel={canManage ? 'Add business type' : undefined}
          onAction={canManage ? openCreateForm : undefined}
        />
      )}

      <BusinessTypeDetailSheet
        item={selectedType}
        canManage={canManage}
        onClose={() => setSelectedType(null)}
        onEdit={openEditForm}
        onToggle={(item) => setConfirmAction({ type: 'toggle', item })}
        onDelete={(item) => setConfirmAction({ type: 'delete', item })}
      />

      <MobileSheet
        visible={Boolean(formSheet)}
        title={formSheet?.mode === 'edit' ? 'Edit business type' : 'Add business type'}
        description={formSheet?.mode === 'edit' ? 'Update the display name. The generated value changes to match.' : 'Create a category members can select in business profiles.'}
        onClose={closeForm}
      >
        <MobileFormSection title="Business type" description="Use a short, user-facing label. Nane automatically generates the system value.">
          <MobileTextInput
            label="Display name *"
            value={displayName}
            onChangeText={(value) => {
              setDisplayName(value);
              if (formError) setFormError(null);
            }}
            placeholder="Equipment Supply"
            error={formError || undefined}
            icon={BriefcaseBusiness}
            disabled={saving}
          />
          <MobileInfoRow label="Generated value" value={displayName.trim() ? formatBusinessTypeValue(displayName) : 'Waiting for display name'} icon={Search} />
          <MobileButton label={formSheet?.mode === 'edit' ? 'Save changes' : 'Add business type'} icon={Save} loading={saving} disabled={saving || !canManage} fullWidth onPress={() => void saveBusinessType()} />
        </MobileFormSection>
      </MobileSheet>

      <MobileConfirmSheet
        visible={Boolean(confirmAction)}
        title={confirmAction?.type === 'delete' ? 'Delete business type?' : confirmAction?.item.enabled ? 'Disable business type?' : 'Enable business type?'}
        description={
          confirmAction?.type === 'delete'
            ? `This will permanently remove ${confirmAction.item.displayName}. Existing member records may still reference the old value.`
            : confirmAction?.item.enabled
              ? `${confirmAction.item.displayName} will be hidden from new member profile selections.`
              : `${confirmAction?.item.displayName || 'This business type'} will become available for member profile selections.`
        }
        confirmLabel={confirmAction?.type === 'delete' ? 'Delete' : confirmAction?.item.enabled ? 'Disable' : 'Enable'}
        destructive={confirmAction?.type === 'delete'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runConfirmAction()}
      />
    </MobileScreen>
  );
}

type DetailProps = {
  item: BusinessType | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (item: BusinessType) => void;
  onToggle: (item: BusinessType) => void;
  onDelete: (item: BusinessType) => void;
};

function BusinessTypeDetailSheet({ item, canManage, onClose, onEdit, onToggle, onDelete }: DetailProps) {
  return (
    <MobileSheet visible={Boolean(item)} title={item?.displayName || 'Business type'} description={item?.value || 'Profile category'} onClose={onClose}>
      {item ? (
        <View style={styles.sheetContent}>
          <MobileCard compact accent={item.enabled ? 'green' : 'slate'}>
            <View style={styles.detailHeader}>
              <View style={styles.flex}>
                <MobileText variant="section" weight="bold">
                  {item.displayName || displayNameFromValue(item.value)}
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {item.value || 'No generated value'}
                </MobileText>
              </View>
              <MobileStatusBadge status={item.enabled ? 'Enabled' : 'Disabled'} tone={item.enabled ? 'success' : 'neutral'} />
            </View>
          </MobileCard>
          <MobileInfoRow label="Display name" value={item.displayName || 'Not set'} icon={BriefcaseBusiness} />
          <MobileInfoRow label="Generated value" value={item.value || 'Not set'} icon={Search} />
          <MobileInfoRow label="Availability" value={item.enabled ? 'Visible for new selections' : 'Hidden from new selections'} icon={item.enabled ? ToggleRight : ToggleLeft} status={item.enabled ? 'Enabled' : 'Disabled'} />

          {canManage ? (
            <View style={styles.sheetActions}>
              <MobileButton label="Edit" icon={Edit3} variant="secondary" onPress={() => onEdit(item)} />
              <MobileButton label={item.enabled ? 'Disable' : 'Enable'} icon={item.enabled ? ToggleLeft : ToggleRight} variant="secondary" onPress={() => onToggle(item)} />
              <MobileButton label="Delete" icon={Trash2} variant="danger" onPress={() => onDelete(item)} />
            </View>
          ) : null}
        </View>
      ) : null}
    </MobileSheet>
  );
}

function formatBusinessTypeValue(name: string) {
  return name.trim().toUpperCase().replace(/\s+/g, '_');
}

function displayNameFromValue(value?: string | null) {
  return String(value || 'Business type')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function sortBusinessTypes(a: BusinessType, b: BusinessType) {
  if (a.enabled && !b.enabled) return -1;
  if (!a.enabled && b.enabled) return 1;
  return String(a.displayName || a.value || '').localeCompare(String(b.displayName || b.value || ''));
}

function hasSettingsUpdatePermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string; systemRole?: string } | null) {
  const values = [...(user?.permissions || []), ...(user?.roles || []), user?.associationRole || '', user?.systemRole || ''].map((value) => value.toLowerCase());
  return values.some((value) => ['settings.update', 'config_write', 'platform_admin', 'association_admin', 'admin'].includes(value));
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
  sheetContent: {
    gap: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
