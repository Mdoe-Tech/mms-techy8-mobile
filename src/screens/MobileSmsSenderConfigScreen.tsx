import { router } from 'expo-router';
import {
  AlertTriangle,
  Clock3,
  MessageSquareText,
  RefreshCw,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Type,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import {
  MobileButton,
  MobileCard,
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
  MobileStatusBadge,
  MobileStatusTabs,
  MobileText,
  MobileTextInput,
  MobileToast,
} from '@/components/mobile';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getAssociationProfile } from '@/services/association-service';
import {
  createSmsSenderConfig,
  DEFAULT_ATTENDANCE_ABSENT_TEMPLATE,
  DEFAULT_ATTENDANCE_PRESENT_TEMPLATE,
  deleteSmsSenderConfig,
  getSmsSenderConfig,
  testSmsSenderConfig,
  updateSmsSenderConfig,
  type SmsSenderConfig,
} from '@/services/sms-sender-config-service';
import { type StatusTone } from '@/theme/tokens';
import { getApiErrorMessage } from '@/types/api';

type SmsSenderTab = 'configuration' | 'templates' | 'test';
type SmsSenderInitialMode = 'delete' | 'test';
type ConfirmAction = 'delete' | 'test' | null;

type SmsSenderFormState = {
  senderName: string;
  fallbackSenderName: string;
  description: string;
  attendancePresentTemplate: string;
  attendanceAbsentTemplate: string;
  testPhoneNumber: string;
  testMessage: string;
};

type MobileSmsSenderConfigScreenProps = {
  initialTab?: SmsSenderTab;
  initialMode?: SmsSenderInitialMode;
};

const senderNamePattern = /^[A-Za-z0-9 .-]+$/;
const systemFallback = 'N8NE MMS';

export default function MobileSmsSenderConfigScreen({
  initialTab,
  initialMode,
}: MobileSmsSenderConfigScreenProps) {
  const { activeView, associationId, user } = useAuth();
  const [tab, setTab] = useState<SmsSenderTab>(initialTab || 'configuration');
  const [config, setConfig] = useState<SmsSenderConfig | null>(null);
  const [associationName, setAssociationName] = useState('Association');
  const [form, setForm] = useState<SmsSenderFormState>(() => emptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const handledInitialModeRef = useRef(false);

  const canManageSmsConfig = useMemo(() => hasSmsConfigPermission(user), [user]);
  const hasPersistedConfig = Boolean(config?.id);
  const effectiveSenderName = config?.effectiveSenderName || form.fallbackSenderName || systemFallback;
  const testStatus = config?.testStatus || 'NOT_TESTED';

  const loadConfig = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!associationId) {
        setLoading(false);
        setError('Association context is required before loading SMS sender settings.');
        return;
      }

      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      if (mode === 'refresh') setNotice(null);

      try {
        const [loadedConfig, profile] = await Promise.all([
          getSmsSenderConfig(associationId),
          getAssociationProfile(associationId).catch(() => null),
        ]);
        setConfig(loadedConfig);
        setAssociationName(loadedConfig.associationName || profile?.name || 'Association');
        setForm((current) => ({
          ...formFromConfig(loadedConfig),
          testPhoneNumber: current.testPhoneNumber,
          testMessage: current.testMessage,
        }));
        setFormErrors({});
        if (mode === 'refresh') setNotice('SMS sender configuration refreshed.');
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

  useEffect(() => {
    if (loading || handledInitialModeRef.current) return;
    if (!initialMode || !hasPersistedConfig || !canManageSmsConfig) return;
    handledInitialModeRef.current = true;
    void Promise.resolve().then(() => {
      if (initialMode === 'delete') setConfirmAction('delete');
      if (initialMode === 'test') {
        setTab('test');
        setConfirmAction('test');
      }
    });
  }, [canManageSmsConfig, hasPersistedConfig, initialMode, loading]);

  const metrics = useMemo(() => {
    const customizedTemplates = [
      isCustomTemplate(form.attendancePresentTemplate, DEFAULT_ATTENDANCE_PRESENT_TEMPLATE),
      isCustomTemplate(form.attendanceAbsentTemplate, DEFAULT_ATTENDANCE_ABSENT_TEMPLATE),
    ].filter(Boolean).length;

    return {
      status: hasPersistedConfig ? (config?.enabled === false ? 'Inactive' : 'Active') : 'Default',
      senderLabel: hasPersistedConfig ? effectiveSenderName : 'System',
      testLabel: labelFromValue(testStatus),
      customizedTemplates,
    };
  }, [config?.enabled, effectiveSenderName, form.attendanceAbsentTemplate, form.attendancePresentTemplate, hasPersistedConfig, testStatus]);

  const tabs = useMemo(
    () => [
      { value: 'configuration', label: 'Config', count: hasPersistedConfig ? 1 : 0 },
      { value: 'templates', label: 'Templates', count: 2 },
      { value: 'test', label: 'Test', count: testStatus === 'SUCCESS' ? 1 : 0 },
    ],
    [hasPersistedConfig, testStatus],
  );

  const updateForm = (patch: Partial<SmsSenderFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setFormErrors({});
    setNotice(null);
  };

  const saveConfig = async () => {
    if (!associationId || !canManageSmsConfig) return;
    const errors = validateForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload = {
        senderName: form.senderName.trim(),
        fallbackSenderName: form.fallbackSenderName.trim() || systemFallback,
        enabled: true,
        description: form.description.trim(),
        attendancePresentTemplate: form.attendancePresentTemplate.trim() || DEFAULT_ATTENDANCE_PRESENT_TEMPLATE,
        attendanceAbsentTemplate: form.attendanceAbsentTemplate.trim() || DEFAULT_ATTENDANCE_ABSENT_TEMPLATE,
      };
      const saved = hasPersistedConfig
        ? await updateSmsSenderConfig(associationId, payload)
        : await createSmsSenderConfig(associationId, payload);
      setConfig(saved);
      setAssociationName(saved.associationName || associationName);
      setForm((current) => ({
        ...formFromConfig(saved),
        testPhoneNumber: current.testPhoneNumber,
        testMessage: current.testMessage,
      }));
      setNotice(hasPersistedConfig ? 'SMS sender configuration updated.' : 'SMS sender configuration created.');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async () => {
    if (!associationId || !hasPersistedConfig || !canManageSmsConfig) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await deleteSmsSenderConfig(associationId);
      setConfig(null);
      setForm((current) => ({
        ...emptyForm(form.fallbackSenderName),
        testPhoneNumber: current.testPhoneNumber,
        testMessage: current.testMessage,
      }));
      setConfirmAction(null);
      setNotice('SMS sender configuration deleted. System fallback sender will be used.');
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  };

  const sendTestSms = async () => {
    if (!associationId || !hasPersistedConfig || !canManageSmsConfig) return;
    if (!form.testPhoneNumber.trim()) {
      setFormErrors({ testPhoneNumber: 'Enter the recipient phone number with country code.' });
      setConfirmAction(null);
      return;
    }
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const tested = await testSmsSenderConfig(associationId, form.testPhoneNumber.trim(), form.testMessage.trim());
      setConfig(tested);
      setConfirmAction(null);
      setNotice('Test SMS request completed.');
    } catch (testError) {
      setError(getApiErrorMessage(testError));
    } finally {
      setTesting(false);
    }
  };

  if (activeView !== 'ADMIN') {
    return <AccessDeniedScreen title="SMS sender configuration" description="SMS sender settings are available for association admin workspaces only." />;
  }

  if (loading) {
    return <MobilePageLoadingState kind="form" message="Loading SMS sender configuration" />;
  }

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Settings"
        title="SMS sender"
        subtitle="Configure sender ID and attendance SMS templates"
        onBack={() => router.back()}
        rightAction={
          <MobileIconButton
            icon={RefreshCw}
            label="Refresh SMS sender"
            variant="secondary"
            disabled={refreshing || saving || testing}
            onPress={() => void loadConfig('refresh')}
          />
        }
      />

      {error ? <MobileErrorState title="SMS configuration issue" description={error} retryLabel="Reload" onRetry={() => void loadConfig('refresh')} /> : null}
      {notice ? <MobileToast title={notice} /> : null}
      {!canManageSmsConfig ? (
        <MobileToast title="Read-only access" description="This account needs SMS configuration permission to change sender settings." tone="warning" />
      ) : null}

      <MobileKpiGrid>
        <MobileKpiGridItem>
          <MobileKpiCard title="Effective sender" value={metrics.senderLabel} description={effectiveSenderName} icon={MessageSquareText} tone="blue" />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Configuration" value={metrics.status} description={hasPersistedConfig ? 'Custom sender saved' : 'Using system fallback'} icon={ShieldCheck} tone={hasPersistedConfig ? 'green' : 'slate'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Test status" value={metrics.testLabel} description={formatDateTime(config?.lastTested)} icon={Clock3} tone={testStatusTone(testStatus) === 'success' ? 'green' : testStatusTone(testStatus) === 'danger' ? 'red' : 'orange'} />
        </MobileKpiGridItem>
        <MobileKpiGridItem>
          <MobileKpiCard title="Templates" value={`${metrics.customizedTemplates}/2`} description="Attendance messages customized" icon={Type} tone="purple" />
        </MobileKpiGridItem>
      </MobileKpiGrid>

      <MobileStatusTabs tabs={tabs} value={tab} onChange={(value) => setTab(parseTab(value))} />

      {tab === 'configuration' ? (
        <View style={styles.stack}>
          <MobileFormSection title="Sender identity" description="Sender names must match the provider registration exactly. Maximum length is 11 characters.">
            <MobileTextInput
              label="Sender name"
              value={form.senderName}
              onChangeText={(senderName) => updateForm({ senderName })}
              placeholder="e.g. NANECOOP"
              helperText={`${form.senderName.length}/11 characters. Letters, numbers, spaces, hyphens and dots only.`}
              error={formErrors.senderName}
              maxLength={11}
              autoCapitalize="characters"
              disabled={!canManageSmsConfig || saving}
            />
            <MobileTextInput
              label="Fallback sender"
              value={form.fallbackSenderName}
              onChangeText={() => undefined}
              helperText="Fixed by the system and used if the primary sender cannot be used."
              disabled
            />
            <MobileTextInput
              label="Description"
              value={form.description}
              onChangeText={(description) => updateForm({ description })}
              placeholder="Optional note for admins"
              error={formErrors.description}
              maxLength={255}
              multiline
              numberOfLines={3}
              disabled={!canManageSmsConfig || saving}
            />
          </MobileFormSection>

          <View style={styles.actions}>
            <MobileButton
              label={hasPersistedConfig ? 'Update config' : 'Create config'}
              icon={Save}
              loading={saving}
              disabled={!canManageSmsConfig || !form.senderName.trim()}
              fullWidth
              style={styles.primaryAction}
              onPress={() => void saveConfig()}
            />
            {hasPersistedConfig ? (
              <MobileButton
                label="Delete"
                icon={Trash2}
                variant="danger"
                disabled={!canManageSmsConfig || saving || testing}
                onPress={() => setConfirmAction('delete')}
              />
            ) : null}
          </View>

          <MobileCard compact style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.flex}>
                <MobileText variant="section" weight="bold">
                  Current configuration
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {associationName}
                </MobileText>
              </View>
              <MobileStatusBadge
                status={hasPersistedConfig ? metrics.status : 'Draft'}
                label={hasPersistedConfig ? metrics.status : 'Default'}
                tone={hasPersistedConfig ? 'success' : 'neutral'}
              />
            </View>
            <MobileInfoRow label="Primary sender" value={hasPersistedConfig ? form.senderName : 'Not configured'} helper="The custom sender submitted to the SMS provider." icon={MessageSquareText} />
            <MobileInfoRow label="Effective sender" value={effectiveSenderName} helper="What the backend will use after fallback rules." icon={Settings} />
            <MobileInfoRow label="Last updated" value={formatDateTime(config?.updatedAt)} helper={hasPersistedConfig ? 'Configuration save timestamp.' : 'No custom sender has been saved yet.'} icon={Clock3} />
          </MobileCard>
        </View>
      ) : null}

      {tab === 'templates' ? (
        <View style={styles.stack}>
          <MobileCard compact accent="orange" style={styles.sectionCard}>
            <View style={styles.placeholderHeader}>
              <AlertTriangle size={18} color="#C2410C" />
              <View style={styles.flex}>
                <MobileText variant="body" weight="bold">
                  Available placeholders
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  {'{memberName}, {associationName}, {meetingTitle}, {meetingDate}, {attendanceStatus}, {fineAmount}, {fineDueDate}'}
                </MobileText>
              </View>
            </View>
          </MobileCard>

          <MobileFormSection title="Attendance SMS templates" description="These messages are sent when meeting attendance notifications are generated.">
            <MobileTextInput
              label="Members marked present"
              value={form.attendancePresentTemplate}
              onChangeText={(attendancePresentTemplate) => updateForm({ attendancePresentTemplate })}
              error={formErrors.attendancePresentTemplate}
              maxLength={1000}
              multiline
              numberOfLines={4}
              disabled={!canManageSmsConfig || saving}
            />
            <MobileTextInput
              label="Members marked absent"
              value={form.attendanceAbsentTemplate}
              onChangeText={(attendanceAbsentTemplate) => updateForm({ attendanceAbsentTemplate })}
              error={formErrors.attendanceAbsentTemplate}
              maxLength={1000}
              multiline
              numberOfLines={4}
              disabled={!canManageSmsConfig || saving}
            />
          </MobileFormSection>

          <MobileButton
            label={hasPersistedConfig ? 'Save templates' : 'Create config'}
            icon={Save}
            loading={saving}
            disabled={!canManageSmsConfig || !form.senderName.trim()}
            fullWidth
            onPress={() => void saveConfig()}
          />
        </View>
      ) : null}

      {tab === 'test' ? (
        <View style={styles.stack}>
          <MobileCard compact style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.flex}>
                <MobileText variant="section" weight="bold">
                  Test SMS
                </MobileText>
                <MobileText variant="small" tone="secondary">
                  Send one provider test message to verify the registered sender name.
                </MobileText>
              </View>
              <MobileStatusBadge status={testStatus} label={metrics.testLabel} tone={testStatusTone(testStatus)} />
            </View>
            <MobileInfoRow label="Sender used" value={effectiveSenderName} helper="Test will try the custom sender first, then fallback if provider rejects it." icon={Send} />
            <MobileInfoRow label="Last tested" value={formatDateTime(config?.lastTested)} helper="Only updates after the backend test endpoint runs." icon={Clock3} />
          </MobileCard>

          <MobileFormSection title="Recipient" description="This action can send a real SMS. Use a valid test number with country code.">
            <MobileTextInput
              label="Test phone number"
              value={form.testPhoneNumber}
              onChangeText={(testPhoneNumber) => updateForm({ testPhoneNumber })}
              placeholder="255712345678"
              keyboardType="phone-pad"
              error={formErrors.testPhoneNumber}
              disabled={!canManageSmsConfig || testing || !hasPersistedConfig}
            />
            <MobileTextInput
              label="Test message"
              value={form.testMessage}
              onChangeText={(testMessage) => updateForm({ testMessage })}
              placeholder="Test message from your association"
              disabled={!canManageSmsConfig || testing || !hasPersistedConfig}
            />
          </MobileFormSection>

          {!hasPersistedConfig ? (
            <MobileToast title="Create configuration first" description="A custom sender configuration must be saved before the test SMS endpoint can run." tone="warning" />
          ) : null}

          <MobileButton
            label="Send test SMS"
            icon={Send}
            loading={testing}
            disabled={!canManageSmsConfig || !hasPersistedConfig || !form.testPhoneNumber.trim()}
            fullWidth
            onPress={() => setConfirmAction('test')}
          />
        </View>
      ) : null}

      <MobileConfirmSheet
        visible={confirmAction === 'delete'}
        title="Delete SMS sender config"
        description="This removes the association custom sender configuration. Future SMS messages will use the system fallback sender."
        confirmLabel="Delete config"
        destructive
        loading={saving}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void deleteConfig()}
      />

      <MobileConfirmSheet
        visible={confirmAction === 'test'}
        title="Send test SMS"
        description={`Send a real test SMS to ${form.testPhoneNumber || 'the selected number'} using ${effectiveSenderName}?`}
        confirmLabel="Send SMS"
        loading={testing}
        confirmDisabled={!form.testPhoneNumber.trim()}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void sendTestSms()}
      />
    </MobileScreen>
  );
}

function emptyForm(fallbackSenderName = systemFallback): SmsSenderFormState {
  return {
    senderName: '',
    fallbackSenderName,
    description: '',
    attendancePresentTemplate: DEFAULT_ATTENDANCE_PRESENT_TEMPLATE,
    attendanceAbsentTemplate: DEFAULT_ATTENDANCE_ABSENT_TEMPLATE,
    testPhoneNumber: '',
    testMessage: '',
  };
}

function formFromConfig(config: SmsSenderConfig | null): SmsSenderFormState {
  const fallbackSenderName = config?.fallbackSenderName || config?.effectiveSenderName || systemFallback;
  return {
    senderName: config?.id ? config.senderName || '' : '',
    fallbackSenderName,
    description: config?.description || '',
    attendancePresentTemplate: config?.attendancePresentTemplate || DEFAULT_ATTENDANCE_PRESENT_TEMPLATE,
    attendanceAbsentTemplate: config?.attendanceAbsentTemplate || DEFAULT_ATTENDANCE_ABSENT_TEMPLATE,
    testPhoneNumber: '',
    testMessage: '',
  };
}

function validateForm(form: SmsSenderFormState) {
  const errors: Record<string, string> = {};
  const senderName = form.senderName.trim();
  if (!senderName) {
    errors.senderName = 'Sender name is required.';
  } else if (senderName.length < 3 || senderName.length > 11) {
    errors.senderName = 'Sender name must be between 3 and 11 characters.';
  } else if (!senderNamePattern.test(senderName)) {
    errors.senderName = 'Use letters, numbers, spaces, hyphens or dots only.';
  }
  if (form.description.length > 255) errors.description = 'Description cannot exceed 255 characters.';
  if (form.attendancePresentTemplate.length > 1000) errors.attendancePresentTemplate = 'Present template cannot exceed 1000 characters.';
  if (form.attendanceAbsentTemplate.length > 1000) errors.attendanceAbsentTemplate = 'Absent template cannot exceed 1000 characters.';
  return errors;
}

function parseTab(value: string): SmsSenderTab {
  if (value === 'templates' || value === 'test') return value;
  return 'configuration';
}

function hasSmsConfigPermission(user: { permissions?: string[]; roles?: string[]; associationRole?: string; systemRole?: string; isTechy8Admin?: boolean } | null) {
  if (!user) return false;
  if (user.isTechy8Admin) return true;
  const values = [...(user.permissions || []), ...(user.roles || []), user.associationRole || '', user.systemRole || '']
    .filter(Boolean)
    .map((value) => value.toLowerCase().replace(/[\s-]+/g, '_'));
  return values.some((value) =>
    [
      'sms_config_manage',
      'sms.sender.configuration',
      'sms_sender_configuration',
      'settings.update',
      'settings_update',
      'platform_admin',
      'association_admin',
      'admin',
      'system_admin',
    ].includes(value),
  );
}

function testStatusTone(status?: string | null): StatusTone {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'SUCCESS') return 'success';
  if (normalized === 'FAILED') return 'danger';
  if (normalized === 'PENDING') return 'warning';
  return 'neutral';
}

function labelFromValue(value?: string | null) {
  return String(value || 'Unknown')
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not tested';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isCustomTemplate(value: string, defaultValue: string) {
  return value.trim() !== defaultValue.trim();
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
  placeholderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryAction: {
    flex: 1,
  },
});
