import { router } from 'expo-router';
import {
  BellRing,
  BellOff,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Globe2,
  Inbox,
  Landmark,
  Mail,
  Megaphone,
  MessageSquare,
  Phone,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  UserRound,
  WalletCards,
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
  MobileInfoRow,
  MobileKpiCard,
  MobileKpiGrid,
  MobileKpiGridItem,
  MobilePageHeader,
  MobilePageLoadingState,
  MobileScreen,
  MobileSearchToolbar,
  MobileSelect,
  MobileSheet,
  MobileStatusBadge,
  MobileStatusTabs,
  MobileSummaryPanel,
  MobileText,
  MobileToast,
} from '@/components/mobile';
import { getRouteByPath } from '@/navigation/route-registry';
import AccessDeniedScreen from '@/screens/AccessDeniedScreen';
import { getPublicAssociationConfig, type AssociationConfig } from '@/services/association-service';
import {
  getCurrentMemberByUserId,
  updateCurrentMemberPreferences,
  type AssociationMember,
} from '@/services/member-service';
import {
  ensurePushRegistrationAsync,
  getPushReadinessAsync,
  type PushReadiness,
} from '@/services/mobile-push-service';
import { getApiErrorMessage } from '@/types/api';
import { useNaneTheme } from '@/theme/tokens';
import { formatDate, formatNumber } from '@/utils/format';

type Notice = { title: string; description?: string; tone?: 'success' | 'info' | 'warning' | 'danger' } | null;
type SourceGroup = 'all' | 'finance' | 'community' | 'account';

type NotificationSource = {
  id: string;
  title: string;
  description: string;
  group: Exclude<SourceGroup, 'all'>;
  routePath: string;
  status: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'review' | 'neutral';
  iconLabel: string;
  actionLabel: string;
};

const notificationLanguages = [
  { value: 'en', label: 'English' },
  { value: 'sw', label: 'Swahili (Kiswahili)' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'es', label: 'Spanish' },
];

const sources: NotificationSource[] = [
  {
    id: 'payments',
    title: 'Payments and receipts',
    description: 'Review contribution receipts, pending payments, fines, and overdue items.',
    group: 'finance',
    routePath: '/member/revenue-transactions',
    status: 'Finance',
    tone: 'success',
    iconLabel: 'TZ',
    actionLabel: 'Open receipts',
  },
  {
    id: 'invoices',
    title: 'Invoices',
    description: 'Track issued invoices and payment status updates from your association.',
    group: 'finance',
    routePath: '/member/invoices',
    status: 'Billing',
    tone: 'primary',
    iconLabel: 'IN',
    actionLabel: 'Open invoices',
  },
  {
    id: 'loans',
    title: 'Loan updates',
    description: 'Check approvals, disbursements, repayments, and loan status changes.',
    group: 'finance',
    routePath: '/member/loans',
    status: 'Loans',
    tone: 'warning',
    iconLabel: 'LN',
    actionLabel: 'Open loans',
  },
  {
    id: 'wallet',
    title: 'Wallet activity',
    description: 'View wallet balances, top-ups, withdrawals, and transaction results.',
    group: 'finance',
    routePath: '/member/wallet',
    status: 'Wallet',
    tone: 'info',
    iconLabel: 'WA',
    actionLabel: 'Open wallet',
  },
  {
    id: 'events',
    title: 'Events and RSVPs',
    description: 'See event invitations, registration status, venues, and event payment actions.',
    group: 'community',
    routePath: '/member/events',
    status: 'Events',
    tone: 'review',
    iconLabel: 'EV',
    actionLabel: 'Open events',
  },
  {
    id: 'news',
    title: 'Announcements',
    description: 'Read association bulletins, news, tender announcements, and job posts.',
    group: 'community',
    routePath: '/member/news',
    status: 'News',
    tone: 'primary',
    iconLabel: 'NW',
    actionLabel: 'Open news',
  },
  {
    id: 'profile',
    title: 'Profile and documents',
    description: 'Keep contact details, security, certificates, and required documents ready.',
    group: 'account',
    routePath: '/member/profile',
    status: 'Account',
    tone: 'neutral',
    iconLabel: 'ME',
    actionLabel: 'Open profile',
  },
];

export default function MobileMemberNotificationsScreen() {
  const theme = useNaneTheme();
  const { activeView, associationId, user } = useAuth();
  const userId = user?.userId;
  const [member, setMember] = useState<AssociationMember | null>(null);
  const [associationConfig, setAssociationConfig] = useState<AssociationConfig | null>(null);
  const [smsLanguage, setSmsLanguage] = useState('en');
  const [savedSmsLanguage, setSavedSmsLanguage] = useState('en');
  const [tab, setTab] = useState<SourceGroup>('all');
  const [query, setQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<NotificationSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const [pushReadiness, setPushReadiness] = useState<PushReadiness | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const loadCenter = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!userId) {
        setLoading(false);
        setError('Member session is missing the user identifier.');
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const currentMember = await getCurrentMemberByUserId(userId);
        setMember(currentMember);

        const savedLanguage = normalizeLanguage(currentMember.customAttributes?.['sms.language']) || 'en';
        setSmsLanguage(savedLanguage);
        setSavedSmsLanguage(savedLanguage);

        const effectiveAssociationId = currentMember.associationId || associationId;
        if (effectiveAssociationId) {
          try {
            setAssociationConfig(await getPublicAssociationConfig(effectiveAssociationId));
          } catch {
            setAssociationConfig(null);
          }
        } else {
          setAssociationConfig(null);
        }

        if (mode === 'refresh') {
          setNotice({ title: 'Notification center refreshed', tone: 'success' });
        }
      } catch (loadError) {
        setMember(null);
        setAssociationConfig(null);
        setError(getApiErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [associationId, userId],
  );

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(() => loadCenter());
    }
  }, [activeView, loadCenter]);

  const loadPushReadiness = useCallback(async () => {
    setPushLoading(true);
    try {
      setPushReadiness(await getPushReadinessAsync());
    } catch (readinessError) {
      setPushReadiness(null);
      setNotice({
        title: 'Push status unavailable',
        description: getApiErrorMessage(readinessError),
        tone: 'warning',
      });
    } finally {
      setPushLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView === 'MEMBER') {
      void Promise.resolve().then(loadPushReadiness);
    }
  }, [activeView, loadPushReadiness]);

  const settings = useMemo(() => extractSettings(associationConfig), [associationConfig]);
  const smsEnabled = toBoolean(settings['notifications.sms.enabled'], true);
  const emailEnabled = toBoolean(settings['notifications.email.enabled'], true);
  const languageOptions = useMemo(
    () => extractNotificationLanguages(settings, savedSmsLanguage),
    [savedSmsLanguage, settings],
  );
  const readiness = useMemo(() => buildReadiness(member, smsEnabled, emailEnabled, pushReadiness), [emailEnabled, member, pushReadiness, smsEnabled]);
  const sourceSummary = useMemo(() => {
    const finance = sources.filter((source) => source.group === 'finance').length;
    const community = sources.filter((source) => source.group === 'community').length;
    const account = sources.filter((source) => source.group === 'account').length;
    return { finance, community, account, total: sources.length };
  }, []);

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: sourceSummary.total },
      { value: 'finance', label: 'Finance', count: sourceSummary.finance },
      { value: 'community', label: 'Community', count: sourceSummary.community },
      { value: 'account', label: 'Account', count: sourceSummary.account },
    ],
    [sourceSummary],
  );

  const filteredSources = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sources.filter((source) => {
      if (tab !== 'all' && source.group !== tab) return false;
      if (!needle) return true;
      return [source.title, source.description, source.group, source.status].join(' ').toLowerCase().includes(needle);
    });
  }, [query, tab]);

  const listItems = useMemo<MobileDataListItem[]>(
    () =>
      filteredSources.map((source) => ({
        id: source.id,
        title: source.title,
        subtitle: source.description,
        meta: formatGroup(source.group),
        status: source.status,
        statusTone: source.tone,
        initials: source.iconLabel,
        accent: source.tone,
      })),
    [filteredSources],
  );

  const savePreference = async () => {
    setSavingPreference(true);
    setError(null);
    setNotice(null);
    try {
      await updateCurrentMemberPreferences({ smsLanguage });
      setSavedSmsLanguage(smsLanguage);
      setNotice({ title: 'Preference saved', description: 'Your notification language was updated.', tone: 'success' });
    } catch (saveError) {
      setError(getApiErrorMessage(saveError));
    } finally {
      setSavingPreference(false);
    }
  };

  const enablePushAlerts = async () => {
    setPushSaving(true);
    setNotice(null);
    try {
      const result = await ensurePushRegistrationAsync({ user, activeView, prompt: true });
      setPushReadiness(result);
      if (result.status === 'ready') {
        setNotice({ title: 'Push alerts enabled', description: 'This device can now receive Nane alerts.', tone: 'success' });
      } else if (result.status === 'backend_unconfigured') {
        setNotice({
          title: 'Device alerts are allowed',
          description: 'The mobile app is ready. Server push registration still needs the backend endpoint.',
          tone: 'warning',
        });
      } else if (result.status === 'backend_failed') {
        setNotice({
          title: 'Device alerts are allowed',
          description: 'Nane could not confirm server push registration yet. Try again after the backend endpoint is available.',
          tone: 'warning',
        });
      } else {
        setNotice({ title: 'Push alerts need attention', description: result.message, tone: 'warning' });
      }
    } catch (pushError) {
      setNotice({
        title: 'Could not enable push alerts',
        description: getApiErrorMessage(pushError),
        tone: 'danger',
      });
    } finally {
      setPushSaving(false);
    }
  };

  if (activeView !== 'MEMBER') {
    return (
      <AccessDeniedScreen
        title="Member workspace required"
        description="Notifications are available from the member portal workspace."
      />
    );
  }

  if (loading) {
    return <MobilePageLoadingState kind="list" message="Loading notification center" />;
  }

  const selectedLanguage = languageOptions.find((option) => option.value === savedSmsLanguage)?.label || savedSmsLanguage.toUpperCase();
  const source = selectedSource;

  return (
    <MobileScreen>
      <MobilePageHeader
        showLogo
        eyebrow="Member portal"
        title="Notifications"
        subtitle={member?.membershipNumber || user?.associationName || 'Communication preferences'}
        onBack={() => router.back()}
        rightAction={
          <MobileButton
            label={refreshing ? 'Refreshing' : 'Refresh'}
            icon={RefreshCw}
            variant="secondary"
            size="sm"
            loading={refreshing}
            onPress={() => void loadCenter('refresh')}
          />
        }
      />

      {notice ? <MobileToast title={notice.title} description={notice.description} tone={notice.tone || 'success'} /> : null}
      {error ? (
        <MobileErrorState
          title="Notification center issue"
          description={error}
          retryLabel="Try again"
          onRetry={() => void loadCenter('refresh')}
        />
      ) : null}

      {member ? (
        <>
          <MobileSummaryPanel
            title="Notification readiness"
            value={`${readiness.ready} of ${readiness.total} ready`}
            description="SMS, email, and in-app member routes."
            icon={BellRing}
            tone={readiness.ready === readiness.total ? 'green' : readiness.ready > 0 ? 'orange' : 'red'}
            footer={
              <View style={styles.summaryFooter}>
                <MobileStatusBadge status={smsEnabled ? 'SMS_ENABLED' : 'SMS_OFF'} label={smsEnabled ? 'SMS enabled' : 'SMS off'} tone={smsEnabled ? 'success' : 'warning'} />
                <MobileStatusBadge status={emailEnabled ? 'EMAIL_ENABLED' : 'EMAIL_OFF'} label={emailEnabled ? 'Email enabled' : 'Email off'} tone={emailEnabled ? 'success' : 'warning'} />
                <MobileStatusBadge status="PUSH" label={pushBadgeLabel(pushReadiness)} tone={pushBadgeTone(pushReadiness)} />
              </View>
            }
          />

          <View style={styles.sourceBlock}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitle}>
                <MobileText variant="section" weight="bold">Notification sources</MobileText>
                <MobileText variant="small" tone="secondary">Open the real member areas where updates and actions live.</MobileText>
              </View>
              <SlidersHorizontal color={theme.colors.primary} size={21} />
            </View>
            <MobileSearchToolbar value={query} onChange={setQuery} placeholder="Find" />
            <MobileStatusTabs tabs={tabs} value={tab} onChange={(value) => setTab(value as SourceGroup)} />
            {listItems.length ? (
              <MobileDataList
                items={listItems}
                onPressItem={(item) => {
                  setSelectedSource(sources.find((entry) => entry.id === item.id) || null);
                }}
              />
            ) : (
              <MobileEmptyState
                title="No sources found"
                description="Adjust search or status tabs to see notification source areas."
                actionLabel="Reset"
                onAction={() => {
                  setQuery('');
                  setTab('all');
                }}
              />
            )}
          </View>

          <MobileKpiGrid>
            <MobileKpiGridItem>
              <MobileKpiCard
                title="Ready channels"
                value={formatNumber(readiness.ready)}
                description={`${readiness.total} possible channels`}
                icon={CheckCircle2}
                tone={readiness.ready === readiness.total ? 'green' : 'orange'}
              />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard
                title="Alert sources"
                value={formatNumber(sourceSummary.total)}
                description="Member self-service areas"
                icon={Inbox}
                tone="blue"
              />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard
                title="Languages"
                value={formatNumber(languageOptions.length)}
                description={selectedLanguage}
                icon={Globe2}
                tone="purple"
              />
            </MobileKpiGridItem>
            <MobileKpiGridItem>
              <MobileKpiCard
                title="Profile contact"
                value={`${readiness.contactCount}/2`}
                description="Phone and email readiness"
                icon={UserRound}
                tone={readiness.contactCount === 2 ? 'green' : 'orange'}
              />
            </MobileKpiGridItem>
          </MobileKpiGrid>

          <MobileCard compact style={styles.cardGap}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitle}>
                <MobileText variant="section" weight="bold">Delivery setup</MobileText>
                <MobileText variant="small" tone="secondary">Based on your member profile and association settings.</MobileText>
              </View>
              <MobileStatusBadge status={readiness.ready === readiness.total ? 'Ready' : 'Review'} tone={readiness.ready === readiness.total ? 'success' : 'warning'} />
            </View>
            <MobileInfoRow
              icon={Phone}
              label="SMS"
              value={member.contactInfo?.phoneNumber || 'Phone not added'}
              helper={smsEnabled ? 'Association SMS delivery is enabled.' : 'Association SMS delivery is currently off.'}
              status={readiness.smsReady ? 'Ready' : 'Review'}
            />
            <MobileInfoRow
              icon={Mail}
              label="Email"
              value={member.contactInfo?.email || user?.email || 'Email not added'}
              helper={emailEnabled ? 'Association email delivery is enabled.' : 'Association email delivery is currently off.'}
              status={readiness.emailReady ? 'Ready' : 'Review'}
            />
            <MobileInfoRow
              icon={Globe2}
              label="Preferred language"
              value={selectedLanguage}
              helper="Used for SMS and reminder wording where supported."
            />
            <MobileInfoRow
              icon={pushReadiness?.status === 'permission_denied' ? BellOff : BellRing}
              label="Push alerts"
              value={pushDeliveryValue(pushReadiness)}
              helper={pushReadiness?.message || 'Check whether this phone can receive instant Nane alerts.'}
              status={pushBadgeLabel(pushReadiness)}
            />
            <MobileInfoRow
              icon={CalendarDays}
              label="Last profile update"
              value={formatDate(member.updatedAt)}
              helper="Update your profile if contacts are outdated."
            />
          </MobileCard>

          <MobileCard compact style={styles.cardGap}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitle}>
                <MobileText variant="section" weight="bold">Phone alerts</MobileText>
                <MobileText variant="small" tone="secondary">Allow Nane to notify you about payments, approvals, reminders, and account updates.</MobileText>
              </View>
              <Smartphone color={theme.colors.primary} size={21} />
            </View>
            <MobileInfoRow
              icon={BellRing}
              label="Device permission"
              value={pushPermissionLabel(pushReadiness)}
              helper={pushReadiness?.canAskAgain === false && pushReadiness.permissionState === 'denied' ? 'Open device settings to allow notifications.' : 'Managed by this phone.'}
              status={pushBadgeLabel(pushReadiness)}
            />
            <MobileInfoRow
              icon={Smartphone}
              label="Server connection"
              value={pushReadiness?.backendConfigured ? 'Push endpoint configured' : 'Waiting for backend endpoint'}
              helper={pushReadiness?.backendConfigured ? 'This build can sync the device push token to Nane.' : 'The mobile app is ready, but the backend device-token endpoint is not configured yet.'}
              status={pushReadiness?.backendConfigured ? 'Ready' : 'Review'}
            />
            <View style={styles.pushActions}>
              <MobileButton
                label={pushSaving ? 'Enabling alerts' : pushReadiness?.permissionState === 'granted' || pushReadiness?.permissionState === 'provisional' ? 'Refresh push setup' : 'Enable push alerts'}
                icon={BellRing}
                fullWidth
                loading={pushSaving}
                disabled={pushSaving || pushLoading}
                onPress={() => void enablePushAlerts()}
              />
              <MobileButton
                label={pushLoading ? 'Checking' : 'Check status'}
                icon={RefreshCw}
                variant="secondary"
                fullWidth
                loading={pushLoading}
                disabled={pushSaving || pushLoading}
                onPress={() => void loadPushReadiness()}
              />
            </View>
          </MobileCard>

          <MobileCard compact style={styles.cardGap}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitle}>
                <MobileText variant="section" weight="bold">Language preference</MobileText>
                <MobileText variant="small" tone="secondary">Choose how member reminders should be written.</MobileText>
              </View>
              <MessageSquare color={theme.colors.primary} size={21} />
            </View>
            <MobileSelect
              label="Notification language"
              value={smsLanguage}
              options={languageOptions}
              onChange={setSmsLanguage}
              helperText="Available languages come from your association settings."
            />
            <MobileButton
              label="Save preference"
              icon={ShieldCheck}
              loading={savingPreference}
              disabled={savingPreference || smsLanguage === savedSmsLanguage}
              fullWidth
              onPress={() => void savePreference()}
            />
          </MobileCard>
        </>
      ) : null}

      <MobileSheet visible={Boolean(source)} title={source?.title || 'Notification source'} onClose={() => setSelectedSource(null)}>
        {source ? (
          <View style={styles.sheetContent}>
            <MobileSummaryPanel
              title={formatGroup(source.group)}
              value={source.status}
              description={source.description}
              icon={sourceIcon(source.id)}
              tone={sourceTone(source)}
            />
            <MobileInfoRow icon={Megaphone} label="Source type" value={formatGroup(source.group)} />
            <MobileInfoRow icon={ReceiptText} label="Member action" value={source.actionLabel} helper="This opens the real route where records and actions are available." />
            <MobileInfoRow icon={MessageSquare} label="Delivery channels" value={channelSummary(smsEnabled, emailEnabled)} />
            <View style={styles.sheetActions}>
              <MobileButton
                label={source.actionLabel}
                icon={sourceIcon(source.id)}
                fullWidth
                onPress={() => {
                  openRoute(source.routePath, member?.id);
                  setSelectedSource(null);
                }}
              />
              {member?.contactInfo?.email ? (
                <MobileButton
                  label="Email support"
                  icon={Mail}
                  variant="secondary"
                  fullWidth
                  onPress={() => {
                    void Linking.openURL(`mailto:${member.contactInfo?.email}`);
                  }}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </MobileSheet>
    </MobileScreen>
  );
}

function buildReadiness(member: AssociationMember | null, smsEnabled: boolean, emailEnabled: boolean, pushReadiness: PushReadiness | null) {
  const hasPhone = Boolean(member?.contactInfo?.phoneNumber);
  const hasEmail = Boolean(member?.contactInfo?.email);
  const smsReady = hasPhone && smsEnabled;
  const emailReady = hasEmail && emailEnabled;
  const inAppReady = true;
  const pushReady = Boolean(
    pushReadiness &&
      (pushReadiness.status === 'ready' ||
        (pushReadiness.status === 'backend_unconfigured' && pushReadiness.registration?.expoPushToken)),
  );
  return {
    smsReady,
    emailReady,
    inAppReady,
    pushReady,
    ready: Number(smsReady) + Number(emailReady) + Number(inAppReady) + Number(pushReady),
    total: 4,
    contactCount: Number(hasPhone) + Number(hasEmail),
  };
}

function pushBadgeLabel(readiness: PushReadiness | null) {
  if (!readiness) return 'Checking';
  if (readiness.status === 'ready') return 'Ready';
  if (readiness.status === 'backend_unconfigured' && readiness.registration?.expoPushToken) return 'Device ready';
  if (readiness.status === 'backend_failed' && readiness.registration?.expoPushToken) return 'Sync failed';
  if (readiness.status === 'permission_denied') return 'Blocked';
  if (readiness.status === 'device_unsupported') return 'Device only';
  return 'Review';
}

function pushBadgeTone(readiness: PushReadiness | null): 'success' | 'warning' | 'danger' | 'info' {
  if (!readiness) return 'info';
  if (readiness.status === 'ready') return 'success';
  if (readiness.status === 'permission_denied' || readiness.status === 'error') return 'danger';
  return 'warning';
}

function pushDeliveryValue(readiness: PushReadiness | null) {
  if (!readiness) return 'Checking device';
  if (readiness.status === 'ready') return 'Ready on this phone';
  if (readiness.status === 'backend_unconfigured' && readiness.registration?.expoPushToken) return 'Allowed on this phone';
  if (readiness.status === 'backend_failed' && readiness.registration?.expoPushToken) return 'Server sync failed';
  if (readiness.status === 'permission_denied') return 'Blocked on this phone';
  if (readiness.status === 'device_unsupported') return 'Physical device required';
  return 'Needs setup';
}

function pushPermissionLabel(readiness: PushReadiness | null) {
  if (!readiness) return 'Checking';
  if (readiness.permissionState === 'granted') return 'Allowed';
  if (readiness.permissionState === 'provisional') return 'Quiet alerts allowed';
  if (readiness.permissionState === 'denied') return 'Blocked';
  if (readiness.permissionState === 'unavailable') return 'Not available';
  return 'Not enabled';
}

function normalizeLanguage(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace('_', '-').toLowerCase();
  return /^[a-z]{2,8}(-[a-z0-9]{2,8})*$/i.test(normalized) ? normalized : null;
}

function extractNotificationLanguages(settings: Record<string, unknown>, currentLanguage?: string | null) {
  const rawEnabled = settings['notifications.languages.enabled'];
  const rawDefault = settings['notifications.languages.default'] || settings['sms.language'];
  const codes = new Set<string>();
  const defaultLanguage = normalizeLanguage(rawDefault);
  const savedLanguage = normalizeLanguage(currentLanguage || '');

  if (defaultLanguage) codes.add(defaultLanguage);
  if (Array.isArray(rawEnabled)) {
    rawEnabled.forEach((item) => {
      const code = normalizeLanguage(String(item));
      if (code) codes.add(code);
    });
  } else if (typeof rawEnabled === 'string') {
    rawEnabled.split(',').forEach((item) => {
      const code = normalizeLanguage(item);
      if (code) codes.add(code);
    });
  }
  if (savedLanguage) codes.add(savedLanguage);
  if (!codes.size) {
    codes.add('en');
    codes.add('sw');
  }

  return Array.from(codes).map((code) => notificationLanguages.find((language) => language.value === code) || { value: code, label: code.toUpperCase() });
}

function extractSettings(config: AssociationConfig | null) {
  const raw = config?.settings || {};
  const nested = isRecord(raw.settings) ? raw.settings : {};
  return { ...raw, ...nested };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'enabled'].includes(normalized)) return true;
    if (['false', '0', 'no', 'disabled'].includes(normalized)) return false;
  }
  return fallback;
}

function formatGroup(group: NotificationSource['group']) {
  if (group === 'finance') return 'Finance';
  if (group === 'community') return 'Community';
  return 'Account';
}

function channelSummary(smsEnabled: boolean, emailEnabled: boolean) {
  if (smsEnabled && emailEnabled) return 'SMS and email';
  if (smsEnabled) return 'SMS only';
  if (emailEnabled) return 'Email only';
  return 'In-app routes only';
}

function sourceTone(source: NotificationSource) {
  if (source.tone === 'success') return 'green';
  if (source.tone === 'warning') return 'orange';
  if (source.tone === 'danger') return 'red';
  if (source.tone === 'review') return 'purple';
  if (source.tone === 'info') return 'teal';
  if (source.tone === 'neutral') return 'slate';
  return 'blue';
}

function sourceIcon(sourceId: string) {
  if (sourceId === 'payments') return CreditCard;
  if (sourceId === 'invoices') return FileText;
  if (sourceId === 'loans') return Landmark;
  if (sourceId === 'wallet') return WalletCards;
  if (sourceId === 'events') return CalendarDays;
  if (sourceId === 'news') return BriefcaseBusiness;
  return UserRound;
}

function openRoute(path: string, memberId?: string) {
  const route = getRouteByPath(path);
  if (!route) return;
  router.push({
    pathname: '/work/route-preview',
    params: {
      routeId: route.id,
      ...(path.includes(':memberId') && memberId ? { memberId } : {}),
    },
  } as never);
}

const styles = StyleSheet.create({
  summaryFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardGap: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  sourceBlock: {
    gap: 12,
  },
  sheetContent: {
    gap: 14,
  },
  sheetActions: {
    gap: 10,
  },
  pushActions: {
    gap: 10,
  },
});
