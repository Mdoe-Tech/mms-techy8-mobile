import { router } from 'expo-router';
import {
  Bell,
  FileText,
  FormInput,
  Hash,
  LayoutList,
  Plus,
  RefreshCw,
  Save,
  Settings,
  SlidersHorizontal,
  Trash2,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileAmountInput,
  MobileButton,
  MobileCard,
  MobileCheckboxRow,
  MobileConfirmSheet,
  MobileEmptyState,
  MobileErrorState,
  MobileFormSection,
  MobileIconButton,
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
import {
  getPublicAssociationConfig,
  updateAssociationConfig,
  type AssociationConfig,
} from '@/services/association-service';
import { getApiErrorMessage } from '@/types/api';

type MainTab = 'builder' | 'notifications' | 'fees' | 'rules';
type FieldType = 'text' | 'textarea' | 'number' | 'yesno' | 'date' | 'dropdown' | 'radio' | 'checkbox' | 'group';
type FormType = 'INDIVIDUAL' | 'COMPANY' | 'BOTH';

type FieldDetailForm = {
  name: string;
  label: string;
  type: FieldType;
};

type FieldForm = {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  formTypes: FormType;
  options: string[];
  details: FieldDetailForm[];
  order: number;
};

type DocumentForm = {
  name: string;
  label: string;
  required: boolean;
  formTypes: FormType;
  order: number;
};

type PageForm = {
  pageNumber: number;
  title: string;
  layout: 'vertical' | 'horizontal';
  fields: FieldForm[];
  files: DocumentForm[];
};

type GroupSettingForm = {
  key: string;
  label: string;
  value: string;
  type: 'text' | 'number' | 'dropdown';
  options?: { label: string; value: string }[];
  predefined: boolean;
};

type ConfigFormState = {
  associationType: string;
  pages: PageForm[];
  notificationsSmsEnabled: boolean;
  notificationsEmailEnabled: boolean;
  registrationFeeEnabled: boolean;
  registrationFeeAmount: string;
  groupSettings: GroupSettingForm[];
};

const fieldTypeOptions = [
  { label: 'Text', value: 'text' },
  { label: 'Textarea', value: 'textarea' },
  { label: 'Number', value: 'number' },
  { label: 'Yes / No', value: 'yesno' },
  { label: 'Date', value: 'date' },
  { label: 'Dropdown', value: 'dropdown' },
  { label: 'Radio', value: 'radio' },
  { label: 'Checkbox', value: 'checkbox' },
  { label: 'Group', value: 'group' },
];

const detailFieldTypeOptions = fieldTypeOptions.filter((option) => option.value !== 'dropdown' && option.value !== 'radio' && option.value !== 'checkbox' && option.value !== 'group');

const formTypeOptions = [
  { label: 'Both individual and company', value: 'BOTH' },
  { label: 'Individual only', value: 'INDIVIDUAL' },
  { label: 'Company only', value: 'COMPANY' },
];

const layoutOptions = [
  { label: 'Vertical', value: 'vertical' },
  { label: 'Horizontal', value: 'horizontal' },
];

const frequencyOptions = [
  { label: 'Daily', value: 'DAILY' },
  { label: 'Weekly', value: 'WEEKLY' },
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Annually', value: 'ANNUALLY' },
];

const yesNoOptions = [
  { label: 'Yes', value: 'true' },
  { label: 'No', value: 'false' },
];

const fineTypeOptions = [
  { label: 'Fixed amount', value: 'AMOUNT' },
  { label: 'Percentage', value: 'PERCENTAGE' },
];

const predefinedGroupRuleKeys = new Set([
  'socialAmount',
  'socialFrequency',
  'shareValue',
  'sharePurchaseFrequency',
  'fineAmount',
  'fineType',
  'interestRate',
  'minShares',
  'finePercentage',
  'insuranceRate',
  'interestType',
  'disburseGrossAmount',
  'deductInsuranceOnDisbursement',
  'dividends.weighting',
  'dividends.minMonthsSinceJoin',
]);

const defaultGroupSettings: GroupSettingForm[] = [
  { key: 'socialAmount', label: 'Contribution amount', value: '0', type: 'number', predefined: true },
  { key: 'socialFrequency', label: 'Contribution frequency', value: 'MONTHLY', type: 'dropdown', options: frequencyOptions, predefined: true },
  { key: 'shareValue', label: 'Share value', value: '0', type: 'number', predefined: true },
  { key: 'sharePurchaseFrequency', label: 'Share purchase frequency', value: 'MONTHLY', type: 'dropdown', options: frequencyOptions, predefined: true },
  { key: 'fineAmount', label: 'Fine amount', value: '0', type: 'number', predefined: true },
  { key: 'fineType', label: 'Fine type', value: 'AMOUNT', type: 'dropdown', options: fineTypeOptions, predefined: true },
  { key: 'interestRate', label: 'Interest rate (%)', value: '0', type: 'number', predefined: true },
  { key: 'insuranceRate', label: 'Insurance rate (%)', value: '0', type: 'number', predefined: true },
  { key: 'minShares', label: 'Minimum shares', value: '0', type: 'number', predefined: true },
  { key: 'finePercentage', label: 'Fine percentage (%)', value: '0', type: 'number', predefined: true },
  {
    key: 'interestType',
    label: 'Interest type',
    value: 'SIMPLE',
    type: 'dropdown',
    options: [
      { label: 'Simple', value: 'SIMPLE' },
      { label: 'Compound', value: 'COMPOUND' },
    ],
    predefined: true,
  },
  { key: 'disburseGrossAmount', label: 'Disburse full loan amount', value: 'false', type: 'dropdown', options: yesNoOptions, predefined: true },
  { key: 'deductInsuranceOnDisbursement', label: 'Deduct insurance on disbursement', value: 'false', type: 'dropdown', options: yesNoOptions, predefined: true },
  {
    key: 'dividends.weighting',
    label: 'Dividend weighting',
    value: 'SHARE_COUNT',
    type: 'dropdown',
    options: [
      { label: 'By share count', value: 'SHARE_COUNT' },
      { label: 'By share value', value: 'SHARE_VALUE' },
      { label: 'Equally', value: 'EQUAL' },
    ],
    predefined: true,
  },
  { key: 'dividends.minMonthsSinceJoin', label: 'Dividend minimum months', value: '0', type: 'number', predefined: true },
];

type MobileAssociationConfigEditScreenProps = {
  initialTab?: MainTab;
};

export default function MobileAssociationConfigEditScreen({ initialTab = 'builder' }: MobileAssociationConfigEditScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const [config, setConfig] = useState<AssociationConfig | null>(null);
  const [innerSettings, setInnerSettings] = useState<Record<string, unknown>>({});
  const [form, setForm] = useState<ConfigFormState>(() => defaultForm());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingSave, setPendingSave] = useState<MainTab | null>(null);

  const userAssociationType = user?.associationType;
  const canUpdateSettings = useMemo(() => hasSettingsUpdatePermission(user), [user]);

  const loadConfig = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before editing settings.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const loaded = await getPublicAssociationConfig(associationId);
        const normalized = normalizeConfig(loaded, userAssociationType);
        setConfig(loaded);
        setInnerSettings(normalized.innerSettings);
        setForm(normalized.form);
      } catch (loadError) {
        setConfig(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, userAssociationType],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadConfig('initial'));
  }, [loadConfig]);

  const totals = useMemo(() => getTotals(form), [form]);
  const activeSaveLabel = activeTab === 'notifications' ? 'Save notifications' : activeTab === 'fees' ? 'Save fee' : 'Save builder';

  const requestSave = (scope: MainTab = activeTab) => {
    setNotice(null);
    setError(null);

    if (!canUpdateSettings) {
      setError('Your role cannot update association settings.');
      return;
    }

    const validationErrors = scope === 'builder' || scope === 'rules' ? validateBuilder(form) : validateSimpleSettings(form);
    if (validationErrors.length) {
      setError(validationErrors[0]);
      return;
    }

    setPendingSave(scope);
    setConfirmVisible(true);
  };

  const confirmSave = async () => {
    if (!pendingSave || !associationId) {
      setConfirmVisible(false);
      return;
    }

    setConfirmVisible(false);
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const nextInnerSettings = buildNextSettings(form, innerSettings, pendingSave);
      await updateAssociationConfig(associationId, { settings: nextInnerSettings });
      setInnerSettings(nextInnerSettings);
      setNotice(saveNotice(pendingSave));
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
      setPendingSave(null);
    }
  };

  const updateForm = (patch: Partial<ConfigFormState>) => setForm((current) => ({ ...current, ...patch }));

  const updatePage = (pageIndex: number, patch: Partial<PageForm>) => {
    setForm((current) => ({
      ...current,
      pages: current.pages.map((page, index) => (index === pageIndex ? { ...page, ...patch } : page)),
    }));
  };

  const addPage = () => {
    setForm((current) => ({
      ...current,
      pages: [
        ...current.pages,
        {
          pageNumber: current.pages.length + 1,
          title: `Page ${current.pages.length + 1}`,
          layout: 'vertical',
          fields: [],
          files: [],
        },
      ],
    }));
  };

  const removePage = (pageIndex: number) => {
    setForm((current) => ({
      ...current,
      pages: current.pages
        .filter((_, index) => index !== pageIndex)
        .map((page, index) => ({ ...page, pageNumber: index + 1 })),
    }));
  };

  const addField = (pageIndex: number) => {
    setForm((current) => ({
      ...current,
      pages: current.pages.map((page, index) =>
        index === pageIndex
          ? {
              ...page,
              fields: [
                ...page.fields,
                {
                  name: '',
                  label: '',
                  type: 'text',
                  required: false,
                  formTypes: 'BOTH',
                  options: [],
                  details: [],
                  order: page.fields.length + 1,
                },
              ],
            }
          : page,
      ),
    }));
  };

  const updateField = (pageIndex: number, fieldIndex: number, patch: Partial<FieldForm>) => {
    setForm((current) => ({
      ...current,
      pages: current.pages.map((page, index) =>
        index === pageIndex
          ? {
              ...page,
              fields: page.fields.map((field, nestedIndex) => (nestedIndex === fieldIndex ? normalizeFieldPatch(field, patch) : field)),
            }
          : page,
      ),
    }));
  };

  const removeField = (pageIndex: number, fieldIndex: number) => {
    setForm((current) => ({
      ...current,
      pages: current.pages.map((page, index) =>
        index === pageIndex
          ? {
              ...page,
              fields: page.fields.filter((_, nestedIndex) => nestedIndex !== fieldIndex).map((field, orderIndex) => ({ ...field, order: orderIndex + 1 })),
            }
          : page,
      ),
    }));
  };

  const addFieldOption = (pageIndex: number, fieldIndex: number) => {
    const field = form.pages[pageIndex]?.fields[fieldIndex];
    if (field) updateField(pageIndex, fieldIndex, { options: [...field.options, ''] });
  };

  const updateFieldOption = (pageIndex: number, fieldIndex: number, optionIndex: number, value: string) => {
    const field = form.pages[pageIndex]?.fields[fieldIndex];
    if (!field) return;
    updateField(pageIndex, fieldIndex, { options: field.options.map((option, index) => (index === optionIndex ? value : option)) });
  };

  const removeFieldOption = (pageIndex: number, fieldIndex: number, optionIndex: number) => {
    const field = form.pages[pageIndex]?.fields[fieldIndex];
    if (!field) return;
    updateField(pageIndex, fieldIndex, { options: field.options.filter((_, index) => index !== optionIndex) });
  };

  const addFieldDetail = (pageIndex: number, fieldIndex: number) => {
    const field = form.pages[pageIndex]?.fields[fieldIndex];
    if (field) updateField(pageIndex, fieldIndex, { details: [...field.details, { name: '', label: '', type: 'text' }] });
  };

  const updateFieldDetail = (pageIndex: number, fieldIndex: number, detailIndex: number, patch: Partial<FieldDetailForm>) => {
    const field = form.pages[pageIndex]?.fields[fieldIndex];
    if (!field) return;
    updateField(pageIndex, fieldIndex, {
      details: field.details.map((detail, index) => (index === detailIndex ? { ...detail, ...patch } : detail)),
    });
  };

  const removeFieldDetail = (pageIndex: number, fieldIndex: number, detailIndex: number) => {
    const field = form.pages[pageIndex]?.fields[fieldIndex];
    if (!field) return;
    updateField(pageIndex, fieldIndex, { details: field.details.filter((_, index) => index !== detailIndex) });
  };

  const addDocument = (pageIndex: number) => {
    setForm((current) => ({
      ...current,
      pages: current.pages.map((page, index) =>
        index === pageIndex
          ? {
              ...page,
              files: [
                ...page.files,
                {
                  name: '',
                  label: '',
                  required: true,
                  formTypes: 'BOTH',
                  order: page.files.length + 1,
                },
              ],
            }
          : page,
      ),
    }));
  };

  const updateDocument = (pageIndex: number, documentIndex: number, patch: Partial<DocumentForm>) => {
    setForm((current) => ({
      ...current,
      pages: current.pages.map((page, index) =>
        index === pageIndex
          ? {
              ...page,
              files: page.files.map((file, nestedIndex) => (nestedIndex === documentIndex ? { ...file, ...patch } : file)),
            }
          : page,
      ),
    }));
  };

  const removeDocument = (pageIndex: number, documentIndex: number) => {
    setForm((current) => ({
      ...current,
      pages: current.pages.map((page, index) =>
        index === pageIndex
          ? {
              ...page,
              files: page.files.filter((_, nestedIndex) => nestedIndex !== documentIndex).map((file, orderIndex) => ({ ...file, order: orderIndex + 1 })),
            }
          : page,
      ),
    }));
  };

  const updateRule = (ruleIndex: number, value: string) => {
    setForm((current) => ({
      ...current,
      groupSettings: current.groupSettings.map((setting, index) => (index === ruleIndex ? { ...setting, value } : setting)),
    }));
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Association settings" description="Association settings are available for association admin workspaces only." />;
  }

  if (loading && !config) {
    return <MobilePageLoadingState kind="form" message="Loading association settings" />;
  }

  if (!associationId) {
    return (
      <MobileScreen>
        <MobilePageHeader showLogo eyebrow="Settings" title="Association settings" subtitle="Association context unavailable" onBack={() => router.back()} />
        <MobileErrorState title="Association not selected" description="Sign in through an association account before editing settings." />
      </MobileScreen>
    );
  }

  if (error && !config) {
    return (
      <MobileScreen>
        <MobilePageHeader
          showLogo
          eyebrow="Settings"
          title="Association settings"
          subtitle="Registration builder and system settings"
          onBack={() => router.back()}
          rightAction={<MobileIconButton icon={RefreshCw} label="Retry" variant="secondary" disabled={refreshing} onPress={() => void loadConfig('refresh')} />}
        />
        <MobileErrorState title="Settings could not load" description={error} retryLabel="Retry" onRetry={() => void loadConfig('refresh')} />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="Association settings"
        subtitle="Pages, fields, documents, fees, and notifications."
        onBack={() => router.back()}
        rightAction={<MobileIconButton icon={Save} label={activeSaveLabel} variant="primary" disabled={saving || !canUpdateSettings} onPress={() => requestSave(activeTab)} />}
      />

      {error ? <MobileStatusBadge status="Failed" label={error} tone="danger" /> : null}
      {notice ? <MobileToast title="Settings saved" description={notice} tone="success" /> : null}
      {!canUpdateSettings ? <MobileStatusBadge status="Read only" label="Your role can review these settings but cannot save changes." tone="info" /> : null}

      <MobileCard compact accent="blue">
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Settings color="#FFFFFF" size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.flex}>
            <MobileText variant="section" weight="bold" numberOfLines={2}>
              {user?.associationName || 'Association settings'}
            </MobileText>
            <MobileText variant="small" tone="secondary" numberOfLines={2}>
              {labelFromEnum(form.associationType)} setup · {config?.id ? 'configuration loaded' : 'new configuration'}
            </MobileText>
          </View>
          <MobileStatusBadge status={canUpdateSettings ? 'Active' : 'Read only'} label={canUpdateSettings ? 'Editable' : 'Review'} tone={canUpdateSettings ? 'success' : 'info'} />
        </View>
      </MobileCard>

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Pages" value={`${totals.pages}`} description="Registration steps" icon={LayoutList} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Fields" value={`${totals.fields}`} description={`${totals.requiredFields} required`} icon={FormInput} tone="green" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Documents" value={`${totals.documents}`} description={`${totals.requiredDocuments} required`} icon={FileText} tone="purple" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Rules" value={`${form.groupSettings.length}`} description="Operational settings" icon={Hash} tone="orange" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as MainTab)}
        tabs={[
          { value: 'builder', label: 'Builder', count: totals.pages },
          { value: 'notifications', label: 'Notify', count: 2 },
          { value: 'fees', label: 'Fees', count: form.registrationFeeEnabled ? 1 : 0 },
          { value: 'rules', label: 'Rules', count: form.groupSettings.length },
        ]}
      />

      {activeTab === 'builder' ? (
        <BuilderTab
          canEdit={canUpdateSettings && !saving}
          form={form}
          addPage={addPage}
          removePage={removePage}
          updatePage={updatePage}
          addField={addField}
          updateField={updateField}
          removeField={removeField}
          addFieldOption={addFieldOption}
          updateFieldOption={updateFieldOption}
          removeFieldOption={removeFieldOption}
          addFieldDetail={addFieldDetail}
          updateFieldDetail={updateFieldDetail}
          removeFieldDetail={removeFieldDetail}
          addDocument={addDocument}
          updateDocument={updateDocument}
          removeDocument={removeDocument}
          requestSave={() => requestSave('builder')}
        />
      ) : null}

      {activeTab === 'notifications' ? (
        <MobileFormSection title="Notifications" description="Control the channels used by registration and operational reminders.">
          <MobileCheckboxRow
            label="Enable SMS reminders"
            description="Allow the association to send reminder SMS messages when configured."
            checked={form.notificationsSmsEnabled}
            onChange={(checked) => updateForm({ notificationsSmsEnabled: checked })}
            disabled={saving || !canUpdateSettings}
          />
          <MobileCheckboxRow
            label="Enable email reminders"
            description="Allow reminder and registration emails when addresses are available."
            checked={form.notificationsEmailEnabled}
            onChange={(checked) => updateForm({ notificationsEmailEnabled: checked })}
            disabled={saving || !canUpdateSettings}
          />
          <MobileButton label="Save notifications" icon={Bell} loading={saving} disabled={saving || !canUpdateSettings} fullWidth onPress={() => requestSave('notifications')} />
        </MobileFormSection>
      ) : null}

      {activeTab === 'fees' ? (
        <MobileFormSection title="Registration fee" description="Require a once-off payment before first registration is completed.">
          <MobileCheckboxRow
            label="Enable registration fee"
            description="Members will be asked to pay this fee during registration."
            checked={form.registrationFeeEnabled}
            onChange={(checked) => updateForm({ registrationFeeEnabled: checked })}
            disabled={saving || !canUpdateSettings}
          />
          <MobileAmountInput
            label="Registration fee amount"
            value={form.registrationFeeAmount}
            onChangeText={(value) => updateForm({ registrationFeeAmount: value })}
            helperText="Use 0 when no fee is required."
            error={Number(form.registrationFeeAmount || 0) < 0 ? 'Amount cannot be negative.' : undefined}
            disabled={saving || !canUpdateSettings}
          />
          <MobileButton label="Save registration fee" icon={WalletCards} loading={saving} disabled={saving || !canUpdateSettings} fullWidth onPress={() => requestSave('fees')} />
        </MobileFormSection>
      ) : null}

      {activeTab === 'rules' ? (
        <MobileFormSection title="Operational rules" description="Rules used by registration, contributions, fines, shares, and dividends.">
          {form.groupSettings.map((setting, index) => (
            <MobileCard key={setting.key} compact accent={setting.predefined ? 'orange' : 'slate'}>
              <View style={styles.ruleHeader}>
                <View style={styles.flex}>
                  <MobileText variant="body" weight="bold">
                    {setting.label}
                  </MobileText>
                  <MobileText variant="tiny" tone="secondary">
                    {setting.key}
                  </MobileText>
                </View>
                <MobileStatusBadge status={setting.predefined ? 'Configured' : 'Custom'} tone={setting.predefined ? 'success' : 'neutral'} />
              </View>
              {setting.type === 'dropdown' && setting.options ? (
                <MobileSelect label="Value" value={setting.value} options={setting.options} onChange={(value) => updateRule(index, value)} disabled={saving || !canUpdateSettings} />
              ) : setting.type === 'number' ? (
                <MobileTextInput label="Value" value={setting.value} onChangeText={(value) => updateRule(index, value)} keyboardType="decimal-pad" disabled={saving || !canUpdateSettings} />
              ) : (
                <MobileTextInput label="Value" value={setting.value} onChangeText={(value) => updateRule(index, value)} disabled={saving || !canUpdateSettings} />
              )}
            </MobileCard>
          ))}
          <MobileButton label="Save builder and rules" icon={SlidersHorizontal} loading={saving} disabled={saving || !canUpdateSettings} fullWidth onPress={() => requestSave('rules')} />
        </MobileFormSection>
      ) : null}

      <MobileConfirmSheet
        visible={confirmVisible}
        title="Save association settings?"
        description="This will update the association configuration. Existing hidden settings are preserved before the update is sent."
        confirmLabel={pendingSave === 'notifications' ? 'Save notifications' : pendingSave === 'fees' ? 'Save fee' : 'Save builder'}
        onCancel={() => {
          setConfirmVisible(false);
          setPendingSave(null);
        }}
        onConfirm={() => void confirmSave()}
      />
    </MobileScreen>
  );
}

type BuilderTabProps = {
  canEdit: boolean;
  form: ConfigFormState;
  addPage: () => void;
  removePage: (pageIndex: number) => void;
  updatePage: (pageIndex: number, patch: Partial<PageForm>) => void;
  addField: (pageIndex: number) => void;
  updateField: (pageIndex: number, fieldIndex: number, patch: Partial<FieldForm>) => void;
  removeField: (pageIndex: number, fieldIndex: number) => void;
  addFieldOption: (pageIndex: number, fieldIndex: number) => void;
  updateFieldOption: (pageIndex: number, fieldIndex: number, optionIndex: number, value: string) => void;
  removeFieldOption: (pageIndex: number, fieldIndex: number, optionIndex: number) => void;
  addFieldDetail: (pageIndex: number, fieldIndex: number) => void;
  updateFieldDetail: (pageIndex: number, fieldIndex: number, detailIndex: number, patch: Partial<FieldDetailForm>) => void;
  removeFieldDetail: (pageIndex: number, fieldIndex: number, detailIndex: number) => void;
  addDocument: (pageIndex: number) => void;
  updateDocument: (pageIndex: number, documentIndex: number, patch: Partial<DocumentForm>) => void;
  removeDocument: (pageIndex: number, documentIndex: number) => void;
  requestSave: () => void;
};

function BuilderTab({
  canEdit,
  form,
  addPage,
  removePage,
  updatePage,
  addField,
  updateField,
  removeField,
  addFieldOption,
  updateFieldOption,
  removeFieldOption,
  addFieldDetail,
  updateFieldDetail,
  removeFieldDetail,
  addDocument,
  updateDocument,
  removeDocument,
  requestSave,
}: BuilderTabProps) {
  if (!form.pages.length) {
    return (
      <MobileEmptyState
        title="No registration pages"
        description="Add at least one registration page before saving this builder."
        actionLabel="Add page"
        onAction={canEdit ? addPage : undefined}
      />
    );
  }

  return (
    <MobileFormSection title="Registration builder" description="Configure pages, member fields, and required registration documents.">
      <View style={styles.sectionActionRow}>
        <MobileButton label="Add page" icon={Plus} variant="secondary" size="sm" disabled={!canEdit} onPress={addPage} />
        <MobileButton label="Save builder" icon={Save} size="sm" disabled={!canEdit} onPress={requestSave} />
      </View>

      {form.pages.map((page, pageIndex) => (
        <MobileCard key={`page-${pageIndex}`} compact accent="blue">
          <View style={styles.cardHeader}>
            <View style={styles.flex}>
              <MobileText variant="section" weight="bold">
                Page {pageIndex + 1}
              </MobileText>
              <MobileText variant="small" tone="secondary">
                {page.fields.length} field{page.fields.length === 1 ? '' : 's'} · {page.files.length} document{page.files.length === 1 ? '' : 's'}
              </MobileText>
            </View>
            {form.pages.length > 1 ? <MobileButton label="Remove" icon={Trash2} variant="danger" size="sm" disabled={!canEdit} onPress={() => removePage(pageIndex)} /> : null}
          </View>

          <MobileTextInput
            label="Page title"
            value={page.title}
            onChangeText={(value) => updatePage(pageIndex, { title: value })}
            placeholder="Basic Information"
            disabled={!canEdit}
          />
          <MobileSelect label="Layout" value={page.layout} options={layoutOptions} onChange={(value) => updatePage(pageIndex, { layout: value as PageForm['layout'] })} disabled={!canEdit} />

          <View style={styles.subSection}>
            <View style={styles.cardHeader}>
              <View style={styles.flex}>
                <MobileText variant="body" weight="bold">
                  Member fields
                </MobileText>
                <MobileText variant="tiny" tone="secondary">
                  Data captured during registration.
                </MobileText>
              </View>
              <MobileButton label="Add field" icon={Plus} variant="secondary" size="sm" disabled={!canEdit} onPress={() => addField(pageIndex)} />
            </View>
            {page.fields.length ? (
              page.fields.map((field, fieldIndex) => (
                <FieldEditor
                  key={`field-${pageIndex}-${fieldIndex}`}
                  canEdit={canEdit}
                  field={field}
                  pageIndex={pageIndex}
                  fieldIndex={fieldIndex}
                  updateField={updateField}
                  removeField={removeField}
                  addFieldOption={addFieldOption}
                  updateFieldOption={updateFieldOption}
                  removeFieldOption={removeFieldOption}
                  addFieldDetail={addFieldDetail}
                  updateFieldDetail={updateFieldDetail}
                  removeFieldDetail={removeFieldDetail}
                />
              ))
            ) : (
              <MobileText variant="small" tone="secondary">
                No member fields on this page yet.
              </MobileText>
            )}
          </View>

          <View style={styles.subSection}>
            <View style={styles.cardHeader}>
              <View style={styles.flex}>
                <MobileText variant="body" weight="bold">
                  Required documents
                </MobileText>
                <MobileText variant="tiny" tone="secondary">
                  Files members must upload.
                </MobileText>
              </View>
              <MobileButton label="Add document" icon={Plus} variant="secondary" size="sm" disabled={!canEdit} onPress={() => addDocument(pageIndex)} />
            </View>
            {page.files.length ? (
              page.files.map((file, documentIndex) => (
                <MobileCard key={`document-${pageIndex}-${documentIndex}`} compact accent="purple">
                  <View style={styles.cardHeader}>
                    <MobileText variant="body" weight="bold" style={styles.flex}>
                      Document {documentIndex + 1}
                    </MobileText>
                    <MobileButton label="Remove" icon={Trash2} variant="danger" size="sm" disabled={!canEdit} onPress={() => removeDocument(pageIndex, documentIndex)} />
                  </View>
                  <MobileTextInput label="Document name" value={file.label} onChangeText={(value) => updateDocument(pageIndex, documentIndex, { label: value })} placeholder="ID document" disabled={!canEdit} />
                  <MobileTextInput label="Document key" value={file.name} onChangeText={(value) => updateDocument(pageIndex, documentIndex, { name: value })} placeholder={slugFromLabel(file.label)} helperText="Leave blank to generate from the name." disabled={!canEdit} />
                  <MobileSelect label="Form type" value={file.formTypes} options={formTypeOptions} onChange={(value) => updateDocument(pageIndex, documentIndex, { formTypes: value as FormType })} disabled={!canEdit} />
                  <MobileCheckboxRow label="Required document" checked={file.required} onChange={(checked) => updateDocument(pageIndex, documentIndex, { required: checked })} disabled={!canEdit} />
                </MobileCard>
              ))
            ) : (
              <MobileText variant="small" tone="secondary">
                No required documents on this page yet.
              </MobileText>
            )}
          </View>
        </MobileCard>
      ))}
    </MobileFormSection>
  );
}

type FieldEditorProps = {
  canEdit: boolean;
  field: FieldForm;
  pageIndex: number;
  fieldIndex: number;
  updateField: (pageIndex: number, fieldIndex: number, patch: Partial<FieldForm>) => void;
  removeField: (pageIndex: number, fieldIndex: number) => void;
  addFieldOption: (pageIndex: number, fieldIndex: number) => void;
  updateFieldOption: (pageIndex: number, fieldIndex: number, optionIndex: number, value: string) => void;
  removeFieldOption: (pageIndex: number, fieldIndex: number, optionIndex: number) => void;
  addFieldDetail: (pageIndex: number, fieldIndex: number) => void;
  updateFieldDetail: (pageIndex: number, fieldIndex: number, detailIndex: number, patch: Partial<FieldDetailForm>) => void;
  removeFieldDetail: (pageIndex: number, fieldIndex: number, detailIndex: number) => void;
};

function FieldEditor({
  canEdit,
  field,
  pageIndex,
  fieldIndex,
  updateField,
  removeField,
  addFieldOption,
  updateFieldOption,
  removeFieldOption,
  addFieldDetail,
  updateFieldDetail,
  removeFieldDetail,
}: FieldEditorProps) {
  const hasOptions = field.type === 'dropdown' || field.type === 'radio' || field.type === 'checkbox';

  return (
    <MobileCard compact accent="green">
      <View style={styles.cardHeader}>
        <MobileText variant="body" weight="bold" style={styles.flex}>
          Field {fieldIndex + 1}
        </MobileText>
        <MobileButton label="Remove" icon={Trash2} variant="danger" size="sm" disabled={!canEdit} onPress={() => removeField(pageIndex, fieldIndex)} />
      </View>
      <MobileTextInput label="Field name" value={field.label} onChangeText={(value) => updateField(pageIndex, fieldIndex, { label: value })} placeholder="Company name" disabled={!canEdit} />
      <MobileTextInput label="Field key" value={field.name} onChangeText={(value) => updateField(pageIndex, fieldIndex, { name: value })} placeholder={slugFromLabel(field.label)} helperText="Leave blank to generate from the field name." disabled={!canEdit} />
      <MobileSelect label="Type" value={field.type} options={fieldTypeOptions} onChange={(value) => updateField(pageIndex, fieldIndex, { type: value as FieldType })} disabled={!canEdit} />
      <MobileSelect label="Form type" value={field.formTypes} options={formTypeOptions} onChange={(value) => updateField(pageIndex, fieldIndex, { formTypes: value as FormType })} disabled={!canEdit} />
      <MobileCheckboxRow label="Required field" checked={field.required} onChange={(checked) => updateField(pageIndex, fieldIndex, { required: checked })} disabled={!canEdit} />

      {hasOptions ? (
        <View style={styles.subSection}>
          <View style={styles.cardHeader}>
            <MobileText variant="small" weight="bold" style={styles.flex}>
              Options
            </MobileText>
            <MobileButton label="Add option" icon={Plus} variant="secondary" size="sm" disabled={!canEdit} onPress={() => addFieldOption(pageIndex, fieldIndex)} />
          </View>
          {field.options.length ? (
            field.options.map((option, optionIndex) => (
              <View key={`option-${optionIndex}`} style={styles.inlineRow}>
                <View style={styles.flex}>
                  <MobileTextInput label={`Option ${optionIndex + 1}`} value={option} onChangeText={(value) => updateFieldOption(pageIndex, fieldIndex, optionIndex, value)} disabled={!canEdit} />
                </View>
                <MobileButton label="Remove" icon={Trash2} variant="ghost" size="sm" disabled={!canEdit} onPress={() => removeFieldOption(pageIndex, fieldIndex, optionIndex)} />
              </View>
            ))
          ) : (
            <MobileText variant="small" tone="secondary">
              Add at least one option for this field type.
            </MobileText>
          )}
        </View>
      ) : null}

      {field.type === 'group' ? (
        <View style={styles.subSection}>
          <View style={styles.cardHeader}>
            <MobileText variant="small" weight="bold" style={styles.flex}>
              Detail fields
            </MobileText>
            <MobileButton label="Add detail" icon={Plus} variant="secondary" size="sm" disabled={!canEdit} onPress={() => addFieldDetail(pageIndex, fieldIndex)} />
          </View>
          {field.details.length ? (
            field.details.map((detail, detailIndex) => (
              <MobileCard key={`detail-${detailIndex}`} compact>
                <View style={styles.cardHeader}>
                  <MobileText variant="small" weight="bold" style={styles.flex}>
                    Detail {detailIndex + 1}
                  </MobileText>
                  <MobileButton label="Remove" icon={Trash2} variant="danger" size="sm" disabled={!canEdit} onPress={() => removeFieldDetail(pageIndex, fieldIndex, detailIndex)} />
                </View>
                <MobileTextInput label="Detail name" value={detail.label} onChangeText={(value) => updateFieldDetail(pageIndex, fieldIndex, detailIndex, { label: value })} disabled={!canEdit} />
                <MobileSelect label="Detail type" value={detail.type} options={detailFieldTypeOptions} onChange={(value) => updateFieldDetail(pageIndex, fieldIndex, detailIndex, { type: value as FieldType })} disabled={!canEdit} />
              </MobileCard>
            ))
          ) : (
            <MobileText variant="small" tone="secondary">
              No detail fields yet.
            </MobileText>
          )}
        </View>
      ) : null}
    </MobileCard>
  );
}

function defaultForm(): ConfigFormState {
  return {
    associationType: 'GENERIC',
    pages: [defaultPage()],
    notificationsSmsEnabled: true,
    notificationsEmailEnabled: true,
    registrationFeeEnabled: false,
    registrationFeeAmount: '0',
    groupSettings: defaultGroupSettings,
  };
}

function defaultPage(): PageForm {
  return {
    pageNumber: 1,
    title: 'Basic Information',
    layout: 'vertical',
    fields: [],
    files: [],
  };
}

function normalizeConfig(config: AssociationConfig | null, fallbackAssociationType?: string | null) {
  const topLevel = asRecord(config?.settings) ?? {};
  const innerSettings = asRecord(topLevel.settings) ?? topLevel;
  const pages = toRecordArray(innerSettings.pages).map(normalizePage).filter(Boolean) as PageForm[];
  const groupRules = normalizeGroupRules(asRecord(innerSettings.groupRules));

  return {
    innerSettings,
    form: {
      associationType: String(innerSettings.associationType || topLevel.associationType || fallbackAssociationType || 'GENERIC'),
      pages: pages.length ? pages : [defaultPage()],
      notificationsSmsEnabled: toBoolean(innerSettings['notifications.sms.enabled'] ?? topLevel['notifications.sms.enabled'], true),
      notificationsEmailEnabled: toBoolean(innerSettings['notifications.email.enabled'] ?? topLevel['notifications.email.enabled'], true),
      registrationFeeEnabled: toBoolean(innerSettings['registrationFee.enabled'] ?? topLevel['registrationFee.enabled'], false),
      registrationFeeAmount: stringNumber(innerSettings['registrationFee.amount'] ?? topLevel['registrationFee.amount'], '0'),
      groupSettings: mergeGroupSettings(groupRules),
    },
  };
}

function normalizePage(raw: Record<string, unknown>, index: number): PageForm {
  return {
    pageNumber: Number(raw.pageNumber || index + 1),
    title: String(raw.title || `Page ${index + 1}`),
    layout: raw.layout === 'horizontal' ? 'horizontal' : 'vertical',
    fields: toRecordArray(raw.fields).map(normalizeField).filter(Boolean) as FieldForm[],
    files: toRecordArray(raw.files).map(normalizeDocument).filter(Boolean) as DocumentForm[],
  };
}

function normalizeField(raw: Record<string, unknown>, index: number): FieldForm {
  const type = normalizeFieldType(String(raw.type || 'text'));
  return {
    name: String(raw.name || ''),
    label: String(raw.label || raw.name || ''),
    type,
    required: Boolean(raw.required),
    formTypes: normalizeFormType(raw.formTypes),
    options: Array.isArray(raw.options) ? raw.options.map(String).filter(Boolean) : [],
    details: toRecordArray(raw.subFields || raw.details).map(normalizeDetail).filter(Boolean) as FieldDetailForm[],
    order: Number(raw.order || index + 1),
  };
}

function normalizeDocument(raw: Record<string, unknown>, index: number): DocumentForm {
  return {
    name: String(raw.name || ''),
    label: String(raw.label || raw.name || ''),
    required: Boolean(raw.required),
    formTypes: normalizeFormType(raw.formTypes),
    order: Number(raw.order || index + 1),
  };
}

function normalizeDetail(raw: Record<string, unknown>): FieldDetailForm {
  return {
    name: String(raw.name || ''),
    label: String(raw.label || raw.name || ''),
    type: normalizeFieldType(String(raw.type || 'text')),
  };
}

function normalizeGroupRules(groupRules: Record<string, unknown> | null) {
  const flattened: Record<string, unknown> = {};
  if (!groupRules) return flattened;
  Object.entries(groupRules).forEach(([key, value]) => {
    if (key === 'additionalRules' && asRecord(value)) {
      Object.assign(flattened, asRecord(value));
    } else {
      flattened[key] = value;
    }
  });
  return flattened;
}

function mergeGroupSettings(groupRules: Record<string, unknown>) {
  const merged = defaultGroupSettings.map((setting) => ({
    ...setting,
    value: groupRules[setting.key] === undefined || groupRules[setting.key] === null ? setting.value : String(groupRules[setting.key]),
  }));

  Object.entries(groupRules)
    .filter(([key]) => !predefinedGroupRuleKeys.has(key))
    .forEach(([key, value]) => {
      merged.push({
        key,
        label: labelFromEnum(key),
        value: value === undefined || value === null ? '' : String(value),
        type: typeof value === 'number' ? 'number' : 'text',
        predefined: false,
      });
    });

  return merged;
}

function buildNextSettings(form: ConfigFormState, currentInner: Record<string, unknown>, scope: MainTab) {
  const next = { ...currentInner };

  if (scope === 'notifications') {
    next['notifications.sms.enabled'] = form.notificationsSmsEnabled;
    next['notifications.email.enabled'] = form.notificationsEmailEnabled;
    return next;
  }

  if (scope === 'fees') {
    next['registrationFee.enabled'] = form.registrationFeeEnabled;
    next['registrationFee.amount'] = Math.max(0, toNumber(form.registrationFeeAmount));
    return next;
  }

  next.associationType = form.associationType || 'GENERIC';
  next.pages = form.pages.map(buildPagePayload);
  next.groupRules = buildGroupRulesPayload(form.groupSettings);
  return next;
}

function buildPagePayload(page: PageForm) {
  return {
    pageNumber: page.pageNumber,
    title: page.title.trim(),
    layout: page.layout,
    fields: page.fields.map((field, index) => ({
      name: field.name.trim() || slugFromLabel(field.label),
      label: field.label.trim(),
      type: field.type === 'yesno' ? 'boolean' : field.type === 'text' ? 'string' : field.type,
      required: field.required,
      formTypes: field.formTypes,
      associationType: 'ALL',
      options: field.type === 'dropdown' || field.type === 'radio' || field.type === 'checkbox' ? field.options.map((option) => option.trim()).filter(Boolean) : undefined,
      subFields:
        field.type === 'group'
          ? field.details.map((detail) => ({
              name: detail.name.trim() || slugFromLabel(detail.label),
              label: detail.label.trim(),
              type: detail.type === 'yesno' ? 'boolean' : detail.type === 'text' ? 'string' : detail.type,
            }))
          : undefined,
      order: field.order || index + 1,
    })),
    files: page.files.map((file, index) => ({
      name: file.name.trim() || slugFromLabel(file.label),
      label: file.label.trim(),
      required: file.required,
      formTypes: file.formTypes,
      associationType: 'ALL',
      order: file.order || index + 1,
    })),
  };
}

function buildGroupRulesPayload(settings: GroupSettingForm[]) {
  const predefined: Record<string, string | number> = {};
  const additionalRules: Record<string, string | number> = {};

  settings.forEach((setting) => {
    const value = setting.type === 'number' ? toNumber(setting.value) : setting.value;
    if (setting.predefined && predefinedGroupRuleKeys.has(setting.key)) predefined[setting.key] = value;
    else additionalRules[setting.key] = value;
  });

  return Object.keys(additionalRules).length ? { ...predefined, additionalRules } : predefined;
}

function validateBuilder(form: ConfigFormState) {
  const errors: string[] = [];
  if (!form.pages.length) errors.push('Add at least one registration page.');

  form.pages.forEach((page, pageIndex) => {
    if (!page.title.trim()) errors.push(`Page ${pageIndex + 1} needs a title.`);
    page.fields.forEach((field, fieldIndex) => {
      if (!field.label.trim()) errors.push(`Field ${fieldIndex + 1} on page ${pageIndex + 1} needs a name.`);
      if ((field.type === 'dropdown' || field.type === 'radio' || field.type === 'checkbox') && !field.options.some((option) => option.trim())) {
        errors.push(`${field.label || `Field ${fieldIndex + 1}`} needs at least one option.`);
      }
      if (field.type === 'group') {
        field.details.forEach((detail, detailIndex) => {
          if (!detail.label.trim()) errors.push(`Detail ${detailIndex + 1} in ${field.label || `field ${fieldIndex + 1}`} needs a name.`);
        });
      }
    });
    page.files.forEach((file, fileIndex) => {
      if (!file.label.trim()) errors.push(`Document ${fileIndex + 1} on page ${pageIndex + 1} needs a name.`);
    });
  });

  return errors;
}

function validateSimpleSettings(form: ConfigFormState) {
  if (Number(form.registrationFeeAmount || 0) < 0) return ['Registration fee amount cannot be negative.'];
  return [];
}

function getTotals(form: ConfigFormState) {
  const fields = form.pages.reduce((sum, page) => sum + page.fields.length, 0);
  const requiredFields = form.pages.reduce((sum, page) => sum + page.fields.filter((field) => field.required).length, 0);
  const documents = form.pages.reduce((sum, page) => sum + page.files.length, 0);
  const requiredDocuments = form.pages.reduce((sum, page) => sum + page.files.filter((file) => file.required).length, 0);

  return {
    pages: form.pages.length,
    fields,
    requiredFields,
    documents,
    requiredDocuments,
  };
}

function saveNotice(scope: MainTab) {
  if (scope === 'notifications') return 'Notification settings updated.';
  if (scope === 'fees') return 'Registration fee settings updated.';
  return 'Registration builder and operational rules updated.';
}

function normalizeFieldPatch(field: FieldForm, patch: Partial<FieldForm>) {
  const next = { ...field, ...patch };
  if (patch.type && !(patch.type === 'dropdown' || patch.type === 'radio' || patch.type === 'checkbox')) next.options = [];
  if (patch.type && patch.type !== 'group') next.details = [];
  return next;
}

function normalizeFieldType(value: string): FieldType {
  if (value === 'string') return 'text';
  if (value === 'boolean') return 'yesno';
  if (['text', 'textarea', 'number', 'yesno', 'date', 'dropdown', 'radio', 'checkbox', 'group'].includes(value)) return value as FieldType;
  return 'text';
}

function normalizeFormType(value: unknown): FormType {
  return value === 'INDIVIDUAL' || value === 'COMPANY' || value === 'BOTH' ? value : 'BOTH';
}

function toBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
}

function stringNumber(value: unknown, fallback: string) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function toNumber(value: string) {
  const number = Number(String(value || '0').replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item))) : [];
}

function slugFromLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+([a-z0-9])/g, (_, char: string) => char.toUpperCase());
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
    backgroundColor: '#2563EB',
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  sectionActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  subSection: {
    gap: 10,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
});
