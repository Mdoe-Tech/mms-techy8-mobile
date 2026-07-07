import {
  BellRing,
  Clock,
  Mail,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
  MobileCheckboxRow,
  MobileConfirmSheet,
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
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import {
  getCurrentReminderConfig,
  resetCurrentReminderConfig,
  toReminderConfigUpdatePayload,
  triggerCurrentReminders,
  updateCurrentReminderConfig,
  type ReminderConfig,
  type ReminderSettings,
  type ReminderTriggerType,
} from '@/services/reminder-config-service';
import { getApiErrorMessage } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';

type ReminderTab = 'payment' | 'share' | 'loan' | 'subscription' | 'channels' | 'email';
type PendingAction = { kind: 'save' } | { kind: 'reset' } | { kind: 'trigger'; triggerType: ReminderTriggerType } | null;
type ReminderTabOption = { value: ReminderTab; label: string; count: number };

type MobileReminderConfigScreenProps = {
  initialTab?: ReminderTab;
  initialMode?: 'confirm' | 'trigger' | 'reset';
};

const frequencyOptions = [
  { label: 'Daily', value: 'DAILY' },
  { label: 'Weekly', value: 'WEEKLY' },
  { label: 'Monthly', value: 'MONTHLY' },
];

const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Swahili', value: 'sw' },
];

export default function MobileReminderConfigScreen({ initialTab, initialMode }: MobileReminderConfigScreenProps) {
  const { activeView, user } = useAuth();
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [activeTab, setActiveTab] = useState<ReminderTab>('subscription');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const handledInitialModeRef = useRef(false);

  const canManage = useMemo(() => hasReminderPermission(user), [user]);
  const isVikobaAssociation = user?.associationType === 'VIKOBA';
  const tabs = useMemo(() => reminderTabs(isVikobaAssociation), [isVikobaAssociation]);

  const loadConfig = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      if (mode === 'refresh') setNotice(null);

      try {
        const nextConfig = normalizeReminderConfig(await getCurrentReminderConfig());
        setConfig(nextConfig);
        const firstTab: ReminderTab = initialTab && tabs.some((tab) => tab.value === initialTab) ? initialTab : tabs[0]?.value || 'channels';
        setActiveTab(firstTab);
        if (mode === 'refresh') setNotice('Reminder configuration refreshed.');
      } catch (loadError) {
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [initialTab, tabs],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadConfig('initial'));
  }, [loadConfig]);

  useEffect(() => {
    if (loading || handledInitialModeRef.current || !config) return;
    handledInitialModeRef.current = true;
    if (initialMode === 'confirm') {
      void Promise.resolve().then(() => setPendingAction({ kind: 'save' }));
    } else if (initialMode === 'trigger') {
      void Promise.resolve().then(() => setPendingAction({ kind: 'trigger', triggerType: isVikobaAssociation ? 'all' : 'subscription' }));
    } else if (initialMode === 'reset') {
      void Promise.resolve().then(() => setPendingAction({ kind: 'reset' }));
    }
  }, [config, initialMode, isVikobaAssociation, loading]);

  const metrics = useMemo(() => {
    if (!config) {
      return { enabled: 0, channels: '0/2', schedule: 0, languages: 0 };
    }
    const enabled = [config.paymentReminders, config.shareReminders, config.loanReminders, config.subscriptionReminders].filter((reminder) => reminder.enabled).length;
    const channels = Number(config.notificationSettings.smsEnabled) + Number(config.notificationSettings.emailEnabled);
    return {
      enabled,
      channels: `${channels}/2`,
      schedule: config.paymentReminders.reminderSchedule?.length || 0,
      languages: config.notificationSettings.enabledLanguages?.length || 1,
    };
  }, [config]);

  const updateReminder = (key: keyof Pick<ReminderConfig, 'paymentReminders' | 'shareReminders' | 'loanReminders' | 'subscriptionReminders'>, patch: Partial<ReminderSettings>) => {
    setConfig((current) => (current ? { ...current, [key]: { ...current[key], ...patch } } : current));
    setNotice(null);
  };

  const updateEmailSettings = (patch: Partial<ReminderConfig['emailSettings']>) => {
    setConfig((current) => (current ? { ...current, emailSettings: { ...current.emailSettings, ...patch } } : current));
    setNotice(null);
  };

  const updateNotificationSettings = (patch: Partial<ReminderConfig['notificationSettings']>) => {
    setConfig((current) => (current ? { ...current, notificationSettings: { ...current.notificationSettings, ...patch } } : current));
    setNotice(null);
  };

  const requestSave = () => {
    if (!config || !canManage) return;
    const validationErrors = validateReminderConfig(config);
    if (validationErrors.length) {
      setError(validationErrors[0]);
      return;
    }
    setPendingAction({ kind: 'save' });
  };

  const executePendingAction = async () => {
    if (!pendingAction || !config || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      if (pendingAction.kind === 'save') {
        const saved = await updateCurrentReminderConfig(toReminderConfigUpdatePayload(config));
        setConfig(normalizeReminderConfig(saved));
        setNotice('Reminder configuration saved.');
      } else if (pendingAction.kind === 'reset') {
        const reset = await resetCurrentReminderConfig();
        setConfig(normalizeReminderConfig(reset));
        setNotice('Reminder configuration reset to defaults.');
      } else {
        await triggerCurrentReminders(pendingAction.triggerType);
        setNotice(`${labelForTrigger(pendingAction.triggerType)} triggered.`);
      }
      setPendingAction(null);
    } catch (actionError) {
      setError(getApiErrorMessage(actionError));
    } finally {
      setSaving(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="Reminder configuration" description="Reminder settings are available from association admin workspaces only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message="Loading reminder configuration" />;
  }

  if (!config) {
    return <MobileErrorState title="Reminder configuration issue" description={error || 'Reminder configuration could not be loaded.'} retryLabel="Reload" onRetry={() => void loadConfig('refresh')} />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Configuration"
        title="Reminder configuration"
        subtitle="Configure reminder schedules, templates, channels, and monitoring"
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Reload reminders"
            variant="secondary"
            disabled={refreshing || saving}
            onPress={() => void loadConfig('refresh')}
          />
        }
      />

      {error ? <MobileErrorState title="Reminder configuration issue" description={error} retryLabel="Reload" onRetry={() => void loadConfig('refresh')} /> : null}
      {notice ? <MobileToast title={notice} /> : null}
      {!canManage ? <MobileToast title="Read-only access" description="This account needs reminder configuration permission to update or trigger reminders." tone="warning" /> : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Enabled reminders" value={`${metrics.enabled}/4`} description="Payment, share, loan, subscription" icon={BellRing} tone={metrics.enabled ? 'green' : 'orange'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Channels" value={metrics.channels} description="SMS and email delivery" icon={Send} tone={metrics.channels === '2/2' ? 'green' : 'orange'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Payment windows" value={formatNumber(metrics.schedule)} description="Configured reminder days" icon={Clock} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Languages" value={formatNumber(metrics.languages)} description={`Default ${config.notificationSettings.defaultLanguage || config.notificationSettings.smsLanguage || 'en'}`} icon={Mail} tone="purple" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileCard compact style={styles.actionsCard}>
        <MobileText variant="section" weight="bold">
          Reminder controls
        </MobileText>
        <MobileText variant="small" tone="secondary">
          Manual triggers can send messages, so each action requires confirmation.
        </MobileText>
        <View style={styles.actions}>
          <MobileButton label="Save changes" icon={Save} loading={saving} disabled={!canManage || saving} fullWidth onPress={requestSave} />
          <MobileButton label="Reset defaults" icon={RotateCcw} variant="secondary" disabled={!canManage || saving} fullWidth onPress={() => setPendingAction({ kind: 'reset' })} />
          <MobileButton label={isVikobaAssociation ? 'Trigger all reminders' : 'Trigger subscription reminders'} icon={Clock} variant="secondary" disabled={!canManage || saving} fullWidth onPress={() => setPendingAction({ kind: 'trigger', triggerType: isVikobaAssociation ? 'all' : 'subscription' })} />
        </View>
      </MobileCard>

      <MobileStatusTabs tabs={tabs} value={activeTab} onChange={(value) => setActiveTab(value as ReminderTab)} />

      {activeTab === 'payment' ? (
        <ReminderSection
          title="Payment reminders"
          description="Configure contribution and invoice reminder timing and templates."
          value={config.paymentReminders}
          onChange={(patch) => updateReminder('paymentReminders', patch)}
          disabled={!canManage || saving}
          showDaysBefore
          scheduleHelper="Payment reminders may use multiple days before due date."
        />
      ) : null}

      {activeTab === 'share' ? (
        <ReminderSection
          title="Share reminders"
          description="Configure share purchase reminder frequency and templates."
          value={config.shareReminders}
          onChange={(patch) => updateReminder('shareReminders', patch)}
          disabled={!canManage || saving}
        />
      ) : null}

      {activeTab === 'loan' ? (
        <ReminderSection
          title="Loan reminders"
          description="Configure loan repayment reminder timing and templates."
          value={config.loanReminders}
          onChange={(patch) => updateReminder('loanReminders', patch)}
          disabled={!canManage || saving}
          showDaysBefore
        />
      ) : null}

      {activeTab === 'subscription' ? (
        <ReminderSection
          title="Subscription reminders"
          description="Configure membership renewal reminders before subscriptions expire."
          value={config.subscriptionReminders}
          onChange={(patch) => updateReminder('subscriptionReminders', patch)}
          disabled={!canManage || saving}
          showDaysBefore
          daysLabel="Days before expiry"
        />
      ) : null}

      {activeTab === 'channels' ? (
        <MobileFormSection title="Notification channels" description="Control the delivery channels and default reminder language.">
          <MobileCheckboxRow
            label="Enable SMS reminders"
            description="notifications.sms.enabled"
            checked={config.notificationSettings.smsEnabled}
            onChange={(smsEnabled) => updateNotificationSettings({ smsEnabled })}
            disabled={!canManage || saving}
          />
          <MobileCheckboxRow
            label="Enable email reminders"
            description="notifications.email.enabled"
            checked={config.notificationSettings.emailEnabled}
            onChange={(emailEnabled) => updateNotificationSettings({ emailEnabled })}
            disabled={!canManage || saving}
          />
          <MobileSelect
            label="Default language"
            value={config.notificationSettings.defaultLanguage || config.notificationSettings.smsLanguage || 'en'}
            options={languageOptions}
            onChange={(language) => updateNotificationSettings({ smsLanguage: language, defaultLanguage: language, enabledLanguages: uniqueLanguages([...(config.notificationSettings.enabledLanguages || []), language]) })}
            disabled={!canManage || saving}
            helperText={`Enabled languages: ${(config.notificationSettings.enabledLanguages || ['en']).join(', ')}`}
          />
        </MobileFormSection>
      ) : null}

      {activeTab === 'email' ? (
        <MobileFormSection title="Email monitoring" description="Configure sender identity and trial-phase BCC monitoring.">
          <MobileTextInput label="From name" value={config.emailSettings.fromName || ''} onChangeText={(fromName) => updateEmailSettings({ fromName })} icon={Mail} disabled={!canManage || saving} />
          <MobileTextInput label="From email" value={config.emailSettings.fromEmail || ''} onChangeText={(fromEmail) => updateEmailSettings({ fromEmail })} icon={Mail} keyboardType="email-address" autoCapitalize="none" disabled={!canManage || saving} />
          <MobileTextInput label="Reply-to email" value={config.emailSettings.replyToEmail || ''} onChangeText={(replyToEmail) => updateEmailSettings({ replyToEmail })} icon={Mail} keyboardType="email-address" autoCapitalize="none" disabled={!canManage || saving} />
          <MobileCheckboxRow label="Enable BCC monitoring" description="BCC reminder emails during trial monitoring." checked={config.emailSettings.bccEnabled} onChange={(bccEnabled) => updateEmailSettings({ bccEnabled })} disabled={!canManage || saving} />
          <MobileTextInput label="BCC email" value={config.emailSettings.bccEmail || ''} onChangeText={(bccEmail) => updateEmailSettings({ bccEmail })} icon={Mail} keyboardType="email-address" autoCapitalize="none" disabled={!canManage || saving} />
          <MobileInfoRow label="Last updated" value={formatDate(config.lastUpdated)} helper={config.lastUpdatedBy || 'Updated by system or current admin'} icon={Clock} />
        </MobileFormSection>
      ) : null}

      <MobileConfirmSheet
        visible={Boolean(pendingAction)}
        title={pendingActionTitle(pendingAction)}
        description={pendingActionDescription(pendingAction)}
        confirmLabel={pendingActionConfirmLabel(pendingAction)}
        loading={saving}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void executePendingAction()}
      />
    </MobileScreen>
  );
}

function ReminderSection({
  title,
  description,
  value,
  onChange,
  disabled,
  showDaysBefore,
  daysLabel = 'Days before due date',
  scheduleHelper,
}: {
  title: string;
  description: string;
  value: ReminderSettings;
  onChange: (patch: Partial<ReminderSettings>) => void;
  disabled: boolean;
  showDaysBefore?: boolean;
  daysLabel?: string;
  scheduleHelper?: string;
}) {
  return (
    <MobileFormSection title={title} description={description}>
      <MobileCheckboxRow label={`Enable ${title.toLowerCase()}`} description="Automatic reminders for eligible members." checked={value.enabled} onChange={(enabled) => onChange({ enabled })} disabled={disabled} />
      {showDaysBefore ? (
        <MobileTextInput
          label={daysLabel}
          value={String(value.daysBefore || '')}
          onChangeText={(daysBefore) => onChange({ daysBefore: Number(daysBefore.replace(/[^0-9]/g, '')) || 0 })}
          keyboardType="number-pad"
          icon={Clock}
          helperText={scheduleHelper}
          disabled={disabled}
        />
      ) : null}
      <MobileSelect label="Frequency" value={value.frequency || 'DAILY'} options={frequencyOptions} onChange={(frequency) => onChange({ frequency })} disabled={disabled} />
      {value.reminderSchedule ? (
        <MobileTextInput
          label="Reminder schedule"
          value={value.reminderSchedule.join(', ')}
          onChangeText={(input) => onChange({ reminderSchedule: parseSchedule(input) })}
          helperText="Comma-separated days before the due date, for example 30, 14, 7, 1."
          icon={Clock}
          disabled={disabled}
        />
      ) : null}
      <MobileTextInput label="Email subject" value={value.emailSubject || ''} onChangeText={(emailSubject) => onChange({ emailSubject })} icon={Mail} disabled={disabled} />
      <MobileTextInput label="Email template" value={value.emailTemplate || ''} onChangeText={(emailTemplate) => onChange({ emailTemplate })} icon={Mail} multiline numberOfLines={6} disabled={disabled} />
      <MobileTextInput label="SMS template" value={value.smsTemplate || ''} onChangeText={(smsTemplate) => onChange({ smsTemplate })} icon={Send} multiline numberOfLines={3} disabled={disabled} />
    </MobileFormSection>
  );
}

function reminderTabs(isVikobaAssociation: boolean): ReminderTabOption[] {
  const tabs: ReminderTabOption[] = isVikobaAssociation
    ? [
        { value: 'payment', label: 'Payment', count: 1 },
        { value: 'share', label: 'Share', count: 1 },
        { value: 'loan', label: 'Loan', count: 1 },
      ]
    : [{ value: 'subscription', label: 'Subscription', count: 1 }];
  return [
    ...tabs,
    { value: 'channels', label: 'Channels', count: 2 },
    { value: 'email', label: 'Email', count: 1 },
  ];
}

function normalizeReminderConfig(config: ReminderConfig): ReminderConfig {
  return {
    ...config,
    paymentReminders: normalizeReminder(config.paymentReminders, { daysBefore: 7, frequency: 'DAILY', subject: 'Payment Reminder' }),
    shareReminders: normalizeReminder(config.shareReminders, { frequency: 'WEEKLY', subject: 'Share Purchase Reminder' }),
    loanReminders: normalizeReminder(config.loanReminders, { daysBefore: 7, frequency: 'DAILY', subject: 'Loan Payment Reminder' }),
    subscriptionReminders: normalizeReminder(config.subscriptionReminders, { daysBefore: 30, frequency: 'WEEKLY', subject: 'Membership Renewal Reminder' }),
    emailSettings: {
      fromName: config.emailSettings?.fromName || '',
      fromEmail: config.emailSettings?.fromEmail || 'notifications@nane.co.tz',
      replyToEmail: config.emailSettings?.replyToEmail || '',
      bccEnabled: config.emailSettings?.bccEnabled !== false,
      bccEmail: config.emailSettings?.bccEmail || 'crm@nane.co.tz',
    },
    notificationSettings: {
      smsEnabled: config.notificationSettings?.smsEnabled !== false,
      emailEnabled: config.notificationSettings?.emailEnabled !== false,
      smsLanguage: config.notificationSettings?.smsLanguage || config.notificationSettings?.defaultLanguage || 'en',
      defaultLanguage: config.notificationSettings?.defaultLanguage || config.notificationSettings?.smsLanguage || 'en',
      enabledLanguages: uniqueLanguages(config.notificationSettings?.enabledLanguages || [config.notificationSettings?.defaultLanguage || config.notificationSettings?.smsLanguage || 'en']),
    },
  };
}

function normalizeReminder(value: ReminderSettings, fallback: { daysBefore?: number; frequency: string; subject: string }): ReminderSettings {
  return {
    enabled: value?.enabled !== false,
    daysBefore: value?.daysBefore ?? fallback.daysBefore ?? null,
    frequency: value?.frequency || fallback.frequency,
    emailSubject: value?.emailSubject || fallback.subject,
    emailTemplate: value?.emailTemplate || fallback.subject,
    smsTemplate: value?.smsTemplate || fallback.subject,
    reminderSchedule: value?.reminderSchedule || null,
    languageTemplates: value?.languageTemplates || null,
  };
}

function validateReminderConfig(config: ReminderConfig) {
  const errors: string[] = [];
  const reminders: [string, ReminderSettings][] = [
    ['Payment reminders', config.paymentReminders],
    ['Share reminders', config.shareReminders],
    ['Loan reminders', config.loanReminders],
    ['Subscription reminders', config.subscriptionReminders],
  ];
  reminders.forEach(([label, reminder]) => {
    if (reminder.daysBefore !== null && reminder.daysBefore !== undefined && (reminder.daysBefore < 1 || reminder.daysBefore > 365)) {
      errors.push(`${label}: days before must be between 1 and 365.`);
    }
    if (!reminder.frequency) errors.push(`${label}: frequency is required.`);
    if (!reminder.emailSubject?.trim()) errors.push(`${label}: email subject is required.`);
    if (!reminder.emailTemplate?.trim()) errors.push(`${label}: email template is required.`);
    if (!reminder.smsTemplate?.trim()) errors.push(`${label}: SMS template is required.`);
  });
  if (!config.emailSettings.fromName?.trim()) errors.push('Email settings: from name is required.');
  if (!isValidEmail(config.emailSettings.fromEmail)) errors.push('Email settings: from email must be valid.');
  if (config.emailSettings.replyToEmail && !isValidEmail(config.emailSettings.replyToEmail)) errors.push('Email settings: reply-to email must be valid.');
  if (config.emailSettings.bccEnabled && config.emailSettings.bccEmail && !isValidEmail(config.emailSettings.bccEmail)) errors.push('Email settings: BCC email must be valid.');
  return errors;
}

function isValidEmail(value?: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

function parseSchedule(input: string) {
  const values = input
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 365);
  return Array.from(new Set(values));
}

function uniqueLanguages(values: (string | null | undefined)[]) {
  const normalized = values.map((value) => String(value || 'en').trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set(normalized.length ? normalized : ['en']));
}

function labelForTrigger(type: ReminderTriggerType) {
  if (type === 'all') return 'All reminders';
  if (type === 'payment') return 'Payment reminders';
  if (type === 'share') return 'Share reminders';
  if (type === 'loan') return 'Loan reminders';
  return 'Subscription reminders';
}

function pendingActionTitle(action: PendingAction) {
  if (action?.kind === 'save') return 'Save reminder configuration';
  if (action?.kind === 'reset') return 'Reset reminders to defaults';
  if (action?.kind === 'trigger') return `Trigger ${labelForTrigger(action.triggerType).toLowerCase()}`;
  return 'Confirm action';
}

function pendingActionDescription(action: PendingAction) {
  if (action?.kind === 'save') return 'Apply the current reminder schedule, template, email, and channel settings.';
  if (action?.kind === 'reset') return 'This restores reminder settings to backend defaults and can change delivery behavior.';
  if (action?.kind === 'trigger') return `${labelForTrigger(action.triggerType)} can send SMS or email messages to eligible members.`;
  return 'Confirm this action.';
}

function pendingActionConfirmLabel(action: PendingAction) {
  if (action?.kind === 'save') return 'Save changes';
  if (action?.kind === 'reset') return 'Reset defaults';
  if (action?.kind === 'trigger') return 'Trigger reminders';
  return 'Confirm';
}

function hasReminderPermission(user: ReturnType<typeof useAuth>['user']) {
  if (!user) return false;
  if (user.isTechy8Admin) return true;
  const values = [...(user.permissions || []), ...(user.roles || []), user.associationRole || '', user.systemRole || '']
    .filter(Boolean)
    .map((value) => value.toLowerCase().replace(/[\s-]+/g, '_'));
  return values.some((value) => ['reminders_config_manage', 'settings.update', 'settings_update', 'admin', 'association_admin', 'system_admin'].includes(value));
}

const styles = StyleSheet.create({
  actionsCard: {
    gap: 12,
  },
  actions: {
    gap: 10,
  },
});
