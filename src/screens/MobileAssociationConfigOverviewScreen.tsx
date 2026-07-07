import { router } from 'expo-router';
import {
  ClipboardList,
  FileText,
  FormInput,
  Hash,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAssociationConfig, type AssociationConfig } from '@/services/association-service';
import type { StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';

type ConfigTab = 'all' | 'documents' | 'registration' | 'custom' | 'rules' | 'settings';
type ConfigItemType = 'document' | 'registration' | 'custom' | 'rule' | 'setting';

type ConfigOverviewItem = {
  id: string;
  type: ConfigItemType;
  title: string;
  subtitle: string;
  meta: string;
  status: string;
  statusLabel?: string;
  statusTone: StatusTone;
  accent: StatusTone;
  details: Record<string, string>;
};

type ConfigField = {
  name?: string | null;
  label?: string | null;
  type?: string | null;
  required?: boolean | null;
  options?: unknown[] | null;
  subFields?: ConfigField[] | null;
  details?: ConfigField[] | null;
};

type ConfigFile = {
  name?: string | null;
  label?: string | null;
  required?: boolean | null;
};

type ConfigPage = {
  fields?: ConfigField[] | null;
  files?: ConfigFile[] | null;
};

export default function MobileAssociationConfigOverviewScreen() {
  const { activeView, associationId, user } = useAuth();
  const [config, setConfig] = useState<AssociationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<ConfigTab>('all');
  const [selectedItem, setSelectedItem] = useState<ConfigOverviewItem | null>(null);

  const editRoute = getRouteByPath('/associations/settings/associations/config');

  const loadConfig = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading configuration.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const loaded = await getAssociationConfig(associationId);
        setConfig(loaded);
      } catch (loadError) {
        setConfig(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadConfig('initial'));
  }, [loadConfig]);

  const normalized = useMemo(() => normalizeConfig(config, user?.associationType), [config, user?.associationType]);
  const allItems = useMemo(() => buildConfigItems(normalized), [normalized]);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: allItems.length },
      { value: 'documents', label: 'Docs', count: allItems.filter((item) => item.type === 'document').length },
      { value: 'registration', label: 'Reg.', count: allItems.filter((item) => item.type === 'registration').length },
      { value: 'custom', label: 'Custom', count: allItems.filter((item) => item.type === 'custom').length },
      { value: 'rules', label: 'Rules', count: allItems.filter((item) => item.type === 'rule').length },
      { value: 'settings', label: 'Keys', count: allItems.filter((item) => item.type === 'setting').length },
    ],
    [allItems],
  );

  const visibleItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return allItems.filter((item) => {
      if (activeTab === 'documents' && item.type !== 'document') return false;
      if (activeTab === 'registration' && item.type !== 'registration') return false;
      if (activeTab === 'custom' && item.type !== 'custom') return false;
      if (activeTab === 'rules' && item.type !== 'rule') return false;
      if (activeTab === 'settings' && item.type !== 'setting') return false;
      if (!query) return true;
      return [item.title, item.subtitle, item.meta, item.statusLabel, ...Object.values(item.details)]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [activeTab, allItems, searchTerm]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      visibleItems.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        meta: item.meta,
        status: item.status,
        statusLabel: item.statusLabel,
        statusTone: item.statusTone,
        accent: item.accent,
      })),
    [visibleItems],
  );

  const selectedDetails = useMemo(() => {
    if (!selectedItem) return [];
    return Object.entries(selectedItem.details).filter(([, value]) => value && value !== 'Not available');
  }, [selectedItem]);

  const openEditSettings = () => {
    if (editRoute) {
      router.push({ pathname: '/work/route-preview', params: { routeId: editRoute.id } } as never);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association configuration" description="Association configuration is available for association admin workspaces only." />;
  }

  if (loading && !config) {
    return <MobilePageLoadingState kind="dashboard" message="Loading association configuration" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Settings" title="Association configuration" subtitle="Association context unavailable" onBack={() => router.back()} />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before opening configuration." />
      </MobileScreen>
    );
  }

  if (error && !config) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Settings"
          title="Association configuration"
          subtitle="Rules, documents, and fields"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" disabled={refreshing} onPress={() => void loadConfig('refresh')} />}
        />
        <MobileErrorState title="Configuration could not load" description={error} retryLabel="Retry" onRetry={() => void loadConfig('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Association configuration"
        subtitle="Rules, documents, and member fields."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={RefreshCw} label="Refresh configuration" variant="secondary" disabled={refreshing} onPress={() => void loadConfig('refresh')} />}
      />

      {error ? <MobileStatusBadge status="Refresh failed" label={error} tone="warning" /> : null}

      <MobileCard compact accent="blue">
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Settings color="#FFFFFF" size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {user?.associationName || 'Association configuration'}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {normalized.associationType} setup · {allItems.length} visible configuration item{allItems.length === 1 ? '' : 's'}
            </MobileText>
          </View>
          <MobileStatusBadge status="Active" label={normalized.configId ? 'Loaded' : 'No ID'} tone={normalized.configId ? 'success' : 'warning'} />
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Documents" value={`${normalized.requiredFiles.length}`} description={`${normalized.requiredFiles.filter((file) => file.required).length} required`} icon={FileText} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Registration" value={`${normalized.registrationFields.length}`} description="Member form fields" icon={FormInput} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Custom fields" value={`${normalized.customFields.length}`} description="Other member data" icon={UserRound} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Stored keys" value={`${normalized.storedSettings.length}`} description="Raw config entries" icon={Hash} tone="orange" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact>
        <View style={styles.actionHeader}>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold">
              Configuration overview
            </MobileText>
            <MobileText variant="small" tone="secondary">
              Review active documents, member fields, group rules, and stored settings.
            </MobileText>
          </View>
          <MobileStatusBadge status={normalized.associationType} label={normalized.associationType} tone="info" />
        </View>
        <View style={styles.actions}>
          <MobileButton label="Edit settings" icon={SlidersHorizontal} size="sm" onPress={openEditSettings} disabled={!editRoute} />
          <MobileButton label="Refresh" icon={RefreshCw} size="sm" variant="secondary" disabled={refreshing} onPress={() => void loadConfig('refresh')} />
        </View>
      </MobileCard>

      <MobileSearchToolbar value={searchTerm} onChange={setSearchTerm} placeholder="Search configuration..." />
      <MobileStatusTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as ConfigTab)} />

      {listItems.length > 0 ? (
        <MobileDataList
          items={listItems}
          onPressItem={(item) => {
            const selected = visibleItems.find((candidate) => candidate.id === item.id);
            if (selected) setSelectedItem(selected);
          }}
        />
      ) : (
        <MobileEmptyState
          title="No configuration items"
          description={searchTerm ? 'No documents, fields, or settings match your search.' : 'This association configuration has no visible items yet.'}
          actionLabel="Refresh"
          onAction={() => void loadConfig('refresh')}
        />
      )}

      <MobileSheet
        visible={Boolean(selectedItem)}
        title={selectedItem?.title || 'Configuration item'}
        description={selectedItem?.subtitle}
        onClose={() => setSelectedItem(null)}
      >
        {selectedItem ? (
          <View style={styles.sheetContent}>
            <MobileCard compact accent={toneToAccent(selectedItem.accent)}>
              <View style={styles.sheetHeader}>
                <MobileText variant="section" weight="bold" style={styles.flex}>
                  {selectedItem.title}
                </MobileText>
                <MobileStatusBadge status={selectedItem.status} label={selectedItem.statusLabel} tone={selectedItem.statusTone} />
              </View>
              <MobileText variant="small" tone="secondary">
                {selectedItem.meta}
              </MobileText>
            </MobileCard>
            {selectedDetails.map(([key, value]) => (
              <MobileInfoRow key={key} label={key} value={value} icon={ClipboardList} />
            ))}
          </View>
        ) : null}
      </MobileSheet>
    </MobileScreen>
  );
}

function normalizeConfig(config: AssociationConfig | null, fallbackAssociationType?: string | null) {
  const topLevel = asRecord(config?.settings) ?? {};
  const inner = asRecord(topLevel.settings) ?? topLevel;
  const pages = toRecordArray(inner.pages) as ConfigPage[];
  const filesFromPages = pages.flatMap((page) => toRecordArray(page.files) as ConfigFile[]);
  const fieldsFromPages = pages.flatMap((page) => toRecordArray(page.fields) as ConfigField[]);

  const requiredFiles = ((toRecordArray(inner.requiredFiles) as ConfigFile[]).length ? (toRecordArray(inner.requiredFiles) as ConfigFile[]) : filesFromPages)
    .map(normalizeFile)
    .filter((file) => file.name || file.label);

  const registrationFields = ((toRecordArray(inner.registrationFormFields) as ConfigField[]).length ? (toRecordArray(inner.registrationFormFields) as ConfigField[]) : fieldsFromPages)
    .map(normalizeField)
    .filter((field) => field.name || field.label);

  const customFields = (toRecordArray(inner.customMemberFields) as ConfigField[])
    .map(normalizeField)
    .filter((field) => field.name || field.label);

  const groupRules = asRecord(inner.groupRules) || {};
  const storedSettings = Object.entries(inner)
    .filter(([key]) => !['associationType', 'groupRules', 'requiredFiles', 'registrationFormFields', 'customMemberFields', 'pages'].includes(key))
    .map(([key, value]) => ({ key, value }));

  return {
    configId: config?.id || null,
    associationId: config?.associationId || null,
    associationType: labelFromEnum(String(topLevel.associationType || inner.associationType || fallbackAssociationType || 'GENERIC')),
    requiredFiles,
    registrationFields,
    customFields,
    groupRules,
    storedSettings,
  };
}

function buildConfigItems(normalized: ReturnType<typeof normalizeConfig>): ConfigOverviewItem[] {
  const documentItems = normalized.requiredFiles.map((file, index) => ({
    id: `document-${file.name || index}`,
    type: 'document' as const,
    title: file.label || labelFromEnum(file.name || `Document ${index + 1}`),
    subtitle: file.name || 'Registration document',
    meta: file.required ? 'Required during registration' : 'Optional registration document',
    status: file.required ? 'Required' : 'Optional',
    statusLabel: file.required ? 'Required' : 'Optional',
    statusTone: file.required ? 'warning' as StatusTone : 'info' as StatusTone,
    accent: file.required ? 'warning' as StatusTone : 'info' as StatusTone,
    details: {
      Type: 'Required document',
      Key: file.name || 'Not available',
      Label: file.label || 'Not available',
      Required: file.required ? 'Yes' : 'No',
    },
  }));

  const registrationItems = normalized.registrationFields.map((field, index) => fieldToItem(field, index, 'registration'));
  const customItems = normalized.customFields.map((field, index) => fieldToItem(field, index, 'custom'));

  const ruleItems = Object.entries(normalized.groupRules).map(([key, value]) => ({
    id: `rule-${key}`,
    type: 'rule' as const,
    title: labelFromEnum(key),
    subtitle: 'VIKOBA group rule',
    meta: formatSettingValue(value),
    status: 'Rules',
    statusLabel: 'Rule',
    statusTone: 'review' as StatusTone,
    accent: 'review' as StatusTone,
    details: {
      Type: 'Group rule',
      Key: key,
      Value: formatSettingValue(value),
    },
  }));

  const settingItems = normalized.storedSettings.map(({ key, value }) => ({
    id: `setting-${key}`,
    type: 'setting' as const,
    title: labelFromEnum(key),
    subtitle: key,
    meta: formatSettingValue(value),
    status: isEmptySetting(value) ? 'Pending' : 'Configured',
    statusLabel: isEmptySetting(value) ? 'Empty' : 'Configured',
    statusTone: isEmptySetting(value) ? 'warning' as StatusTone : 'success' as StatusTone,
    accent: isEmptySetting(value) ? 'warning' as StatusTone : 'success' as StatusTone,
    details: {
      Type: 'Stored setting',
      Key: key,
      Value: formatSettingValue(value),
    },
  }));

  return [...documentItems, ...registrationItems, ...customItems, ...ruleItems, ...settingItems];
}

function fieldToItem(field: ConfigField, index: number, type: 'registration' | 'custom'): ConfigOverviewItem {
  const title = field.label || labelFromEnum(field.name || `${type} field ${index + 1}`);
  const options = (field.options || []).map(String).filter(Boolean);
  const subFields = [...(field.subFields || []), ...(field.details || [])].map((subField) => subField.label || subField.name || 'Unnamed field');
  const fieldType = labelFromEnum(field.type || 'field');

  return {
    id: `${type}-${field.name || index}`,
    type,
    title,
    subtitle: field.name || `${labelFromEnum(type)} field`,
    meta: `${fieldType}${options.length ? ` · ${options.length} option${options.length === 1 ? '' : 's'}` : ''}`,
    status: field.required ? 'Required' : 'Optional',
    statusLabel: field.required ? 'Required' : 'Optional',
    statusTone: field.required ? 'warning' : 'info',
    accent: type === 'registration' ? 'primary' : 'review',
    details: {
      Type: type === 'registration' ? 'Registration field' : 'Custom member field',
      Key: field.name || 'Not available',
      Label: field.label || 'Not available',
      'Data type': fieldType,
      Required: field.required ? 'Yes' : 'No',
      Options: options.join(', ') || 'Not available',
      'Sub fields': subFields.join(', ') || 'Not available',
    },
  };
}

function normalizeFile(file: ConfigFile): ConfigFile {
  return {
    name: file.name || null,
    label: file.label || null,
    required: Boolean(file.required),
  };
}

function normalizeField(field: ConfigField): ConfigField {
  return {
    ...field,
    name: field.name || null,
    label: field.label || null,
    type: field.type || null,
    required: Boolean(field.required),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item))) : [];
}

function formatSettingValue(value: unknown) {
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (typeof value === 'object') return `${Object.keys(value as Record<string, unknown>).length} key${Object.keys(value as Record<string, unknown>).length === 1 ? '' : 's'}`;
  return String(value);
}

function isEmptySetting(value: unknown) {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0;
  return false;
}

function labelFromEnum(value: string) {
  return value
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length <= 3 && word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(' ') || 'Not available';
}

function toneToAccent(tone: StatusTone) {
  if (tone === 'success') return 'green';
  if (tone === 'warning') return 'orange';
  if (tone === 'danger') return 'red';
  if (tone === 'review') return 'purple';
  if (tone === 'info') return 'teal';
  return 'blue';
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
    backgroundColor: '#2563EB',
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sheetContent: {
    gap: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
});
